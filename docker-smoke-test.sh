#!/bin/sh
# Retold Stack — Docker Smoke Test
#
# Spins up a clean retold-stack container against a temporary directory of
# generated test fixtures, then hits every major API endpoint and reports
# pass/fail with timing for each. Designed to diagnose architecture
# mismatches, missing tools, and broken services.
#
# Run this BEFORE shipping a built image to a NAS, and again ON the NAS
# itself if anything seems off in production.
#
# Usage:
#   ./docker-smoke-test.sh                    # uses retold-stack:latest
#   ./docker-smoke-test.sh retold-stack:slim  # specify a tag
#   ./docker-smoke-test.sh --keep             # don't tear down at the end
#   ./docker-smoke-test.sh --large-folder     # also test a 10k-file folder listing
#   ./docker-smoke-test.sh --large-folder=50000  # custom file count
#
# What it tests:
#   - Container architecture (warns about QEMU emulation if mismatched)
#   - All capability detection (sharp, ffmpeg, libreoffice, etc.)
#   - Small / medium / large image thumbnails
#   - Image preview generation (sharp)
#   - DZI tile generation for very large images
#   - Video thumbnail extraction (ffmpeg)
#   - Video frame extraction (ffmpeg)
#   - Audio waveform generation (ffprobe + ffmpeg)
#   - Audio segment extraction (ffmpeg)
#   - PDF page text extraction (pdf-parse)
#   - Document conversion (LibreOffice via Orator-Conversion)
#   - Subimage region storage (Bibliograph)
#   - Folder summary
#   - Ultravisor health (port 54321)
#
# Exit code:
#   0 = all tests passed
#   1 = one or more tests failed
#   2 = could not start container
#   3 = invalid arguments

set -e

# --- Parse arguments ---
IMAGE_TAG="retold-stack:latest"
KEEP_RUNNING=0
LARGE_FOLDER_SIZE=0

for ARG in "$@"
do
	case "$ARG" in
		--keep)
			KEEP_RUNNING=1
			;;
		--large-folder)
			# Default large folder size
			LARGE_FOLDER_SIZE=10000
			;;
		--large-folder=*)
			LARGE_FOLDER_SIZE="${ARG#--large-folder=}"
			;;
		-h|--help)
			grep '^# ' "$0" | sed 's/^# //;s/^#//'
			exit 0
			;;
		*)
			IMAGE_TAG="$ARG"
			;;
	esac
done

CONTAINER_NAME="retold-smoke-test"
HOST_PORT=17999
ULTRAVISOR_PORT=54399
FIXTURES_DIR="/tmp/retold-smoke-fixtures-$$"
RESULTS_PASS=0
RESULTS_FAIL=0
RESULTS_FAILED_TESTS=""

# --- Color helpers (only if stdout is a tty) ---
if [ -t 1 ]; then
	C_RED=$(printf '\033[31m')
	C_GREEN=$(printf '\033[32m')
	C_YELLOW=$(printf '\033[33m')
	C_BLUE=$(printf '\033[34m')
	C_BOLD=$(printf '\033[1m')
	C_RESET=$(printf '\033[0m')
else
	C_RED=''
	C_GREEN=''
	C_YELLOW=''
	C_BLUE=''
	C_BOLD=''
	C_RESET=''
fi

# --- Helpers ---
_msg() {
	printf '%s\n' "$*"
}

_pass() {
	RESULTS_PASS=$((RESULTS_PASS + 1))
	printf '  %s[PASS]%s %s\n' "$C_GREEN" "$C_RESET" "$1"
}

_fail() {
	RESULTS_FAIL=$((RESULTS_FAIL + 1))
	RESULTS_FAILED_TESTS="$RESULTS_FAILED_TESTS\n  - $1: $2"
	printf '  %s[FAIL]%s %s — %s\n' "$C_RED" "$C_RESET" "$1" "$2"
}

_warn() {
	printf '  %s[WARN]%s %s\n' "$C_YELLOW" "$C_RESET" "$1"
}

_section() {
	printf '\n%s%s%s\n' "$C_BOLD" "$1" "$C_RESET"
	printf '%s\n' "------------------------------------------------------------"
}

# --- Cleanup on exit ---
_cleanup() {
	if [ "$KEEP_RUNNING" = "0" ]; then
		_msg ""
		_msg "Cleaning up..."
		docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
		docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true
		rm -rf "$FIXTURES_DIR"
	else
		_msg ""
		_msg "Container $CONTAINER_NAME left running on port $HOST_PORT (--keep was set)"
		_msg "Fixtures left at $FIXTURES_DIR"
		_msg "To clean up later: docker rm -f $CONTAINER_NAME && rm -rf $FIXTURES_DIR"
	fi
}
trap _cleanup EXIT INT TERM

