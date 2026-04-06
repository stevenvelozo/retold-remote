# eBook Reader

The eBook reader displays EPUB files directly in the browser using epub.js, with support for MOBI files through server-side conversion.

## Opening an eBook

- **From the gallery**: select an `.epub` or `.mobi` file and press `Enter`, or double-click it
- eBooks are detected by the document type system (pdf, epub, mobi are all in the document category)

## EPUB Files

EPUB files are loaded and rendered directly in the browser using the epub.js library. No server-side processing is required.

### Reading Interface

The reader takes up the full viewer area and displays one page at a time in a single-column layout (no spread/two-page mode). Text is styled to match the active theme:

- Body text uses the theme's primary text color
- Background matches the theme's primary background
- Links use the theme's accent color
- Font: Georgia, Times New Roman, serif
- Line height: 1.6
- Padding: 20px horizontal, 40px vertical

### Table of Contents

A sidebar on the left shows the book's table of contents. Each chapter is a clickable button. Subchapters are indented up to two levels.

| Action | Effect |
|--------|--------|
| Click a chapter | Jump to that chapter |
| Click "TOC" button | Toggle the sidebar open/closed |

The TOC sidebar starts collapsed and can be toggled with the TOC button in the controls bar.

### Page Navigation

Controls at the bottom of the reader:

| Button | Action |
|--------|--------|
| **TOC** | Toggle table of contents sidebar |
| **Prev** | Go to previous page |
| **Next** | Go to next page |

Page navigation moves through the reflowed content. Pages are determined by the viewport size, not by the original book pagination.

## MOBI Files

MOBI files (and AZW format) require server-side conversion to EPUB before they can be displayed. This requires **ebook-convert** from Calibre to be installed on the server.

### Conversion Flow

1. The client requests conversion via `/api/media/ebook-convert?path=<file>`
2. The server runs `ebook-convert` to produce an EPUB file
3. The converted EPUB is cached on disk
4. The client fetches the EPUB from `/api/media/ebook/<cacheKey>/<filename>`
5. The EPUB is rendered using the same epub.js reader

If ebook-convert is not available, MOBI files show a message explaining that conversion is needed and linking to the Calibre download page.

### Installing Calibre (for MOBI support)

**macOS:**
```bash
brew install calibre
```

**Ubuntu/Debian:**
```bash
sudo apt-get install calibre
```

**Docker:**
The provided Dockerfile includes Calibre. If using the minimal Dockerfile, add:
```dockerfile
RUN apt-get update && apt-get install -y calibre && rm -rf /var/lib/apt/lists/*
```

## PDF Files

PDF files are rendered using a full **pdf.js** canvas pipeline. The library is loaded from CDN on first use; no server-side dependencies are required for basic display.

### Page Navigation

The controls bar exposes:

- **← Prev** / **Next →** — page navigation
- **Page input** — type a page number and press Enter to jump
- **Zoom In / Out / Fit** — adjust scale (0.25x – 5x)

### Text Selection

PDF.js renders an invisible text layer over the canvas, so native browser text selection works. Drag to select text, then click **💾 Save Selection** to capture it as a labeled region.

The capture stores: page number, selected text, optional label.

### Visual Region Selection

Click **✂ Select Region** to enter visual selection mode. A crosshair cursor appears over the page canvas. Drag a rectangle, release, and a label input appears in the controls bar.

The capture stores: page number, X/Y/Width/Height in PDF units (so the region remaps correctly at any zoom level), optional label.

### Server-Side Text Extraction

`GET /api/media/pdf-text?path=<file>&page=<num>` returns the extracted text for a specific page (via pdf-parse). This is useful for search indexing or for when you want the full text without selecting it manually.

## Convertible Document Formats

Beyond PDF/EPUB/MOBI, the viewer also handles `.doc`, `.docx`, `.rtf`, `.odt`, `.wpd`, `.wps`, `.pages`, `.odp`, `.ppt`, `.pptx`, `.ods`, `.xls`, and `.xlsx` files. These are converted to PDF on the fly via the embedded **Orator-Conversion** service, then displayed in the same pdf.js viewer.

### Conversion Pipeline

1. The browser opens a convertible document
2. Retold Remote shows a "Converting document to PDF..." spinner
3. The server calls `GET /api/media/doc-convert?path=<file>` which delegates to `orator-conversion`'s `doc-to-pdf` custom converter
4. The converter pipes the file through LibreOffice headless (`soffice --headless --convert-to pdf`)
5. Falls back to Calibre's `ebook-convert` if LibreOffice is unavailable
6. The resulting PDF is cached in the same Parime cache as ebooks (separate `manifest-pdf.json`)
7. The browser loads the PDF in the standard pdf.js viewer with full text and region selection

Conversion results are cached per file (keyed by path + mtime), so reopening the same document is instant after the first conversion.

### Required Tools

| Tool | Use |
|------|-----|
| **LibreOffice** (`soffice`) | Best fidelity for Word, RTF, ODT, WordPerfect, PowerPoint, Excel |
| **Calibre** (`ebook-convert`) | Fallback for documents LibreOffice can't handle |

Install at least one of them on the server. On macOS: `brew install --cask libreoffice` or `brew install calibre`.

## eBook Selection Features

The EPUB reader supports the same labeled-region capture pattern as PDF and image viewers.

### Save Text Selection

1. Select text in the rendered EPUB content (works through the epub.js iframe via `getContents()`)
2. Click **💾 Save Selection** in the controls bar
3. Enter a label and save

The capture stores:

- **CFI** (Canonical Fragment Identifier) — exact location for re-navigating later
- **Spine index** — which section of the book
- **Chapter title** — best-effort lookup from the TOC
- **Selected text** — the actual highlighted prose

Click a saved text selection in the **Regions** sidebar tab to navigate back to its exact location via `rendition.display(cfi)`.

### Visual Region Selection

Click **✂ Select Region** to overlay a transparent crosshair on the rendered page. Drag a rectangle to capture a visual area. The capture stores X/Y/Width/Height plus the viewport dimensions at capture time (so coordinates can be remapped if the window is resized later).

## Limitations

- MOBI conversion requires Calibre's `ebook-convert` on the server
- Document conversion (DOC, DOCX, RTF, etc.) requires LibreOffice or Calibre on the server
- DRM-protected ebooks cannot be read
- Complex EPUB layouts (fixed-layout EPUBs, heavy CSS) may not render perfectly
- The reader uses single-page mode only (no two-page spreads)
- Page numbers shown in the UI correspond to the reflowed content, not the original book pagination
- EPUB visual region coordinates are container-relative; they remap reasonably at different window sizes but are not perfectly stable across major layout reflows
