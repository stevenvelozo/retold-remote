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

Press `e` from the action menu, stats bar, or viewer to open the video explorer. It extracts frames into a grid, provides a clickable timeline, range selection for marking clips, and a full-screen frame preview overlay. See the full [Video Explorer](video-explorer.md) documentation for details.

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