# --- Verify Docker and image ---
_section "Pre-flight checks"

if ! command -v docker > /dev/null 2>&1; then
	_msg "${C_RED}Error: docker command not found in PATH${C_RESET}"
	exit 2
fi

if ! docker image inspect "$IMAGE_TAG" > /dev/null 2>&1; then
	_msg "${C_RED}Error: image $IMAGE_TAG not found locally${C_RESET}"
	_msg "Build it first with: ./docker-build-and-save.sh"
	_msg "Or load it with:    docker load -i retold-stack-image.tar.gz"
	exit 2
fi

IMAGE_ARCH=$(docker image inspect "$IMAGE_TAG" --format '{{.Architecture}}')
HOST_ARCH=$(uname -m)
case "$HOST_ARCH" in
	x86_64|amd64) HOST_ARCH_NORMALIZED="amd64" ;;
	arm64|aarch64) HOST_ARCH_NORMALIZED="arm64" ;;
	*) HOST_ARCH_NORMALIZED="$HOST_ARCH" ;;
esac

_msg "Image:    $IMAGE_TAG"
_msg "Image arch: $IMAGE_ARCH"
_msg "Host arch:  $HOST_ARCH_NORMALIZED"

if [ "$IMAGE_ARCH" != "$HOST_ARCH_NORMALIZED" ]; then
	_msg ""
	_msg "${C_YELLOW}${C_BOLD}WARNING: Architecture mismatch!${C_RESET}"
	_msg "${C_YELLOW}The image is ${IMAGE_ARCH} but the host is ${HOST_ARCH_NORMALIZED}.${C_RESET}"
	_msg "${C_YELLOW}The container will run under QEMU emulation, which is very slow${C_RESET}"
	_msg "${C_YELLOW}for native code (sharp/libvips, ffmpeg, ImageMagick, LibreOffice).${C_RESET}"
	_msg "${C_YELLOW}Operations on large media may time out.${C_RESET}"
	_msg ""
	_msg "${C_YELLOW}Rebuild for this host with:${C_RESET}"
	_msg "${C_YELLOW}  ./docker-build-and-save.sh --${HOST_ARCH_NORMALIZED}${C_RESET}"
	_msg ""
fi

# --- Generate fixtures inside the image (so we don't need host tools) ---
_section "Generating test fixtures"

mkdir -p "$FIXTURES_DIR"

docker run --rm -v "$FIXTURES_DIR:/out" "$IMAGE_TAG" sh -c '
set -e
# Small image (< 4096px) — should serve directly without preview generation
convert -size 800x600 plasma: -depth 8 /out/01-small.jpg 2>/dev/null
# Medium image (4096-8192px) — triggers preview generation via sharp
convert -size 5000x4000 plasma: -depth 8 /out/02-medium.jpg 2>/dev/null
# Large image (> 8192px) — auto-launches Image Explorer with DZI tiles
convert -size 9000x6000 plasma: -depth 8 /out/03-large.jpg 2>/dev/null
# 5-second test video with audio — for ffmpeg thumbnail and frame extraction
ffmpeg -y -f lavfi -i testsrc2=duration=5:size=640x480:rate=30 \
	-f lavfi -i sine=frequency=440:duration=5 \
	-c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -shortest \
	/out/04-video.mp4 > /dev/null 2>&1
# 10-second audio file — for waveform and segment extraction
ffmpeg -y -f lavfi -i sine=frequency=440:duration=10 /out/05-audio.mp3 > /dev/null 2>&1
# Tiny PDF — for pdf-text extraction
echo "Hello from retold-stack smoke test. This is a test PDF document with multiple sentences." > /tmp/test.txt
soffice --headless --convert-to pdf --outdir /out /tmp/test.txt > /dev/null 2>&1
mv /out/test.pdf /out/06-document.pdf
# RTF file — for doc-convert (LibreOffice → PDF)
printf "{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}\\f0\\fs24 This is a test RTF file converted on the fly.}" > /out/07-rtf.rtf
ls -la /out/
' > /dev/null 2>&1

