# Audio Viewer and Explorer

The audio viewer provides HTML5 audio playback with an optional waveform explorer for visualizing, selecting, and extracting audio segments.

## Opening an Audio File

- **From the gallery**: select an audio file and press `Enter`, or double-click it
- **Force any file as audio**: press `3` in the gallery or viewer to open it in the audio viewer regardless of extension

## Audio Player

The viewer shows a centered audio player with the filename and native HTML5 audio controls (play/pause, seek bar, volume, playback speed).

Below the player, action buttons appear:

| Button | Requires | Description |
|--------|----------|-------------|
| **Explore Audio** | ffprobe or ffmpeg | Opens the waveform explorer |
| **Stream with VLC** | -- | Sends the file to VLC on the server |

### Autoplay

Autoplay is off by default. Enable it in Settings > Gallery > Autoplay audio. When enabled, audio begins playing as soon as the player loads.

## Audio Explorer

The audio explorer displays a canvas-based waveform visualization with selection, zoom, and segment extraction.

### Opening the Explorer

- From the audio player, click "Explore Audio"
- The explorer fetches 2000 peak samples from the server via ffmpeg

### Waveform Display

The main canvas shows the audio waveform as vertical bars. The height of each bar represents the amplitude at that point. A dashed center line marks the zero crossing.

- **Unselected regions** are drawn in the secondary text color
- **Selected regions** are drawn in the accent color with a semi-transparent highlight behind them
- A **cursor line** follows the mouse position, displayed in white

### Overview Bar

Below the main waveform, a smaller overview canvas shows the entire audio file. A highlighted viewport indicator box shows which portion of the waveform is currently visible in the main canvas.

Click anywhere on the overview to pan the main view to that position.

### Selection

**Click and drag** on the main waveform to select a time range. The selection is highlighted in the accent color with edge markers.

- If the selection is too small (less than 0.1% of the total duration), it is automatically cleared
- The selection is shown in both the main canvas and the overview

### Time Display Bar

A bar above the waveform shows three pieces of information:

- **View**: the time range currently visible (e.g., "0:12.3 - 0:45.7")
- **Selection**: the selected time range and its duration (e.g., "0:20.0 - 0:30.5 (10.5s)"), or "None"
- **Cursor**: the time position under the mouse, or "--"

Timestamps are formatted as `M:SS.D` (minutes, seconds, tenths of a second) or `H:MM:SS.D` for long files.

### Zoom Controls

| Key / Button | Action |
|--------------|--------|
| `+` or `=` | Zoom in (centered) |
| `-` | Zoom out (centered) |
| `0` | Zoom to fit (show entire file) |
| `z` | Zoom to selection (with 5% margin) |
| Mouse wheel | Zoom at cursor position |

Minimum zoom level is 0.5% of the total duration.

Zooming preserves the center point -- the portion of the waveform under the mouse (for wheel zoom) or the center (for keyboard zoom) stays in place while the view range narrows or widens.

### Playing a Selection

With a selection active, press `Space` or click the Play Selection button to extract and play that audio segment.

The server extracts the segment via ffmpeg and returns it as an MP3 file. A playback bar appears with an HTML5 audio player for the extracted segment.

The extraction endpoint is `/api/media/audio-segment` with `start` and `end` parameters in seconds.

### Info Bar

The explorer shows an info bar with metadata from ffprobe:

| Field | Example |
|-------|---------|
| Duration | 3:42 |
| Sample Rate | 44.1 kHz |
| Channels | 2 (stereo) |
| Codec | mp3 |
| Bitrate | 320 kbps |
| File Size | 8.7 MB |
| Peaks | 2000 (ffmpeg) |

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play selection |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Zoom to fit |
| `z` | Zoom to selection |
| `Esc` | Clear selection (if any), or go back to audio player |

### Mouse Interactions

| Action | Effect |
|--------|--------|
| Click and drag on main waveform | Create/adjust selection |
| Mouse move on main waveform | Show cursor position in time bar |
| Mouse wheel on main waveform | Zoom in/out at cursor position |
| Click on overview bar | Pan main view to that position |

## File Info Overlay

Press `i` while viewing audio to see metadata:

- Size, Duration, Codec, Bitrate, Format, Modified date, Path

## Supported Formats

mp3, wav, ogg, flac, aac, m4a, wma, oga

Browser playback support varies. Most browsers play mp3, wav, ogg, and flac natively. For other formats, use VLC streaming.

Force any file as audio by pressing `3` in the gallery or viewer.
