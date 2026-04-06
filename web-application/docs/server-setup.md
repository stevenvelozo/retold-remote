# Server Setup and Docker

## Installation

### From npm

```bash
npm install -g retold-remote
```

### From source

```bash
git clone <repo-url>
cd retold-remote
npm install
npm run build
```

The build step bundles the client-side JavaScript with Quackage and copies assets into `web-application/`.

## Running the Server

### CLI Commands

There are three bin entries provided by the `retold-remote` package:

```bash
retold-remote serve [content-path] [options]   # full form
rr serve [content-path] [options]               # short alias
retold-stack [content-path] [options]           # convenience: serve --stack
```

If `content-path` is omitted, the current directory is served.

The `retold-stack` shortcut auto-injects `serve --stack`, which spawns Ultravisor as a child process and uses XDG-style data paths. See [Stack Launcher](stack-launcher.md) for the full story.

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --port [port]` | Port to listen on | Random 7000-7999 |
| `--no-hash` | Disable hashed filename mode (use plain paths in URLs) | Hashing on |
| `-c, --cache-path [path]` | Root cache directory | `./dist/retold-cache/` (or `~/.cache/retold-remote/` in stack mode) |
| `--cache-server [url]` | URL of a remote Parime cache server | None |
| `-u, --ultravisor [url]` | Connect to an Ultravisor mesh; URL defaults to `http://localhost:54321` if omitted | None |
| `--stack` | Spawn Ultravisor as a child process and connect to it. Uses XDG-style data paths under `~/.local/share` and `~/.cache`. See [Stack Launcher](stack-launcher.md) | Off |
| `-l, --logfile [path]` | Write logs to a file (auto-generates timestamped name if path omitted) | Console only |

### Direct Node.js

```bash
node server.js [content-path]
```

Default port is `8086` when using `server.js` directly.

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP port | `8086` (server.js) or random (CLI) |
| `RETOLD_HASHED_FILENAMES` | Set to `true` to enable hashed filenames | `false` |

### Examples

```bash
# Serve current directory on a random port
retold-remote serve

# Serve a specific folder
retold-remote serve /mnt/nas/media

# CLI with custom port
retold-remote serve /mnt/nas/media -p 3000

# Plain paths in URLs (disable hashing)
retold-remote serve /mnt/nas/media --no-hash

# Custom cache location (useful for Docker volumes)
retold-remote serve /media -c /cache

# Connect to an existing Ultravisor mesh
retold-remote serve /media -u http://192.168.1.100:54321

# Full stack: spawn Ultravisor as a child process, embed Orator-Conversion,
# use XDG paths (~/.local/share/ultravisor, ~/.cache/retold-remote)
retold-stack /mnt/nas/media

# Same thing via the explicit flag
retold-remote serve --stack /mnt/nas/media
```

## Configuration

### Settings Persistence

User preferences are stored in the browser via `localStorage` under the key `retold-remote-settings`. These include:

- Theme selection
- View mode (grid or list)
- Thumbnail size (small, medium, large)
- Gallery filter and sort preferences
- Show hidden files toggle
- Autoplay video / audio toggles
- Image fit mode
- Sidebar state
- Filter presets

Settings are loaded on page load and saved whenever a preference changes.

### Server Capabilities

On startup the server probes for optional tools and reports availability at `GET /api/media/capabilities`. The Settings panel in the UI shows which tools are detected.

| Tool | Detection Method | Feature |
|------|-----------------|---------|
| **sharp** | `require('sharp')` | Image thumbnail generation |
| **ImageMagick** | `identify --version` | Fallback image thumbnails |
| **ffmpeg** | `ffmpeg -version` | Video thumbnails, frame extraction, audio waveforms |
| **ffprobe** | `ffprobe -version` | Media metadata (duration, dimensions, codec, bitrate) |
| **VLC** | macOS: `/Applications/VLC.app`; Linux: `vlc --version` | External video playback |
| **7-Zip** | `7z --help` | Archive browsing (rar, 7z, tar.*) |
| **ebook-convert** | `ebook-convert --version` (Calibre) | MOBI/AZW to EPUB conversion |