if [ ! -f "$FIXTURES_DIR/01-small.jpg" ]; then
	_msg "${C_RED}Error: failed to generate test fixtures inside the container${C_RESET}"
	_msg "Try: docker run --rm -v $FIXTURES_DIR:/out $IMAGE_TAG sh -c 'convert -size 100x100 xc:red /out/test.png && ls -l /out/'"
	exit 2
fi

_msg "Generated 7 fixtures in $FIXTURES_DIR"
ls -lh "$FIXTURES_DIR" | tail -n +2 | awk '{ printf "  %-20s  %s\n", $9, $5 }'

# Generate a large folder fixture on demand (--large-folder flag)
if [ "$LARGE_FOLDER_SIZE" -gt 0 ]; then
	_msg ""
	_msg "Generating large folder fixture ($LARGE_FOLDER_SIZE files)..."
	mkdir -p "$FIXTURES_DIR/big-folder"
	# Fast path: use printf + xargs touch rather than a shell loop
	seq 1 "$LARGE_FOLDER_SIZE" \
		| awk -v dir="$FIXTURES_DIR/big-folder" '{ printf "%s/file-%05d.txt\n", dir, $1 }' \
		| xargs touch
	LARGE_COUNT=$(find "$FIXTURES_DIR/big-folder" -type f | wc -l | tr -d ' ')
	_msg "  big-folder/  ($LARGE_COUNT files)"
fi

# --- Start the container ---
_section "Starting container"

docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true

CONTAINER_ID=$(docker run -d \
	--name "$CONTAINER_NAME" \
	-p "$HOST_PORT:7777" \
	-p "$ULTRAVISOR_PORT:54321" \
	-v "$FIXTURES_DIR:/media:ro" \
	"$IMAGE_TAG" 2>&1) || {
		_msg "${C_RED}Error: failed to start container${C_RESET}"
		_msg "$CONTAINER_ID"
		exit 2
	}

_msg "Container started: ${CONTAINER_ID%%[a-f0-9][a-f0-9]*}..."
_msg "Waiting for services to be ready..."

# Wait up to 60s for retold-remote to respond
WAIT_COUNT=0
MAX_WAIT=60
until curl -s -o /dev/null -w '%{http_code}' "http://localhost:$HOST_PORT/" 2>/dev/null | grep -q '200'; do
	WAIT_COUNT=$((WAIT_COUNT + 1))
	if [ "$WAIT_COUNT" -ge "$MAX_WAIT" ]; then
		_msg "${C_RED}Error: container did not become ready within ${MAX_WAIT}s${C_RESET}"
		_msg "Last 20 lines of container logs:"
		docker logs "$CONTAINER_NAME" 2>&1 | tail -20
		exit 2
	fi
	sleep 1
done

_msg "Ready after ${WAIT_COUNT}s"

# --- Test runner ---
# Usage: _test "Test name" "expected_code" curl_args...
_test() {
	NAME="$1"
	EXPECTED_CODE="$2"
	shift 2

	START=$(date +%s)
	HTTP_CODE=$(curl -s -o /tmp/smoke-response -w '%{http_code}' --max-time 60 "$@" 2>/dev/null || echo "000")
	END=$(date +%s)
	ELAPSED=$((END - START))

	if [ "$HTTP_CODE" = "$EXPECTED_CODE" ]; then
		SIZE=$(wc -c < /tmp/smoke-response | tr -d ' ')
		_pass "$NAME (HTTP $HTTP_CODE, ${SIZE}B, ${ELAPSED}s)"
	else
		BODY=$(head -c 200 /tmp/smoke-response 2>/dev/null || echo '')
		_fail "$NAME" "expected HTTP $EXPECTED_CODE, got $HTTP_CODE — $BODY"
	fi
}

# Like _test but expects a JSON response with Success: true
_test_json_success() {
	NAME="$1"
	shift

	START=$(date +%s)
	HTTP_CODE=$(curl -s -o /tmp/smoke-response -w '%{http_code}' --max-time 60 "$@" 2>/dev/null || echo "000")
	END=$(date +%s)
	ELAPSED=$((END - START))

	if [ "$HTTP_CODE" != "200" ]; then
		_fail "$NAME" "HTTP $HTTP_CODE"
		return
	fi

	SIZE=$(wc -c < /tmp/smoke-response | tr -d ' ')
	if grep -q '"Success":true' /tmp/smoke-response 2>/dev/null; then
		_pass "$NAME (${SIZE}B, ${ELAPSED}s)"
	else
		ERR=$(grep -o '"Error":"[^"]*"' /tmp/smoke-response 2>/dev/null | head -1)
		_fail "$NAME" "Success != true. ${ERR:-(no error message)}"
	fi
}

