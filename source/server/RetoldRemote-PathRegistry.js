/**
 * Retold Remote -- Path Registry
 *
 * Maps short deterministic hashes (10-char hex, SHA-256 truncated)
 * to full relative paths.  Hashes are deterministic so they survive
 * server restarts without persistence.  The registry is populated
 * on-demand as directories are listed.
 *
 * @license MIT
 */
const libCrypto = require('crypto');
const libFableServiceProviderBase = require('fable-serviceproviderbase');

const _HASH_LENGTH = 10;

class RetoldRemotePathRegistry extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemotePathRegistry';

		this._enabled = !!(pOptions && pOptions.Enabled);

		// hash -> relative path
		this._hashToPath = new Map();
		// relative path -> hash
		this._pathToHash = new Map();
	}

	/**
	 * Whether hashed filenames mode is active.
	 *
	 * @returns {boolean}
	 */
	isEnabled()
	{
		return this._enabled;
	}

	/**
	 * Compute a deterministic 10-char hex hash for a relative path.
	 *
	 * @param {string} pRelativePath
	 * @returns {string} 10-character lowercase hex string
	 */
	hashPath(pRelativePath)
	{
		let tmpNormalized = (pRelativePath || '').replace(/\\/g, '/').replace(/\/+$/, '');
		return libCrypto
			.createHash('sha256')
			.update(tmpNormalized)
			.digest('hex')
			.substring(0, _HASH_LENGTH);
	}

	/**
	 * Register a relative path and return its hash.
	 *
	 * @param {string} pRelativePath
	 * @returns {string} 10-char hex hash
	 */
	register(pRelativePath)
	{
		let tmpHash = this.hashPath(pRelativePath);
		this._hashToPath.set(tmpHash, pRelativePath);
		this._pathToHash.set(pRelativePath, tmpHash);
		return tmpHash;
	}

	/**
	 * Resolve a hash back to its relative path.
	 *
	 * @param {string} pHash
	 * @returns {string|null}
	 */
	resolve(pHash)
	{
		return this._hashToPath.get(pHash) || null;
	}

	/**
	 * Get the hash for a previously registered path.
	 *
	 * @param {string} pRelativePath
	 * @returns {string|null}
	 */
	getHash(pRelativePath)
	{
		return this._pathToHash.get(pRelativePath) || null;
	}

	/**
	 * Annotate an array of file list entries with Hash fields.
	 * Each entry is expected to have a Path property.
	 *
	 * @param {Array} pFileList
	 * @returns {Array} Same array with Hash fields added
	 */
	annotateFileList(pFileList)
	{
		if (!Array.isArray(pFileList))
		{
			return pFileList;
		}

		for (let i = 0; i < pFileList.length; i++)
		{
			let tmpEntry = pFileList[i];
			if (tmpEntry && tmpEntry.Path)
			{
				tmpEntry.Hash = this.register(tmpEntry.Path);
			}
		}

		return pFileList;
	}
}

module.exports = RetoldRemotePathRegistry;
