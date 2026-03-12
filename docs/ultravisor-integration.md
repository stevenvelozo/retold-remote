# Ultravisor Integration

retold-remote can offload heavy media processing to a remote machine running an Ultravisor beacon worker. This is useful when the server (e.g. a NAS) has limited CPU and RAM but needs to process large video files, raw camera images, audio waveforms, and ebook conversions.

## How It Works

When configured, retold-remote dispatches shell commands (ffmpeg, ffprobe, dcraw, ImageMagick, audiowaveform, ebook-convert) to a beacon worker via HTTP instead of running them locally. The beacon downloads the source file from retold-remote's content API, executes the command, and returns the result as base64-encoded data.

```
NAS (retold-remote)                 Fast Machine (Ultravisor)
┌──────────────────────┐            ┌──────────────────────┐
│ Request → Check Cache│            │ Ultravisor Server    │
│   ↓ (miss)           │   HTTP     │   └─ Beacon Worker   │
│ Dispatch command  ───┼──────────►│      1. Download src │
│                      │            │      2. Run command  │
│ ◄─ base64 result  ◄──┼────────────┤      3. Return output│
│   ↓                  │            │                      │
│ Decode → Cache       │            └──────────────────────┘
│ Serve response       │
│                      │
│ ↓ (dispatch fails)   │
│ Local fallback       │
└──────────────────────┘
```

All caching, metadata, and storage remain on the NAS. Only the tool execution changes.

## Setup

### 1. Start Ultravisor on the Fast Machine

Install and run the Ultravisor server with a beacon worker:

```bash
# On the fast machine
npm install ultravisor
node ultravisor-server.js --port 55555
```

The beacon worker must have the processing tools installed:

| Tool | Used For |
|------|----------|
| **ffmpeg** | Video thumbnails, frame extraction, audio waveform generation |
| **ffprobe** | Media metadata (duration, dimensions, codec, bitrate) |
| **dcraw** | Raw camera image conversion (CR2, NEF, ARW, etc.) |
| **ImageMagick** | Image format conversion, thumbnails |
| **audiowaveform** | Audio waveform peak data |
| **ebook-convert** | MOBI/AZW to EPUB conversion (from Calibre) |

Only install the tools you need. The beacon reports its capabilities and retold-remote only dispatches commands for tools the beacon has available.

### 2. Configure retold-remote

Pass two settings when starting the server:

| Setting | Description | Example |
|---------|-------------|---------|
| `UltravisorURL` | URL of the Ultravisor server | `http://192.168.1.100:55555` |
| `ContentAPIURL` | URL where the beacon can reach retold-remote's content API | `http://192.168.1.50:8086` |

```bash
# CLI
retold-remote serve /mnt/media \
  --ultravisor-url http://192.168.1.100:55555 \
  --content-api-url http://192.168.1.50:8086

# Or via server setup options
node server.js /mnt/media
```

The `ContentAPIURL` must be reachable from the beacon machine over the network. This is the URL the beacon uses to download source files before processing them.

### 3. Verify Connection

On startup, retold-remote pings the Ultravisor server and logs whether beacons are available. Check the server logs for:

```
Ultravisor Dispatcher: connection check passed, beacons available.
```

If no `UltravisorURL` is configured, the dispatcher is disabled and all processing runs locally, identical to the default behavior.

## Offloaded Operations

The following operations are dispatched to the beacon when available:

| Service | Operation | Command |
|---------|-----------|---------|
| **MediaService** | Video thumbnails | `ffmpeg -ss ... -vframes 1 -vf scale=WxH ...` |
| **MediaService** | Image thumbnails (ImageMagick path) | `convert ... -thumbnail WxH ...` |
| **MediaService** | Media probing | `ffprobe -v quiet -print_format json ...` |
| **VideoFrameService** | Frame extraction | `ffmpeg -ss T -vframes 1 -vf scale=WxH ...` |
| **VideoFrameService** | Video probing | `ffprobe -v quiet -print_format json ...` |
| **AudioWaveformService** | Audio probing | `ffprobe -v quiet -print_format json ...` |
| **EbookService** | MOBI/AZW conversion | `ebook-convert source.mobi output.epub` |
| **ImageService** | Raw conversion (dcraw) | `dcraw -c -w "{SourcePath}" \| convert ppm:- jpeg:"{OutputPath}"` |
| **ImageService** | Image conversion (ImageMagick) | `convert "{SourcePath}" -quality 92 "{OutputPath}"` |

## File Transfer

Since the beacon worker runs on a separate machine without shared filesystem access, files are transferred over HTTP:

1. **Source download**: The beacon downloads the source file from retold-remote's content API (`ContentAPIURL + '/content/' + relativePath`) before executing the command.
2. **Result return**: The beacon base64-encodes the output file and includes it in the HTTP response.
3. **Decode and cache**: retold-remote decodes the base64 data and stores it in the local cache (Parime storage).

The `{SourcePath}` and `{OutputPath}` placeholders in commands are automatically replaced with local staging paths on the beacon.

## Affinity and Download Caching

When the same source file is used for multiple operations (e.g. generating a video thumbnail, then extracting frames from the same video), the beacon caches the downloaded file using an affinity key. The download only happens once per file.

Affinity keys are derived from the relative file path. All operations on the same source file reuse the cached download. Affinity staging is cleaned up when the beacon shuts down or when the affinity TTL expires (default: 1 hour).

## Fallback Behavior

Every dispatched operation has automatic fallback to local processing:

- If `UltravisorURL` is not configured, all operations run locally (no behavior change).
- If the Ultravisor server is unreachable, operations fall back to local tools.
- If the beacon returns an error, the operation falls back to local execution.
- If no beacons are registered, dispatch returns an error and local processing takes over.

This means the Ultravisor integration is purely additive. Removing the configuration or shutting down the Ultravisor server does not break any functionality.

## Synchronous Dispatch

retold-remote uses synchronous HTTP dispatch (`POST /Beacon/Work/Dispatch`). The HTTP connection stays open until the beacon completes the work item. This avoids polling complexity and works well for the request-response pattern of thumbnail generation and media probing.

The default timeout is 5 minutes (300,000 ms). Individual operations may specify shorter timeouts.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| All operations run locally | `UltravisorURL` not configured or Ultravisor unreachable | Check URL and network connectivity |
| Beacon downloads fail | `ContentAPIURL` not reachable from beacon machine | Verify network route between machines |
| Timeouts on large files | File too large for default timeout | Increase `TimeoutMs` in Ultravisor settings |
| Beacon missing capabilities | Required tools not installed on beacon machine | Install ffmpeg, dcraw, etc. on the beacon |