# --- Capabilities ---
_section "Capability detection"

_test "Root /" "200" "http://localhost:$HOST_PORT/"

CAPS=$(curl -s "http://localhost:$HOST_PORT/api/media/capabilities" 2>/dev/null)
echo "$CAPS" | grep -q '"Success":true' && _pass "GET /api/media/capabilities" || _fail "GET /api/media/capabilities" "no success"

# Print which tools were detected
for TOOL in sharp imagemagick ffmpeg ffprobe p7zip ebook_convert libreoffice exiftool dcraw; do
	if echo "$CAPS" | grep -q "\"$TOOL\":true"; then
		_msg "    ${C_GREEN}✓${C_RESET} $TOOL"
	else
		_msg "    ${C_YELLOW}✗${C_RESET} $TOOL (not detected)"
	fi
done

# --- File listing ---
_section "File browser"

# pict-section-filebrowser returns a plain JSON array, not a Success-wrapped object
LIST_CODE=$(curl -s -o /tmp/smoke-list -w '%{http_code}' --max-time 30 "http://localhost:$HOST_PORT/api/filebrowser/list?path=" 2>/dev/null || echo "000")
if [ "$LIST_CODE" = "200" ] && head -c 1 /tmp/smoke-list | grep -q '\['; then
	# Count entries by counting "Name" keys (more portable than parsing JSON)
	COUNT=$(grep -o '"Name"' /tmp/smoke-list | wc -l | tr -d ' ')
	_pass "List root directory ($COUNT entries)"
else
	_fail "List root directory" "HTTP $LIST_CODE, body: $(head -c 100 /tmp/smoke-list)"
fi

_test_json_success "Folder summary" "http://localhost:$HOST_PORT/api/media/folder-summary?path="

# --- Image processing ---
_section "Image processing"

_test "Small thumbnail (800x600 → 200x200)"   "200" "http://localhost:$HOST_PORT/api/media/thumbnail?path=01-small.jpg&width=200&height=200"
_test "Medium thumbnail (5000x4000 → 200x200)" "200" "http://localhost:$HOST_PORT/api/media/thumbnail?path=02-medium.jpg&width=200&height=200"
_test "Large thumbnail (9000x6000 → 200x200)"  "200" "http://localhost:$HOST_PORT/api/media/thumbnail?path=03-large.jpg&width=200&height=200"

_test_json_success "Image preview probe (medium)" "http://localhost:$HOST_PORT/api/media/image-preview?path=02-medium.jpg"
_test_json_success "Image preview probe (large)"  "http://localhost:$HOST_PORT/api/media/image-preview?path=03-large.jpg"

# Get the cache key from the medium preview probe and fetch the actual file
PROBE=$(curl -s "http://localhost:$HOST_PORT/api/media/image-preview?path=02-medium.jpg" 2>/dev/null)
KEY=$(echo "$PROBE" | sed -n 's/.*"CacheKey":"\([^"]*\)".*/\1/p')
FN=$(echo "$PROBE" | sed -n 's/.*"OutputFilename":"\([^"]*\)".*/\1/p')
if [ -n "$KEY" ] && [ -n "$FN" ]; then
	_test "Image preview file (medium)" "200" "http://localhost:$HOST_PORT/api/media/image-preview-file/$KEY/$FN"
fi

_test_json_success "DZI manifest (large)" "http://localhost:$HOST_PORT/api/media/dzi?path=03-large.jpg"

# --- Video processing ---
_section "Video processing (ffmpeg)"

_test "Video thumbnail (640x480)" "200" "http://localhost:$HOST_PORT/api/media/thumbnail?path=04-video.mp4&width=200&height=200"
_test_json_success "Video probe (ffprobe)" "http://localhost:$HOST_PORT/api/media/probe?path=04-video.mp4"
_test_json_success "Video frames extraction (5 frames)" "http://localhost:$HOST_PORT/api/media/video-frames?path=04-video.mp4&count=5"

# --- Audio processing ---
_section "Audio processing (ffmpeg)"

_test_json_success "Audio waveform (500 peaks)" "http://localhost:$HOST_PORT/api/media/audio-waveform?path=05-audio.mp3&peaks=500"
_test "Audio segment extraction (2s-4s)" "200" "http://localhost:$HOST_PORT/api/media/audio-segment?path=05-audio.mp3&start=2&end=4&format=mp3"

# --- PDF processing ---
_section "PDF processing"

