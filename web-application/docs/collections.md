# Collections

Collections let you bookmark files, video frames, audio clips, and video clips into named groups. The collections panel provides a sidebar for managing collections, and keyboard shortcuts let you quick-add items without leaving the current view.

## Quick-Add

Press `a` in any mode to add the current item to a collection. If a collection is already active (open in the panel) or was recently used, the item is added to it immediately with a toast notification. If no collection is active, a dropdown picker appears in the top bar so you can choose one.

### What Gets Added

| Context | Item Type | Data Captured |
|---------|-----------|---------------|
| Gallery or viewer (file) | File | File path |
| Gallery or viewer (folder) | Folder or folder contents | Folder path (prompts for choice) |
| Gallery or viewer (archive subfile) | Subfile | File path + archive path |
| Video explorer | Video frame | Path, timestamp, cached frame image |
| Video explorer (with selection) | Video clip | Path, start time, end time |
| Audio explorer (with selection) | Audio clip | Path, start time, end time |
| Image explorer (with active region) | Image crop | Path, X, Y, Width, Height in original pixels |
| PDF viewer (with text selection) | Document region (text) | Path, page number, selected text |
| PDF viewer (with visual region) | Document region (visual) | Path, page number, X/Y/Width/Height in PDF units |
| EPUB reader (with text selection) | Document region (text) | Path, CFI, spine index, chapter title, selected text |
| EPUB reader (with visual region) | Document region (visual) | Path, X/Y/Width/Height in container coordinates |

### Folder Choice

When quick-adding a folder or archive, a prompt asks whether to add the folder itself or its contents. "Add Folder" creates a single reference. "Add Folder Contents" creates a wildcard reference to everything inside.

### Quick-Add Target

The quick-add target is resolved in this priority order:

1. The collection currently open in detail mode in the panel
2. The last collection an item was added to
3. If neither is available, the dropdown picker opens

## Favorites

Favorites is a special system collection with a dedicated heart icon in the top bar.

### Toggle

Press `h` in any mode to toggle the current file as a favorite. The heart icon in the top bar fills when the current file is favorited and empties when it is not.

Favorites work for files, folders (with the same folder choice prompt), and archive subfiles. The favorites collection is created automatically on first use.

### Favorites Pane

Favorited items appear in the sidebar favorites pane, accessible via the sidebar tabs.

## Collections Panel

Press `b` in any mode to toggle the collections panel on the right side of the screen. The panel has three modes.

### List Mode

Shows all collections as cards. Each card displays the collection icon, name, and item count. Click a card to open it in detail mode.

- **New (+)** button creates a new collection (prompts for a name)
- **Search bar** filters collections by name, description, or tags

### Detail Mode

Shows the items in a single collection. Each item row displays an icon or thumbnail, the item name, a type badge, and a remove button.

#### Sorting

| Sort Mode | Description |
|-----------|-------------|
| Manual | Drag-to-reorder using the handle (default) |
| Name | Alphabetical by label |
| Date Added | Chronological by when the item was added |
| Type | Grouped by item type |

A direction toggle switches between ascending and descending order.

#### Item Thumbnails

- **Images and image crops**: Thumbnail from the server
- **Video frames**: The actual extracted frame image
- **Other types**: A type icon (folder, audio clip, video clip, subfile, etc.)

#### Clicking Items

Click an item to navigate to it. Files open in the viewer, folders navigate the file browser, video frames open the video explorer at the frame timestamp, and audio clips open the audio explorer with the selection pre-loaded.

### Edit Mode

Click the edit button (pencil icon) in the detail header to open the edit form.

| Field | Description |
|-------|-------------|
| Name | Collection display name |
| Description | Markdown description |
| Cover Image | File path for a cover image ("Use current file" button fills this with the currently viewed file) |
| Tags | Comma-separated tags for searching |

The danger zone at the bottom has a "Delete Collection" button with a confirmation step.

## Item Types

