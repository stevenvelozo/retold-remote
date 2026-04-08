# Image Explorer

The image explorer provides deep-zoom inspection of images using OpenSeadragon. Small images load directly; images larger than 4096 pixels are automatically tiled into a DZI pyramid for smooth pan and zoom at any resolution.

## Opening the Explorer

- From the image viewer, press `e`
- URL updates to `#/explore-image/{id}`

## Display Modes

### Direct Mode

Images with a longest side of 4096 pixels or less load as a single image. The info bar shows dimensions, megapixels, and "Direct" as the mode.

### DZI Tile Mode

Images exceeding 4096 pixels trigger server-side tile generation using Sharp. The image is sliced into 256-pixel tiles at multiple zoom levels, served from `/api/media/dzi-tile/{cacheKey}/{level}/{col}_{row}.{format}`. The info bar shows tile size, format, and live coordinate and zoom readouts.

If Sharp is not available on the server, the image loads directly regardless of size.

## UI Elements

- **Header**: Back button and filename
- **Info bar**: Image dimensions, megapixels, mode, and (in DZI mode) coordinates and zoom percentage
- **Viewer canvas**: Main pan-and-zoom area powered by OpenSeadragon
- **Navigator**: A minimap in the bottom-right corner showing the full image with a viewport indicator rectangle

## Mouse Interactions

| Action | Effect |
|--------|--------|
| Click | Zoom in at click position |
| Double-click | Toggle zoom level |
| Click and drag | Pan the image |
| Scroll wheel | Zoom in or out at cursor position |
| Mouse move | Updates coordinate display (DZI mode) |

### Touch

| Action | Effect |
|--------|--------|
| Pinch | Zoom in or out |
| Drag | Pan the image |
| Flick | Momentum-based pan (0.25x velocity) |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `+` / `=` | Zoom in (1.5x) |
| `-` | Zoom out (1.5x) |
| `0` | Reset to home zoom (fit to view) |
| `s` | Toggle region selection mode |
| `a` | Quick-add to active collection (current region if one is selected) |
| `b` | Toggle collection panel |
| `h` | Toggle favorite |
| `Esc` | Unwind one layer: exit edit mode → exit selection mode → back to viewer |

`Esc` is layered: if you are editing a saved region, the first `Esc` exits edit mode; if you are drawing a new region, it cancels the draw; otherwise it closes the explorer.

## Subimage Regions

Press `s` (or click the **✂ Select** button in the header) to enter region selection mode. The cursor changes to a crosshair and OpenSeadragon's drag-to-pan is temporarily disabled.

Drag a rectangle on the image. On release, an inline label input appears in the controls bar — type a name and hit Enter. The region is saved with these coordinates:

- **X, Y** — top-left corner in original image pixels
- **Width, Height** — dimensions in original image pixels

Saved regions render as gold-bordered overlays with floating label badges. They persist per file via the SubimageService and appear in the **Regions** sidebar tab. Overlays are restored automatically whenever you reopen the image, including after the tile-viewer swap for DZI-mode images.

### Editing Existing Regions

Double-click any saved region overlay to enter **edit mode**. The selected region is highlighted, the other regions dim to 35% opacity, and eight drag handles appear (four corners + four edges). Each handle has a larger invisible hit area around a small visible dot so it's easy to grab on both mouse and touch.

In edit mode you can:

- **Resize** — drag a corner or edge handle. Dragging past the opposite edge flips the rectangle (so you can go from tl-drag to br-drag without re-entering edit mode).
- **Move** — drag the body of the region.
- **Edit label** — the inline label input in the controls bar is pre-filled with the current label. Change it and press `Enter` (or click Save).
- **Cancel** — click the Cancel button, press `Esc`, or double-click a different region.

Geometry and label changes are **optimistic**: they apply locally the instant you release the drag or press Enter, then fire a `PUT /api/media/subimage-regions/:id` in the background. If the server request fails (e.g., because the file's mtime changed since the region was loaded), the change reverts and a toast explains the failure.

While in edit mode OpenSeadragon's mouse navigation (pan/zoom/click-to-zoom) is suspended inside the region rectangle so drags on the handles or body don't also pan the viewer. Clicks outside any region still pan normally.

Edit mode is mutually exclusive with new-region draw mode: entering one automatically exits the other.

### Region Actions

From the **Regions** sidebar tab you can:

- 🔍 **Navigate** — zoom the explorer to the saved region (`viewport.fitBounds(imageRect)`)
- ➕ **Add to Collection** — saves as an `image-crop` collection item with the original-pixel `CropRegion`
- 🗑️ **Delete** — removes the region

The Regions sidebar auto-refreshes when you navigate between files — you no longer have to click the Regions tab after switching images.

### Multiple Regions

You can save unlimited labeled regions per image. They never lose resolution because the coordinates are stored in the original image pixel space, not in viewport pixels. When the collection is exported, each region is cropped at full resolution via `sharp.extract()`.

This same labeling pattern works on CBZ/CBR comic pages (each page is a regular image inside an archive — no special handling needed) and is the foundation for the document region system in the EPUB and PDF viewers.

### Regions Browser

The topbar **▣ Regions Browser** button opens a full-screen folder-scoped view of every saved region across every file. This scales cleanly to thousands of regions because the server maintains an in-memory cache keyed on the Bibliograph enumeration, invalidated only on mutations.

Layout:

- **Left** — folder tree with per-folder region counts. Click a folder to filter the right pane. "All folders" shows every region across the content root.
- **Right** — files in the selected folder, each with a header showing the filename and region count, followed by the regions as clickable chips (label + dimensions).

Click a region chip to close the browser, open the file in the appropriate viewer (image explorer for images, media viewer for PDFs/EPUBs), and jump to the region's coordinates.

The initial folder selection is seeded from the gallery's current browsing location, so opening the browser from a folder you're browsing shows just that folder's regions by default. Press `Esc` or the **✕ Close** button to dismiss.

## Coordinate Display

In DZI tile mode, the info bar shows the pixel coordinates of the point under the cursor in real time (e.g., "(4096, 3072)"). This updates as the mouse moves across the canvas and reflects the actual pixel position in the original full-resolution image.

## Zoom Levels

Each keyboard zoom step multiplies or divides by 1.5. The navigator minimap updates to show the current viewport position. The zoom percentage is displayed in the info bar in DZI mode.

## Supported Formats

All image formats supported by the viewer work in the explorer: png, jpg, jpeg, gif, webp, svg, bmp, ico, avif, tiff, tif, heic, heif.

Animated formats (GIF, WebP) display their first frame in the explorer.