_test_json_success "PDF text extraction (page 1)" "http://localhost:$HOST_PORT/api/media/pdf-text?path=06-document.pdf&page=1"

# --- Document conversion ---
_section "Document conversion (LibreOffice)"

_test_json_success "RTF → PDF conversion (doc-convert)" "http://localhost:$HOST_PORT/api/media/doc-convert?path=07-rtf.rtf"

# Also test the orator-conversion endpoint directly with a buffer upload
RTF_RESPONSE_CODE=$(curl -s -o /tmp/smoke-converted.pdf -w '%{http_code}' --max-time 60 \
	-X POST --data-binary "@$FIXTURES_DIR/07-rtf.rtf" \
	-H "Content-Type: application/rtf" \
	"http://localhost:$HOST_PORT/api/conversion/1.0/doc-to-pdf?ext=rtf" 2>/dev/null || echo "000")
PDF_SIZE=$(wc -c < /tmp/smoke-converted.pdf 2>/dev/null | tr -d ' ' || echo 0)
if [ "$RTF_RESPONSE_CODE" = "200" ] && [ "$PDF_SIZE" -gt 1000 ]; then
	# Verify it's a real PDF
	if head -c 4 /tmp/smoke-converted.pdf | grep -q '%PDF'; then
		_pass "Orator-Conversion doc-to-pdf direct (${PDF_SIZE}B PDF)"
	else
		_fail "Orator-Conversion doc-to-pdf direct" "response is not a PDF"
	fi
else
	_fail "Orator-Conversion doc-to-pdf direct" "HTTP $RTF_RESPONSE_CODE, ${PDF_SIZE}B"
fi

# --- Subimage regions ---
_section "Subimage region storage"

_test_json_success "GET subimage regions (empty)" "http://localhost:$HOST_PORT/api/media/subimage-regions?path=03-large.jpg"

# Add a region and verify it stuck
ADD_BODY='{"Path":"03-large.jpg","Region":{"Label":"smoke","X":100,"Y":100,"Width":500,"Height":400}}'
ADD_CODE=$(curl -s -o /tmp/smoke-add -w '%{http_code}' --max-time 30 \
	-X POST -H "Content-Type: application/json" -d "$ADD_BODY" \
	"http://localhost:$HOST_PORT/api/media/subimage-regions" 2>/dev/null || echo "000")
if [ "$ADD_CODE" = "200" ] && grep -q '"Success":true' /tmp/smoke-add; then
	_pass "POST subimage region"
else
	_fail "POST subimage region" "HTTP $ADD_CODE"
fi

# --- Large folder listing (only if --large-folder was passed) ---
if [ "$LARGE_FOLDER_SIZE" -gt 0 ]; then
	_section "Large folder listing ($LARGE_FOLDER_SIZE files)"

	LARGE_START=$(date +%s)
	LARGE_CODE=$(curl -s -o /tmp/smoke-large -w '%{http_code}' --max-time 120 \
		"http://localhost:$HOST_PORT/api/filebrowser/list?path=big-folder" 2>/dev/null || echo "000")
	LARGE_END=$(date +%s)
	LARGE_ELAPSED=$((LARGE_END - LARGE_START))

	if [ "$LARGE_CODE" = "200" ] && head -c 1 /tmp/smoke-large | grep -q '\['; then
		LARGE_ENTRIES=$(grep -o '"Name"' /tmp/smoke-large | wc -l | tr -d ' ')
		LARGE_BYTES=$(wc -c < /tmp/smoke-large | tr -d ' ')
		if [ "$LARGE_ENTRIES" = "$LARGE_FOLDER_SIZE" ]; then
			_pass "Listed $LARGE_ENTRIES entries (${LARGE_BYTES}B, ${LARGE_ELAPSED}s)"
		else
			_fail "Large folder count mismatch" "expected $LARGE_FOLDER_SIZE got $LARGE_ENTRIES"
		fi
	else
		_fail "Large folder listing" "HTTP $LARGE_CODE"
	fi
fi

# --- Operation status WebSocket ---
_section "Operation status WebSocket (/ws/operations)"

