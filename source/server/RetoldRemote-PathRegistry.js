/**
 * Retold Remote -- Path Registry
 *
 * Maps short deterministic hashes (10-char hex, SHA-256 truncated)
 * to full relative paths.  Hashes are deterministic so they survive
 * server restarts without persistence.  The registry is populated
 * on-demand as directories are listed and persisted to a Bibliograph
 * source so lookups survive server restarts without a directory walk.
 *
 * @license MIT
 */
const libCrypto = require('crypto');
const libFs = require('fs');
const libPath = require('path');
const libFableServiceProviderBase = require('fable-serviceproviderbase');

const _HASH_LENGTH = 10;
const _BIBLIOGRAPH_SOURCE = 'retold-remote-path-registry';

class RetoldRemotePathRegistry extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemotePathRegistry';

		this._enabled = !!(pOptions && pOptions.Enabled);
		this._contentPath = (pOptions && pOptions.ContentPath) ? libPath.resolve(pOptions.ContentPath) : null;
		this._bibliographReady = false;

		// hash -> relative path
		this._hashToPath = new Map();
		// relative path -> hash
		this._pathToHash = new Map();
	}

	/**
	 * Initialize the Bibliograph source for persisting hash→path mappings.
	 * Call this after Parime storage is initialized.
	 *
	 * @param {Function} fCallback
	 */
	initialize(fCallback)
	{
		let tmpSelf = this;

		if (!this.fable.Bibliograph)
		{
			this.fable.log.warn('PathRegistry: Bibliograph not available, persistence disabled.');
			return fCallback();
		}

		this.fable.Bibliograph.createSource(_BIBLIOGRAPH_SOURCE,
			(pError) =>
			{
				if (pError)
				{
					tmpSelf.fable.log.warn('PathRegistry source creation notice: ' + pError.message);
				}
				tmpSelf._bibliographReady = true;
				tmpSelf.fable.log.info('PathRegistry Bibliograph source initialized.');
				return fCallback();
			});
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
	 * Also persists the mapping to Bibliograph (fire-and-forget).
	 *
	 * @param {string} pRelativePath
	 * @returns {string} 10-char hex hash
	 */
	register(pRelativePath)
	{
		let tmpHash = this.hashPath(pRelativePath);
		let tmpAlreadyKnown = this._hashToPath.has(tmpHash);

		this._hashToPath.set(tmpHash, pRelativePath);
		this._pathToHash.set(pRelativePath, tmpHash);

		// Persist to Bibliograph (fire-and-forget, only for new mappings)
		if (!tmpAlreadyKnown && this._bibliographReady)
		{
			this.fable.Bibliograph.write(_BIBLIOGRAPH_SOURCE, tmpHash,
				{ Hash: tmpHash, Path: pRelativePath },
				(pError) =>
				{
					if (pError)
					{
						this.fable.log.warn('PathRegistry persist error: ' + pError.message);
					}
				});
		}

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
	 * Resolve a hash asynchronously using a three-tier lookup:
	 *   1. In-memory map (instant)
	 *   2. Bibliograph persistent store (fast)
	 *   3. Directory walk fallback (slow, last resort)
	 *
	 * @param {string} pHash - The 10-char hex hash to resolve
	 * @param {Function} fCallback - Callback(pError, pResolvedPath)
	 */
	resolveAsync(pHash, fCallback)
	{
		// Tier 1: in-memory
		let tmpResolved = this._hashToPath.get(pHash) || null;
		if (tmpResolved)
		{
			return fCallback(null, tmpResolved);
		}

		let tmpSelf = this;

		// Tier 2: Bibliograph
		if (this._bibliographReady)
		{
			this.fable.Bibliograph.read(_BIBLIOGRAPH_SOURCE, pHash,
				(pReadError, pRecord) =>
				{
					if (!pReadError && pRecord && pRecord.Path)
					{
						// Populate in-memory maps from the persisted record
						tmpSelf._hashToPath.set(pHash, pRecord.Path);
						tmpSelf._pathToHash.set(pRecord.Path, pHash);
						return fCallback(null, pRecord.Path);
					}

					// Tier 3: directory walk
					tmpSelf.resolveByWalk(pHash, fCallback);
				});
			return;
		}

		// Bibliograph not ready — fall straight to directory walk
		this.resolveByWalk(pHash, fCallback);
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

	/**
	 * Resolve a hash by walking the content directory tree.
	 * Used when the hash isn't in the in-memory registry (e.g. after a server restart).
	 * Walks recursively, computing hashes for each entry until a match is found.
	 *
	 * @param {string} pHash - The 10-char hex hash to find
	 * @param {Function} fCallback - Callback(pError, pResolvedPath)
	 */
	resolveByWalk(pHash, fCallback)
	{
		if (!this._contentPath)
		{
			return fCallback(null, null);
		}

		let tmpSelf = this;
		let tmpFound = false;

		let tmpWalk = function (pDir, pRelBase, fWalkDone)
		{
			if (tmpFound)
			{
				return fWalkDone();
			}

			libFs.readdir(pDir, { withFileTypes: true }, (pError, pEntries) =>
			{
				if (pError || !pEntries)
				{
					return fWalkDone();
				}

				let i = 0;
				let tmpNext = function ()
				{
					if (tmpFound || i >= pEntries.length)
					{
						return fWalkDone();
					}

					let tmpEntry = pEntries[i++];
					let tmpName = tmpEntry.name;

					// Skip hidden entries
					if (tmpName.charAt(0) === '.')
					{
						return tmpNext();
					}

					let tmpRelPath = pRelBase ? (pRelBase + '/' + tmpName) : tmpName;
					let tmpEntryHash = tmpSelf.register(tmpRelPath);

					if (tmpEntryHash === pHash)
					{
						tmpFound = true;
						return fWalkDone();
					}

					if (tmpEntry.isDirectory())
					{
						tmpWalk(libPath.join(pDir, tmpName), tmpRelPath, tmpNext);
					}
					else
					{
						tmpNext();
					}
				};

				tmpNext();
			});
		};

		tmpWalk(tmpSelf._contentPath, '', () =>
		{
			if (tmpFound)
			{
				return fCallback(null, tmpSelf._hashToPath.get(pHash) || null);
			}
			return fCallback(null, null);
		});
	}
}

module.exports = RetoldRemotePathRegistry;
