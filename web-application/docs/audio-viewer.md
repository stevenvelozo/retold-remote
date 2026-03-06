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

Click "Explore Audio" from the player to open the waveform explorer. It provides a canvas-based waveform visualization with zoom, selection, segment playback, and collection integration. See the full [Audio Explorer](audio-explorer.md) documentation for details.

## File Info Overlay

Press `i` while viewing audio to see metadata:

- Size, Duration, Codec, Bitrate, Format, Modified date, Path

## Supported Formats

mp3, wav, ogg, flac, aac, m4a, wma, oga

Browser playback support varies. Most browsers play mp3, wav, ogg, and flac natively. For other formats, use VLC streaming.

Force any file as audio by pressing `3` in the gallery or viewer.