Without any optional tools the application still works: images are served directly (no thumbnails), videos play in the browser, and zip/cbz archives use native extraction via yauzl.

### Thumbnail Cache

Thumbnails are cached on disk using a SHA-256 hash of `<filepath>:<mtime>:<width>x<height>`. When the source file is modified the mtime changes, invalidating the cache entry automatically.

Default location: `./dist/retold-cache/thumbnails/`

Default thumbnail size: 200x200, format: webp.

Thumbnails are served with `Cache-Control: public, max-age=86400`.

### Hashed Filenames Mode

When enabled (`-H` flag or `RETOLD_HASHED_FILENAMES=true`), real file paths are never exposed to the browser. Instead, deterministic 10-character hex hashes derived from SHA-256 are used in URLs and API responses. The same path always produces the same hash across server restarts.

## Docker

### Using the Included Dockerfile

A `Dockerfile` is provided in the repository root:

```bash
docker build -t retold-remote .
docker run -p 8086:8086 -v /path/to/media:/media retold-remote
```

### Inline Dockerfile

If you need to create a Dockerfile from scratch, here is a complete working version:

```dockerfile
FROM node:20-slim

# Install optional tools for full functionality
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    p7zip-full \
    calibre \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Install sharp (optional image processing)
RUN npm install sharp || true

# Copy application source and built assets
COPY source/ source/
COPY web-application/ web-application/
COPY css/ css/
COPY html/ html/
COPY server.js ./

# Create cache directory
RUN mkdir -p /cache

# Default port
ENV PORT=8086

EXPOSE 8086

# Serve /media with cache at /cache
CMD ["node", "server.js", "/media"]
```

### Docker Compose

```yaml
version: "3.8"
services:
  retold-remote:
    build: .
    ports:
      - "8086:8086"
    volumes:
      - /path/to/media:/media:ro
      - retold-cache:/cache
    environment:
      - PORT=8086
    restart: unless-stopped

volumes:
  retold-cache:
```

### Docker Usage Notes

- Mount your media folder to `/media` (read-only is fine with `:ro`)
- Mount a volume to `/cache` for persistent thumbnail and frame caches
- The `node:20-slim` base keeps the image small while the `apt-get` packages add full media processing
- `calibre` is the largest optional package; omit it if you do not need MOBI/AZW ebook conversion
- `sharp` is installed separately because it has native bindings that may fail on some architectures; the `|| true` ensures the build continues without it

### Minimal Dockerfile (No Optional Tools)

If you only need basic browsing without thumbnails or media probing:

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY source/ source/
COPY web-application/ web-application/
COPY css/ css/
COPY html/ html/
COPY server.js ./

ENV PORT=8086
EXPOSE 8086

CMD ["node", "server.js", "/media"]
```

This produces an image under 200MB. Images display directly (no thumbnails), videos play in the browser, and zip/cbz archives use native extraction.

## Archive Browsing

Archives appear as navigable folders in the file browser. Clicking an archive opens it and displays its contents as if they were a regular directory.

**Supported formats:**

| Format | Tool Required |
|--------|---------------|
| `.zip`, `.cbz` | None (native yauzl) |
| `.7z`, `.rar`, `.tar`, `.tar.gz`, `.tar.bz2`, `.tar.xz`, `.tgz`, `.cbr` | 7-Zip |

Files inside archives can be viewed, thumbnailed, and probed just like regular files. Archive contents are extracted to the cache directory on demand.

## VLC Streaming

The VLC integration allows streaming media files to a VLC player running on the server machine. Press `v` in the media viewer to send the current file to VLC.

Setup instructions for macOS, Windows, and Linux are available in the Settings panel under "VLC Protocol Setup". The setup creates a `vlc://` protocol handler that opens files in VLC when triggered from the browser.

**Platform details:**
- **macOS**: Creates an AppleScript app at `/Applications/VLCProtocol.app` and registers it as a URL handler
- **Windows**: Registry entry or batch script that maps `vlc://` to the VLC executable
- **Linux**: Desktop file at `~/.local/share/applications/vlc-protocol.desktop` registered with xdg-mime
