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

# --- Detect architecture if not specified ---
if [ -z "$ARCH" ]; then
	HOST_ARCH=$(uname -m)
	case "$HOST_ARCH" in
		x86_64|amd64)
			ARCH="linux/amd64"
			;;
		arm64|aarch64)
			ARCH="linux/arm64"
			;;
		*)
			echo "Unknown host architecture: $HOST_ARCH"
			echo "Specify --arm64 or --amd64 explicitly."
			exit 1
			;;
	esac
fi

echo "============================================================"
echo "  Retold Stack — Build and Save"
echo "============================================================"
echo "  Variant:    $VARIANT"
echo "  Dockerfile: $DOCKERFILE"
echo "  Tag:        $IMAGE_TAG"
echo "  Platform:   $ARCH"
echo "  Output:     ${OUTPUT}.gz"
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
echo "  Next steps:"
echo "    1. Copy ${OUTPUT}.gz to your NAS, e.g. via scp:"
echo "         scp ${OUTPUT}.gz nas-user@your-nas-ip:/volume1/docker/retold-stack/"
echo
echo "    2. Also copy docker-compose.yml to the same folder."
echo
echo "    3. SSH into the NAS and load the image:"
echo "         cd /volume1/docker/retold-stack"
echo "         sudo docker load -i ${OUTPUT}.gz"
echo
echo "       Or use Container Manager → Image → Add → Add From File."
echo
echo "    4. In Container Manager, create a Project pointing at"
echo "       /volume1/docker/retold-stack/ and use the existing"
echo "       docker-compose.yml."
echo "============================================================"