| Type | Created By | Special Fields |
|------|-----------|----------------|
| `file` | Quick-add on a file | Path |
| `folder` | Quick-add on a folder (single reference) | Path |
| `folder-contents` | Quick-add on a folder (contents wildcard) | Path |
| `subfile` | Quick-add on a file inside an archive | Path, ArchivePath |
| `video-frame` | `a` key in video explorer | Path, FrameTimestamp, FrameCacheKey, FrameFilename |
| `video-clip` | `s` key in video explorer | Path, VideoStart, VideoEnd |
| `audio-clip` | `a`/`s` key in audio explorer | Path, AudioStart, AudioEnd |

Each item also stores an auto-generated label, the date it was added, and an optional sort order for manual sorting.

## Operation Plans

Operation plan collections are a special collection type used for batch file operations (move, copy, rename). They are created programmatically rather than through the standard UI.

### Display

Operation plan collections show a summary bar with counts of pending, completed, failed, and skipped items. Each item row shows:

- Status indicator (pending, completed, failed, skipped)
- Source path and destination path with an arrow between them
- Operation badge (MOVE, COPY, or RENAME)
- Skip button (for pending items)
- Error message (for failed items)

### Controls

| Button | Action |
|--------|--------|
| Execute | Run all pending operations |
| Undo | Reverse completed operations |

Pending item destinations can be edited inline by clicking the destination path.

## Keyboard Shortcuts

| Key | Mode | Action |
|-----|------|--------|
| `a` | Gallery, viewer, all explorers | Quick-add current item to collection |
| `s` | Video explorer | Add selected range as video clip |
| `s` | Audio explorer | Save audio snippet to collection |
| `s` | Image explorer | Toggle region selection mode |
| `s` | Document viewer (PDF/EPUB) | Toggle visual region selection mode |
| `[` | Video explorer | Set selection start at current frame |
| `]` | Video explorer | Set selection end at current frame |
| `b` | All modes | Toggle collection panel |
| `h` | All modes | Toggle favorite |

## Export

Collections can be exported to a folder within the content root. Each item is processed according to its type:

| Item Type | Export Behavior |
|-----------|----------------|
| `file` / `subfile` | Copied directly to the destination |
| `image-crop` | Cropped via sharp at the original resolution |
| `video-clip` | Extracted via `ffmpeg -ss -t -c copy` |
| `video-frame` | Extracted via `ffmpeg -ss -vframes 1` |
| `audio-clip` | Extracted via `ffmpeg -ss -t -vn` |
| `document-region` (text) | Written as a `.txt` file with the captured text and source metadata |
| `document-region` (visual) | Metadata file describing the page and region |
| `folder` | Copied recursively |
| `folder-contents` | Files copied flat into the destination |

Exported files are named `{sortOrder}_{label}.{ext}` so the order is preserved on disk.

To export, click the **⇩ Export** button in the collection detail header. You will be prompted for a destination path (relative to the content root).

The export endpoint is restricted to paths within the content root for safety -- paths containing `..` or absolute paths are rejected.

## Data Storage

Collections are stored server-side as Bibliograph records. Each collection is a JSON document containing the collection metadata and its items array. The favorites collection uses a well-known GUID and is created automatically.

Client-side state (which collection is open, panel width, last-used collection) persists in the browser via localStorage.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/collections` | List all collections (summaries) |
| GET | `/api/collections/:guid` | Get full collection with items |
| PUT | `/api/collections/:guid` | Create or update a collection |
| DELETE | `/api/collections/:guid` | Delete a collection |
| POST | `/api/collections/:guid/items` | Add items to a collection |
| DELETE | `/api/collections/:guid/items/:itemId` | Remove an item |
| PUT | `/api/collections/:guid/reorder` | Reorder items (manual sort) |
| POST | `/api/collections/copy-items` | Copy items between collections |
| POST | `/api/collections/:guid/execute` | Execute pending operations (operation plans) |
| POST | `/api/collections/:guid/export` | Export the collection to a folder within the content root |
