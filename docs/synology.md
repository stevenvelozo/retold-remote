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
- **Architecture matters**: most Synology models are AMD64 (Intel/AMD), some newer ARM-based ones are ARM64. Check your model's CPU type at [Synology's spec sheet](https://www.synology.com/en-global/products). The build script picks a sensible default but you can override it with `--arm64` or `--amd64`.

## Step-by-Step Setup

### 1. On your dev machine: build the image

Clone the retold-remote repo (if you haven't already) and run the build script:

```bash
cd retold-remote

# Full image (3 GB) — includes LibreOffice + Calibre for doc conversion:
./docker-build-and-save.sh

# OR: slim image (1.8 GB) — no LibreOffice, no Calibre, no MOBI support:
./docker-build-and-save.sh slim

# Force a specific architecture if your NAS doesn't match your dev machine:
./docker-build-and-save.sh --amd64        # most Synology Intel/AMD models
./docker-build-and-save.sh slim --arm64   # ARM-based Synology + slim variant
```

This builds the image, then exports it to `retold-stack-image.tar.gz` (or `retold-stack-image-slim.tar.gz` for slim). Measured compressed sizes:

- **Full** (`retold-stack-image.tar.gz`): ~900 MB compressed (3 GB uncompressed)
- **Slim** (`retold-stack-image-slim.tar.gz`): ~425 MB compressed (1.81 GB uncompressed)

### 2. On the NAS: create the project folder

In File Station, navigate to `/volume1/docker/` (create the `docker` shared folder first if it doesn't exist). Create a subfolder named `retold-stack`.

The final path should be: `/volume1/docker/retold-stack/`

### 3. Transfer the image and compose file

Copy two files into that folder:

- `retold-stack-image.tar.gz` (or `-slim.tar.gz`)
- `docker-compose.yml` (from the retold-remote repo root)

You can use File Station upload, scp, or rsync. Example via scp:

```bash
scp retold-stack-image.tar.gz docker-compose.yml \
  admin@your-nas-ip:/volume1/docker/retold-stack/
```

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
