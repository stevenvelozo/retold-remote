# File Metadata

Retold Remote gathers and displays metadata about files in three ways: the file info overlay in the media viewer, the info sidebar tab, and the info bars within each explorer. Metadata extraction uses ffprobe, exifr, sharp, and pdf-parse depending on the file type.

## File Info Overlay

Press `i` while viewing any file to show a compact metadata overlay in the top-right corner of the viewer. The overlay is toggled on and off with the same key.

### Images

- **Size** (file size in KB/MB)
- **Dimensions** (width x height in pixels)

### Video

- **Size** (file size)
- **Duration** (MM:SS)
- **Codec** (video codec name)
- **Format** (container format)
- **Modified** (date/time)

### Audio

- **Size** (file size)
- **Duration** (MM:SS)
- **Codec** (audio codec)
- **Format** (container format)
- **Modified** (date/time)

## Info Sidebar Tab

Press `i` in gallery mode or open the Info tab in the sidebar to see extended metadata for the currently selected file. This panel fetches from the `/api/media/extended-metadata` endpoint and displays a full breakdown organized by section.

### Basic (All Files)

| Field | Example |
|-------|---------|
| File Size | 14.2 MB |
| Category | image, video, audio, document |
| Extension | .mp4 |
| Modified | Mar 6, 2026 2:15 PM |
| Created | Mar 1, 2026 9:00 AM |
| MD5 Hash | a1b2c3d4e5f6... |

### Image Section

| Field | Example |
|-------|---------|
| Dimensions | 4032 x 3024 px |
| Format | JPEG |
| Color Space | sRGB |
| DPI | 72 |
| Alpha Channel | No |

#### EXIF (when present)

| Field | Example |
|-------|---------|
| Camera | Canon EOS R5 |
| Lens | RF 24-70mm F2.8 L |
| Exposure | 1/1000s f/2.8 ISO 400 |
| Focal Length | 50mm |
| Date Taken | 2026-03-01 14:30:22 |
| Software | Adobe Lightroom |

#### GPS (when present)

| Field | Example |
|-------|---------|
| Latitude | 47.6062° N |
| Longitude | 122.3321° W |
| Altitude | 56m |
| Map Link | Opens Google Maps at the coordinates |

### Video Section

| Field | Example |
|-------|---------|
| Codec | h264 (Main @ Level 4.0) |
| Resolution | 1920 x 1080 |
| Frame Rate | 23.976 fps |
| Pixel Format | yuv420p |
| Color Space | bt709 |
| Color Range | tv |
| Bitrate | 8.5 Mbps |

### Audio Section

Shown for audio files and for the audio track in video files.

| Field | Example |
|-------|---------|
| Codec | aac (LC) |
| Sample Rate | 44.1 kHz |
| Channels | 2 (stereo) |
| Bitrate | 320 kbps |
| Bit Depth | 16-bit (PCM audio) |

### Format Section (Video/Audio)

| Field | Example |
|-------|---------|
| Container | MPEG-4 |
| Duration | 3:42 |
| Overall Bitrate | 9.2 Mbps |

### Document Section (PDF)

| Field | Example |
|-------|---------|
| Pages | 24 |
| Title | Annual Report 2025 |
| Author | Jane Smith |
| Subject | Finance |
| Keywords | quarterly, revenue |
| Creator | Microsoft Word |
| Producer | macOS Quartz PDFContext |
| Created | 2025-12-15 |
| Modified | 2026-01-03 |

### Tags

Any embedded format-level tags (ID3 tags for MP3, Vorbis comments for OGG, etc.) are displayed as key-value pairs sorted alphabetically.

### Chapters

Video and audio files with embedded chapter markers list each chapter with its title and start time.

## Explorer Info Bars

Each explorer displays a focused info bar with metadata relevant to that media type.

### Video Explorer Info Bar

| Field | Example |
|-------|---------|
| Duration | 1:23:45 |
| Resolution | 1920 x 1080 |
| Codec | h264 |
| Size | 2.1 GB |
| Frames | 20 extracted |

### Audio Explorer Info Bar

| Field | Example |
|-------|---------|
| Duration | 3:42 |
| Sample Rate | 44.1 kHz |
| Channels | 2 (stereo) |
| Codec | mp3 |
| Bitrate | 320 kbps |
| Size | 8.7 MB |
| Peaks | 2000 (ffmpeg) |

The audio explorer also shows a **time display bar** above the waveform with three live-updating fields:

- **View**: the time range currently visible (e.g., 0:12.3 - 0:45.7)
- **Selection**: the selected range and duration (e.g., 0:20.0 - 0:30.5 (10.5s)), or None
- **Cursor**: the time position under the mouse, or --

### Image Explorer Info Bar

**Direct mode** (images up to 4096px):

| Field | Example |
|-------|---------|
| Dimensions | 2400 x 1600 px |
| Size | 3.8 MP |
| Mode | Direct |

**DZI tile mode** (images larger than 4096px):

| Field | Example |
|-------|---------|
| Dimensions | 8192 x 6144 px |
| Tile Size | 256 px |
| Format | jpeg |
| Size | 50.3 MP |
| Coordinates | (4096, 3072) |
| Zoom | 125% |

Coordinates and zoom level update in real time as the mouse moves and the view changes.

## Video Stats Bar

When playing a video in the browser, a stats bar below the player shows:

- **Duration** (MM:SS)
- **Resolution** (width x height)
- **Codec** (e.g., h264, hevc, vp9)
- **Bitrate** (kbps or Mbps)
- **Size** (formatted file size)
- **Explore Button** to open the video explorer
- **VLC Button** to stream with VLC

Stats are fetched from `/api/media/probe`.

## Metadata Caching

Extracted metadata is cached server-side using Parime BinaryStorage. Cache keys are derived from a hash of the file path and modification time, so metadata is automatically invalidated when a file changes. Re-extraction can be forced from the info sidebar.

## Required Tools

| Tool | Used For |
|------|----------|
| **ffprobe** | Video and audio metadata (codec, duration, streams, chapters, tags) |
| **exifr** | Image EXIF and GPS data |
| **sharp** | Image dimensions, format, color space, DPI |
| **pdf-parse** | PDF page count, title, author, and document properties |

Without these tools, basic file metadata (size, extension, dates) is still available.
