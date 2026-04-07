#!/bin/sh
# Retold Remote — Build and Save Image for NAS Transfer
#
# Builds the retold-stack Docker image locally, then exports it as a
# compressed tar file ready to be copied to a NAS or other Docker host.
#
# Usage:
#   ./docker-build-and-save.sh           # full image (LibreOffice + Calibre)
#   ./docker-build-and-save.sh slim      # smaller image without LibreOffice/Calibre
#   ./docker-build-and-save.sh --arm64   # build only for arm64 (matches most Synology models)
#   ./docker-build-and-save.sh --amd64   # build only for amd64 (Intel/AMD Synology models)
#
# Combine flags as needed:
#   ./docker-build-and-save.sh slim --arm64
#
# Output:
#   retold-stack-image.tar.gz          (full)
#   retold-stack-image-slim.tar.gz     (slim)
#
# After running, transfer the .tar.gz to your NAS and load it with:
#   docker load -i retold-stack-image.tar.gz
# Or in Synology Container Manager: Image → Add → Add From File.

set -e

# --- Parse arguments ---
VARIANT="full"
ARCH=""
TAG="latest"

for ARG in "$@"
do
	case "$ARG" in
		slim)
			VARIANT="slim"
			TAG="slim"
			;;
		full)
			VARIANT="full"
			TAG="latest"
			;;
		--arm64)
			ARCH="linux/arm64"
			;;
		--amd64)
			ARCH="linux/amd64"
			;;
		*)
			echo "Unknown argument: $ARG"
			echo "Usage: $0 [full|slim] [--arm64|--amd64]"
			exit 1
			;;
	esac
done

# --- Pick the right Dockerfile ---
if [ "$VARIANT" = "slim" ]; then
	DOCKERFILE="Dockerfile.slim"
	OUTPUT="retold-stack-image-slim.tar"
	IMAGE_TAG="retold-stack:slim"
else
	DOCKERFILE="Dockerfile"
	OUTPUT="retold-stack-image.tar"
	IMAGE_TAG="retold-stack:latest"
fi

if [ ! -f "$DOCKERFILE" ]; then
	echo "Error: $DOCKERFILE not found in current directory."
	echo "Run this script from the retold-remote project root."
	exit 1
fi

# --- Detect host architecture and prompt if not explicitly specified ---
HOST_ARCH=$(uname -m)
case "$HOST_ARCH" in
	x86_64|amd64) HOST_ARCH_NORMALIZED="amd64" ;;
	arm64|aarch64) HOST_ARCH_NORMALIZED="arm64" ;;
	*) HOST_ARCH_NORMALIZED="$HOST_ARCH" ;;
esac

if [ -z "$ARCH" ]; then
	# CRITICAL: don't silently default to host arch — most users build on a
	# Mac (arm64) and deploy to a Synology/Linux server (usually amd64).
	# Force them to think about it.
	echo "============================================================"
	echo "  ARCHITECTURE NOT SPECIFIED"
	echo "============================================================"
	echo
	echo "  You did not pass --amd64 or --arm64."
	echo
	echo "  Your host machine is: $HOST_ARCH_NORMALIZED ($HOST_ARCH)"
	echo
	echo "  WHERE WILL YOU RUN THIS IMAGE?"
	echo
	echo "    Most Synology NAS units, Intel/AMD servers, and Linux"
	echo "    desktops are amd64. Apple Silicon Macs (M1/M2/M3/M4),"
	echo "    Raspberry Pi 4/5, and some newer ARM servers are arm64."
	echo
	echo "    If you build the wrong arch and run it on the wrong host,"
	echo "    Docker will fall back to QEMU emulation. Native code"
	echo "    (sharp/libvips, ffmpeg, ImageMagick, LibreOffice) will be"
	echo "    extremely slow or hang on heavy operations."
	echo
	echo "  Re-run this script with the explicit target architecture:"
	echo
	echo "    ./docker-build-and-save.sh $VARIANT --amd64    # for Intel/AMD targets"
	echo "    ./docker-build-and-save.sh $VARIANT --arm64    # for ARM targets"
	echo
	echo "  Or set RETOLD_ARCH=amd64|arm64 in your environment to skip this prompt:"
	echo
	echo "    RETOLD_ARCH=amd64 ./docker-build-and-save.sh $VARIANT"
	echo "============================================================"

	if [ -n "$RETOLD_ARCH" ]; then
		case "$RETOLD_ARCH" in
			amd64) ARCH="linux/amd64" ;;
			arm64) ARCH="linux/arm64" ;;
			*)
				echo "Unknown RETOLD_ARCH value: $RETOLD_ARCH (use amd64 or arm64)"
				exit 1
				;;
		esac
		echo
		echo "  RETOLD_ARCH=$RETOLD_ARCH detected — building for $ARCH"
		echo
	else
		exit 1
	fi
fi

# Normalize the chosen target arch back into the simple form
case "$ARCH" in
	linux/amd64) TARGET_ARCH="amd64" ;;
	linux/arm64) TARGET_ARCH="arm64" ;;
	*) TARGET_ARCH="$ARCH" ;;
esac

