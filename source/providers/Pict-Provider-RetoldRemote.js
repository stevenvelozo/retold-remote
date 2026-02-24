const libPictProvider = require('pict-provider');

const _DefaultProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-Provider',
	AutoInitialize: true,
	AutoSolveWithApp: false
};

class RetoldRemoteProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		// Client-side cache: path -> hash and hash -> path
		this._pathToHash = {};
		this._hashToPath = {};
	}

	/**
	 * Fetch the server's media processing capabilities.
	 *
	 * @param {Function} fCallback - Callback(pError, pCapabilities)
	 */
	fetchCapabilities(fCallback)
	{
		fetch('/api/media/capabilities')
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				if (pData && pData.Capabilities)
				{
					return fCallback(null, pData.Capabilities);
				}
				return fCallback(null, {});
			})
			.catch((pError) =>
			{
				return fCallback(pError);
			});
	}

	/**
	 * Fetch the server's remote settings (e.g. hashed filenames mode).
	 *
	 * @param {Function} fCallback - Callback(pError, pSettings)
	 */
	fetchRemoteSettings(fCallback)
	{
		fetch('/api/remote/settings')
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				if (pData)
				{
					return fCallback(null, pData);
				}
				return fCallback(null, {});
			})
			.catch((pError) =>
			{
				return fCallback(pError);
			});
	}

	/**
	 * Register a path<->hash mapping in the client-side cache.
	 *
	 * @param {string} pPath - Relative file/folder path
	 * @param {string} pHash - 10-char hex hash
	 */
	registerHash(pPath, pHash)
	{
		if (pPath && pHash)
		{
			this._pathToHash[pPath] = pHash;
			this._hashToPath[pHash] = pPath;
		}
	}

	/**
	 * Get the hash for a known path.
	 *
	 * @param {string} pPath
	 * @returns {string|null}
	 */
	getHashForPath(pPath)
	{
		return this._pathToHash[pPath] || null;
	}

	/**
	 * Get the path for a known hash.
	 *
	 * @param {string} pHash
	 * @returns {string|null}
	 */
	getPathForHash(pHash)
	{
		return this._hashToPath[pHash] || null;
	}

	/**
	 * Get the best path identifier for use in URL query params.
	 * Returns the hash if hashed filenames is enabled and hash is cached,
	 * otherwise returns the full path.
	 *
	 * @param {string} pPath - Relative file/folder path
	 * @returns {string} Hash or encoded path
	 */
	_getPathParam(pPath)
	{
		if (this.pict.AppData.RetoldRemote.HashedFilenames)
		{
			let tmpHash = this.getHashForPath(pPath);
			if (tmpHash)
			{
				return tmpHash;
			}
		}
		return encodeURIComponent(pPath);
	}

	/**
	 * Get a short identifier for a path, suitable for use in browser hash fragments.
	 * Returns the hash token if hashed filenames is on and hash is cached,
	 * otherwise returns the raw path.
	 *
	 * @param {string} pPath - Relative file/folder path
	 * @returns {string} Hash token or raw path
	 */
	getFragmentIdentifier(pPath)
	{
		if (this.pict.AppData.RetoldRemote.HashedFilenames)
		{
			let tmpHash = this.getHashForPath(pPath);
			if (tmpHash)
			{
				return tmpHash;
			}
		}
		return pPath;
	}

	/**
	 * Resolve a fragment identifier back to a path.
	 * If it looks like a 10-char hex hash and we have a mapping, return the path.
	 * Otherwise return the identifier as-is (it's already a path).
	 *
	 * @param {string} pIdentifier - Hash token or raw path from fragment
	 * @returns {string} Resolved path
	 */
	resolveFragmentIdentifier(pIdentifier)
	{
		if (pIdentifier && /^[a-f0-9]{10}$/.test(pIdentifier))
		{
			let tmpPath = this.getPathForHash(pIdentifier);
			if (tmpPath !== null)
			{
				return tmpPath;
			}
		}
		return pIdentifier;
	}

	/**
	 * Get a content URL for a file.
	 * Uses /content-hashed/<hash> when hashed filenames is on and hash is cached,
	 * otherwise uses /content/<encoded-path>.
	 *
	 * @param {string} pPath - Relative file path
	 * @returns {string} URL
	 */
	getContentURL(pPath)
	{
		// Always use the /content/ static route for actual file serving.
		// Encode each path segment individually to preserve directory separators.
		let tmpSegments = pPath.split('/').map((pSeg) => encodeURIComponent(pSeg));
		return '/content/' + tmpSegments.join('/');
	}

	/**
	 * Build a thumbnail URL for a file.
	 * Returns the direct content URL if the server has no thumbnail capability.
	 *
	 * @param {string} pPath   - Relative file path
	 * @param {number} pWidth  - Desired width
	 * @param {number} pHeight - Desired height
	 * @returns {string} URL
	 */
	getThumbnailURL(pPath, pWidth, pHeight)
	{
		let tmpCapabilities = this.pict.AppData.RetoldRemote.ServerCapabilities;
		let tmpExtension = pPath.replace(/^.*\./, '').toLowerCase();
		let tmpIsImage = this._isImageExtension(tmpExtension);

		// If server has thumbnail tools, use the thumbnail API
		if (tmpCapabilities && (tmpCapabilities.sharp || tmpCapabilities.imagemagick))
		{
			return '/api/media/thumbnail?path=' + this._getPathParam(pPath) +
				'&width=' + (pWidth || 200) +
				'&height=' + (pHeight || 200);
		}

		// For images without server-side tools, use the direct file URL
		if (tmpIsImage)
		{
			return this.getContentURL(pPath);
		}

		// For non-images without tools, return null (use icon instead)
		return null;
	}

	/**
	 * Fetch media metadata for a file.
	 *
	 * @param {string}   pPath     - Relative file path
	 * @param {Function} fCallback - Callback(pError, pProbeData)
	 */
	fetchMediaProbe(pPath, fCallback)
	{
		fetch('/api/media/probe?path=' + this._getPathParam(pPath))
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				// Cache hash if returned in probe data
				if (pData && pData.Hash && pData.Path)
				{
					this.registerHash(pData.Path, pData.Hash);
				}
				fCallback(null, pData);
			})
			.catch((pError) => fCallback(pError));
	}

	/**
	 * Fetch folder media summary.
	 *
	 * @param {string}   pPath     - Relative folder path
	 * @param {Function} fCallback - Callback(pError, pSummaryData)
	 */
	fetchFolderSummary(pPath, fCallback)
	{
		let tmpURL = '/api/media/folder-summary';
		if (pPath)
		{
			tmpURL += '?path=' + this._getPathParam(pPath);
		}

		fetch(tmpURL)
			.then((pResponse) => pResponse.json())
			.then((pData) => fCallback(null, pData))
			.catch((pError) => fCallback(pError));
	}

	/**
	 * Check if a file extension is a known image type.
	 *
	 * @param {string} pExtension - Lowercase extension
	 * @returns {boolean}
	 */
	_isImageExtension(pExtension)
	{
		let tmpImageExtensions = { 'png': true, 'jpg': true, 'jpeg': true, 'gif': true, 'webp': true, 'svg': true, 'bmp': true, 'ico': true, 'avif': true, 'tiff': true, 'tif': true };
		return !!tmpImageExtensions[pExtension];
	}
}

RetoldRemoteProvider.default_configuration = _DefaultProviderConfiguration;

module.exports = RetoldRemoteProvider;
