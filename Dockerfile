# Retold Remote — Full Stack Dockerfile
#
# Builds an image that runs the full Retold stack:
#   - Ultravisor (mesh coordinator) as a child process
#   - Retold Remote media browser (main process)
#   - Orator-Conversion (embedded inside Retold Remote)
#
# Includes all optional tools:
#   - ffmpeg / ffprobe  — video/audio thumbnails, frame extraction, waveforms
#   - ImageMagick       — fallback image thumbnails
#   - 7-Zip             — archive browsing (rar, 7z, tar.*)
#   - poppler-utils     — pdftoppm, pdftotext (for Orator-Conversion PDF endpoints)
#   - pdftk-java        — PDF page extraction (Orator-Conversion PDF endpoints)
#   - LibreOffice       — doc/docx/rtf/odt/wpd/ppt/xls to PDF conversion
#   - Calibre           — MOBI/AZW to EPUB (and fallback doc-to-pdf)
#   - audiowaveform     — faster audio waveform peak generation
#   - exiftool          — EXIF/metadata extraction
#   - dcraw             — raw camera image decoding
#
# Image size note: Calibre and LibreOffice are each several hundred MB.
# If you don't need document conversion, use Dockerfile.slim instead.

FROM node:20-slim

# Install all optional media processing tools in a single layer.
# Note: audiowaveform is not in the default Debian repos — retold-remote
# falls back to ffprobe + ffmpeg for waveform generation, which works fine.
RUN apt-get update && apt-get install -y --no-install-recommends \
		ffmpeg \
		imagemagick \
		p7zip-full \
		poppler-utils \
		pdftk-java \
		libreoffice-core \
		libreoffice-writer \
		libreoffice-calc \
		libreoffice-impress \
		calibre \
		exiftool \
		dcraw \
		ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies.
#
# Notes:
# - Prefer `npm ci` for reproducible builds; fall back to `npm install`
#   when the lock file is out of sync with package.json.
# - `--ignore-scripts` skips postinstall hooks; ultravisor's postinstall
#   tries to build its web interface with devDependencies (quack) which
#   aren't available here. The web interface is shipped pre-built in the
#   published package, so skipping postinstall is safe.
COPY package.json package-lock.json* ./
RUN (npm ci --omit=dev --no-audit --no-fund --ignore-scripts \
		|| npm install --omit=dev --no-audit --no-fund --ignore-scripts) \
	&& npm cache clean --force

# Copy application source and built assets
COPY source/ source/
COPY web-application/ web-application/
COPY css/ css/
COPY html/ html/

# XDG-style data paths — these are the volume mount points
#   /media   — media folder (mount read-only)
#   /cache   — Retold Remote cache (thumbnails, frames, waveforms, conversions)
#   /data    — Ultravisor datastore + staging
#   /config  — Stack config files
ENV XDG_CACHE_HOME=/cache \
	XDG_DATA_HOME=/data \
	XDG_CONFIG_HOME=/config \
	NODE_ENV=production

RUN mkdir -p /media /cache /data /config \
	&& mkdir -p /cache/retold-remote \
	&& mkdir -p /data/ultravisor/datastore /data/ultravisor/staging \
	&& mkdir -p /config/retold-stack

# Pin ports so they're predictable for host port mapping:
#   7777 — Retold Remote (web UI)
#   54321 — Ultravisor (coordinator + web interface)
EXPOSE 7777 54321

# Default: launch the full stack against /media with a fixed port.
# Override by passing your own command to `docker run`.
CMD ["node", "source/cli/RetoldRemote-Stack-Run.js", "/media", "-p", "7777", "--no-hash"]
