# Video Explorer

The video explorer extracts frames from a video and displays them in a grid, letting you scrub through content visually without playing the video. It supports range selection for marking clips, custom frame extraction at specific timestamps, and a full-screen frame preview overlay. Requires ffmpeg on the server.

## Opening the Explorer

- From the video action menu, press `e`
- From the video player stats bar, click "Explore Video"
- From the gallery (with a video selected), press `e`
- From the media viewer, press `e` while viewing a video
- URL updates to `#/explore/{id}`

Opening with a pre-existing selection (from a collection item, for example) highlights that range automatically.

## Frame Grid

Frames are displayed in a responsive grid. Each frame card shows the extracted image, a timestamp label (e.g., "1:23"), and a frame index number. Frames are sorted in chronological order.

- **Click** a frame to select it (highlights in grid and timeline)
- **Double-click** a frame to open the full-screen preview overlay

Custom frames extracted at specific timestamps are styled with a dashed border to distinguish them from the evenly-spaced batch frames.

## Controls

| Control | Description |
|---------|-------------|
| Frame count dropdown | Choose 10, 20, 40, 60, or 100 frames (default: 20) |
| Full-res checkbox | Extract at 1920x1080 instead of 640x360 |
| Refresh button | Re-extract frames with current settings |
| Select Range toggle | Enable or disable range selection mode |
| Selection info | Shows start, end, and duration of current selection |
| Clear button | Remove current selection |
| Generate Frames | Extract additional frames across the selected range (3, 5, 10, or 20) |
| Save Segment | Add the selected range as a video clip to a collection |

## Info Bar

Below the controls, an info bar shows video metadata:

- Duration, resolution, codec, file size, number of extracted frames

## Timeline Bar

Below the frame grid, a timeline bar visualizes the video duration.

### Markers

Vertical lines mark the position of each extracted frame. Custom frames use a distinct marker style. Click any marker to jump to that frame in the grid.

### Click-to-Extract

Click on empty space in the timeline to extract a single frame at that exact timestamp. The new frame appears in the grid in chronological order with a dashed border.

### Selection Overlay

When a range is selected, a semi-transparent highlight shows the selected region on the timeline.

## Range Selection

Toggle range selection with the "Select Range" button or use the `[` and `]` keys to set boundaries at specific frame timestamps.

### Creating a Selection

- **Timeline drag**: Click and drag on the timeline to define a range
- **Keyboard markers**: Press `[` to set the start and `]` to set the end at the currently selected frame's timestamp
- **Slider handles**: Once a selection exists, drag the start and end handles above the timeline for fine adjustment

### Minimum Range

Selections shorter than 0.5 seconds are automatically cleared.

### Generate Frames Across Selection

With a selection active, use the "Generate Frames" dropdown to extract evenly-spaced frames within the selected range (3, 5, 10, or 20 frames). This is useful for scrubbing through a specific scene.

### Save Segment

Click "Save Segment" or press `s` to add the selected range as a video clip to a collection. If no collection is active, a dropdown picker appears.

### Persistence

Selection state and custom frames are saved to the server and restored when you return to the same video.

## Frame Preview

Double-click any frame to open a full-screen preview overlay.

### Navigation

| Key | Action |
|-----|--------|
| Left / `k` | Previous frame |
| Right / `j` | Next frame |
| `Esc` | Close preview |

The Back button in the preview header also closes it. Navigation moves through all frames (regular and custom) in chronological order. The title shows the timestamp and frame type (e.g., "1:23 - #5" or "2:15 - custom"). Selecting a frame in the preview also highlights it in the grid behind the overlay.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Esc` | Close preview if open, otherwise back to video viewer |
| `a` | Add selected frame to collection |
| `s` | Add selected range as video clip to collection |
| `[` | Set selection start at current frame's timestamp |
| `]` | Set selection end at current frame's timestamp |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |

## Frame Extraction Details

Frames are extracted server-side by ffmpeg via the `/api/media/video-frames` endpoint. By default, frames are extracted at 640x360 resolution. Enabling "Full Res" extracts at 1920x1080.

Custom single-frame extraction uses `/api/media/video-frame-at` with a specific timestamp. A placeholder card reading "Extracting..." appears in the grid while the server processes the request, then swaps in the actual frame image.

Extracted frames are cached on the server and reused across sessions.