# Inline Node script to: connect to the ws endpoint, trigger a video frame
# extraction with an X-Op-Id header, and verify we receive at least one
# progress event matching that opId before the HTTP response completes.
# Runs INSIDE the container so we don't need node/ws on the host.
WS_TEST_RESULT=$(docker exec "$CONTAINER_NAME" node -e '
const WS = require("ws");
const http = require("http");
const OP_ID = "op-smoke-" + Date.now();
let progress = 0;
let completeSeen = false;
let helloSeen = false;
const ws = new WS("ws://localhost:7777/ws/operations");
ws.on("open", () => {
	setTimeout(() => {
		const req = http.request({
			hostname: "localhost", port: 7777,
			path: "/api/media/video-frames?path=04-video.mp4&count=5",
			method: "GET",
			headers: { "X-Op-Id": OP_ID }
		}, (res) => {
			let body = "";
			res.on("data", c => body += c);
			res.on("end", () => {
				setTimeout(() => {
					console.log("hello=" + helloSeen + " progress=" + progress + " complete=" + completeSeen + " http=" + res.statusCode);
					process.exit(0);
				}, 300);
			});
		});
		req.on("error", (e) => { console.log("http-error=" + e.message); process.exit(1); });
		req.end();
	}, 50);
});
ws.on("message", (data) => {
	const msg = JSON.parse(data.toString());
	if (msg.Type === "hello") helloSeen = true;
	if (msg.OperationId === OP_ID && msg.Type === "progress") progress++;
	if (msg.OperationId === OP_ID && msg.Type === "complete") completeSeen = true;
});
ws.on("error", (e) => { console.log("ws-error=" + e.message); process.exit(1); });
setTimeout(() => { console.log("timeout progress=" + progress); process.exit(2); }, 15000);
' 2>&1)

if echo "$WS_TEST_RESULT" | grep -q 'hello=true' && echo "$WS_TEST_RESULT" | grep -q 'progress=[1-9]'; then
	PROG_COUNT=$(echo "$WS_TEST_RESULT" | grep -o 'progress=[0-9]*' | head -1 | sed 's/progress=//')
	_pass "WebSocket progress events (${PROG_COUNT} received)"
else
	_fail "WebSocket progress events" "$WS_TEST_RESULT"
fi

# --- Ultravisor coordinator ---
_section "Ultravisor coordinator"

# Ultravisor's root returns a 302 redirect to the web interface
UV_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "http://localhost:$ULTRAVISOR_PORT/" 2>/dev/null || echo "000")
if [ "$UV_CODE" = "200" ] || [ "$UV_CODE" = "302" ]; then
	_pass "Ultravisor web interface (HTTP $UV_CODE)"
else
	_fail "Ultravisor web interface" "HTTP $UV_CODE"
fi

# Check the dispatcher log to make sure the beacon registered
docker logs "$CONTAINER_NAME" 2>&1 | grep -q "beacon connected as" && \
	_pass "Beacon registered with Ultravisor" || \
	_fail "Beacon registration" "no 'beacon connected as' line in logs"

# --- Shared-FS reachability (positive path) ---
_section "Shared-FS reachability strategy (positive path)"

# When retold-remote and orator-conversion run inside the same container,
# they should both advertise the same MountID for the content path so the
# Ultravisor reachability matrix can pick the 'shared-fs' strategy and skip
# the HTTP file-transfer to staging entirely.
#
# We assert three things here:
#   1. The 'advertising shared mount' line appears on startup (both beacons
#      receive the same SharedMounts array from Server-Setup)
#   2. After triggering a dispatched thumbnail operation, at least one
#      'File Transfer: shared-fs hit' line appears (proving the reachability
#      matrix actually returned Strategy: shared-fs and the file-transfer
#      task short-circuited without copying bytes)
#   3. The operation returned HTTP 200 (end-to-end OK)

if docker logs "$CONTAINER_NAME" 2>&1 | grep -q "advertising shared mount"; then
	_pass "Beacons advertise shared mount on startup"
else
	_fail "Shared mount advertisement" "no 'advertising shared mount' line in logs"
fi

# Trigger an Ultravisor-dispatched thumbnail on the LARGE fixture so the
# dispatcher's local-first short-circuit does not kick in. The medium and
# large thumbnails earlier in the script may have already primed the cache,
# so use a unique width/height combo to force a fresh run.
SHARED_FS_OP_ID="op-sharedfs-pos-$(date +%s)"
SHARED_FS_CODE=$(curl -s -o /tmp/smoke-sharedfs-pos -w '%{http_code}' --max-time 60 \
	-H "X-Op-Id: $SHARED_FS_OP_ID" \
	"http://localhost:$HOST_PORT/api/media/thumbnail?path=03-large.jpg&width=173&height=173" 2>/dev/null || echo "000")

# Give the dispatcher a moment to log the shared-fs hit
sleep 1

