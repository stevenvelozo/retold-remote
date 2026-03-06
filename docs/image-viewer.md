# Image Viewer

The image viewer displays image files with three fit modes, manual zoom, and EXIF orientation support.

## Opening an Image

- **From the gallery**: select a file and press `Enter`, or double-click a tile
- **Force any file as image**: press `1` in the gallery or viewer to open it in the image viewer regardless of extension

## Fit Modes

Cycle through fit modes by pressing `z`.

### Fit to Window

Scales the image to fill the viewport while preserving aspect ratio (CSS `object-fit: contain` behavior). The image is never larger than the viewport.

### Original if Smaller (default)

Displays the image at its native resolution if it fits within the viewport. If the image is larger than the viewport, it scales down using the same logic as Fit to Window. This avoids upscaling small images.

### Original Size

Always displays at native resolution regardless of viewport size. Large images will overflow and can be scrolled.

When the fit mode changes, a brief overlay indicator appears for 1.2 seconds showing the active mode name.

## Zoom

| Key | Action | Range |
|-----|--------|-------|
| `+` or `=` | Zoom in | Up to 8x |
| `-` | Zoom out | Down to 0.25x |
| `0` | Reset zoom to 1x | |
| Click on image | Toggle between 1x and 2x | |

Each zoom step multiplies or divides by 1.25. The zoom level applies on top of the current fit mode calculation.

When zoomed beyond the viewport, the cursor changes to a zoom-out icon and the image can be scrolled. When the image fits, the cursor shows zoom-in.

## Mouse Interactions

- **Click** on the image toggles between 1x and 2x zoom
- **Scroll** when zoomed to pan the image

## Keyboard Shortcuts

These work while viewing any image:

| Key | Action |
|-----|--------|
| `z` | Cycle fit mode (Fit to Window -> Original if Smaller -> Original Size) |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom |
| `f` | Toggle fullscreen |
| `i` | Toggle file info overlay |
| Right / `j` | Next file |
| Left / `k` | Previous file |
| `v` / `Enter` | Stream with VLC |
| `d` | Distraction-free mode |
| `e` | Open image explorer |
| `a` | Quick-add to active collection |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |
| `Esc` | Back to gallery |

## Image Explorer

Press `e` to open the image explorer for deep-zoom inspection with OpenSeadragon. Images larger than 4096 pixels are automatically tiled for smooth pan and zoom at any resolution. See the full [Image Explorer](image-explorer.md) documentation for details.

## File Info Overlay

Press `i` to show metadata about the current image:

- **Size**: file size in KB/MB
- **Dimensions**: width x height in pixels
- **Format**: image format
- **Modified**: last modification date
- **Path**: file path on the server

The overlay appears in the top-right corner and can be toggled on and off.

## Supported Formats

png, jpg, jpeg, gif, webp, svg, bmp, ico, avif, tiff, tif, heic, heif

Animated GIFs and WebP animations play in the browser natively. SVG files render as vector graphics. HEIC/HEIF support depends on the browser.

## EXIF Orientation

Images are displayed with `image-orientation: from-image`, meaning EXIF rotation data is respected automatically. Portrait photos taken on phones display upright without manual rotation.

## Thumbnails

In the gallery, image thumbnails are generated server-side using sharp (preferred) or ImageMagick (fallback) at 200x200 pixels in webp format. Thumbnails are cached on disk and invalidated when the source file changes.

If no image processing tool is available, the full image is loaded directly.
