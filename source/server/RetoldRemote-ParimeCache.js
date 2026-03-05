/**
 * Retold Remote -- Parime Cache Adapter
 *
 * Wraps parime's ParimeBinaryStorage as a unified cache layer for
 * retold-remote.  Supports two modes:
 *
 *   1. Embedded (default): ParimeBinaryStorage accessed directly in-process.
 *   2. Remote: If fable.settings.ParimeCacheServer is a URL, all cache
 *      operations route through HTTP to a remote parime server.
 *
 * This adapter provides helper methods for cache key generation and
 * passthrough access to the underlying storage.
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libCrypto = require('crypto');

class RetoldRemoteParimeCache extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteParimeCache';

		this._remoteURL = (typeof(this.fable.settings.ParimeCacheServer) === 'string'
			&& this.fable.settings.ParimeCacheServer.length > 0)
			? this.fable.settings.ParimeCacheServer.replace(/\/+$/, '')
			: null;
	}

	/**
	 * Whether this adapter is operating in remote mode.
	 *
	 * @returns {boolean}
	 */
	get isRemote()
	{
		return this._remoteURL !== null;
	}

	/**
	 * Build a cache key from an array of components.
	 *
	 * Components are joined with ':' and hashed with SHA-256.
	 * Optionally truncate to pHashLength characters.
	 *
	 * @param {Array<string|number>} pComponents - Values to include in the key.
	 * @param {number} [pHashLength] - Truncate the hash to this many hex chars.
	 * @returns {string} The hex hash.
	 */
	buildCacheKey(pComponents, pHashLength)
	{
		let tmpInput = pComponents.join(':');
		let tmpHash = libCrypto.createHash('sha256').update(tmpInput).digest('hex');
		if (typeof(pHashLength) === 'number' && pHashLength > 0)
		{
			return tmpHash.substring(0, pHashLength);
		}
		return tmpHash;
	}

	/**
	 * Get the underlying ParimeBinaryStorage service.
	 *
	 * @returns {object} The ParimeBinaryStorage instance.
	 */
	get storage()
	{
		return this.fable.ParimeBinaryStorage;
	}

	/**
	 * Resolve a category + key to an absolute filesystem path.
	 *
	 * Only valid in embedded mode (not remote).
	 *
	 * @param {string} pCategory - The cache category.
	 * @param {string} pKey - The cache key.
	 * @returns {string} Absolute file path.
	 */
	resolvePath(pCategory, pKey)
	{
		return this.fable.ParimeBinaryStorage.resolvePath(pCategory, pKey);
	}

	/**
	 * Check if a cached item exists.
	 *
	 * @param {string} pCategory - The cache category.
	 * @param {string} pKey - The cache key.
	 * @param {function} fCallback - Callback(pError, pExists).
	 */
	exists(pCategory, pKey, fCallback)
	{
		if (this._remoteURL)
		{
			return this._remoteExists(pCategory, pKey, fCallback);
		}
		return this.fable.ParimeBinaryStorage.exists(pCategory, pKey, fCallback);
	}

	/**
	 * Read a cached item.
	 *
	 * @param {string} pCategory - The cache category.
	 * @param {string} pKey - The cache key.
	 * @param {function} fCallback - Callback(pError, pBuffer).
	 */
	read(pCategory, pKey, fCallback)
	{
		if (this._remoteURL)
		{
			return this._remoteRead(pCategory, pKey, fCallback);
		}
		return this.fable.ParimeBinaryStorage.read(pCategory, pKey, fCallback);
	}

	/**
	 * Write a cached item.
	 *
	 * @param {string} pCategory - The cache category.
	 * @param {string} pKey - The cache key.
	 * @param {Buffer} pBuffer - The data to write.
	 * @param {function} fCallback - Callback(pError).
	 */
	write(pCategory, pKey, pBuffer, fCallback)
	{
		if (this._remoteURL)
		{
			return this._remoteWrite(pCategory, pKey, pBuffer, fCallback);
		}
		return this.fable.ParimeBinaryStorage.write(pCategory, pKey, pBuffer, fCallback);
	}

	/**
	 * Get a readable stream for a cached item.
	 *
	 * Only valid in embedded mode.
	 *
	 * @param {string} pCategory - The cache category.
	 * @param {string} pKey - The cache key.
	 * @param {object} [pOptions] - Stream options ({ start, end }).
	 * @returns {ReadStream}
	 */
	readStream(pCategory, pKey, pOptions)
	{
		return this.fable.ParimeBinaryStorage.readStream(pCategory, pKey, pOptions);
	}

	/**
	 * Get file stats for a cached item.
	 *
	 * @param {string} pCategory - The cache category.
	 * @param {string} pKey - The cache key.
	 * @param {function} fCallback - Callback(pError, pStats).
	 */
	stat(pCategory, pKey, fCallback)
	{
		if (this._remoteURL)
		{
			return this._remoteStat(pCategory, pKey, fCallback);
		}
		return this.fable.ParimeBinaryStorage.stat(pCategory, pKey, fCallback);
	}

	/**
	 * Delete a cached item.
	 *
	 * @param {string} pCategory - The cache category.
	 * @param {string} pKey - The cache key.
	 * @param {function} fCallback - Callback(pError).
	 */
	delete(pCategory, pKey, fCallback)
	{
		if (this._remoteURL)
		{
			return this._remoteDelete(pCategory, pKey, fCallback);
		}
		return this.fable.ParimeBinaryStorage.delete(pCategory, pKey, fCallback);
	}

	// ── Remote mode helpers ──────────────────────────────────────

	/**
	 * @private
	 */
	_remoteExists(pCategory, pKey, fCallback)
	{
		let tmpURL = `${this._remoteURL}/1.0/Binary/${encodeURIComponent(pCategory)}/${pKey}/Stat`;
		let libHTTP = require('http');
		let tmpParsed = new URL(tmpURL);

		let tmpReq = libHTTP.request(
			{
				hostname: tmpParsed.hostname,
				port: tmpParsed.port,
				path: tmpParsed.pathname,
				method: 'GET'
			},
			(pResponse) =>
			{
				let tmpChunks = [];
				pResponse.on('data', (pChunk) => { tmpChunks.push(pChunk); });
				pResponse.on('end', () =>
				{
					return fCallback(null, pResponse.statusCode === 200);
				});
			});
		tmpReq.on('error', (pError) => { return fCallback(pError); });
		tmpReq.end();
	}

	/**
	 * @private
	 */
	_remoteRead(pCategory, pKey, fCallback)
	{
		let tmpURL = `${this._remoteURL}/1.0/Binary/${encodeURIComponent(pCategory)}/${pKey}`;
		let libHTTP = require('http');
		let tmpParsed = new URL(tmpURL);

		let tmpReq = libHTTP.request(
			{
				hostname: tmpParsed.hostname,
				port: tmpParsed.port,
				path: tmpParsed.pathname,
				method: 'GET'
			},
			(pResponse) =>
			{
				if (pResponse.statusCode === 404)
				{
					pResponse.resume();
					return fCallback(null, null);
				}
				let tmpChunks = [];
				pResponse.on('data', (pChunk) => { tmpChunks.push(pChunk); });
				pResponse.on('end', () =>
				{
					return fCallback(null, Buffer.concat(tmpChunks));
				});
			});
		tmpReq.on('error', (pError) => { return fCallback(pError); });
		tmpReq.end();
	}

	/**
	 * @private
	 */
	_remoteWrite(pCategory, pKey, pBuffer, fCallback)
	{
		let tmpURL = `${this._remoteURL}/1.0/Binary/${encodeURIComponent(pCategory)}/${pKey}`;
		let libHTTP = require('http');
		let tmpParsed = new URL(tmpURL);

		let tmpReq = libHTTP.request(
			{
				hostname: tmpParsed.hostname,
				port: tmpParsed.port,
				path: tmpParsed.pathname,
				method: 'PUT',
				headers: { 'Content-Type': 'application/octet-stream' }
			},
			(pResponse) =>
			{
				pResponse.resume();
				pResponse.on('end', () =>
				{
					return fCallback(pResponse.statusCode >= 400
						? new Error(`Remote write failed: ${pResponse.statusCode}`)
						: null);
				});
			});
		tmpReq.on('error', (pError) => { return fCallback(pError); });
		tmpReq.write(pBuffer);
		tmpReq.end();
	}

	/**
	 * @private
	 */
	_remoteStat(pCategory, pKey, fCallback)
	{
		let tmpURL = `${this._remoteURL}/1.0/Binary/${encodeURIComponent(pCategory)}/${pKey}/Stat`;
		let libHTTP = require('http');
		let tmpParsed = new URL(tmpURL);

		let tmpReq = libHTTP.request(
			{
				hostname: tmpParsed.hostname,
				port: tmpParsed.port,
				path: tmpParsed.pathname,
				method: 'GET'
			},
			(pResponse) =>
			{
				let tmpChunks = [];
				pResponse.on('data', (pChunk) => { tmpChunks.push(pChunk); });
				pResponse.on('end', () =>
				{
					if (pResponse.statusCode === 404)
					{
						return fCallback(null, null);
					}
					try
					{
						let tmpBody = JSON.parse(Buffer.concat(tmpChunks).toString());
						return fCallback(null, { size: tmpBody.Size });
					}
					catch (pError)
					{
						return fCallback(pError);
					}
				});
			});
		tmpReq.on('error', (pError) => { return fCallback(pError); });
		tmpReq.end();
	}

	/**
	 * @private
	 */
	_remoteDelete(pCategory, pKey, fCallback)
	{
		let tmpURL = `${this._remoteURL}/1.0/Binary/${encodeURIComponent(pCategory)}/${pKey}`;
		let libHTTP = require('http');
		let tmpParsed = new URL(tmpURL);

		let tmpReq = libHTTP.request(
			{
				hostname: tmpParsed.hostname,
				port: tmpParsed.port,
				path: tmpParsed.pathname,
				method: 'DELETE'
			},
			(pResponse) =>
			{
				pResponse.resume();
				pResponse.on('end', () =>
				{
					return fCallback(null);
				});
			});
		tmpReq.on('error', (pError) => { return fCallback(pError); });
		tmpReq.end();
	}
}

module.exports = RetoldRemoteParimeCache;
