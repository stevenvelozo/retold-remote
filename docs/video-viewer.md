# Video Viewer and Explorer

The video viewer provides an action menu for choosing how to interact with a video, inline browser playback, VLC streaming, and a frame explorer for scrubbing through video content visually.

## Opening a Video

- **From the gallery**: select a video file and press `Enter`, or double-click it
- **Force any file as video**: press `2` in the gallery or viewer to open it in the video viewer regardless of extension

## Video Action Menu

When a video is opened, an action menu appears instead of playing immediately. The menu shows the filename and a preview frame extracted from the video midpoint.

### Menu Options

| Key | Option | Description |
|-----|--------|-------------|
| `Space` / `Enter` | **Play in Browser** | Plays the video inline with HTML5 `<video>` controls |
| `e` | **Explore Video Frames** | Opens the frame explorer (requires ffmpeg) |
| `t` | **Extract Thumbnail** | Extracts a single frame from the midpoint |
| `v` | **Stream with VLC** | Sends the file to VLC on the server machine |

The preview frame in the menu is loaded automatically from the server. If ffmpeg is not available, the Explore and Thumbnail options are hidden.

Navigation and collection shortcuts also work while the menu is open:

| Key | Action |
|-----|--------|
| Right / `j` | Skip to next file |
| Left / `k` | Skip to previous file |
| `a` | Quick-add to active collection |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |
| `Esc` | Back to gallery |

## In-Browser Playback

Pressing `Space` or `Enter` replaces the action menu with an HTML5 video player. The player has native browser controls for play/pause, seeking, volume, and fullscreen.

Below the player, a **stats bar** shows:

- **Duration** (formatted as mm:ss)
- **Resolution** (width x height)
- **Codec** (e.g., h264, hevc, vp9)
- **Bitrate** (in kbps or Mbps)
- **File Size** (formatted)

The stats bar also includes buttons to jump to the Video Explorer or stream with VLC.

### Autoplay

Autoplay is off by default. Enable it in Settings > Gallery > Autoplay video. When enabled, videos begin playing as soon as the player loads.

## Video Explorer

The video explorer extracts multiple frames from a video and displays them in a grid, letting you scrub through content visually without playing the video.

### Opening the Explorer

- From the video action menu, press `e`
- From the video stats bar during playback, click "Explore Video"

### Frame Grid

Frames are displayed in a responsive grid. Each frame card shows:

- The extracted frame image
- A timestamp label (e.g., "1:23")
- A frame index number

Double-click any frame to open it in a full-screen preview overlay.

### Controls

At the top of the explorer:

| Control | Description |
|---------|-------------|
| Frame count dropdown | Choose 10, 20, 40, 60, or 100 frames (default: 20) |
| Full-res checkbox | Extract frames at 1920x1080 instead of 640x360 |
| Refresh button | Re-extract frames with current settings |

### Info Bar

Below the controls, an info bar displays video metadata:

- Duration
- Resolution
- Codec
- File size
- Number of extracted frames

### Timeline Bar

Below the frame grid, a timeline bar shows the video duration with markers at each extracted frame's position. The timeline also shows markers for any custom frames you extract.

**Click anywhere on the timeline** to extract a frame at that exact timestamp. The extracted frame appears in the grid in chronological order, styled with a dashed border to distinguish it from the evenly-spaced frames.

### Frame Preview

Double-click any frame in the grid to open a full-screen preview overlay showing the frame at full size.

In the preview:

| Key | Action |
|-----|--------|
| Left / `k` | Previous frame |
| Right / `j` | Next frame |
| `Esc` | Close preview |

The Back button in the preview header also closes it. Navigation moves through all frames (regular and custom) in chronological order.

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Back to video viewer (or close frame preview) |
| `a` | Add current frame to collection |
| `s` | Add video clip (selection) to collection |
| `[` | Set selection start marker at current frame |
| `]` | Set selection end marker at current frame |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |

## VLC Streaming

Press `v` from the action menu, stats bar, or viewer to send the current video to VLC running on the server. This is useful for files in formats the browser cannot play natively.

VLC protocol setup instructions are available in Settings > VLC Protocol Setup, with platform-specific guides for macOS, Windows, and Linux.

## File Info Overlay

Press `i` while viewing a video to see metadata:

- Size, Duration, Resolution, Codec, Bitrate, Format, Modified date, Path

## Supported Formats

**Natively recognized extensions**: mp4, webm, mov, mkv, avi, wmv, flv, m4v, ogv, mpg, mpeg, mpe, mpv, m2v, ts, mts, m2ts, vob, 3gp, 3g2, f4v, rm, rmvb, divx, asf, mxf, dv, nsv, nuv, y4m, wtv, swf, dat

**Browser playback support** varies by format. Most browsers play mp4 (h264), webm (vp8/vp9), and ogg natively. For other formats, use VLC streaming or the frame explorer.

**Force any file as video** by pressing `2` in the gallery or viewer to bypass extension detection. This is useful for misnamed files (e.g., `.avii` instead of `.avi`).
