# Audio Explorer

The audio explorer displays a canvas-based waveform visualization of an audio file with zoom, selection, and segment extraction. Select a region of the waveform, play it back instantly, or save it to a collection as an audio clip. Requires ffmpeg on the server for waveform analysis and segment extraction.

## Opening the Explorer

- From the audio player, click "Explore Audio"
- From the gallery (with an audio file selected), press `e`
- From the media viewer, press `e` while viewing audio
- URL updates to `#/explore-audio/{id}`

Opening with a pre-existing selection (from a collection item, for example) highlights that range automatically.

## Waveform Display

### Main Canvas

The main canvas shows a zoomed and pannable portion of the waveform. Peaks are drawn as vertical bars above and below a dashed center line, representing the amplitude at each point.

- **Unselected regions** are drawn in the secondary text color
- **Selected regions** are drawn in the accent color with a semi-transparent highlight
- A **cursor line** follows the mouse position

### Overview Bar

Below the main canvas, a smaller overview canvas shows the entire audio file at a glance. A highlighted viewport indicator rectangle shows which portion is currently visible in the main canvas.

Click anywhere on the overview bar to pan the main view to that position. The viewport indicator can also be dragged.

## Time Display Bar

A bar above the waveform shows three live-updating fields:

| Field | Content | Example |
|-------|---------|---------|
| **View** | Time range currently visible | 0:12.3 - 0:45.7 |
| **Selection** | Selected range and duration | 0:20.0 - 0:30.5 (10.5s) |
| **Cursor** | Time position under the mouse | 0:25.8 |

Timestamps are formatted as M:SS.D (minutes, seconds, tenths) or H:MM:SS.D for long files. When no selection exists, "None" is shown. When the cursor is outside the canvas, "--" is shown.

## Info Bar

| Field | Example |
|-------|---------|
| Duration | 3:42 |
| Sample Rate | 44.1 kHz |
| Channels | 2 (stereo) |
| Codec | mp3 |
| Bitrate | 320 kbps |
| Size | 8.7 MB |
| Peaks | 2000 (ffmpeg) |

## Selection

Click and drag on the main waveform to select a time range. The selection is highlighted in the accent color with vertical edge markers in both the main canvas and the overview bar.

Selections smaller than approximately 1 millisecond are automatically cleared.

### Controls

| Button | Action |
|--------|--------|
| Play Selection | Extract and play the selected segment |
| Clear | Remove the selection |
| Save Segment | Add the selection as an audio clip to a collection |

## Zoom

| Key / Action | Effect |
|--------------|--------|
| `+` or `=` | Zoom in (halves visible range, centered) |
| `-` | Zoom out (doubles visible range, centered) |
| `0` | Zoom to fit (show entire file) |
| `z` | Zoom to selection (with 5% margin) |
| Scroll wheel | Zoom at cursor position |

The minimum zoom level is 0.5% of the total duration. Zooming preserves the center point -- the portion of the waveform under the cursor (scroll wheel) or the center of the view (keyboard) stays in place while the view range changes.

## Playing a Selection

With a selection active, press `Space` or click "Play Selection" to hear that segment. The server extracts the audio via ffmpeg and returns an MP3 file. A playback bar appears with an HTML5 audio player for the extracted segment.

The extraction endpoint is `/api/media/audio-segment` with `start` and `end` parameters in seconds.

## Mouse Interactions

| Action | Effect |
|--------|--------|
| Click and drag on main waveform | Create or adjust a selection |
| Mouse move on main waveform | Update cursor position in time bar |
| Scroll wheel on main waveform | Zoom in or out at cursor position |
| Click on overview bar | Pan main view to that position |
| Drag viewport indicator | Pan main view by dragging |

### Touch

Selection drag is supported on touch devices.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play selection |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Zoom to fit |
| `z` | Zoom to selection |
| `a` / `s` | Save audio snippet to collection |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |
| `Esc` | Clear selection (if any), or go back to audio player |

## State Persistence

Zoom level and selection state are saved to the server and restored when you return to the same audio file.

## Waveform Analysis

The server analyzes the audio file into 2000 peak sample points by default. Each peak contains min and max amplitude values normalized to the -1.0 to 1.0 range. The analysis method is shown in the info bar (typically "ffmpeg").