echo "============================================================"
echo "  Retold Stack — Build and Save"
echo "============================================================"
echo "  Variant:    $VARIANT"
echo "  Dockerfile: $DOCKERFILE"
echo "  Tag:        $IMAGE_TAG"
echo "  Platform:   $ARCH"
echo "  Host arch:  $HOST_ARCH_NORMALIZED"
echo "  Output:     ${OUTPUT}.gz"
if [ "$TARGET_ARCH" != "$HOST_ARCH_NORMALIZED" ]; then
	echo
	echo "  NOTE: cross-arch build (host $HOST_ARCH_NORMALIZED -> target $TARGET_ARCH)"
	echo "  This requires QEMU and will be slower than a native build."
	echo "  Make sure 'docker buildx ls' shows multi-platform support."
fi
echo "============================================================"
echo

# --- Build the image ---
echo "[1/3] Building image (this may take 5-15 minutes)..."
docker buildx build \
	--platform "$ARCH" \
	-f "$DOCKERFILE" \
	-t "$IMAGE_TAG" \
	--load \
	.

# --- Save the image to a tar file ---
echo
echo "[2/3] Exporting image to $OUTPUT..."
docker save -o "$OUTPUT" "$IMAGE_TAG"

# --- Compress the tar file ---
echo
echo "[3/3] Compressing $OUTPUT (gzip)..."
gzip -f "$OUTPUT"

# --- Show the final size ---
SIZE=$(ls -lh "${OUTPUT}.gz" | awk '{print $5}')

echo
echo "============================================================"
echo "  Done."
echo "============================================================"
echo "  File:        ${OUTPUT}.gz"
echo "  Size:        $SIZE"
echo
echo "  Next steps (copy-paste friendly):"
echo
echo "  ----------------------------------------------------------"
echo "  1) Copy the image tarball + compose file to the NAS"
echo "  ----------------------------------------------------------"
echo "       scp -O ${OUTPUT}.gz nas-user@your-nas-ip:/volume1/docker/retold-stack/"
echo "       scp -O docker-compose.yml nas-user@your-nas-ip:/volume1/docker/retold-stack/"
echo
echo "     NOTE: the -O flag forces the legacy SCP protocol. OpenSSH 9.0+"
echo "     defaults to SFTP, which Synology's SFTP daemon mishandles for"
echo "     trailing-slash directory paths. Without -O you may see:"
echo "       scp: dest open '/volume1/docker/...': No such file or directory"
echo
echo "     The compose file only needs to be copied the FIRST time, or"
echo "     whenever you change it locally."
echo
echo "  ----------------------------------------------------------"
echo "  2) SSH into the NAS and cd into the stack folder"
echo "  ----------------------------------------------------------"
echo "       ssh nas-user@your-nas-ip"
echo "       cd /volume1/docker/retold-stack"
echo
echo "     All the commands below assume you're in this directory so"
echo "     they can use ./docker-compose.yml as a relative path."
echo
echo "  ----------------------------------------------------------"
echo "  3) Load the image and (re)start the stack — ONE LINER"
echo "  ----------------------------------------------------------"
echo "       sudo docker compose -f ./docker-compose.yml down && \\"
echo "         sudo docker load -i ${OUTPUT}.gz && \\"
echo "         sudo docker compose -f ./docker-compose.yml up -d"
echo
echo "     This is the command you'll run every time you upload a new"
echo "     image: it stops the running container, loads the fresh image"
echo "     into Docker's local store, and starts the new container in"
echo "     the background. Named volumes (cache, ultravisor data) are"
echo "     preserved across the restart."
echo
echo "  ----------------------------------------------------------"
echo "  4) Day-to-day commands"
echo "  ----------------------------------------------------------"
echo "       sudo docker compose -f ./docker-compose.yml up -d       # start"
echo "       sudo docker compose -f ./docker-compose.yml down        # stop + remove"
echo "       sudo docker compose -f ./docker-compose.yml restart     # restart in place"
echo "       sudo docker compose -f ./docker-compose.yml ps          # status"
echo "       sudo docker compose -f ./docker-compose.yml logs -f     # tail logs (Ctrl+C exits)"
echo
echo "     Quick health check:"
echo "       curl -s -o /dev/null -w '%{http_code}\\n' http://localhost:7777/"
echo
echo "  ----------------------------------------------------------"
echo "  5) Optional: shell aliases on the NAS (~/.profile)"
echo "  ----------------------------------------------------------"
echo "       alias rs-up='cd /volume1/docker/retold-stack && sudo docker compose -f ./docker-compose.yml up -d'"
echo "       alias rs-down='cd /volume1/docker/retold-stack && sudo docker compose -f ./docker-compose.yml down'"
echo "       alias rs-logs='cd /volume1/docker/retold-stack && sudo docker compose -f ./docker-compose.yml logs -f'"
echo "       alias rs-ps='cd /volume1/docker/retold-stack && sudo docker compose -f ./docker-compose.yml ps'"
echo "       alias rs-reload='cd /volume1/docker/retold-stack && sudo docker compose -f ./docker-compose.yml down && sudo docker load -i ${OUTPUT}.gz && sudo docker compose -f ./docker-compose.yml up -d'"
echo
echo "     Run 'source ~/.profile' (or log out/in) to pick them up."
echo
echo "  ----------------------------------------------------------"
echo "  Notes"
echo "  ----------------------------------------------------------"
echo "    - DSM 7.2+ uses 'docker compose' (v2 plugin). Older DSM may"
echo "      require 'docker-compose' (with hyphen, v1) instead."
echo "    - You can still use Container Manager's GUI alongside these"
echo "      CLI commands — they manipulate the same project."
echo "    - Browse to http://your-nas-ip:7777/ once the container is up."
echo "============================================================"
