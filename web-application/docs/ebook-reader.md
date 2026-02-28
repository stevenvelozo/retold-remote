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

PDF files are rendered using the browser's native PDF viewer in an iframe. No additional tools or libraries are required. The browser provides its own controls for page navigation, zoom, and search.

## Limitations

- MOBI conversion requires Calibre's `ebook-convert` on the server
- DRM-protected ebooks cannot be read
- Complex EPUB layouts (fixed-layout EPUBs, heavy CSS) may not render perfectly
- The reader uses single-page mode only (no two-page spreads)
- Page numbers shown in the UI correspond to the reflowed content, not the original book pagination
