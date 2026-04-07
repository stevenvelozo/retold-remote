# Synology Container Manager Setup

Run the full Retold stack on a Synology NAS using Container Manager (Synology's built-in Docker + Docker Compose package). This gives you a single self-contained container that runs Ultravisor, Retold Remote, and Orator-Conversion, with all optional media processing tools baked in.

## Why Build Elsewhere and Transfer?

**Don't try to build the image directly on the NAS** unless you have a beefy unit. Synology NASes are usually slow ARM or low-power x86 boxes, and building this image involves:

- Downloading ~1.5 GB of base packages (Calibre, LibreOffice, ffmpeg, etc.)
- Compiling sharp's native binding (slow on a Realtek SoC)
- Running ultravisor's webinterface postinstall

On a typical Synology, this can take **45+ minutes** and may run out of memory mid-build. Worse, if you only copy `docker-compose.yml` to the NAS without the source tree, Container Manager errors with:

```
unable to prepare context: unable to evaluate symlinks in Dockerfile path:
lstat /volume1/docker/retold-stack/Dockerfile: no such file or directory
```

The fix: **build the image on a real computer (your laptop, desktop, dev workstation), save it to a tar file, and load that tar on the NAS**. The included `docker-build-and-save.sh` script does the build and packaging in one step.

## Prerequisites

- **DSM 7.2 or newer** with **Container Manager** installed (Package Center → Install Container Manager)
- A development machine with **Docker installed** (Docker Desktop, OrbStack, Colima, or native Docker on Linux)
- At least **2 GB of free RAM** on the NAS for the running container
- A few GB of free disk space on the NAS for the loaded image and cache
- Your media folder somewhere on the NAS (e.g., `/volume1/media`, `/volume1/photo`, `/volume1/video`)

## ⚠️ ARCHITECTURE — READ THIS FIRST ⚠️

**This is the single most common cause of "videos and large images don't work" on a Synology.** Read it before building anything.

### Most Synology NAS units are amd64

Almost every Synology NAS — including all Celeron, Pentium, Atom, Ryzen, and Xeon-based models — is **amd64** (also called x86_64). Only a handful of low-end ARM-based models (e.g., DS118, DS220j, DS223j) are arm64.

**Find your NAS architecture:**

```bash
ssh admin@your-nas
uname -m
# x86_64  → amd64 (most Synology models)
# aarch64 → arm64 (a handful of low-end models)
```

Or check the [Synology spec sheet](https://www.synology.com/en-global/products) for your model under "CPU".

### Most build machines are different from the NAS

If you build the image on:

| Build machine | Build machine arch | Synology arch | Cross-arch? |
|---------------|--------------------|----|----|
| MacBook Pro (M1/M2/M3/M4) | arm64 | amd64 (most) | **YES** |
| MacBook Pro (Intel) | amd64 | amd64 (most) | No |
| Linux desktop (Intel/AMD) | amd64 | amd64 (most) | No |
| Raspberry Pi 4/5 | arm64 | amd64 (most) | **YES** |

If you build on an Apple Silicon Mac and your NAS is amd64 (the most common case), **you must explicitly pass `--amd64` to the build script** or you'll get an arm64 image that runs on the NAS through QEMU emulation. Native code (sharp/libvips, ffmpeg, ImageMagick, LibreOffice, Calibre) is **5-20x slower under emulation and frequently times out** — which produces exactly the symptoms of "small thumbnails work, large image previews and video frame extraction don't work".

### What the build script does about it

As of the current version, `./docker-build-and-save.sh` **refuses to run** without an explicit `--amd64` or `--arm64` flag. There is no silent default. This is intentional — it's safer to fail fast than to silently produce a broken image.

```bash
# CORRECT — explicit target:
./docker-build-and-save.sh --amd64               # for Intel/AMD Synology (most)
./docker-build-and-save.sh --arm64               # for ARM-based Synology
./docker-build-and-save.sh slim --amd64          # slim variant + amd64
```

### What the stack launcher does about it

When the container starts, the stack launcher checks for emulation signals (CPU vendor `VirtualApple`, `qemu` strings in `/proc/cpuinfo`, kernel/binary architecture mismatch, slow CPU loop benchmark) and prints a giant red warning if any are detected:

```
==========================================================
  WARNING: container is running under emulation!
==========================================================
  Reason: x86_64 binary on Apple Silicon (VirtualApple vendor)
  Node arch: x64
  CPU vendor: VirtualApple
  ...
  FIX: rebuild the image for the host architecture.
    ./docker-build-and-save.sh --amd64
==========================================================
```

If you see this warning in your container logs, **your image is the wrong architecture for the host**. Rebuild with the correct flag.

### What the smoke test does about it

The included `docker-smoke-test.sh` (run from your dev machine against any image tag) compares the image's stated architecture against the host arch and prints a warning before running the tests if they don't match. Failing tests under arch mismatch include a hint pointing at the rebuild command.

## Step-by-Step Setup

### 1. On your dev machine: build the image

Clone the retold-remote repo (if you haven't already) and run the build script. **You must pass `--amd64` or `--arm64`** — the script refuses to run without it (see the architecture section above for why).

```bash
cd retold-remote

# Full image (3 GB) — includes LibreOffice + Calibre for doc conversion
# Most Synology NAS units are amd64:
./docker-build-and-save.sh --amd64

# OR: slim image (1.8 GB) — no LibreOffice, no Calibre, no MOBI support
./docker-build-and-save.sh slim --amd64

# OR: ARM-based Synology (rare — only DS118, DS220j, DS223j, etc.):
./docker-build-and-save.sh --arm64
./docker-build-and-save.sh slim --arm64
```

This builds the image, then exports it to `retold-stack-image.tar.gz` (or `retold-stack-image-slim.tar.gz` for slim). Measured compressed sizes:

- **Full** (`retold-stack-image.tar.gz`): ~900 MB compressed (3 GB uncompressed)
- **Slim** (`retold-stack-image-slim.tar.gz`): ~425 MB compressed (1.81 GB uncompressed)

### 1.5. (Optional but recommended) Smoke-test the image locally

Before transferring the multi-hundred-MB image to your NAS, verify it works by running the included smoke test:

```bash
./docker-smoke-test.sh retold-stack:latest
```

This generates test fixtures (small/medium/large images, video, audio, PDF, RTF), spins up a temporary container against them, and exercises every API endpoint. You'll see output like:

```
Pre-flight checks
------------------------------------------------------------
Image:      retold-stack:latest
Image arch: amd64
Host arch:  arm64
WARNING: Architecture mismatch!
The image is amd64 but the host is arm64.
The container will run under QEMU emulation, which is very slow...
```

That warning at the top is **normal and expected** when you're cross-building on a Mac for an amd64 NAS — but tests that use heavy native code may time out under emulation. **The image will still work fine on the actual NAS** because there's no emulation there. If all tests pass even under emulation, you're golden.

If you want to skip emulation and just verify the build is correct, build a matching image for your build host arch and smoke-test that one too:

```bash
./docker-build-and-save.sh --arm64   # match your Mac
./docker-smoke-test.sh retold-stack:latest    # tests run native, fast
```

### 2. On the NAS: create the project folder

In File Station, navigate to `/volume1/docker/` (create the `docker` shared folder first if it doesn't exist). Create a subfolder named `retold-stack`.

The final path should be: `/volume1/docker/retold-stack/`

### 3. Transfer the image and compose file

Copy two files into that folder:

- `retold-stack-image.tar.gz` (or `-slim.tar.gz`)
- `docker-compose.yml` (from the retold-remote repo root)

You can use File Station upload, scp, or rsync. Example via scp:

```bash
# Use the -O flag to force the legacy SCP protocol — see the note below.
scp -O retold-stack-image.tar.gz docker-compose.yml \
  admin@your-nas-ip:/volume1/docker/retold-stack/
```

> **Heads up — OpenSSH 9.0+ scp gotcha:** Modern scp (OpenSSH 9.0 and later) defaults to SFTP under the hood, and Synology's SFTP daemon errors out with `dest open ".../foo/": No such file or directory` on trailing-slash directory destinations even when the directory exists and you have full read/write access.
>
> The `-O` flag forces the legacy SCP/RCP protocol and sidesteps the issue. If `-O` still gives you trouble, try one of these alternatives:
>
> ```bash
> # Specify the destination filename explicitly (no trailing slash)
> scp retold-stack-image.tar.gz \
>   admin@your-nas-ip:/volume1/docker/retold-stack/retold-stack-image.tar.gz
>
> # Or use rsync, which is unaffected
> rsync -avh --progress retold-stack-image.tar.gz docker-compose.yml \
>   admin@your-nas-ip:/volume1/docker/retold-stack/
> ```
>
> If even rsync fails with permission errors, check **DSM Control Panel → File Services → FTP → SFTP** and make sure **Enable SFTP service** is checked. SSH access and SFTP are separate switches in DSM.

### 4. Load the image on the NAS

There are two ways to do this — pick whichever feels easier.

**Option A: Container Manager UI**

1. Open **Container Manager** → **Image** → **Add** → **Add From File**
2. Browse to `/volume1/docker/retold-stack/retold-stack-image.tar.gz` and select it
3. Wait for the import to finish (a couple of minutes — it's decompressing 1+ GB)

**Option B: SSH (faster)**

```bash
ssh admin@your-nas-ip
cd /volume1/docker/retold-stack
sudo docker load -i retold-stack-image.tar.gz
```

You should see something like:

```
Loaded image: retold-stack:latest
```

### 5. Edit the media volume path in docker-compose.yml

Open `docker-compose.yml` in File Station's text editor or via SSH. By default the media volume uses an environment variable with a fallback:

```yaml
volumes:
  - ${MEDIA_PATH:-./media}:/media:ro
```

Container Manager doesn't set environment variables by default, so **replace that line** with your actual media path:

```yaml
volumes:
  - /volume1/media:/media:ro   # ← your NAS media folder
```

Common choices:

| If your media lives in... | Use this |
|---------------------------|----------|
| `/volume1/media` | `- /volume1/media:/media:ro` |
| `/volume1/photo` (Photo Station) | `- /volume1/photo:/media:ro` |
| `/volume1/video` (Video Station) | `- /volume1/video:/media:ro` |
| `/volume1/music` | `- /volume1/music:/media:ro` |
| Multiple folders | See [Multiple Media Folders](#multiple-media-folders) below |

The `:ro` suffix means read-only — the container can browse but never modify your media. Leave this unless you need collection export to write back to the media folder (use `:rw` in that case).

### 6. Create the project in Container Manager

1. Open **Container Manager** from the Synology main menu
2. Click **Project** in the left sidebar
3. Click **Create**
4. Fill in the form:
   - **Project name**: `retold-stack`
   - **Path**: `/volume1/docker/retold-stack/`
   - **Source**: `Use existing docker-compose.yml`
5. Container Manager will read the compose file and show the service it detected (`retold-stack`)
6. Click **Next**, review the settings, and click **Done**

Because the compose file uses `image: retold-stack:latest` (not `build:`), Container Manager skips the build step entirely. It just creates the named volumes and starts the container — usually within 30 seconds.

### 7. Browse to the web UI

Once the container is running (look for "Running" status in Container Manager), open:

```
http://your-nas-ip:7777/
```

You should see the Retold Remote gallery showing the contents of the folder you mounted.

The Ultravisor web interface is also available at `http://your-nas-ip:54321/` for monitoring the beacon mesh and work queue.

## Pulling From a Registry Instead

If you've published the image to a registry (Docker Hub, GitHub Container Registry, your own private registry), you can skip the build-and-transfer dance entirely. Edit `docker-compose.yml`:

```yaml
services:
  retold-stack:
    image: ghcr.io/yourname/retold-stack:latest    # ← your registry path
```

Then before creating the project on the NAS, run `docker login <registry>` via SSH if it's a private registry. Container Manager will pull the image automatically when the project starts.

This is the cleanest workflow if you maintain a CI pipeline that publishes images on every commit.

## Building From Source on the NAS (Not Recommended)

If you really want to build on the NAS itself (e.g., to make local modifications to the source):

1. Copy the **entire** retold-remote source tree to `/volume1/docker/retold-stack/` — including `Dockerfile`, `package.json`, `package-lock.json`, `source/`, `web-application/`, `css/`, `html/`, and `.dockerignore`. The folder structure must match the repo exactly.
2. Edit `docker-compose.yml`:
   - Comment out the `image: retold-stack:latest` line
   - Uncomment the `build:` block
3. In Container Manager → Project → Create, point at the folder. Container Manager will run `docker build` against the local Dockerfile.

Expect this to take **30-60 minutes** on most NAS hardware and roughly **5 GB of free space** during the build (intermediate layers + base image + final image). It's almost always faster to build on a real machine and transfer the tar.

## Resource Considerations

The default compose file sets conservative limits:

```yaml
deploy:
  resources:
    limits:
      memory: 2G
    reservations:
      memory: 512M
```

Adjust these based on your NAS hardware:

| NAS Model | Total RAM | Recommended `memory` limit |
|-----------|-----------|---------------------------|
| Low-end (DS120j, DS220j) | 512 MB - 1 GB | Use `Dockerfile.slim`, limit to 512 MB |
| Mid-range (DS220+, DS920+) | 2-4 GB | 1-2 GB (default 2G works) |
| High-end (DS1621+, DS923+) | 4-32 GB | 2-8 GB |

LibreOffice and Calibre conversions can spike memory usage — if you see OOM kills in the logs, bump the limit up.

### Low-RAM NAS: Use the Slim Variant

If your NAS has limited RAM (under 2 GB) or limited disk space, build the slim variant on your dev machine instead:

```bash
./docker-build-and-save.sh slim
```

This produces `retold-stack-image-slim.tar.gz` (~600 MB compressed). Transfer and load it the same way as the full image — it tags itself as `retold-stack:slim`. Then update the compose file's image line:

```yaml
image: retold-stack:slim   # ← was retold-stack:latest
```

The slim variant:
- **1.81 GB** uncompressed instead of 3.0 GB (about 1.2 GB smaller)
- Still supports all image, video, audio, PDF, and EPUB features
- **Does not** support DOC, DOCX, RTF, ODT, WPD, MOBI, or PowerPoint/Excel
- **Does not** support MOBI→EPUB conversion

## Volume Mounts Explained

The compose file defines four volume mounts:

| Mount | Path in container | Purpose |
|-------|-------------------|---------|
| `/volume1/media:/media:ro` | `/media` | Your media folder (read-only) |
| `retold-cache:/cache` | `/cache` | Thumbnails, video frames, audio waveforms, converted PDFs, DZI tiles |
| `ultravisor-data:/data` | `/data` | Ultravisor datastore + work queue journal + staging |
| `retold-config:/config` | `/config` | Generated stack config files |

The last three are **named Docker volumes** — Synology stores them under `/volume1/@docker/volumes/retold-stack_<name>/`. They persist across container restarts and image rebuilds.

### Using Host Folders Instead

If you prefer to manage the cache/data as regular folders you can see in File Station, replace the named volumes with bind mounts:

```yaml
volumes:
  - /volume1/media:/media:ro
  - /volume1/docker/retold-stack/cache:/cache
  - /volume1/docker/retold-stack/data:/data
  - /volume1/docker/retold-stack/config:/config

# And remove the `volumes:` block at the bottom of the file.
```

Then create those subfolders in File Station before starting the project.

## Multiple Media Folders

To browse multiple top-level folders as one unified content tree, create a parent folder and mount it:

```bash
# On the NAS (via SSH or File Station)
mkdir /volume1/retold-media
ln -s /volume1/photo /volume1/retold-media/Photos
ln -s /volume1/video /volume1/retold-media/Videos
ln -s /volume1/music /volume1/retold-media/Music
ln -s /volume1/ebooks /volume1/retold-media/Books
```

Then mount `/volume1/retold-media` as the media volume. The gallery will show each linked folder as a top-level entry.

Alternatively, you can mount multiple folders to different paths inside the container:

```yaml
volumes:
  - /volume1/photo:/media/Photos:ro
  - /volume1/video:/media/Videos:ro
  - /volume1/music:/media/Music:ro
  - /volume1/ebooks:/media/Books:ro
```

Either approach works — the first is simpler for large numbers of folders.

## Updating the Container

When a new version of Retold Remote is released:

1. On your dev machine, pull the latest retold-remote repo
2. Re-run `./docker-build-and-save.sh` to produce a new tar.gz
3. Copy the new tar.gz to the NAS, overwriting the old one
4. SSH into the NAS and run:
   ```bash
   sudo docker load -i retold-stack-image.tar.gz
   ```
   (or use Container Manager → Image → Add → Add From File again)
5. In Container Manager → Project → `retold-stack` → **Stop**, then **Start**

The container will restart using the freshly loaded image. Your cache, datastore, and config are stored in named volumes so they survive the update untouched.

If you're pulling from a registry instead, just `docker compose pull && docker compose up -d` (or use Container Manager's Reset action on the container).

## Reverse Proxy (HTTPS Access)

If you want to expose Retold Remote over HTTPS via a domain name, use Synology's built-in reverse proxy:

1. **Control Panel** → **Login Portal** → **Advanced** → **Reverse Proxy**
2. Click **Create** and fill in:
   - **Source protocol**: HTTPS
   - **Source hostname**: `media.yourdomain.com` (or whatever subdomain you prefer)
   - **Source port**: 443
   - **Destination protocol**: HTTP
   - **Destination hostname**: `localhost`
   - **Destination port**: 7777
3. On the **Custom Header** tab, add **WebSocket** (auto-generated rules)
4. Save

You can then access Retold Remote at `https://media.yourdomain.com/` with Synology's Let's Encrypt certificate.

## Troubleshooting

### "Small images work but videos and large images don't" (the most common issue)

If the gallery loads, small thumbnails appear, but anything that needs heavy processing (large image previews, video frame extraction, audio waveforms, document conversion) silently fails or hangs — **you almost certainly have an architecture mismatch**.

**Quick diagnosis:**

1. SSH into the NAS and check the container logs:
   ```bash
   sudo docker logs retold-stack 2>&1 | grep -E "WARNING|emulation|VirtualApple"
   ```
   If you see `WARNING: container is running under emulation!`, that's your answer.

2. From your dev machine, run the smoke test against the same image you transferred:
   ```bash
   ./docker-smoke-test.sh retold-stack:latest
   ```
   It will report `Image arch: ...` and `Host arch: ...` and tell you exactly what to do.

**Fix:**

```bash
# On your dev machine, rebuild with the correct target arch:
./docker-build-and-save.sh --amd64    # most Synology models (Celeron/Pentium/Atom/Ryzen/Xeon)
# Or:
./docker-build-and-save.sh --arm64    # the few ARM-based Synology models

# Transfer the new tar.gz to the NAS:
scp -O retold-stack-image.tar.gz steven@your-nas:/volume1/docker/retold-stack/

# On the NAS:
sudo docker load -i /volume1/docker/retold-stack/retold-stack-image.tar.gz

# Restart the project in Container Manager (Stop, then Start)
```

### scp error: `dest open ".../folder/": No such file or directory`

This is the OpenSSH 9.0+ scp/SFTP gotcha. Modern scp uses SFTP under the hood, and Synology's SFTP daemon stumbles on trailing-slash directory paths even when the directory exists. **Fix:** add `-O` to force the legacy SCP protocol:

```bash
scp -O retold-stack-image.tar.gz steven@nas-ip:/volume1/docker/retold-stack/
```

If `-O` still doesn't work, try specifying the destination filename explicitly (no trailing slash), or use `rsync` instead:

```bash
rsync -avh --progress retold-stack-image.tar.gz steven@nas-ip:/volume1/docker/retold-stack/
```

If even rsync fails, check that SFTP is actually enabled at **DSM Control Panel → File Services → FTP → SFTP → Enable SFTP service**. SSH access and SFTP are separate toggles in DSM.

### Project creation error: "unable to evaluate symlinks in Dockerfile path"

```
unable to prepare context: unable to evaluate symlinks in Dockerfile path:
lstat /volume1/docker/retold-stack/Dockerfile: no such file or directory
```

This means your `docker-compose.yml` is using `build:` instead of `image:`, but the Dockerfile and source tree are not in the project folder. **Fix:**

1. Make sure the compose file's services block looks like this:
   ```yaml
   services:
     retold-stack:
       image: retold-stack:latest
       # build:               ← must be commented out
       #   context: .
       #   dockerfile: Dockerfile
   ```
2. Make sure you've actually loaded the image first: `sudo docker load -i retold-stack-image.tar.gz` (or via Container Manager's Image → Add → From File). Verify with `sudo docker images | grep retold-stack`.
3. Recreate the project in Container Manager.

### Other common issues

| Symptom | Fix |
|---------|-----|
| `image not found: retold-stack:latest` | You forgot step 4 (load the image). Run `sudo docker load -i retold-stack-image.tar.gz` first, then start the project. |
| `exec format error` when starting the container | The image was built for the wrong CPU architecture. Most Synology models are AMD64. Rebuild with `./docker-build-and-save.sh --amd64` (or `--arm64` for ARM-based models) and reload. |
| Container won't start, logs show "permission denied" on /media | The `node` user inside the container (UID 1000) can't read your media folder. Either chmod the folder to world-readable, or run the container as a different user with `user: "0:0"` in compose (runs as root — less secure but works) |
| Logs show "Ultravisor did not become ready within 30000ms" | Resource-constrained NAS. Increase the memory limit in compose, or use the slim variant |
| Port 7777 already in use | Change the host-side port in compose: `- "8080:7777"` (leaves container side on 7777) |
| Can't reach http://nas-ip:7777/ from another machine | Check Synology **Control Panel → Security → Firewall**. Make sure port 7777 is allowed. |
| Thumbnails are slow / CPU spikes | Normal during first browse — thumbnails are generated on demand and cached. Subsequent browses of the same folder will be instant. |
| Container uses too much memory | Reduce the `memory:` limit in compose, or use the slim variant to drop Calibre and LibreOffice |
| Collection export fails with "Destination path must be within the content root" | Remember that exports go to subfolders of the `/media` mount. If you mounted `:ro` you'll need to change it to `:rw` or mount a separate writable folder |

### Viewing Logs

In Container Manager → Container → `retold-stack` → **Details** → **Log** tab. You'll see output from both the main retold-remote process and the child ultravisor process, with `[ultravisor]` prefixes for the latter.

Via SSH:

```bash
docker logs -f retold-stack
```

### SSH Into the Running Container

```bash
docker exec -it retold-stack /bin/bash
```

Useful for checking installed tools (`which ffmpeg`, `soffice --version`, etc.), inspecting cache contents at `/cache`, or testing conversions manually.

## Performance Tips

- **Store the cache on SSD** if your NAS has an M.2 SSD cache — thumbnails are I/O-intensive
- **Use a faster network** — the 54321 port between the beacon (retold-remote) and the coordinator (ultravisor) is localhost, but media I/O from `/volume1` benefits from good disk speed
- **Preload thumbnails** by browsing a folder once; subsequent visits hit the cache
- **Adjust the memory limit upward** if you regularly browse very large images (>100 MP) or convert long documents — LibreOffice spikes can hit 1.5 GB
- **Disable hashing** (`--no-hash` in CMD, already the default) for slightly faster URL resolution on resource-constrained NAS units

## Architecture Inside the Container

```
┌────────────────────────────────────────────────────────────┐
│ Container: retold-stack                                    │
│                                                            │
│  Node process 1 (main): retold-remote                     │
│   ├─ HTTP server on :7777                                  │
│   ├─ Orator-Conversion embedded                            │
│   └─ Ultravisor Beacon client → connects to :54321        │
│                                                            │
│  Node process 2 (child): ultravisor                       │
│   ├─ HTTP server on :54321                                │
│   ├─ Datastore at /data/ultravisor/datastore               │
│   └─ Staging at /data/ultravisor/staging                   │
│                                                            │
│  Shell tools available:                                    │
│   ffmpeg, ffprobe, sharp (native), convert, 7z,           │
│   pdftk, pdftoppm, soffice, ebook-convert,                │
│   audiowaveform, exiftool, dcraw                          │
│                                                            │
│  Volumes:                                                  │
│   /media (ro, host media folder)                           │
│   /cache (rw, named volume: retold-cache)                  │
│   /data (rw, named volume: ultravisor-data)                │
│   /config (rw, named volume: retold-config)                │
└────────────────────────────────────────────────────────────┘
              │                              │
              ▼                              ▼
      http://nas:7777/              http://nas:54321/
      (Retold Remote UI)            (Ultravisor UI)
```

## Uninstalling

In Container Manager → Project → `retold-stack` → **Stop** → **Delete**.

To also remove the cached data:

```bash
# Via SSH
docker volume rm retold-stack_retold-cache retold-stack_ultravisor-data retold-stack_retold-config
```

The media folder on your NAS is never touched (the container only has read access).