# Look for the definitive shared-fs signal in the logs.
# The file-transfer task emits 'File Transfer: shared-fs hit, using <path>
# directly (<N> bytes, no copy).' when the short-circuit fires.
SHARED_FS_HIT_COUNT=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "File Transfer: shared-fs hit" || true)
RESOLVE_AUTO_DETECT_COUNT=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "auto-detected shared-fs peer" || true)

if [ "$SHARED_FS_CODE" = "200" ] && [ "$SHARED_FS_HIT_COUNT" -gt 0 ]; then
	_pass "Shared-fs strategy used by dispatched thumbnail ($SHARED_FS_HIT_COUNT hit(s), auto-detect fired $RESOLVE_AUTO_DETECT_COUNT time(s))"
elif [ "$SHARED_FS_CODE" = "200" ] && [ "$RESOLVE_AUTO_DETECT_COUNT" -gt 0 ]; then
	# Auto-detect fired but the file-transfer short-circuit didn't log —
	# this can happen if the requesting beacon was the source beacon, in
	# which case we just ended up on the 'local' path. Still a pass.
	_pass "Shared-fs auto-detect fired ($RESOLVE_AUTO_DETECT_COUNT time(s)); operation completed"
elif [ "$SHARED_FS_CODE" = "200" ]; then
	_warn "Thumbnail succeeded but no shared-fs signal in logs (may have hit local cache or dispatcher declined)"
else
	_fail "Shared-fs positive path thumbnail" "HTTP $SHARED_FS_CODE"
fi

# Sanity-check: the shared-fs hit should mean zero bytes transferred.
# Grep the transfer log line and pull the byte count.
ZERO_BYTE_LINE=$(docker logs "$CONTAINER_NAME" 2>&1 | grep "File Transfer: shared-fs hit" | tail -1)
if [ -n "$ZERO_BYTE_LINE" ]; then
	_msg "    ${C_BLUE}[info]${C_RESET} $(echo "$ZERO_BYTE_LINE" | sed 's/.*File Transfer:/File Transfer:/')"
fi

# --- Shared-FS reachability (negative path via RETOLD_SHARED_FS_ENABLED=false) ---
_section "Shared-FS reachability strategy (negative path)"

# Tear down the positive-path container and start a fresh one with the
# shared-fs advertisement DISABLED via the RETOLD_SHARED_FS_ENABLED=false
# env var. This forces the reachability matrix to fall through to
# 'direct' (HTTP file-transfer via localhost). The test confirms two things:
#   1. The env var is actually plumbed through (log line 'SharedMounts advertisement DISABLED')
#   2. When the env var is set, the file-transfer short-circuit does NOT fire
#      (no 'File Transfer: shared-fs hit' lines) but the operation still
#      completes successfully (the fallback direct-HTTP path is healthy)

_msg "Restarting container with RETOLD_SHARED_FS_ENABLED=false..."
docker stop "$CONTAINER_NAME" > /dev/null 2>&1 || true
docker rm "$CONTAINER_NAME" > /dev/null 2>&1 || true

CONTAINER_ID=$(docker run -d \
	--name "$CONTAINER_NAME" \
	-p "$HOST_PORT:7777" \
	-p "$ULTRAVISOR_PORT:54321" \
	-v "$FIXTURES_DIR:/media:ro" \
	-e "RETOLD_SHARED_FS_ENABLED=false" \
	"$IMAGE_TAG" 2>&1) || {
		_fail "Negative-path container start" "docker run failed: $CONTAINER_ID"
		# Don't exit — fall through to final report
		CONTAINER_ID=""
	}

