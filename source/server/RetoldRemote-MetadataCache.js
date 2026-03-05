/**
 * Retold Remote -- Metadata Cache
 *
 * Wraps ffprobe calls with a Parime BinaryStorage cache layer so that
 * file metadata (duration, codec, dimensions, ID3/format tags, etc.)
 * is extracted once and served from cache on subsequent requests.
 *
 * Cache key: SHA-256 of "metadata:{relativePath}:{mtimeMs}" truncated
 * to 16 hex chars.  Invalidation is mtime-based -- if the source file
 * is modified, the stale entry is automatically bypassed and replaced.
 *
 * Storage category: "metadata" in ParimeBinaryStorage.
 *
 * API:
 *   getMetadata(pRelPath, fCallback)
 *     -> { Path, FileSize, Modified, Category, Extension, Duration, ... Tags, Video, Audio }
 *
 *   getMetadataBatch(pRelPaths, fCallback)
 *     -> [ metadata, metadata, ... ]
 *
 *   invalidate(pRelPath, fCallback)
 *     -> removes cached entry
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');
const libChildProcess = require('child_process');

const libExtensionMaps = require('../RetoldRemote-ExtensionMaps.js');

const CACHE_CATEGORY = 'metadata';

const _DefaultServiceConfiguration =
{
	"ContentPath": "."
};

class RetoldRemoteMetadataCache extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteMetadataCache';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		// Detect ffprobe availability
		this.hasFfprobe = this._detectCommand('ffprobe -version');

		this.fable.log.info(`Metadata Cache: using ParimeBinaryStorage (category: ${CACHE_CATEGORY})`);
		this.fable.log.info(`  ffprobe: ${this.hasFfprobe ? 'available' : 'not found'}`);
	}

	/**
	 * Check if a command-line tool is available.
	 *
	 * @param {string} pCommand
	 * @returns {boolean}
	 */
	_detectCommand(pCommand)
	{
		try
		{
			libChildProcess.execSync(pCommand, { stdio: 'ignore', timeout: 5000 });
			return true;
		}
		catch (pError)
		{
			return false;
		}
	}

	/**
	 * Build a cache key from a relative path and modification time.
	 *
	 * @param {string} pRelPath - Relative file path
	 * @param {number} pMtimeMs - Modification time in milliseconds
	 * @returns {string} 16-char hex hash
	 */
	_buildCacheKey(pRelPath, pMtimeMs)
	{
		let tmpInput = `metadata:${pRelPath}:${pMtimeMs}`;
		return libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
	}

	/**
	 * Get metadata for a file.  Returns cached data if available and
	 * the file has not been modified; otherwise runs ffprobe and caches
	 * the result.
	 *
	 * @param {string} pRelPath - Path relative to the content root
	 * @param {function} fCallback - Callback(pError, pMetadata)
	 */
	getMetadata(pRelPath, fCallback)
	{
		let tmpSelf = this;

		try
		{
			let tmpAbsPath = libPath.join(this.contentPath, pRelPath);

			if (!libFs.existsSync(tmpAbsPath))
			{
				return fCallback(new Error('File not found: ' + pRelPath));
			}

			let tmpStat = libFs.statSync(tmpAbsPath);
			let tmpCacheKey = this._buildCacheKey(pRelPath, tmpStat.mtimeMs);

			// Try cache first
			this.fable.ParimeBinaryStorage.read(CACHE_CATEGORY, tmpCacheKey,
				(pReadError, pBuffer) =>
				{
					if (!pReadError && pBuffer && pBuffer.length > 0)
					{
						try
						{
							let tmpCached = JSON.parse(pBuffer.toString());
							return fCallback(null, tmpCached);
						}
						catch (pParseError)
						{
							// Corrupted cache entry; fall through to re-probe
							tmpSelf.fable.log.warn(`Metadata cache parse error for ${pRelPath}: ${pParseError.message}`);
						}
					}

					// Cache miss -- probe and cache
					tmpSelf._probeAndCache(pRelPath, tmpAbsPath, tmpStat, tmpCacheKey, fCallback);
				});
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	/**
	 * Get metadata for multiple files.  Processes sequentially to avoid
	 * overwhelming ffprobe on large folders.
	 *
	 * @param {Array<string>} pRelPaths - Array of relative paths
	 * @param {function} fCallback - Callback(pError, pMetadataArray)
	 */
	getMetadataBatch(pRelPaths, fCallback)
	{
		let tmpSelf = this;
		let tmpResults = [];
		let tmpIndex = 0;

		function _next()
		{
			if (tmpIndex >= pRelPaths.length)
			{
				return fCallback(null, tmpResults);
			}

			let tmpRelPath = pRelPaths[tmpIndex];
			tmpIndex++;

			tmpSelf.getMetadata(tmpRelPath,
				(pError, pMetadata) =>
				{
					if (pError)
					{
						// Include error but continue processing
						tmpResults.push(
						{
							Path: tmpRelPath,
							Success: false,
							Error: pError.message
						});
					}
					else
					{
						tmpResults.push(pMetadata);
					}

					_next();
				});
		}

		_next();
	}

	/**
	 * Remove a cached metadata entry.
	 *
	 * @param {string} pRelPath - Path relative to the content root
	 * @param {function} fCallback - Callback(pError)
	 */
	invalidate(pRelPath, fCallback)
	{
		try
		{
			let tmpAbsPath = libPath.join(this.contentPath, pRelPath);
			let tmpStat = libFs.statSync(tmpAbsPath);
			let tmpCacheKey = this._buildCacheKey(pRelPath, tmpStat.mtimeMs);

			this.fable.ParimeBinaryStorage.delete(CACHE_CATEGORY, tmpCacheKey, fCallback);
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	/**
	 * Run ffprobe on a file, build the metadata record, cache it,
	 * and return it via callback.
	 *
	 * @param {string} pRelPath - Relative path
	 * @param {string} pAbsPath - Absolute path
	 * @param {object} pStat - fs.Stats object
	 * @param {string} pCacheKey - Pre-computed cache key
	 * @param {function} fCallback - Callback(pError, pMetadata)
	 * @private
	 */
	_probeAndCache(pRelPath, pAbsPath, pStat, pCacheKey, fCallback)
	{
		let tmpSelf = this;
		let tmpExtension = libPath.extname(pRelPath).replace('.', '').toLowerCase();
		let tmpCategory = libExtensionMaps.getCategory(tmpExtension);

		// Build base metadata from stat
		let tmpMetadata =
		{
			Success: true,
			Path: pRelPath,
			FileSize: pStat.size,
			Modified: pStat.mtime.toISOString(),
			ModifiedMs: pStat.mtimeMs,
			Category: tmpCategory,
			Extension: tmpExtension,

			// Format-level (populated by ffprobe)
			FormatName: null,
			Duration: null,
			Bitrate: null,

			// Tags (populated by ffprobe)
			Tags: {},

			// Video stream (null if absent)
			Video: null,

			// Audio stream (null if absent)
			Audio: null,

			// Timestamp
			CachedAt: new Date().toISOString()
		};

		// Only probe video/audio files with ffprobe
		if ((tmpCategory === 'video' || tmpCategory === 'audio') && this.hasFfprobe)
		{
			this._probe(pAbsPath,
				(pProbeError, pProbeData) =>
				{
					if (!pProbeError && pProbeData)
					{
						tmpMetadata.FormatName = pProbeData.formatName;
						tmpMetadata.Duration = pProbeData.duration;
						tmpMetadata.Bitrate = pProbeData.bitrate;
						tmpMetadata.Tags = pProbeData.tags || {};
						tmpMetadata.Video = pProbeData.video;
						tmpMetadata.Audio = pProbeData.audio;
					}

					// Cache even if probe failed (the stat-only data is still useful)
					tmpSelf._writeCache(pCacheKey, tmpMetadata, fCallback);
				});
		}
		else
		{
			// Non-probeable file; cache basic stat data
			this._writeCache(pCacheKey, tmpMetadata, fCallback);
		}
	}

	/**
	 * Write a metadata record to the cache.
	 *
	 * @param {string} pCacheKey
	 * @param {object} pMetadata
	 * @param {function} fCallback - Callback(pError, pMetadata)
	 * @private
	 */
	_writeCache(pCacheKey, pMetadata, fCallback)
	{
		let tmpBuffer = Buffer.from(JSON.stringify(pMetadata));

		this.fable.ParimeBinaryStorage.write(CACHE_CATEGORY, pCacheKey, tmpBuffer,
			(pWriteError) =>
			{
				if (pWriteError)
				{
					this.fable.log.warn(`Metadata cache write error: ${pWriteError.message}`);
				}
				// Return metadata regardless of cache write success
				return fCallback(null, pMetadata);
			});
	}

	/**
	 * Run ffprobe and parse the full output including format tags and
	 * all stream details.
	 *
	 * @param {string} pAbsPath - Absolute path to the file
	 * @param {function} fCallback - Callback(pError, pResult)
	 * @private
	 */
	_probe(pAbsPath, fCallback)
	{
		try
		{
			let tmpCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${pAbsPath}"`;
			let tmpOutput = libChildProcess.execSync(tmpCmd, { maxBuffer: 1024 * 1024, timeout: 15000 });
			let tmpData = JSON.parse(tmpOutput.toString());

			let tmpResult =
			{
				formatName: null,
				duration: null,
				bitrate: null,
				tags: {},
				video: null,
				audio: null
			};

			// Parse format section
			if (tmpData.format)
			{
				tmpResult.formatName = tmpData.format.format_name || null;
				tmpResult.duration = parseFloat(tmpData.format.duration) || null;
				tmpResult.bitrate = parseInt(tmpData.format.bit_rate, 10) || null;

				// Extract format-level tags (ID3, Vorbis comments, etc.)
				if (tmpData.format.tags)
				{
					let tmpTagKeys = Object.keys(tmpData.format.tags);
					for (let t = 0; t < tmpTagKeys.length; t++)
					{
						tmpResult.tags[tmpTagKeys[t].toLowerCase()] = tmpData.format.tags[tmpTagKeys[t]];
					}
				}
			}

			// Parse streams
			if (tmpData.streams)
			{
				for (let i = 0; i < tmpData.streams.length; i++)
				{
					let tmpStream = tmpData.streams[i];

					if (tmpStream.codec_type === 'video' && !tmpResult.video)
					{
						// Skip attached pictures (album art in MP3s, etc.)
						if (tmpStream.disposition && tmpStream.disposition.attached_pic)
						{
							continue;
						}

						tmpResult.video =
						{
							Codec: tmpStream.codec_name || null,
							Width: tmpStream.width || null,
							Height: tmpStream.height || null,
							FrameRate: tmpStream.r_frame_rate || tmpStream.avg_frame_rate || null,
							PixelFormat: tmpStream.pix_fmt || null,
							Bitrate: parseInt(tmpStream.bit_rate, 10) || null,
							Level: tmpStream.level || null
						};
					}
					else if (tmpStream.codec_type === 'audio' && !tmpResult.audio)
					{
						tmpResult.audio =
						{
							Codec: tmpStream.codec_name || null,
							SampleRate: parseInt(tmpStream.sample_rate, 10) || null,
							Channels: tmpStream.channels || null,
							ChannelLayout: tmpStream.channel_layout || null,
							Bitrate: parseInt(tmpStream.bit_rate, 10) || null
						};
					}
				}
			}

			return fCallback(null, tmpResult);
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}
}

module.exports = RetoldRemoteMetadataCache;
