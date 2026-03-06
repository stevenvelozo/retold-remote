# Retold Remote

A browser-based media server and NAS file explorer. Point it at a folder and browse images, videos, audio, ebooks, code, and documents through a keyboard-driven gallery interface with 15 built-in themes.

## Quick Start

```bash
npx retold-remote serve /path/to/media
```

Or with Docker:

```bash
docker build -t retold-remote .
docker run -p 8086:8086 -v /path/to/media:/media retold-remote
```

Then open `http://localhost:8086` in a browser.

## Features

- **Gallery browser** with grid and list views, thumbnail generation, and lazy loading
- **Image viewer** with three fit modes, 0.25x-8x zoom, and EXIF orientation support
- **Video viewer** with action menu, in-browser playback, VLC streaming, and frame explorer
- **Audio viewer** with waveform visualization, selection-based playback, and segment extraction
- **eBook reader** for EPUB and MOBI with table of contents and page navigation
- **Code/text viewer** with syntax highlighting for 30+ languages
- **PDF viewer** via native browser rendering
- **Archive browsing** into zip, 7z, rar, tar.gz, cbz, and cbr files as virtual folders
- **Filtering and sorting** by media type, extension, file size, date, and text search (with regex)
- **15 themes** from greyscale to retro and cyberpunk
- **Full keyboard navigation** across every mode
- **Media type override** to force any file open as image, video, audio, or text (keys 1-4)
- **Hashed filenames** mode to hide real paths from the browser
- **VLC protocol handler** setup for macOS, Windows, and Linux
- **Settings persistence** via localStorage

## Documentation

| Document | Contents |
|----------|----------|
| [Server Setup and Docker](server-setup.md) | Installation, CLI options, environment variables, configuration, Docker |
| [Image Viewer](image-viewer.md) | Fit modes, zoom, keyboard shortcuts, mouse interactions |
| [Video Viewer](video-viewer.md) | Action menu, playback, frame explorer, timeline, VLC streaming |
| [Audio Viewer](audio-viewer.md) | Waveform visualization, selection, zoom, segment playback |
| [eBook Reader](ebook-reader.md) | EPUB/MOBI support, table of contents, page navigation |

## Keyboard Shortcuts (All Modes)

### Global

| Key | Action |
|-----|--------|
| `F1` | Help panel |
| `F9` | Focus sidebar file list |
| `/` | Search / filter bar |
| `Esc` | Close overlay / go back |

### Gallery

| Key | Action |
|-----|--------|
| Arrow keys | Navigate items |
| `Enter` | Open selected item |
| `1` `2` `3` `4` | Open as image / video / audio / text |
| `Esc` | Go up one folder |
| `Home` / `End` | Jump to first / last item |
| `g` | Toggle grid / list view |
| `f` | Advanced filter panel |
| `s` | Focus sort dropdown |
| `x` | Clear all filters |
| `c` | Settings panel |
| `d` | Distraction-free mode |
| `e` | Explore video frames (video files) |
| `a` | Quick-add to active collection |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |
| `i` | Show info sidebar tab |

### Media Viewer

| Key | Action |
|-----|--------|
| `Esc` | Back to gallery |
| Right / `j` | Next file |
| Left / `k` | Previous file |
| `1` `2` `3` `4` | View as image / video / audio / text |
| `Space` | Play / pause |
| `f` | Fullscreen |
| `i` | File info overlay |
| `v` / `Enter` | Stream with VLC |
| `+` / `-` | Zoom in / out |
| `0` | Reset zoom |
| `z` | Cycle fit mode |
| `d` | Distraction-free mode |
| `e` | Open explorer (video / audio / image) |
| `a` | Quick-add to active collection |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |

### Video Action Menu

| Key | Action |
|-----|--------|
| `Space` / `Enter` | Play in browser |
| `e` | Explore video frames |
| `t` | Extract thumbnail |
| `v` | Stream with VLC |
| Right / `j` | Next file |
| Left / `k` | Previous file |
| `a` | Quick-add to active collection |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |
| `Esc` | Back to gallery |

### Video Explorer

| Key | Action |
|-----|--------|
| `Esc` | Back to video (or close frame preview) |
| `a` | Add current frame to collection |
| `s` | Add video clip (selection) to collection |
| `[` | Set selection start marker |
| `]` | Set selection end marker |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |

