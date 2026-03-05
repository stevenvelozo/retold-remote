/**
 * Retold Remote -- Filesystem Thumbnail Cache
 *
 * Caches generated thumbnails using Parime's ParimeBinaryStorage.
 * Cache keys use a two-level structure: a folder hash derived from
 * the source file's directory, and a file-specific hash derived from
 * the filename, modification time, and requested dimensions.
 *
 * This means all thumbnails for images in the same folder are
 * co-located under the same shard directory — browsing a gallery
 * folder of 10,000 images creates entries in ONE shard directory
 * rather than 10,000 separate shard paths.
 *
 * Stale entries are automatically invalidated when the source file
 * changes (because mtime is part of the file-specific hash).
 */
const libFs = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');

const _CATEGORY = 'thumbnails';

class ThumbnailCache
{
	/**
	 * @param {object} pFable - The Fable instance (must have ParimeBinaryStorage wired)
	 */
	constructor(pFable)
	{
		this._fable = pFable;
		this._storage = pFable.ParimeBinaryStorage;
	}

	/**
	 * Build a cache key from the source file path, its mtime, and the
	 * requested thumbnail dimensions.
	 *
	 * The key has two parts separated by a slash:
	 *   {folderHash}/{fileHash}
	 *
	 * The folder hash groups all thumbnails from the same directory
	 * together so they land in the same shard directory on disk.
	 * The file hash uniquely identifies a particular file at a
	 * particular mtime and dimension.
	 *
	 * @param {string} pFilePath   - Relative path to the source file
	 * @param {number} pMtime      - Source file mtime (ms since epoch)
	 * @param {number} pWidth      - Thumbnail width
	 * @param {number} pHeight     - Thumbnail height
	 * @returns {string} A composite key "{folderHash}/{fileHash}"
	 */
	buildKey(pFilePath, pMtime, pWidth, pHeight)
	{
		let tmpDir = libPath.dirname(pFilePath);
		let tmpFile = libPath.basename(pFilePath);

		// Folder hash — first 16 hex chars; used for sharding and co-location
		let tmpFolderHash = libCrypto.createHash('sha256').update(tmpDir).digest('hex').substring(0, 16);

		// File-specific hash — full 64 hex chars; unique per file + dimensions
		let tmpFileInput = `${tmpFile}:${pMtime}:${pWidth}x${pHeight}`;
		let tmpFileHash = libCrypto.createHash('sha256').update(tmpFileInput).digest('hex');

		return `${tmpFolderHash}/${tmpFileHash}`;
	}

	/**
	 * Return the absolute path to a cached thumbnail, or null if no
	 * cached entry exists.
	 *
	 * @param {string} pKey    - The cache key (from buildKey)
	 * @param {string} pFormat - File extension (e.g. 'webp', 'jpg')
	 * @returns {string|null}
	 */
	get(pKey, pFormat)
	{
		let tmpFileKey = `${pKey}.${pFormat || 'webp'}`;
		let tmpPath = this._storage.resolvePath(_CATEGORY, tmpFileKey);
		if (libFs.existsSync(tmpPath))
		{
			return tmpPath;
		}
		return null;
	}

	/**
	 * Write a thumbnail buffer to the cache.
	 *
	 * @param {string} pKey    - The cache key
	 * @param {Buffer} pBuffer - The thumbnail image data
	 * @param {string} pFormat - File extension (e.g. 'webp', 'jpg')
	 * @returns {string} The absolute path to the cached file
	 */
	put(pKey, pBuffer, pFormat)
	{
		let tmpFileKey = `${pKey}.${pFormat || 'webp'}`;
		let tmpPath = this._storage.resolvePath(_CATEGORY, tmpFileKey);

		// Ensure parent directory exists (for sharded paths)
		let tmpDir = libPath.dirname(tmpPath);
		if (!libFs.existsSync(tmpDir))
		{
			libFs.mkdirSync(tmpDir, { recursive: true });
		}

		libFs.writeFileSync(tmpPath, pBuffer);
		return tmpPath;
	}

	/**
	 * Get the cache category name.
	 *
	 * @returns {string}
	 */
	getCachePath()
	{
		return this._storage.resolvePath(_CATEGORY, '');
	}
}

module.exports = ThumbnailCache;
