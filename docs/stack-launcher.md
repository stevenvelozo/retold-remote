# Stack Launcher

The `--stack` flag (and the `retold-stack` shortcut) brings up the full Retold stack as a single command: an embedded Ultravisor coordinator, the Retold Remote media browser, and Orator-Conversion (embedded inside Retold Remote). Point it at any directory and it just works -- sane XDG-style data paths, automatic readiness polling, and graceful shutdown of all child processes.

## Quick Start

```bash
# Run the full stack against the current directory
retold-stack

# Or against any directory
retold-stack /mnt/nas/media

# Or via the explicit flag
retold-remote serve --stack /mnt/nas/media
```

That's it. No config files, no separate terminals, no manual port wiring.

## What Gets Launched

| Component | Where it runs | Port |
|-----------|---------------|------|
| **Ultravisor** | Spawned as a child process | 54321 |
| **Retold Remote** | Main process (the one you started) | Random 7000-7999 (override with `-p`) |
| **Orator-Conversion** | Embedded inside Retold Remote (no separate process) | Same as Retold Remote |

The stack launcher:
1. Resolves XDG-style data paths
2. Detects whether Ultravisor is already running on port 54321 (and reuses it if so)
3. Spawns Ultravisor as a child process with a generated config file
4. Polls until Ultravisor is accepting connections (up to 30 seconds)
5. Sets the `UltravisorURL` automatically so Retold Remote registers as a beacon
6. Starts the Retold Remote server with Orator-Conversion embedded
7. Streams the Ultravisor child's stdout/stderr through the main logger with an `[ultravisor]` prefix
8. On `SIGINT`/`SIGTERM`, disconnects the beacon, kills the Ultravisor child gracefully, and exits

## Default Data Paths

The stack launcher uses [XDG Base Directory Specification](https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html) defaults so data lives in predictable, user-scoped locations regardless of what directory you launched from.

| Purpose | Default Path | Override |
|---------|-------------|----------|
| Ultravisor datastore | `~/.local/share/ultravisor/datastore/` | `$XDG_DATA_HOME/ultravisor/datastore/` |
| Ultravisor staging | `~/.local/share/ultravisor/staging/` | `$XDG_DATA_HOME/ultravisor/staging/` |
| Retold Remote cache | `~/.cache/retold-remote/` | `$XDG_CACHE_HOME/retold-remote/`, or `-c` flag |
| Stack config files | `~/.config/retold-stack/` | `$XDG_CONFIG_HOME/retold-stack/` |

The cache directory holds thumbnails, video frames, audio waveforms, archive extractions, and converted ebooks/PDFs.

The Ultravisor datastore holds the work-queue journal and beacon registry.

These paths are created on first launch if they do not already exist.

## CLI Reference

### `retold-stack`

Convenience entry point that auto-injects `serve --stack`.

```bash
retold-stack [content-path] [options]
```

All options accepted by `retold-remote serve` are forwarded.

### `retold-remote serve --stack`

The full form. Useful when you want to combine `--stack` with other flags.

```bash
retold-remote serve --stack [content-path] [options]
```

| Flag | Description |
|------|-------------|
| `--stack` | Spawn Ultravisor as a child process and connect to it. Sets cache root to `~/.cache/retold-remote/` if `-c` is not passed. Auto-sets the Ultravisor URL to `http://localhost:54321`. |

All other `serve` options still apply (`-p`, `--no-hash`, `-c`, `-l`, etc.).

## Examples

### Browse the current directory with the full stack

```bash
cd ~/Pictures
retold-stack
```

### Browse a specific NAS share

```bash
retold-stack /mnt/nas/media
```

### Pin the port and stash logs to a file

```bash
retold-stack /mnt/nas/media -p 8086 -l ~/retold.log
```

### Override just the Retold cache location

```bash
retold-remote serve --stack /mnt/nas/media -c /var/cache/retold
```

### Reuse an already-running Ultravisor

If port 54321 is already accepting connections, the stack launcher detects this and connects to the existing instance instead of spawning a new one. The log line will read:

```
[stack] ultravisor already running on port 54321, reusing
```

This means you can leave Ultravisor running across multiple Retold Remote launches without conflict.

## Logging

The stack launcher streams the Ultravisor child process's output through Retold Remote's logger so you have a single log stream for both processes. Lines from the Ultravisor child are prefixed `[ultravisor]`, and stack-launcher events are prefixed `[stack]`:

```
[stack] launching ultravisor (port 54321)
[stack]   data:    /Users/steven/.local/share/ultravisor/datastore
[stack]   staging: /Users/steven/.local/share/ultravisor/staging
[ultravisor] UltravisorTaskTypeRegistry: 53 built-in task types registered.
[stack] ultravisor ready (after 1 attempts)
==========================================================
  Retold Remote running on http://localhost:7842
==========================================================
  Content: /mnt/nas/media
  Cache:   /Users/steven/.cache/retold-remote
  Browse:  http://localhost:7842/
  Beacon:  registered with Ultravisor at http://localhost:54321
  Stack:   ultravisor + retold-remote (orator-conversion embedded)
==========================================================
```

If you also pass `-l <path>`, both streams are written to the file as well.

## Shutdown

Press `Ctrl+C` once. The launcher will:

1. Log `Shutting down...`
2. Disconnect the Ultravisor beacon (so Ultravisor knows the worker is leaving cleanly)
3. Send `SIGTERM` to the Ultravisor child process
4. Wait up to 1 second for graceful exit
5. Send `SIGKILL` if it has not exited
6. Exit the main process

If the launcher reused an already-running Ultravisor (rather than spawning one), it will not kill that Ultravisor -- it only manages processes it started itself.

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  retold-stack /mnt/media                                    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Main process (retold-remote)                         │  │
│  │  ┌───────────────────────────────────────────────┐  │  │
│  │  │ Orator HTTP server (port 7000-7999)           │  │  │
│  │  │  ├─ Retold Remote routes (/api/media/...)     │  │  │
│  │  │  ├─ Orator-Conversion (/api/conversion/1.0/)  │  │  │
│  │  │  └─ Static web app (/)                        │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  │  ┌───────────────────────────────────────────────┐  │  │
│  │  │ Ultravisor Beacon client                      │  │  │
│  │  │  └─ Connects to localhost:54321               │  │  │
│  │  └───────────────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────────────┘  │
│                          ▲                                  │
│                          │ HTTP                             │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Child process (ultravisor)                           │  │
│  │  ├─ Coordinator API (port 54321)                     │  │
│  │  ├─ Beacon registry                                  │  │
│  │  ├─ Work queue journal                               │  │
│  │  └─ Web interface                                    │  │
│  │  Datastore: ~/.local/share/ultravisor/datastore/     │  │
│  └─────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

## Why Stack Mode?

Use `--stack` when you want a single command that brings up the full Retold experience:

- **Heavy media processing offloaded** through the Ultravisor beacon (video frame extraction, audio waveforms, ebook conversion, PDF page rendering)
- **Document conversion** via the embedded Orator-Conversion service (with the `doc-to-pdf` converter for Word, RTF, ODT, WordPerfect, etc.)
- **Persistent state** across launches (the Ultravisor datastore lives at a stable XDG location)
- **No port juggling** -- Ultravisor on its standard port 54321, Retold Remote on a random high port

Use the bare `retold-remote serve` command (without `--stack`) when you just want a quick gallery browser without the coordinator infrastructure.

## Comparison

| Feature | `retold-remote serve` | `retold-stack` |
|---------|----------------------|----------------|
| Gallery browser | [x] | [x] |
| Image/video/audio viewers | [x] | [x] |
| Document conversion (doc, rtf, etc.) | Embedded only | Embedded + dispatched |
| Heavy work offloading | No | Yes (via Ultravisor) |
| Spawns child processes | No | Yes (Ultravisor) |
| Default cache location | `./dist/retold-cache/` | `~/.cache/retold-remote/` |
| Survives `cd` | Yes | Yes (XDG paths are absolute) |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Could not locate the ultravisor package` | Run `npm install ultravisor` (or `npm install -g retold-remote` to get the bundled version) |
| `Ultravisor did not become ready within 30000ms` | Check the `[ultravisor]` log lines for an error. Common causes: port 54321 already bound by another process, missing dependencies, or invalid datastore path permissions |
| Stack mode hangs at `launching ultravisor` | Ultravisor's child process may be waiting on stdin or hitting an interactive prompt. Run with `-l <path>` to capture full logs |
| Beacon shows "not connected" | Ultravisor came up but the beacon registration failed. Check the Ultravisor child logs for errors and verify nothing is firewalling localhost:54321 |
| Want to override XDG paths | Set `XDG_DATA_HOME`, `XDG_CACHE_HOME`, or `XDG_CONFIG_HOME` in your environment before launching, or use the `-c` flag for the Retold Remote cache |
