/**
 * Shared extension category maps for retold-remote.
 *
 * Used by both client-side providers (GalleryFilterSort) and server-side
 * services (MediaService) to classify files by extension.
 */

// Image formats that require server-side conversion before display.
// These are recognized as images for categorization but need dcraw,
// ImageMagick, or embedded-preview extraction before the browser can
// render them.  Includes raw camera formats and formats that most
// browsers cannot display natively (HEIC/HEIF).
const RawImageExtensions =
{
	'nef': true, 'nrw': true,                       // Nikon
	'cr2': true, 'cr3': true, 'crw': true,           // Canon
	'arw': true, 'srf': true, 'sr2': true,           // Sony
	'raf': true,                                     // Fujifilm
	'orf': true,                                     // Olympus / OM System
	'rw2': true, 'rwl': true,                        // Panasonic / Leica
	'pef': true,                                     // Pentax / Ricoh
	'srw': true,                                     // Samsung
	'x3f': true,                                     // Sigma / Foveon
	'3fr': true, 'fff': true,                        // Hasselblad
	'iiq': true,                                     // Phase One
	'dcr': true, 'kdc': true,                        // Kodak
	'mrw': true,                                     // Minolta
	'erf': true,                                     // Epson
	'raw': true,                                     // Generic
	'dng': true,                                     // Adobe DNG (Leica, DJI, etc.)
	'heic': true, 'heif': true                       // Apple / MPEG-H (limited browser support)
};

const ImageExtensions = { 'png': true, 'jpg': true, 'jpeg': true, 'gif': true, 'webp': true, 'svg': true, 'bmp': true, 'ico': true, 'avif': true, 'tiff': true, 'tif': true, 'heic': true, 'heif': true };

// Merge raw extensions into ImageExtensions so getCategory() returns 'image'
for (let tmpKey in RawImageExtensions)
{
	ImageExtensions[tmpKey] = true;
}

const VideoExtensions = { 'mp4': true, 'webm': true, 'mov': true, 'mkv': true, 'avi': true, 'wmv': true, 'flv': true, 'm4v': true, 'ogv': true, 'mpg': true, 'mpeg': true, 'mpe': true, 'mpv': true, 'm2v': true, 'ts': true, 'mts': true, 'm2ts': true, 'vob': true, '3gp': true, '3g2': true, 'f4v': true, 'rm': true, 'rmvb': true, 'divx': true, 'asf': true, 'mxf': true, 'dv': true, 'nsv': true, 'nuv': true, 'y4m': true, 'wtv': true, 'swf': true, 'dat': true };
const AudioExtensions = { 'mp3': true, 'wav': true, 'ogg': true, 'flac': true, 'aac': true, 'm4a': true, 'wma': true, 'oga': true };
const DocumentExtensions = { 'pdf': true, 'epub': true, 'mobi': true, 'doc': true, 'docx': true };

/**
 * Get the media category for a file extension.
 *
 * @param {string} pExtension - Extension with or without leading dot (e.g. '.png' or 'png')
 * @returns {string} 'image', 'video', 'audio', 'document', or 'other'
 */
function getCategory(pExtension)
{
	let tmpExt = (pExtension || '').replace(/^\./, '').toLowerCase();
	if (ImageExtensions[tmpExt]) return 'image';
	if (VideoExtensions[tmpExt]) return 'video';
	if (AudioExtensions[tmpExt]) return 'audio';
	if (DocumentExtensions[tmpExt]) return 'document';
	return 'other';
}

/**
 * Check if an extension is a raw camera image format.
 *
 * @param {string} pExtension - Extension with or without leading dot
 * @returns {boolean}
 */
function isRawImage(pExtension)
{
	let tmpExt = (pExtension || '').replace(/^\./, '').toLowerCase();
	return !!RawImageExtensions[tmpExt];
}

module.exports.RawImageExtensions = RawImageExtensions;
module.exports.ImageExtensions = ImageExtensions;
module.exports.VideoExtensions = VideoExtensions;
module.exports.AudioExtensions = AudioExtensions;
module.exports.DocumentExtensions = DocumentExtensions;
module.exports.getCategory = getCategory;
module.exports.isRawImage = isRawImage;