In the frame preview overlay:

| Key | Action |
|-----|--------|
| Left / `k` | Previous frame |
| Right / `j` | Next frame |
| `Esc` | Close preview |

### Audio Explorer

| Key | Action |
|-----|--------|
| `Space` | Play selection |
| `+` / `-` | Zoom in / out |
| `0` | Zoom to fit |
| `z` | Zoom to selection |
| `Esc` | Clear selection / back |
| `a` / `s` | Save audio snippet to collection |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |

### Image Explorer

| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom |
| `a` | Quick-add to collection |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |
| `Esc` | Back to viewer |

### Sidebar (F9)

| Key | Action |
|-----|--------|
| Up / Down | Navigate file list |
| `Home` / `End` | Jump to first / last |
| `Enter` | Open folder or select file |
| `Esc` | Return to gallery |

## Supported File Formats

### Images
png, jpg, jpeg, gif, webp, svg, bmp, ico, avif, tiff, tif, heic, heif

### Video
mp4, webm, mov, mkv, avi, wmv, flv, m4v, ogv, mpg, mpeg, mpe, mpv, m2v, ts, mts, m2ts, vob, 3gp, 3g2, f4v, rm, rmvb, divx, asf, mxf, dv, nsv, nuv, y4m, wtv, swf, dat

### Audio
mp3, wav, ogg, flac, aac, m4a, wma, oga

### Documents
pdf, epub, mobi

### Archives
zip, 7z, rar, tar, tar.gz, tar.bz2, tar.xz, tgz, cbz, cbr

### Code/Text
js, mjs, cjs, ts, tsx, jsx, py, rb, java, c, cpp, h, hpp, cs, go, rs, php, sh, bash, zsh, pl, r, swift, kt, scala, lua, json, xml, yaml, yml, toml, ini, cfg, conf, env, properties, md, markdown, txt, csv, tsv, log, html, htm, css, scss, sass, less, sql, graphql, gql, makefile, dockerfile, gitignore, editorconfig, htaccess, npmrc, eslintrc, prettierrc

## Themes

**Grey** (pure greyscale): Daylight, Afternoon, Evening, Twilight (default), Night

**Fun** (colorful): Neo-Tokyo, Cyberpunk, Hotdog, 1970s Console, 1980s Console, 1990s Web Site, Early 2000s Web, Synthwave, Solarized Dark, Forest

## Optional Server Tools

These external tools enhance functionality when available on the server:

| Tool | Feature |
|------|---------|
| **sharp** (npm) | Fast image thumbnail generation |
| **ImageMagick** | Fallback image thumbnails |
| **ffmpeg** | Video thumbnails, frame extraction, audio waveforms |
| **ffprobe** | Media metadata (duration, resolution, codec) |
| **7-Zip** (7z) | Archive browsing for rar, 7z, tar.* formats |
| **VLC** | External video streaming |
| **ebook-convert** (Calibre) | MOBI to EPUB conversion |

Without these tools the application still works -- images serve directly, videos play in-browser, and zip/cbz archives use native extraction.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/remote/settings` | Server configuration and capabilities |
| GET | `/api/filebrowser/list?path=` | Directory listing |
| PUT | `/api/filebrowser/settings` | Update browser settings (hidden files) |
| GET | `/api/media/capabilities` | Detected tool availability |
| GET | `/api/media/thumbnail?path=&width=&height=` | Generate/serve cached thumbnail |
| GET | `/api/media/probe?path=` | File metadata via ffprobe |
| GET | `/api/media/folder-summary?path=` | Media type counts for a folder |
| GET | `/api/media/video-frames?path=&count=` | Extract frames from video |
| GET | `/api/media/video-frame/:cacheKey/:filename` | Serve extracted frame |
| GET | `/api/media/video-frame-at?path=&timestamp=` | Extract frame at timestamp |
| GET | `/api/media/audio-waveform?path=&peaks=` | Audio waveform peak data |
| GET | `/api/media/audio-segment?path=&start=&end=` | Extract audio segment |
| GET | `/api/media/ebook-convert?path=` | Convert MOBI to EPUB |
| GET | `/api/media/ebook/:cacheKey/:filename` | Serve converted ebook |
| POST | `/api/media/open` | Open file in external player (VLC) |

## License

MIT
