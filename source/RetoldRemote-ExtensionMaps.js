/**
 * Shared extension category maps for retold-remote.
 *
 * Used by both client-side providers (GalleryFilterSort) and server-side
 * services (MediaService) to classify files by extension.
 */

const ImageExtensions = { 'png': true, 'jpg': true, 'jpeg': true, 'gif': true, 'webp': true, 'svg': true, 'bmp': true, 'ico': true, 'avif': true, 'tiff': true, 'tif': true, 'heic': true, 'heif': true };
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

module.exports.ImageExtensions = ImageExtensions;
module.exports.VideoExtensions = VideoExtensions;
module.exports.AudioExtensions = AudioExtensions;
module.exports.DocumentExtensions = DocumentExtensions;
module.exports.getCategory = getCategory;