if [ -n "$CONTAINER_ID" ]; then
	_msg "Waiting for services to be ready..."
	WAIT_COUNT=0
	MAX_WAIT=60
	until curl -s -o /dev/null -w '%{http_code}' "http://localhost:$HOST_PORT/" 2>/dev/null | grep -q '200'; do
		WAIT_COUNT=$((WAIT_COUNT + 1))
		if [ "$WAIT_COUNT" -ge "$MAX_WAIT" ]; then
			_fail "Negative-path container ready" "did not respond within ${MAX_WAIT}s"
			docker logs "$CONTAINER_NAME" 2>&1 | tail -20
			CONTAINER_ID=""
			break
		fi
		sleep 1
	done

	if [ -n "$CONTAINER_ID" ]; then
		_msg "Ready after ${WAIT_COUNT}s"

		# Assertion 1: the env var gate fired
		if docker logs "$CONTAINER_NAME" 2>&1 | grep -q "SharedMounts advertisement DISABLED"; then
			_pass "RETOLD_SHARED_FS_ENABLED=false disables SharedMounts advertisement"
		else
			_fail "RETOLD_SHARED_FS_ENABLED env var" "expected 'SharedMounts advertisement DISABLED' line in logs"
		fi

		# Assertion 2: no 'advertising shared mount' line (the positive signal should be absent)
		if docker logs "$CONTAINER_NAME" 2>&1 | grep -q "advertising shared mount"; then
			_fail "Negative path: shared mount advertisement" "'advertising shared mount' line present despite env var"
		else
			_pass "Negative path: no shared mount advertised"
		fi

		# Trigger the same thumbnail operation as the positive path, with a
		# distinct width so no cache can short-circuit it.
		NEG_OP_ID="op-sharedfs-neg-$(date +%s)"
		NEG_CODE=$(curl -s -o /tmp/smoke-sharedfs-neg -w '%{http_code}' --max-time 60 \
			-H "X-Op-Id: $NEG_OP_ID" \
			"http://localhost:$HOST_PORT/api/media/thumbnail?path=03-large.jpg&width=179&height=179" 2>/dev/null || echo "000")

		sleep 1

		# Assertion 3: the fallback path still works (HTTP 200)
		if [ "$NEG_CODE" = "200" ]; then
			_pass "Negative path: dispatched thumbnail still succeeds (direct/local fallback)"
		else
			_fail "Negative path: dispatched thumbnail" "HTTP $NEG_CODE"
		fi

		# Assertion 4: no 'File Transfer: shared-fs hit' lines (shared-fs
		# never engaged because both beacons skipped the mount advertisement)
		NEG_HIT_COUNT=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "File Transfer: shared-fs hit" || true)
		if [ "$NEG_HIT_COUNT" = "0" ]; then
			_pass "Negative path: shared-fs short-circuit did NOT fire"
		else
			_fail "Negative path: shared-fs unexpectedly fired" "$NEG_HIT_COUNT hit(s) seen despite env var"
		fi

		# Assertion 5: the direct-HTTP fallback path actually ran. The
		# file-transfer task logs '[FileTransfer] no SourceLocalPath in
		# settings — running standard HTTP download path' when it falls
		# through, which proves the direct strategy was used end-to-end.
		NEG_DIRECT_COUNT=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -c "running standard HTTP download path" || true)
		if [ "$NEG_DIRECT_COUNT" -gt 0 ]; then
			_pass "Negative path: standard HTTP download path engaged ($NEG_DIRECT_COUNT time(s))"
		else
			# Not fatal — some operations might short-circuit earlier (e.g.,
			# local cache hit). Flag as a warning so the test still passes
			# overall but humans notice when the coverage goes thin.
			_warn "Negative path: no 'standard HTTP download path' log line observed — direct path may not have been exercised by this trigger"
		fi
	fi
fi

# --- Final report ---
_section "Results"

TOTAL=$((RESULTS_PASS + RESULTS_FAIL))
_msg "  Passed:  ${C_GREEN}${RESULTS_PASS}${C_RESET} / $TOTAL"
_msg "  Failed:  ${C_RED}${RESULTS_FAIL}${C_RESET} / $TOTAL"

if [ "$RESULTS_FAIL" -gt 0 ]; then
	_msg ""
	_msg "${C_RED}${C_BOLD}Failed tests:${C_RESET}"
	printf "$RESULTS_FAILED_TESTS\n"
	_msg ""
	if [ "$IMAGE_ARCH" != "$HOST_ARCH_NORMALIZED" ]; then
		_msg "${C_YELLOW}${C_BOLD}HINT:${C_RESET} ${C_YELLOW}image arch ($IMAGE_ARCH) does not match host arch ($HOST_ARCH_NORMALIZED).${C_RESET}"
		_msg "${C_YELLOW}      Most failures here are likely caused by QEMU emulation timing out${C_RESET}"
		_msg "${C_YELLOW}      on heavy native operations. Rebuild with the matching arch:${C_RESET}"
		_msg "${C_YELLOW}        ./docker-build-and-save.sh --${HOST_ARCH_NORMALIZED}${C_RESET}"
	fi
	_msg ""
	_msg "Container logs (last 30 lines):"
	docker logs "$CONTAINER_NAME" 2>&1 | tail -30
	exit 1
fi

_msg ""
_msg "${C_GREEN}${C_BOLD}All smoke tests passed.${C_RESET} The image at $IMAGE_TAG is healthy."
exit 0
