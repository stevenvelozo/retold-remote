/**
 * Retold Remote -- Filesystem Thumbnail Cache
 *
 * Caches generated thumbnails as files in a hidden directory under the
 * content root.  Cache keys are derived from the file path, modification
 * time, and requested dimensions so that stale entries are automatically
 * invalidated when the source file changes.
 */
const libFs = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');

class ThumbnailCache
{
	/**
	 * @param {string} pCachePath - Absolute path to the cache directory
	 */
	constructor(pCachePath)
	{
		this._cachePath = pCachePath;

		// Ensure the cache directory exists
		if (!libFs.existsSync(this._cachePath))
		{
			libFs.mkdirSync(this._cachePath, { recursive: true });
		}
	}

	/**
	 * Build a cache key from the source file path, its mtime, and the
	 * requested thumbnail dimensions.
	 *
	 * @param {string} pFilePath   - Relative path to the source file
	 * @param {number} pMtime      - Source file mtime (ms since epoch)
	 * @param {number} pWidth      - Thumbnail width
	 * @param {number} pHeight     - Thumbnail height
	 * @returns {string} A hex hash suitable for use as a filename
	 */
	buildKey(pFilePath, pMtime, pWidth, pHeight)
	{
		let tmpInput = `${pFilePath}:${pMtime}:${pWidth}x${pHeight}`;
		return libCrypto.createHash('sha256').update(tmpInput).digest('hex');
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
		let tmpPath = libPath.join(this._cachePath, `${pKey}.${pFormat || 'webp'}`);
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
		let tmpPath = libPath.join(this._cachePath, `${pKey}.${pFormat || 'webp'}`);
		libFs.writeFileSync(tmpPath, pBuffer);
		return tmpPath;
	}

	/**
	 * Get the absolute path to the cache directory.
	 *
	 * @returns {string}
	 */
	getCachePath()
	{
		return this._cachePath;
	}
}

module.exports = ThumbnailCache;
