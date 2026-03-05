const libPictProvider = require('pict-provider');

const _DefaultProviderConfiguration =
{
	"ProviderIdentifier": "RetoldRemote-Icons",
	"AutoInitialize": true,
	"AutoInitializeOrdinal": 0,
	"AutoSolveWithApp": true,
	"AutoSolveOrdinal": 0
};

// ====================================================================
// DEFAULT DARK-THEME COLOR PALETTE
//
// Designed for retold-remote's dark navy background (#16162B).
// Light strokes on dark fills — the inverse of the filebrowser palette.
// Stored as instance state so colors can be swapped at runtime.
// ====================================================================
const _DefaultColors =
{
	Primary: '#C0C0DD',       // Light purple-gray — main strokes
	Accent: '#66C2B8',        // Teal — accent details (matches app accent)
	Muted: '#6A6A8A',         // Muted purple-gray — secondary strokes
	Light: '#2A2A4A',         // Dark fill for file body backgrounds
	WarmBeige: '#2E2E4E',     // Dark fill for folders
	TealTint: '#1E3A3A',      // Dark teal-tinted fill
	Lavender: '#2A2A48',      // Dark lavender fill for image/video
	AmberTint: '#3A3028',     // Dark amber fill for audio
	PdfFill: '#3A2028',       // Dark reddish fill for PDF
	PdfText: '#E06060'        // Bright red for PDF label text
};

// ====================================================================
// EXTENSION-TO-ICON MAP
//
// Reused from pict-section-filebrowser.  Pure string→string mapping
// with no color references — safe to share across themes.
// ====================================================================
let _BaseExtensionMap;
try
{
	_BaseExtensionMap = require('pict-section-filebrowser/source/providers/Pict-Provider-FileBrowserIcons.js').ExtensionMap;
}
catch (pError)
{
	// Fallback if the require path differs in production bundles
	_BaseExtensionMap = {};
}

// Ensure we have a reasonable extension map even if the import failed
const _FallbackExtensionMap =
{
	// Images
	'.jpg': 'file-image', '.jpeg': 'file-image', '.png': 'file-image',
	'.gif': 'file-image', '.svg': 'file-image', '.webp': 'file-image',
	'.bmp': 'file-image', '.ico': 'file-image', '.tiff': 'file-image',
	'.tif': 'file-image', '.heic': 'file-image', '.heif': 'file-image',
	'.avif': 'file-image', '.raw': 'file-image',

	// Documents / text
	'.txt': 'file-text', '.md': 'file-text', '.rtf': 'file-text',
	'.doc': 'file-text', '.docx': 'file-text',

	// PDF
	'.pdf': 'file-pdf',

	// Spreadsheets
	'.xls': 'file-spreadsheet', '.xlsx': 'file-spreadsheet',
	'.csv': 'file-spreadsheet', '.ods': 'file-spreadsheet',

	// Code
	'.js': 'file-code', '.ts': 'file-code', '.jsx': 'file-code',
	'.tsx': 'file-code', '.py': 'file-code', '.rb': 'file-code',
	'.java': 'file-code', '.c': 'file-code', '.cpp': 'file-code',
	'.h': 'file-code', '.go': 'file-code', '.rs': 'file-code',
	'.swift': 'file-code', '.kt': 'file-code', '.scala': 'file-code',
	'.sh': 'file-code', '.bash': 'file-code', '.zsh': 'file-code',
	'.php': 'file-code', '.lua': 'file-code', '.r': 'file-code',
	'.sql': 'file-code', '.pl': 'file-code',

	// Web / markup
	'.html': 'file-web', '.htm': 'file-web', '.css': 'file-web',
	'.scss': 'file-web', '.less': 'file-web', '.xml': 'file-web',

	// Config
	'.json': 'file-config', '.yaml': 'file-config', '.yml': 'file-config',
	'.toml': 'file-config', '.ini': 'file-config', '.env': 'file-config',
	'.conf': 'file-config', '.cfg': 'file-config',

	// Archives
	'.zip': 'file-archive', '.tar': 'file-archive', '.gz': 'file-archive',
	'.rar': 'file-archive', '.7z': 'file-archive', '.bz2': 'file-archive',
	'.xz': 'file-archive', '.tgz': 'file-archive',
	'.cbz': 'file-archive', '.cbr': 'file-archive',

	// Audio
	'.mp3': 'file-audio', '.wav': 'file-audio', '.flac': 'file-audio',
	'.ogg': 'file-audio', '.aac': 'file-audio', '.wma': 'file-audio',
	'.m4a': 'file-audio', '.opus': 'file-audio', '.aiff': 'file-audio',

	// Video
	'.mp4': 'file-video', '.avi': 'file-video', '.mov': 'file-video',
	'.mkv': 'file-video', '.webm': 'file-video', '.wmv': 'file-video',
	'.flv': 'file-video', '.m4v': 'file-video',

	// Ebooks
	'.epub': 'file-text', '.mobi': 'file-text'
};

