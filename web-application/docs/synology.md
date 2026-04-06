# Synology Container Manager Setup

Run the full Retold stack on a Synology NAS using Container Manager (Synology's built-in Docker + Docker Compose package). This gives you a single self-contained container that runs Ultravisor, Retold Remote, and Orator-Conversion, with all optional media processing tools baked in.

## Prerequisites

- **DSM 7.2 or newer** with **Container Manager** installed (Package Center → Install Container Manager)
- At least **2 GB of free RAM** on the NAS for the container
- Some **free disk space** for the cache (~500 MB initial + thumbnails/frames as you browse)
- Your media folder somewhere on the NAS (e.g., `/volume1/media`, `/volume1/photo`, `/volume1/video`)

## Quick Setup (Project Method)

This is the easiest way to get going — no SSH required.

### 1. Create the project folder

In File Station, navigate to `/volume1/docker/` (create the `docker` shared folder first if it doesn't exist). Create a subfolder named `retold-stack`.

The final path should be: `/volume1/docker/retold-stack/`

### 2. Copy the docker-compose.yml

Copy the `docker-compose.yml` from the retold-remote repository into that folder. You can do this via File Station upload or SSH.

### 3. Edit the media volume path

Open `docker-compose.yml` in a text editor. By default, the media volume uses an environment variable with a fallback:

```yaml
volumes:
  - ${MEDIA_PATH:-./media}:/media:ro
```

For Synology, **replace that line** with your actual media path (hard-coding it is simplest for Container Manager, which doesn't set env variables by default):

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

### 4. Create the project in Container Manager

1. Open **Container Manager** from the Synology main menu
2. Click **Project** in the left sidebar
3. Click **Create**
4. Fill in the form:
   - **Project name**: `retold-stack`
   - **Path**: `/volume1/docker/retold-stack/`
   - **Source**: `Use existing docker-compose.yml`
5. Container Manager will read the compose file and show the services it detected
6. Click **Next**, review the settings, and click **Done**

Container Manager will now:
- Build the Docker image (the full image is **3.0 GB**, takes 5-15 minutes the first time depending on NAS CPU and download speed — slim variant is **1.81 GB**)
- Create the named volumes (`retold-cache`, `ultravisor-data`, `retold-config`)
- Start the container
- Stream build logs to the UI

### 5. Browse to the web UI

Once the container is running (look for "Running" status in Container Manager), open:

```
http://your-nas-ip:7777/
```

You should see the Retold Remote gallery showing the contents of the folder you mounted.

The Ultravisor web interface is also available at `http://your-nas-ip:54321/` for monitoring the beacon mesh and work queue.

## Pulling a Pre-Built Image

If you have a pre-built image published somewhere (Docker Hub, GitHub Container Registry, etc.), you can skip the build step. Edit `docker-compose.yml`:

```yaml
services:
  retold-stack:
    image: your-registry/retold-stack:latest    # ← instead of build:
    # build:
    #   context: .
    #   dockerfile: Dockerfile
    ...
```

Then in Container Manager, when you create the project, it will pull the image instead of building it. This takes ~2 minutes instead of 15.

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

If your NAS has limited RAM (under 2 GB) or limited disk space, change `Dockerfile` to `Dockerfile.slim` in `docker-compose.yml`:

```yaml
build:
  context: .
  dockerfile: Dockerfile.slim    # ← skip LibreOffice + Calibre
```

The slim variant:
- **1.81 GB** instead of 3.0 GB (about 1.2 GB smaller)
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

### If you built from source

1. Pull the latest retold-remote repo
2. In Container Manager → Project → `retold-stack`
3. Click **Stop**
4. Click **Build** (rebuilds from the updated Dockerfile)
5. Click **Start**

### If you're using a pre-built image

1. In Container Manager → Project → `retold-stack`
2. Click the container → **Details** → **Action** → **Reset** (pulls the latest image)
3. Or via SSH: `docker compose pull && docker compose up -d`

Your cache, datastore, and config are stored in named volumes so they survive the rebuild.

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

| Symptom | Fix |
|---------|-----|
| Container won't start, logs show "permission denied" on /media | The `node` user inside the container (UID 1000) can't read your media folder. Either chmod the folder to world-readable, or run the container as a different user with `user: "0:0"` in compose (runs as root — less secure but works) |
| Build fails at `apt-get install libreoffice` | Low disk space during build. Free up space on the volume hosting `/var/lib/docker` (usually `/volume1`). Or use `Dockerfile.slim` |
| Logs show "Ultravisor did not become ready within 30000ms" | Resource-constrained NAS. Increase the memory limit in compose, or use the slim variant |
| Port 7777 already in use | Change the host-side port in compose: `- "8080:7777"` (leaves container side on 7777) |
| Can't reach http://nas-ip:7777/ from another machine | Check Synology **Control Panel → Security → Firewall**. Make sure port 7777 is allowed. |
| Thumbnails are slow / CPU spikes | Normal during first browse — thumbnails are generated on demand and cached. Subsequent browses of the same folder will be instant. |
| Container uses too much memory | Reduce the `memory:` limit in compose, or switch to `Dockerfile.slim` to drop Calibre and LibreOffice |
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
