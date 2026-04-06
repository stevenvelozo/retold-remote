# Retold Remote

A browser-based media server and NAS file explorer. Point it at a folder and browse images, videos, audio, ebooks, code, and documents through a keyboard-driven gallery interface with 15 built-in themes.

## Quick Start

Just the media browser:

```bash
npx retold-remote serve /path/to/media
```

The full stack (Retold Remote + embedded Orator-Conversion + child Ultravisor):

```bash
retold-stack /path/to/media
```

Or with Docker:

```bash
docker build -t retold-remote .
docker run -p 8086:8086 -v /path/to/media:/media retold-remote
```

Then open `http://localhost:8086` in a browser.

See [Stack Launcher](stack-launcher.md) for what `retold-stack` does and how the XDG-style data paths work.

## Features

- **Gallery browser** with grid and list views, thumbnail generation, and lazy loading
- **Image viewer** with three fit modes, 0.25x-8x zoom, and EXIF orientation support
- **Video viewer** with action menu, in-browser playback, VLC streaming, and frame explorer
- **Audio viewer** with waveform visualization, selection-based playback, and segment extraction
- **eBook reader** for EPUB and MOBI with table of contents, page navigation, text selection capture, and visual region selection
- **PDF viewer** with full pdf.js rendering, page navigation, text layer selection, and visual region selection
- **Document conversion** for DOC, DOCX, RTF, ODT, WPD, ODP, PPT(X), ODS, XLS(X) — converted to PDF on the fly via Orator-Conversion + LibreOffice
- **Code/text viewer** with syntax highlighting for 30+ languages
- **Archive browsing** into zip, 7z, rar, tar.gz, cbz, and cbr files as virtual folders
- **Filtering and sorting** by media type, extension, file size, date, and text search (with regex)
- **Subimage regions** — draw labeled rectangles on images, ebook pages, and PDF pages; persisted per file
- **Collections & Export** — bookmark files, image crops, video clips, audio clips, and document regions; export the whole collection to a folder with proper file cutting
- **Stack mode** — single command launches Ultravisor coordinator + Retold Remote + embedded Orator-Conversion with sane XDG data paths
- **Ultravisor offload** — heavy work (frame extraction, waveforms, conversions) dispatched to a beacon worker on a faster machine
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
| [Stack Launcher](stack-launcher.md) | `retold-stack` and `--stack` flag, XDG paths, child process orchestration |
| [Ultravisor Integration](ultravisor-integration.md) | Offloading heavy media processing to a beacon worker |
| [Image Viewer](image-viewer.md) | Fit modes, zoom, keyboard shortcuts, mouse interactions |
| [Video Viewer](video-viewer.md) | Action menu, in-browser playback, VLC streaming |
| [Audio Viewer](audio-viewer.md) | HTML5 playback, autoplay, VLC streaming |
| [eBook Reader](ebook-reader.md) | EPUB/MOBI support, TOC, page nav, text/region selection |
| [Image Explorer](image-explorer.md) | Deep-zoom with OpenSeadragon, DZI tiling, region selection |
| [Video Explorer](video-explorer.md) | Frame grid, timeline, range selection, clip extraction |
| [Audio Explorer](audio-explorer.md) | Waveform visualization, selection, zoom, segment playback |
| [Collections](collections.md) | Bookmarks, favorites, quick-add, item types, operation plans, export |
| [File Metadata](metadata.md) | Info overlay, sidebar metadata, EXIF/GPS, ffprobe, explorer info bars |

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
| `s` | Toggle region selection mode (draw rectangles) |
| `a` | Quick-add to collection (current region if selected) |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |
| `Esc` | Back to viewer |

### Document Viewer (PDF / EPUB)

| Key | Action |
|-----|--------|
| `s` | Toggle visual region selection mode |
| `a` | Quick-add document region to collection |
| `Esc` | Back to gallery |

In the PDF viewer, page navigation buttons and a page input are in the controls bar. The text layer supports native browser text selection — use the **Save Selection** button to capture selected text as a labeled region.

In the EPUB reader, the controls bar exposes **Save Selection** (captures the selected text + CFI) and **Select Region** (draws a rectangle over the rendered page).

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
pdf, epub, mobi, doc, docx, rtf, odt, wpd, wps, pages, odp, ppt, pptx, ods, xls, xlsx

Documents beyond pdf/epub/mobi are converted to PDF on the fly via the embedded Orator-Conversion service (requires LibreOffice or Calibre on the server).

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
| **sharp** (npm) | Fast image thumbnail generation, region cropping |
| **ImageMagick** | Fallback image thumbnails |
| **ffmpeg** | Video thumbnails, frame extraction, audio waveforms, clip cutting |
| **ffprobe** | Media metadata (duration, resolution, codec) |
| **7-Zip** (7z) | Archive browsing for rar, 7z, tar.* formats |
| **VLC** | External video streaming |
| **audiowaveform** (BBC) | Faster audio waveform peak generation |
| **ebook-convert** (Calibre) | MOBI/AZW to EPUB conversion (and PDF fallback for documents) |
| **LibreOffice** (`soffice`) | DOC/DOCX/RTF/ODT/WPD/PPT(X)/XLS(X) to PDF conversion |
| **pdftk** + **pdftoppm** (poppler) | PDF page extraction and rendering (used by Orator-Conversion) |

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
| GET | `/api/media/doc-convert?path=` | Convert DOC/DOCX/RTF/ODT/WPD/etc. to PDF |
| GET | `/api/media/ebook/:cacheKey/:filename` | Serve converted ebook or PDF |
| GET | `/api/media/pdf-text?path=&page=` | Extract text from a PDF page |
| GET | `/api/media/subimage-regions?path=` | List labeled regions for an image, ebook, or PDF |
| POST | `/api/media/subimage-regions` | Add a labeled region (visual or text-selection) |
| PUT | `/api/media/subimage-regions/:id` | Update a region's label or coordinates |
| DELETE | `/api/media/subimage-regions/:id?path=` | Remove a labeled region |
| GET | `/api/collections` | List all collections |
| POST | `/api/collections/:guid/items` | Add items to a collection |
| POST | `/api/collections/:guid/export` | Export collection to a folder (cuts clips, crops images) |
| POST | `/api/conversion/1.0/doc-to-pdf` | Convert any document buffer to PDF (via Orator-Conversion) |
| POST | `/api/conversion/1.0/pdf-to-page-png/:Page` | Render a PDF page as PNG |
| POST | `/api/conversion/1.0/pdf-to-page-jpg/:Page/:LongSidePixels` | Render and resize a PDF page as JPEG |
| POST | `/api/conversion/1.0/image/resize` | Resize an image |
| POST | `/api/media/open` | Open file in external player (VLC) |

## License

MIT