const _ExtensionMap = (Object.keys(_BaseExtensionMap).length > 0)
	? _BaseExtensionMap
	: _FallbackExtensionMap;


/**
 * Dark-theme SVG icon provider for retold-remote.
 *
 * Carries forward the same hand-drawn retro SVG shapes from
 * pict-section-filebrowser's icon provider, recolored for dark
 * backgrounds.  Colors are instance state — call `setColors()` to
 * swap the palette at runtime.
 *
 * Usage:
 *   let tmpIcons = pict.providers['RetoldRemote-Icons'];
 *   let tmpSVG = tmpIcons.getIcon('folder', 48);
 *   let tmpFileSVG = tmpIcons.getIconForEntry(fileEntry, 16);
 *   tmpIcons.setColors({ Accent: '#FF9900' });
 */
class RetoldRemoteIconProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		// Colors as instance state so they can be changed at runtime
		this._colors = Object.assign({}, _DefaultColors);

		// Build icon functions that reference this._colors via tmpSelf closure
		this._icons = this._buildIconSet();

		// Track any custom icons registered after construction
		this._customIcons = {};

		// Copy the extension map
		this._extensionMap = Object.assign({}, _ExtensionMap);

		this._cssInjected = false;
	}

	// ====================================================================
	// ICON SET BUILDER
	//
	// Returns an object of icon functions.  Each function closes over
	// `tmpSelf` to read `this._colors` at call time, not at definition
	// time.  This means `setColors()` + `_rebuildIcons()` produces
	// SVGs in the new palette.
	// ====================================================================

	_buildIconSet()
	{
		let tmpSelf = this;

		return {
			// ---- Folder icons ----
			'folder': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M3.2 7.1V17.2C3.2 18.2 4 19.1 5.1 18.9L19.1 19.1C20 19.1 20.9 18.2 20.8 17.1V9.1C20.9 8 20.1 7.1 19 7.1H12.1L10.1 4.9H5.1C3.9 5 3.1 5.9 3.2 7.1Z" fill="' + c.WarmBeige + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M3.2 9H20.8" stroke="' + c.Primary + '" stroke-width="1" opacity="0.3" />'
					+ '</svg>';
			},

			'folder-open': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M3.2 7.1V17.2C3.2 18.2 4 19.1 5.1 18.9L19.1 19.1C20 19.1 20.9 18.2 20.8 17.1V9.1C20.9 8 20.1 7.1 19 7.1H12.1L10.1 4.9H5.1C3.9 5 3.1 5.9 3.2 7.1Z" fill="' + c.WarmBeige + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M3.2 10.2L5.8 17.8C6 18.4 6.6 18.9 7.2 18.9H19.8L22.1 11.2C22.3 10.6 21.8 10 21.2 10H5.2C4.6 10 4 10.4 3.8 11" stroke="' + c.Primary + '" stroke-width="1.5" fill="' + c.Light + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.7" />'
					+ '</svg>';
			},

			// ---- Generic file ----
			'file': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M14.1 2.1H6.2C5 2.2 4.1 3 4.1 4.1V20.1C4 21.2 5 22 6.1 21.9H18C19.1 22 20 21.1 19.9 19.9V8.1L14.1 2.1Z" fill="' + c.Light + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M13.9 2.1V8.2H20" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '</svg>';
			},

			// ---- Text / document file ----
			'file-text': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M14.1 2.1H6.2C5 2.2 4.1 3 4.1 4.1V20.1C4 21.2 5 22 6.1 21.9H18C19.1 22 20 21.1 19.9 19.9V8.1L14.1 2.1Z" fill="' + c.Light + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M13.9 2.1V8.2H20" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<line x1="8.1" y1="12.8" x2="15.9" y2="12.8" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" />'
					+ '<line x1="8.1" y1="15.8" x2="15.9" y2="15.8" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" />'
					+ '<line x1="8.1" y1="18.8" x2="12.2" y2="18.8" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" />'
					+ '</svg>';
			},

			// ---- Code file ----
			'file-code': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M14.1 2.1H6.2C5 2.2 4.1 3 4.1 4.1V20.1C4 21.2 5 22 6.1 21.9H18C19.1 22 20 21.1 19.9 19.9V8.1L14.1 2.1Z" fill="' + c.Light + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M13.9 2.1V8.2H20" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M8.5 13.2L6.8 15.1L8.6 16.8" stroke="' + c.Accent + '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M15.5 13.2L17.2 15.1L15.4 16.8" stroke="' + c.Accent + '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<line x1="12.8" y1="12" x2="11.2" y2="18" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" />'
					+ '</svg>';
			},

			// ---- Image file ----
			'file-image': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<rect x="3.1" y="3.2" width="17.8" height="17.7" rx="2" fill="' + c.Lavender + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<circle cx="8.3" cy="8.7" r="1.8" fill="' + c.Accent + '" />'
					+ '<path d="M20.8 15.2L15.9 10.1L5.2 20.8" stroke="' + c.Primary + '" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />'
					+ '</svg>';
			},

			// ---- PDF file ----
			'file-pdf': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M14.1 2.1H6.2C5 2.2 4.1 3 4.1 4.1V20.1C4 21.2 5 22 6.1 21.9H18C19.1 22 20 21.1 19.9 19.9V8.1L14.1 2.1Z" fill="' + c.PdfFill + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M13.9 2.1V8.2H20" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<text x="8.2" y="16.8" font-family="sans-serif" font-weight="700" font-size="6.5" fill="' + c.PdfText + '" letter-spacing="-0.3">PDF</text>'
					+ '</svg>';
			},

			// ---- Spreadsheet file ----
			'file-spreadsheet': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M14.1 2.1H6.2C5 2.2 4.1 3 4.1 4.1V20.1C4 21.2 5 22 6.1 21.9H18C19.1 22 20 21.1 19.9 19.9V8.1L14.1 2.1Z" fill="' + c.TealTint + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M13.9 2.1V8.2H20" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<rect x="7.2" y="11.1" width="9.8" height="7.8" rx="0.5" fill="none" stroke="' + c.Accent + '" stroke-width="1.2" />'
					+ '<line x1="7.2" y1="13.7" x2="17" y2="13.7" stroke="' + c.Accent + '" stroke-width="1" />'
					+ '<line x1="7.2" y1="16.3" x2="17" y2="16.3" stroke="' + c.Accent + '" stroke-width="1" />'
					+ '<line x1="10.9" y1="11.1" x2="10.9" y2="18.9" stroke="' + c.Accent + '" stroke-width="1" />'
					+ '</svg>';
			},

			// ---- Archive file ----
			'file-archive': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M14.1 2.1H6.2C5 2.2 4.1 3 4.1 4.1V20.1C4 21.2 5 22 6.1 21.9H18C19.1 22 20 21.1 19.9 19.9V8.1L14.1 2.1Z" fill="' + c.WarmBeige + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M13.9 2.1V8.2H20" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<rect x="8.8" y="11.2" width="2.5" height="2" rx="0.4" fill="' + c.Primary + '" />'
					+ '<rect x="8.8" y="14.2" width="2.5" height="2" rx="0.4" fill="' + c.Primary + '" />'
					+ '<rect x="8.8" y="17.2" width="2.5" height="2" rx="0.4" fill="' + c.Primary + '" />'
					+ '</svg>';
			},

			// ---- Audio file ----
			'file-audio': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M14.1 2.1H6.2C5 2.2 4.1 3 4.1 4.1V20.1C4 21.2 5 22 6.1 21.9H18C19.1 22 20 21.1 19.9 19.9V8.1L14.1 2.1Z" fill="' + c.AmberTint + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M13.9 2.1V8.2H20" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<circle cx="10.2" cy="16.8" r="2.1" fill="none" stroke="' + c.Accent + '" stroke-width="1.5" />'
					+ '<path d="M12.2 16.8V11.2L16.1 10.1" stroke="' + c.Accent + '" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />'
					+ '<circle cx="16.1" cy="15.3" r="1.4" fill="none" stroke="' + c.Accent + '" stroke-width="1.2" />'
					+ '</svg>';
			},

			// ---- Video file ----
			'file-video': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M14.1 2.1H6.2C5 2.2 4.1 3 4.1 4.1V20.1C4 21.2 5 22 6.1 21.9H18C19.1 22 20 21.1 19.9 19.9V8.1L14.1 2.1Z" fill="' + c.Lavender + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M13.9 2.1V8.2H20" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M9.8 12.2V18.2L15.8 15.2L9.8 12.2Z" fill="' + c.Accent + '" stroke="' + c.Accent + '" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />'
					+ '</svg>';
			},

			// ---- Web / markup file ----
			'file-web': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<circle cx="12" cy="12" r="8.9" fill="' + c.TealTint + '" stroke="' + c.Primary + '" stroke-width="1.8" />'
					+ '<ellipse cx="12" cy="12" rx="4.1" ry="8.9" fill="none" stroke="' + c.Primary + '" stroke-width="1.2" />'
					+ '<line x1="3.1" y1="12" x2="20.9" y2="12" stroke="' + c.Primary + '" stroke-width="1" />'
					+ '<path d="M4.8 7.8C7 8.5 9.4 8.9 12 8.9C14.6 8.9 17 8.5 19.2 7.8" stroke="' + c.Primary + '" stroke-width="1" fill="none" />'
					+ '<path d="M4.8 16.2C7 15.5 9.4 15.1 12 15.1C14.6 15.1 17 15.5 19.2 16.2" stroke="' + c.Primary + '" stroke-width="1" fill="none" />'
					+ '</svg>';
			},

			// ---- Config / settings file ----
			'file-config': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M14.1 2.1H6.2C5 2.2 4.1 3 4.1 4.1V20.1C4 21.2 5 22 6.1 21.9H18C19.1 22 20 21.1 19.9 19.9V8.1L14.1 2.1Z" fill="' + c.Light + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M13.9 2.1V8.2H20" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<circle cx="12" cy="15" r="2.8" fill="none" stroke="' + c.Muted + '" stroke-width="1.5" />'
					+ '<line x1="12" y1="11" x2="12" y2="12.2" stroke="' + c.Muted + '" stroke-width="1.3" stroke-linecap="round" />'
					+ '<line x1="12" y1="17.8" x2="12" y2="19" stroke="' + c.Muted + '" stroke-width="1.3" stroke-linecap="round" />'
					+ '<line x1="14.8" y1="13.2" x2="15.8" y2="12.6" stroke="' + c.Muted + '" stroke-width="1.3" stroke-linecap="round" />'
					+ '<line x1="8.2" y1="17" x2="9.2" y2="16.4" stroke="' + c.Muted + '" stroke-width="1.3" stroke-linecap="round" />'
					+ '<line x1="14.8" y1="16.8" x2="15.8" y2="17.4" stroke="' + c.Muted + '" stroke-width="1.3" stroke-linecap="round" />'
					+ '<line x1="8.2" y1="13" x2="9.2" y2="13.6" stroke="' + c.Muted + '" stroke-width="1.3" stroke-linecap="round" />'
					+ '</svg>';
			},

			// ---- UI Icons ----
			'home': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M3.1 9.6L12 3.1L20.9 9.6V19.9C20.9 20.5 20.5 21 19.9 20.9H4.1C3.5 21 3 20.5 3.1 19.9V9.6Z" fill="' + c.TealTint + '" stroke="' + c.Accent + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<rect x="9.2" y="14.1" width="5.6" height="6.9" rx="0.5" fill="' + c.Accent + '" />'
					+ '</svg>';
			},

			'arrow-up': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M12.1 19.1V5.1" stroke="' + c.Muted + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M5.2 11.9L12.1 5.1L18.9 11.9" stroke="' + c.Muted + '" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />'
					+ '</svg>';
			},

			'chevron-right': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M9.2 6.1L14.8 12.1L9.1 17.9" stroke="' + c.Muted + '" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />'
					+ '</svg>';
			},

			'chevron-down': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M6.1 9.2L12.1 14.8L17.9 9.1" stroke="' + c.Muted + '" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />'
					+ '</svg>';
			},

			'search': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<circle cx="10.8" cy="10.8" r="6.8" stroke="' + c.Primary + '" stroke-width="1.8" />'
					+ '<line x1="15.9" y1="16.1" x2="20.8" y2="20.8" stroke="' + c.Primary + '" stroke-width="2" stroke-linecap="round" />'
					+ '</svg>';
			},

			'sort-asc': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M12 4.2L7.2 10.8H16.8L12 4.2Z" fill="' + c.Primary + '" />'
					+ '<path d="M12 19.8L7.2 13.2H16.8L12 19.8Z" fill="' + c.Muted + '" opacity="0.35" />'
					+ '</svg>';
			},

			'sort-desc': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M12 4.2L7.2 10.8H16.8L12 4.2Z" fill="' + c.Muted + '" opacity="0.35" />'
					+ '<path d="M12 19.8L7.2 13.2H16.8L12 19.8Z" fill="' + c.Primary + '" />'
					+ '</svg>';
			},

			'sidebar': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<rect x="3" y="3" width="18" height="18" rx="2" stroke="' + c.Primary + '" stroke-width="1.8" fill="none" />'
					+ '<line x1="9" y1="3" x2="9" y2="21" stroke="' + c.Primary + '" stroke-width="1.8" />'
					+ '<line x1="5" y1="7.5" x2="7.5" y2="7.5" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" />'
					+ '<line x1="5" y1="10.5" x2="7.5" y2="10.5" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" />'
					+ '<line x1="5" y1="13.5" x2="7.5" y2="13.5" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" />'
					+ '</svg>';
			},

			// ====================================================================
			// NEW MEDIA-SPECIFIC ICONS
			// Not in the filebrowser set — standalone shapes for viewer fallbacks.
			// ====================================================================

			// ---- Standalone music note (audio viewer fallback) ----
			'music-note': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<circle cx="8.2" cy="17.8" r="3.1" fill="' + c.AmberTint + '" stroke="' + c.Accent + '" stroke-width="1.8" />'
					+ '<path d="M11.2 17.8V5.2L19.1 3.1V14.8" stroke="' + c.Accent + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />'
					+ '<circle cx="16.1" cy="14.8" r="2.4" fill="' + c.AmberTint + '" stroke="' + c.Accent + '" stroke-width="1.5" />'
					+ '</svg>';
			},

			// ---- Film strip / video placeholder (video viewer fallback) ----
			'film-strip': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<rect x="3" y="4" width="18" height="16" rx="2" stroke="' + c.Primary + '" stroke-width="1.8" fill="' + c.Lavender + '" />'
					+ '<path d="M9.5 8.5V15.5L16 12L9.5 8.5Z" fill="' + c.Accent + '" stroke="' + c.Accent + '" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" />'
					+ '</svg>';
			},

			// ---- Empty gallery / folder placeholder ----
			'gallery-empty': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M3.2 7.1V17.2C3.2 18.2 4 19.1 5.1 18.9L19.1 19.1C20 19.1 20.9 18.2 20.8 17.1V9.1C20.9 8 20.1 7.1 19 7.1H12.1L10.1 4.9H5.1C3.9 5 3.1 5.9 3.2 7.1Z" fill="' + c.WarmBeige + '" stroke="' + c.Muted + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<line x1="9" y1="11" x2="15" y2="17" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" opacity="0.5" />'
					+ '<line x1="15" y1="11" x2="9" y2="17" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" opacity="0.5" />'
					+ '</svg>';
			},

			// ---- Document / generic file fallback (viewer fallback) ----
			'document-large': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M14.1 2.1H6.2C5 2.2 4.1 3 4.1 4.1V20.1C4 21.2 5 22 6.1 21.9H18C19.1 22 20 21.1 19.9 19.9V8.1L14.1 2.1Z" fill="' + c.Light + '" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<path d="M13.9 2.1V8.2H20" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />'
					+ '<line x1="8.1" y1="13" x2="15.9" y2="13" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" />'
					+ '<line x1="8.1" y1="16" x2="15.9" y2="16" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" />'
					+ '<line x1="8.1" y1="19" x2="12" y2="19" stroke="' + c.Muted + '" stroke-width="1.2" stroke-linecap="round" />'
					+ '</svg>';
			},

			// ---- Collection icons ----
			'bookmark': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M6 4C6 3.45 6.45 3 7 3H17C17.55 3 18 3.45 18 4V21L12 17L6 21V4Z" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none" />'
					+ '</svg>';
			},

			'bookmark-filled': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<path d="M6 4C6 3.45 6.45 3 7 3H17C17.55 3 18 3.45 18 4V21L12 17L6 21V4Z" stroke="' + c.Primary + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="' + c.Accent + '" />'
					+ '</svg>';
			},

			'collection': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<rect x="4" y="8" width="16" height="12" rx="2" stroke="' + c.Primary + '" stroke-width="1.8" fill="' + c.Light + '" />'
					+ '<path d="M7 8V6C7 5.45 7.45 5 8 5H16C16.55 5 17 5.45 17 6V8" stroke="' + c.Primary + '" stroke-width="1.5" fill="none" />'
					+ '<path d="M9 5V3.5C9 3.22 9.22 3 9.5 3H14.5C14.78 3 15 3.22 15 3.5V5" stroke="' + c.Muted + '" stroke-width="1.2" fill="none" />'
					+ '</svg>';
			},

			'drag-handle': (pSize) =>
			{
				let c = tmpSelf._colors;
				return '<svg width="' + pSize + '" height="' + pSize + '" viewBox="0 0 24 24" fill="none">'
					+ '<circle cx="9" cy="7" r="1.5" fill="' + c.Muted + '" />'
					+ '<circle cx="15" cy="7" r="1.5" fill="' + c.Muted + '" />'
					+ '<circle cx="9" cy="12" r="1.5" fill="' + c.Muted + '" />'
					+ '<circle cx="15" cy="12" r="1.5" fill="' + c.Muted + '" />'
					+ '<circle cx="9" cy="17" r="1.5" fill="' + c.Muted + '" />'
					+ '<circle cx="15" cy="17" r="1.5" fill="' + c.Muted + '" />'
					+ '</svg>';
			}
		};
	}

	// ====================================================================
	// PUBLIC API
	// ====================================================================

	/**
	 * Get an SVG icon string by name.
	 *
	 * @param {string} pName - Icon name (e.g. 'folder', 'file-code')
	 * @param {number} [pSize=16] - Pixel size
	 * @returns {string} SVG string, or empty string if not found
	 */
	getIcon(pName, pSize)
	{
		let tmpSize = pSize || 16;

		// Check custom icons first, then built-in
		let tmpIconFn = this._customIcons[pName] || this._icons[pName];

		if (typeof tmpIconFn === 'function')
		{
			return tmpIconFn(tmpSize);
		}

		return '';
	}

	/**
	 * Get an SVG icon string for a file entry based on its type and extension.
	 *
	 * @param {Object} pEntry - File entry with Type, Extension, Icon properties
	 * @param {number} [pSize=16] - Pixel size
	 * @returns {string} SVG string
	 */
	getIconForEntry(pEntry, pSize)
	{
		if (!pEntry)
		{
			return '';
		}

		// If the entry has an explicit Icon that looks like SVG, use it directly
		if (pEntry.Icon && typeof pEntry.Icon === 'string' && pEntry.Icon.indexOf('<svg') === 0)
		{
			return pEntry.Icon;
		}

		let tmpSize = pSize || 16;

		// Folder
		if (pEntry.Type === 'folder')
		{
			return this.getIcon('folder', tmpSize);
		}

		// Lookup by extension
		let tmpExt = (pEntry.Extension || '').toLowerCase();
		if (tmpExt && this._extensionMap[tmpExt])
		{
			return this.getIcon(this._extensionMap[tmpExt], tmpSize);
		}

		// Default: generic file
		return this.getIcon('file', tmpSize);
	}

	/**
	 * Get a UI icon by name.
	 *
	 * @param {string} pName - UI icon name
	 * @param {number} [pSize=16] - Pixel size
	 * @returns {string} SVG string
	 */
	getUIIcon(pName, pSize)
	{
		return this.getIcon(pName, pSize || 16);
	}

	/**
	 * Register a custom icon.  Custom icons take priority over built-in
	 * icons and survive `setColors()` rebuilds.
	 *
	 * @param {string} pName - Icon name
	 * @param {Function} pIconFunction - Function(pSize) => SVG string
	 * @returns {boolean} True if registered successfully
	 */
	registerIcon(pName, pIconFunction)
	{
		if (!pName || typeof pIconFunction !== 'function')
		{
			return false;
		}

		this._customIcons[pName] = pIconFunction;
		return true;
	}

	/**
	 * Register a file extension mapping.
	 *
	 * @param {string} pExtension - Extension including dot (e.g. '.vue')
	 * @param {string} pIconName - Icon name to use
	 * @returns {boolean} True if registered successfully
	 */
	registerExtension(pExtension, pIconName)
	{
		if (!pExtension || !pIconName)
		{
			return false;
		}

		this._extensionMap[pExtension.toLowerCase()] = pIconName;
		return true;
	}

	/**
	 * Override one or more colors and rebuild the built-in icon set.
	 * Custom icons registered via `registerIcon()` are preserved.
	 *
	 * @param {Object} pColorOverrides - Partial color palette (e.g. { Accent: '#FF9900' })
	 */
	setColors(pColorOverrides)
	{
		if (!pColorOverrides || typeof pColorOverrides !== 'object')
		{
			return;
		}

		Object.assign(this._colors, pColorOverrides);
		this._icons = this._buildIconSet();
	}

	/**
	 * Get the current color palette.
	 *
	 * @returns {Object} Copy of the active color palette
	 */
	getColors()
	{
		return Object.assign({}, this._colors);
	}

	/**
	 * Get the full list of registered icon names.
	 *
	 * @returns {Array<string>} Array of icon names
	 */
	getIconNames()
	{
		let tmpNames = Object.keys(this._icons);
		let tmpCustomKeys = Object.keys(this._customIcons);
		for (let i = 0; i < tmpCustomKeys.length; i++)
		{
			if (tmpNames.indexOf(tmpCustomKeys[i]) < 0)
			{
				tmpNames.push(tmpCustomKeys[i]);
			}
		}
		return tmpNames;
	}

	/**
	 * Get a copy of the extension map.
	 *
	 * @returns {Object} Extension-to-icon name map
	 */
	getExtensionMap()
	{
		return Object.assign({}, this._extensionMap);
	}

	/**
	 * Inject CSS classes for icon sizing into the pict CSSMap.
	 */
	injectCSS()
	{
		if (this._cssInjected)
		{
			return;
		}

		if (this.pict && this.pict.CSSMap)
		{
			this.pict.CSSMap.addCSS('RetoldRemoteIcons',
				'.retold-remote-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; }\n'
				+ '.retold-remote-icon svg { display: block; }\n'
				+ '.retold-remote-icon-sm svg { width: 16px; height: 16px; }\n'
				+ '.retold-remote-icon-md svg { width: 48px; height: 48px; }\n'
				+ '.retold-remote-icon-lg svg { width: 64px; height: 64px; }\n'
				+ '.retold-remote-icon-xl svg { width: 96px; height: 96px; }\n'
			);
			this._cssInjected = true;
		}
	}

	onAfterInitialize()
	{
		this.injectCSS();
		return super.onAfterInitialize();
	}
}

module.exports = RetoldRemoteIconProvider;

module.exports.default_configuration = _DefaultProviderConfiguration;

module.exports.DefaultColors = _DefaultColors;
