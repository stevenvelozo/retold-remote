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

Retold Remote ships with two Dockerfiles, a `docker-compose.yml`, and a `docker-build-and-save.sh` helper. All images run the full stack (Ultravisor + Retold Remote + embedded Orator-Conversion) as a single container.

> **Running on Synology?** See the dedicated [Synology Container Manager](synology.md) guide for a step-by-step walkthrough including how to build the image on a dev machine and transfer it to the NAS.

### Quick Start (any Docker host with the source tree)

The compose file defaults to `image: retold-stack:latest` so it works on hosts that already have the image loaded. To build and run from the source tree in one go:

```bash
cd retold-remote

# Build the image and tag it as retold-stack:latest
docker build -t retold-stack:latest .

# Start the stack
MEDIA_PATH=/path/to/your/media docker compose up -d
```

Then browse to `http://localhost:7777/`. The Ultravisor coordinator web interface is at `http://localhost:54321/`.

If you'd rather have Compose build the image directly, edit `docker-compose.yml`:

```yaml
services:
  retold-stack:
    # image: retold-stack:latest    # <- comment this out
    build:                          # <- uncomment this block
      context: .
      dockerfile: Dockerfile
```

Then `docker compose up -d --build` will build and start in one step.

### Dockerfile Variants

Both images have been verified to build and run the full stack on ARM64 (Apple Silicon) and should build identically on AMD64.

| File | Measured Size | Includes | Use for |
|------|---------------|----------|---------|
| `Dockerfile` | **3.0 GB** | Everything: ffmpeg, ImageMagick, 7z, poppler, pdftk, LibreOffice, Calibre, exiftool, dcraw | Full document conversion (DOC, DOCX, RTF, ODT, WPD, MOBI, PPT, XLS, etc.) |
| `Dockerfile.slim` | **1.81 GB** | Same but without LibreOffice and Calibre | Image/video/audio/PDF/EPUB only -- no doc/docx/mobi conversion |

> **Note on audiowaveform:** Neither image installs `audiowaveform` because it is not in the default Debian repositories. Retold Remote automatically falls back to ffprobe + ffmpeg for waveform generation, which is slower but works identically. If you need the BBC `audiowaveform` tool for faster generation, add it via a custom Dockerfile step (build from source or a PPA).

### Building and Saving for Transfer

For deploying to a NAS or any host that doesn't have the source tree, use the `docker-build-and-save.sh` helper:

```bash
./docker-build-and-save.sh                # full image, host architecture
./docker-build-and-save.sh slim           # slim variant
./docker-build-and-save.sh --amd64        # cross-build for x86_64
./docker-build-and-save.sh slim --arm64   # slim + arm64
```

This produces a compressed tar file (`retold-stack-image.tar.gz` or `retold-stack-image-slim.tar.gz`) that you can copy to the target host and load with:

```bash
docker load -i retold-stack-image.tar.gz
```

Then start the stack with the included `docker-compose.yml` (which references `retold-stack:latest` by default). No source tree needed on the target host.

### macOS Gotcha: Colima needs the `buildx` plugin

`docker-build-and-save.sh` uses `docker buildx build --platform <arch> ...` so it can cross-build (and so the `--arm64` / `--amd64` flags work).  Docker Desktop ships the `buildx` plugin by default, but [Colima](https://github.com/abiosoft/colima) — the lightweight Docker Desktop replacement most macOS dev hosts use — does **not**.  If you run the script on a Colima-backed CLI without buildx, you'll see:

```text
[1/3] Building image (this may take 5-15 minutes)...
unknown flag: --platform

Usage:  docker [OPTIONS] COMMAND [ARG...]
```

That's the docker CLI failing to parse the command line because it doesn't know `buildx` is a subcommand.  Despite the error wording, **this is not an architecture problem** and Colima itself is fine — it just needs the buildx plugin installed alongside it.

**One-time fix** (Homebrew):

```bash
brew install docker-buildx

# Make the plugin discoverable to the docker CLI
mkdir -p ~/.docker/cli-plugins
ln -sfn "$(brew --prefix)/opt/docker-buildx/bin/docker-buildx" \
        ~/.docker/cli-plugins/docker-buildx

docker buildx version          # should print a version banner

# Create a builder backed by Colima's docker engine
docker buildx create --use --name colima-builder --driver docker-container
docker buildx inspect --bootstrap
```

After that, `./docker-build-and-save.sh full --arm64` (and the `--amd64` variant) work cleanly.

**For multi-arch builds on Apple Silicon**, restart Colima with the Apple Virtualization framework + Rosetta 2 so emulated x86_64 builds run reasonably fast instead of crawling under qemu:

```bash
colima stop
colima start --vm-type vz --cpu 4 --memory 8 --vz-rosetta
```

`--vz-rosetta` requires Colima 0.6+; check with `colima version`.  This gives you transparent x86_64 emulation similar to Docker Desktop's default behavior — the `--amd64` builds will then run at near-native speed under Rosetta translation rather than full CPU emulation.

### Manual Docker Run

If you prefer `docker run` over Compose:

```bash
docker build -t retold-stack .

docker run -d \
  --name retold-stack \
  -p 7777:7777 \
  -p 54321:54321 \
  -v /path/to/media:/media:ro \
  -v retold-cache:/cache \
  -v ultravisor-data:/data \
  -v retold-config:/config \
  --restart unless-stopped \
  retold-stack
```

Then browse to `http://localhost:7777/`.

### Volume Mounts

The stack uses four volume mount points. The first is your media; the other three are for persistent state:

| Container path | Purpose | Typical host mapping |
|----------------|---------|---------------------|
| `/media` | Media folder to browse (read-only) | `/path/to/media:/media:ro` |
| `/cache` | Thumbnails, frames, waveforms, conversions | Named volume `retold-cache` |
| `/data` | Ultravisor datastore + staging | Named volume `ultravisor-data` |
| `/config` | Stack config files | Named volume `retold-config` |

Inside the container, `XDG_CACHE_HOME`, `XDG_DATA_HOME`, and `XDG_CONFIG_HOME` are set to these paths so the stack launcher uses them automatically.

### Published Ports

| Port | Purpose |
|------|---------|
| **7777** | Retold Remote web UI (the main thing you browse to) |
| **54321** | Ultravisor coordinator API + web interface (optional -- useful for monitoring) |

Both are pinned to fixed ports via the `-p 7777` flag in the default CMD, overriding the usual random 7000-7999 behavior.

### Customizing the CMD

The default command launches `retold-stack` against `/media` on port 7777 with hashed filenames disabled. To override (e.g., to enable hashed filenames or change the port):

```yaml
command: ["node", "source/cli/RetoldRemote-Stack-Run.js", "/media", "-p", "7777"]
```

Remove the `--no-hash` flag to re-enable hashed filenames, or change `/media` if you mounted your media to a different path.

### Image Size Notes

- `node:20-slim` base: ~180 MB
- Full `Dockerfile` (with LibreOffice + Calibre): ~2.5 GB -- Calibre alone is ~1 GB, LibreOffice is ~600 MB
- `Dockerfile.slim`: ~1.8 GB -- drops both big dependencies
- Omit `ffmpeg` and `audiowaveform` too if you don't need video/audio processing, for a ~1 GB image

### Child Process Note

The stack launcher spawns Ultravisor as a child process using `node` and the resolved `ultravisor` bin path. This works inside Docker without any special configuration -- the child runs in the same container PID namespace and its logs are streamed through the main process's stdout with `[ultravisor]` prefixes.

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
