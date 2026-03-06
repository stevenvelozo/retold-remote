/**
 * Retold Remote -- Video Frame Extraction Service
 *
 * Extracts evenly-spaced frames from a video using ffmpeg/ffprobe.
 * Frames are cached so repeated requests are instant.
 *
 * API:
 *   extractFrames(pAbsPath, pRelPath, pOptions, fCallback)
 *     -> { Frames: [{ Index, Timestamp, TimestampFormatted, Path }], Duration, ... }
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');
const libChildProcess = require('child_process');

const EXPLORER_STATE_SOURCE = 'retold-remote-video-explorer-state';

const _DefaultServiceConfiguration =
{
	"ContentPath": ".",
	"CachePath": null,
	"DefaultFrameCount": 20,
	"DefaultFrameWidth": 640,
	"DefaultFrameHeight": 360,
	"DefaultFrameFormat": "jpg",
	"SkipSeconds": 1,
	"MinFrameInterval": 2
};

class RetoldRemoteVideoFrameService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteVideoFrameService';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		this.fable.log.info('Video Frame Service: frames in ParimeBinaryStorage, state in Bibliograph');
	}

	/**
	 * Get the cache directory for a specific video file.
	 * The key is based on the absolute path and modification time,
	 * so cache is automatically invalidated when the file changes.
	 *
	 * @param {string} pAbsPath - Absolute path to the video
	 * @param {number} pMtimeMs - Modification time in ms
	 * @param {number} pFrameCount - Number of frames requested
	 * @param {number} pWidth - Frame width
	 * @param {number} pHeight - Frame height
	 * @returns {string} Absolute path to the cache directory for this video
	 */
	_getCacheDir(pAbsPath, pMtimeMs, pFrameCount, pWidth, pHeight)
	{
		let tmpInput = `${pAbsPath}:${pMtimeMs}:${pFrameCount}:${pWidth}x${pHeight}`;
		let tmpHash = libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
		return this.fable.ParimeBinaryStorage.resolvePath('video-frames', tmpHash);
	}

	/**
	 * Probe a video file with ffprobe to get its duration.
	 *
	 * @param {string} pAbsPath - Absolute path to the video
	 * @param {Function} fCallback - Callback(pError, { duration, width, height, codec })
	 */
	_probeVideo(pAbsPath, fCallback)
	{
		try
		{
			let tmpCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${pAbsPath}"`;
			let tmpOutput = libChildProcess.execSync(tmpCmd, { maxBuffer: 1024 * 1024, timeout: 15000 });
			let tmpData = JSON.parse(tmpOutput.toString());

			let tmpResult = {};

			if (tmpData.format)
			{
				tmpResult.duration = parseFloat(tmpData.format.duration) || null;
				tmpResult.bitrate = parseInt(tmpData.format.bit_rate, 10) || null;
				tmpResult.size = parseInt(tmpData.format.size, 10) || null;
			}

			if (tmpData.streams)
			{
				for (let i = 0; i < tmpData.streams.length; i++)
				{
					let tmpStream = tmpData.streams[i];
					if (tmpStream.codec_type === 'video')
					{
						tmpResult.width = tmpStream.width;
						tmpResult.height = tmpStream.height;
						tmpResult.codec = tmpStream.codec_name;
						break;
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

	/**
	 * Extract a single frame from a video at a given timestamp.
	 *
	 * @param {string} pAbsPath - Absolute path to the video
	 * @param {number} pTimestamp - Timestamp in seconds
	 * @param {string} pOutputPath - Absolute path for the output image
	 * @param {number} pWidth - Target width
	 * @param {number} pHeight - Target height
	 * @param {string} pFormat - Output format (jpg, png, webp)
	 * @returns {boolean} True if extraction succeeded
	 */
	_extractFrame(pAbsPath, pTimestamp, pOutputPath, pWidth, pHeight, pFormat)
	{
		try
		{
			// Format timestamp as HH:MM:SS.mmm for ffmpeg
			let tmpHours = Math.floor(pTimestamp / 3600);
			let tmpMinutes = Math.floor((pTimestamp % 3600) / 60);
			let tmpSeconds = pTimestamp % 60;
			let tmpTimeStr = `${String(tmpHours).padStart(2, '0')}:${String(tmpMinutes).padStart(2, '0')}:${tmpSeconds.toFixed(3).padStart(6, '0')}`;

			let tmpCodec = (pFormat === 'png') ? 'png' : (pFormat === 'webp') ? 'webp' : 'mjpeg';

			let tmpMuxer = (pFormat === 'png') ? 'image2' : (pFormat === 'webp') ? 'webp' : 'mjpeg';
			let tmpCmd = `ffmpeg -ss ${tmpTimeStr} -i "${pAbsPath}" -vframes 1 -vf "scale=${pWidth}:${pHeight}:force_original_aspect_ratio=decrease" -f ${tmpMuxer} -y "${pOutputPath}"`;
			libChildProcess.execSync(tmpCmd, { stdio: 'ignore', timeout: 30000 });
			return libFs.existsSync(pOutputPath);
		}
		catch (pError)
		{
			this.fable.log.warn(`Frame extraction failed at ${pTimestamp}s: ${pError.message}`);
			return false;
		}
	}

	/**
	 * Format a timestamp in seconds to a human-readable string.
	 *
	 * @param {number} pSeconds - Timestamp in seconds
	 * @returns {string} Formatted string like "1:23:45" or "12:34"
	 */
	_formatTimestamp(pSeconds)
	{
		let tmpHours = Math.floor(pSeconds / 3600);
		let tmpMinutes = Math.floor((pSeconds % 3600) / 60);
		let tmpSecs = Math.floor(pSeconds % 60);

		if (tmpHours > 0)
		{
			return `${tmpHours}:${String(tmpMinutes).padStart(2, '0')}:${String(tmpSecs).padStart(2, '0')}`;
		}
		return `${tmpMinutes}:${String(tmpSecs).padStart(2, '0')}`;
	}

	/**
	 * Calculate evenly-spaced timestamps for frame extraction.
	 * Skips the first and last few seconds (configurable).
	 *
	 * @param {number} pDuration - Total video duration in seconds
	 * @param {number} pFrameCount - Desired number of frames
	 * @param {number} pSkipSeconds - Seconds to skip at start and end
	 * @returns {number[]} Array of timestamps in seconds
	 */
	_calculateTimestamps(pDuration, pFrameCount, pSkipSeconds)
	{
		let tmpStart = Math.min(pSkipSeconds, pDuration * 0.05);
		let tmpEnd = pDuration - Math.min(pSkipSeconds, pDuration * 0.05);

		// If the video is very short, just grab what we can
		if (tmpEnd <= tmpStart)
		{
			tmpStart = 0;
			tmpEnd = pDuration;
		}

		let tmpUsableDuration = tmpEnd - tmpStart;

		// Don't extract more frames than we have seconds for
		let tmpMinInterval = this.options.MinFrameInterval;
		let tmpMaxFrames = Math.max(1, Math.floor(tmpUsableDuration / tmpMinInterval));
		let tmpActualFrameCount = Math.min(pFrameCount, tmpMaxFrames);

		if (tmpActualFrameCount <= 1)
		{
			return [tmpStart + tmpUsableDuration / 2];
		}

		let tmpTimestamps = [];
		let tmpInterval = tmpUsableDuration / (tmpActualFrameCount - 1);

		for (let i = 0; i < tmpActualFrameCount; i++)
		{
			tmpTimestamps.push(tmpStart + (i * tmpInterval));
		}

		return tmpTimestamps;
	}

	/**
	 * Extract evenly-spaced frames from a video.
	 * Results are cached for fast repeated access.
	 *
	 * @param {string}   pAbsPath    - Absolute path to the video file
	 * @param {string}   pRelPath    - Relative path (for the response)
	 * @param {object}   pOptions    - { count, width, height, format }
	 * @param {Function} fCallback   - Callback(pError, pResult)
	 */
	extractFrames(pAbsPath, pRelPath, pOptions, fCallback)
	{
		let tmpSelf = this;
		let tmpCount = parseInt(pOptions.count, 10) || this.options.DefaultFrameCount;
		let tmpWidth = parseInt(pOptions.width, 10) || this.options.DefaultFrameWidth;
		let tmpHeight = parseInt(pOptions.height, 10) || this.options.DefaultFrameHeight;
		let tmpFormat = pOptions.format || this.options.DefaultFrameFormat;

		// Clamp values
		tmpCount = Math.min(Math.max(tmpCount, 1), 100);
		tmpWidth = Math.min(Math.max(tmpWidth, 64), 1920);
		tmpHeight = Math.min(Math.max(tmpHeight, 64), 1080);

		// Validate format
		if (!{ 'jpg': true, 'png': true, 'webp': true }[tmpFormat])
		{
			tmpFormat = 'jpg';
		}

		// Get file stats for cache key
		let tmpStat;
		try
		{
			tmpStat = libFs.statSync(pAbsPath);
		}
		catch (pError)
		{
			return fCallback(new Error('File not found.'));
		}

		let tmpCacheDir = this._getCacheDir(pAbsPath, tmpStat.mtimeMs, tmpCount, tmpWidth, tmpHeight);

		// Check if we have a cached manifest
		let tmpManifestPath = libPath.join(tmpCacheDir, 'manifest.json');
		if (libFs.existsSync(tmpManifestPath))
		{
			try
			{
				let tmpManifest = JSON.parse(libFs.readFileSync(tmpManifestPath, 'utf8'));
				this.fable.log.info(`Video frames cache hit for ${pRelPath}`);
				return fCallback(null, tmpManifest);
			}
			catch (pError)
			{
				// Corrupted manifest, regenerate
			}
		}

		// Probe the video for duration
		this._probeVideo(pAbsPath,
			(pError, pVideoInfo) =>
			{
				if (pError || !pVideoInfo || !pVideoInfo.duration)
				{
					return fCallback(new Error('Could not probe video. ffprobe may not be available.'));
				}

				let tmpDuration = pVideoInfo.duration;

				// Calculate timestamps
				let tmpTimestamps = tmpSelf._calculateTimestamps(
					tmpDuration, tmpCount, tmpSelf.options.SkipSeconds);

				// Ensure cache directory exists
				if (!libFs.existsSync(tmpCacheDir))
				{
					libFs.mkdirSync(tmpCacheDir, { recursive: true });
				}

				let tmpFrames = [];
				let tmpExtractedCount = 0;

				tmpSelf.fable.log.info(`Extracting ${tmpTimestamps.length} frames from ${pRelPath} (${tmpDuration.toFixed(1)}s)`);

				for (let i = 0; i < tmpTimestamps.length; i++)
				{
					let tmpTimestamp = tmpTimestamps[i];
					let tmpFrameFilename = `frame_${String(i).padStart(4, '0')}.${tmpFormat}`;
					let tmpFramePath = libPath.join(tmpCacheDir, tmpFrameFilename);

					let tmpSuccess = tmpSelf._extractFrame(
						pAbsPath, tmpTimestamp, tmpFramePath, tmpWidth, tmpHeight, tmpFormat);

					if (tmpSuccess)
					{
						let tmpFrameStat = libFs.statSync(tmpFramePath);
						tmpFrames.push(
						{
							Index: i,
							Timestamp: tmpTimestamp,
							TimestampFormatted: tmpSelf._formatTimestamp(tmpTimestamp),
							Filename: tmpFrameFilename,
							Size: tmpFrameStat.size
						});
						tmpExtractedCount++;
					}
				}

				if (tmpExtractedCount === 0)
				{
					return fCallback(new Error('Failed to extract any frames from the video.'));
				}

				let tmpResult =
				{
					Success: true,
					Path: pRelPath,
					Duration: tmpDuration,
					DurationFormatted: tmpSelf._formatTimestamp(tmpDuration),
					VideoWidth: pVideoInfo.width,
					VideoHeight: pVideoInfo.height,
					Codec: pVideoInfo.codec,
					Bitrate: pVideoInfo.bitrate,
					FileSize: pVideoInfo.size || tmpStat.size,
					FrameCount: tmpExtractedCount,
					FrameWidth: tmpWidth,
					FrameHeight: tmpHeight,
					FrameFormat: tmpFormat,
					CacheKey: libPath.basename(tmpCacheDir),
					Frames: tmpFrames
				};

				// Write manifest to cache
				try
				{
					libFs.writeFileSync(tmpManifestPath, JSON.stringify(tmpResult, null, '\t'));
				}
				catch (pWriteError)
				{
					tmpSelf.fable.log.warn(`Could not write frame manifest: ${pWriteError.message}`);
				}

				tmpSelf.fable.log.info(`Extracted ${tmpExtractedCount} frames for ${pRelPath}`);
				return fCallback(null, tmpResult);
			});
	}

	/**
	 * Extract a single frame at an arbitrary timestamp and save it into
	 * an existing cache directory.  Returns the frame metadata on success.
	 *
	 * @param {string}   pAbsPath   - Absolute path to the video file
	 * @param {string}   pCacheKey  - Existing cache directory name (from extractFrames)
	 * @param {number}   pTimestamp - Timestamp in seconds
	 * @param {object}   pOptions   - { width, height, format }
	 * @param {Function} fCallback  - Callback(pError, pFrameInfo)
	 */
	extractSingleFrame(pAbsPath, pCacheKey, pTimestamp, pOptions, fCallback)
	{
		let tmpWidth = parseInt(pOptions.width, 10) || this.options.DefaultFrameWidth;
		let tmpHeight = parseInt(pOptions.height, 10) || this.options.DefaultFrameHeight;
		let tmpFormat = pOptions.format || this.options.DefaultFrameFormat;

		// Clamp
		tmpWidth = Math.min(Math.max(tmpWidth, 64), 1920);
		tmpHeight = Math.min(Math.max(tmpHeight, 64), 1080);
		if (!{ 'jpg': true, 'png': true, 'webp': true }[tmpFormat])
		{
			tmpFormat = 'jpg';
		}

		// Sanitize cache key
		if (!pCacheKey || pCacheKey.includes('..') || pCacheKey.includes('/') || pCacheKey.includes('\\'))
		{
			return fCallback(new Error('Invalid cache key.'));
		}

		let tmpCacheDir = this.fable.ParimeBinaryStorage.resolvePath('video-frames', pCacheKey);
		if (!libFs.existsSync(tmpCacheDir))
		{
			return fCallback(new Error('Cache directory not found. Extract frames first.'));
		}

		// Generate a unique filename based on timestamp to avoid collisions
		let tmpTimestampStr = pTimestamp.toFixed(3).replace('.', '_');
		let tmpFilename = `frame_custom_${tmpTimestampStr}.${tmpFormat}`;
		let tmpOutputPath = libPath.join(tmpCacheDir, tmpFilename);

		// If already extracted, return immediately
		if (libFs.existsSync(tmpOutputPath))
		{
			let tmpStat = libFs.statSync(tmpOutputPath);
			return fCallback(null,
			{
				Success: true,
				Timestamp: pTimestamp,
				TimestampFormatted: this._formatTimestamp(pTimestamp),
				Filename: tmpFilename,
				CacheKey: pCacheKey,
				Size: tmpStat.size
			});
		}

		this.fable.log.info(`Extracting single frame at ${pTimestamp.toFixed(2)}s from ${pAbsPath}`);

		let tmpSuccess = this._extractFrame(pAbsPath, pTimestamp, tmpOutputPath, tmpWidth, tmpHeight, tmpFormat);

		if (!tmpSuccess)
		{
			return fCallback(new Error('Failed to extract frame at ' + pTimestamp.toFixed(2) + 's'));
		}

		let tmpStat = libFs.statSync(tmpOutputPath);
		return fCallback(null,
		{
			Success: true,
			Timestamp: pTimestamp,
			TimestampFormatted: this._formatTimestamp(pTimestamp),
			Filename: tmpFilename,
			CacheKey: pCacheKey,
			Size: tmpStat.size
		});
	}

	/**
	 * Get the absolute path to a cached frame image.
	 *
	 * @param {string} pCacheKey - The cache key (directory name)
	 * @param {string} pFilename - The frame filename
	 * @returns {string|null} Absolute path or null if not found
	 */
	getFramePath(pCacheKey, pFilename)
	{
		// Sanitize inputs to prevent directory traversal
		if (!pCacheKey || !pFilename)
		{
			return null;
		}
		if (pCacheKey.includes('..') || pCacheKey.includes('/') || pCacheKey.includes('\\'))
		{
			return null;
		}
		if (pFilename.includes('..') || pFilename.includes('/') || pFilename.includes('\\'))
		{
			return null;
		}

		let tmpCacheDir = this.fable.ParimeBinaryStorage.resolvePath('video-frames', pCacheKey);
		let tmpPath = libPath.join(tmpCacheDir, pFilename);

		// Double-check it's under the storage root
		let tmpResolved = libPath.resolve(tmpPath);
		if (!tmpResolved.startsWith(this.fable.ParimeBinaryStorage.storageRoot))
		{
			return null;
		}

		if (libFs.existsSync(tmpPath))
		{
			return tmpPath;
		}

		return null;
	}

	// -- Video Explorer State Persistence (Bibliograph) ---------------------

	/**
	 * Create the Bibliograph source for explorer state.
	 * Must be called after Parime initialization completes.
	 *
	 * @param {Function} fCallback - Callback(pError)
	 */
	initializeState(fCallback)
	{
		this.fable.Bibliograph.createSource(EXPLORER_STATE_SOURCE,
			(pError) =>
			{
				if (pError)
				{
					this.fable.log.warn('Video explorer state source creation notice: ' + pError.message);
				}
				return fCallback();
			});
	}

	/**
	 * Build the Bibliograph record key for a video's explorer state.
	 * Deliberately excludes frame count and resolution so custom
	 * frames persist across extraction-setting changes.
	 *
	 * @param {string} pRelPath - Relative path to the video
	 * @param {number} pMtimeMs - Video file modification time in ms
	 * @returns {string} 16-char hex hash key
	 */
	_buildExplorerStateKey(pRelPath, pMtimeMs)
	{
		let tmpInput = `video-explorer:${pRelPath}:${pMtimeMs}`;
		return libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
	}

	/**
	 * Load saved video explorer state (custom frames) from Bibliograph.
	 *
	 * @param {string}   pRelPath  - Relative path to the video
	 * @param {number}   pMtimeMs  - Video file modification time in ms
	 * @param {Function} fCallback - Callback(pError, pState) where pState is the record or null
	 */
	loadExplorerState(pRelPath, pMtimeMs, fCallback)
	{
		let tmpCacheKey = this._buildExplorerStateKey(pRelPath, pMtimeMs);

		this.fable.Bibliograph.read(EXPLORER_STATE_SOURCE, tmpCacheKey,
			(pReadError, pRecord) =>
			{
				if (pReadError || !pRecord)
				{
					return fCallback(null, null);
				}

				return fCallback(null, pRecord);
			});
	}

	/**
	 * Save video explorer state (custom frames) to Bibliograph.
	 * Reads existing state, merges incoming frames (deduplicating
	 * by Filename), sorts by Timestamp, and writes back.
	 *
	 * @param {string}   pRelPath      - Relative path to the video
	 * @param {number}   pMtimeMs      - Video file modification time in ms
	 * @param {Array}    pCustomFrames - Array of custom frame objects to merge
	 * @param {Function} fCallback     - Callback(pError, pState)
	 */
	saveExplorerState(pRelPath, pMtimeMs, pCustomFrames, fCallback)
	{
		let tmpSelf = this;
		let tmpCacheKey = this._buildExplorerStateKey(pRelPath, pMtimeMs);

		// Read existing state first for merge
		this.fable.Bibliograph.read(EXPLORER_STATE_SOURCE, tmpCacheKey,
			(pReadError, pExisting) =>
			{
				if (pReadError)
				{
					pExisting = null;
				}

				let tmpMergedFrames = [];
				let tmpSeen = {};

				// Add existing frames
				if (pExisting && Array.isArray(pExisting.CustomFrames))
				{
					for (let i = 0; i < pExisting.CustomFrames.length; i++)
					{
						let tmpFrame = pExisting.CustomFrames[i];
						if (!tmpSeen[tmpFrame.Filename])
						{
							tmpMergedFrames.push(tmpFrame);
							tmpSeen[tmpFrame.Filename] = true;
						}
					}
				}

				// Add new frames (deduplicate)
				if (Array.isArray(pCustomFrames))
				{
					for (let i = 0; i < pCustomFrames.length; i++)
					{
						let tmpFrame = pCustomFrames[i];
						if (!tmpSeen[tmpFrame.Filename])
						{
							tmpMergedFrames.push(tmpFrame);
							tmpSeen[tmpFrame.Filename] = true;
						}
					}
				}

				// Sort by timestamp
				tmpMergedFrames.sort((pA, pB) => pA.Timestamp - pB.Timestamp);

				let tmpState =
				{
					Path: pRelPath,
					ModifiedMs: pMtimeMs,
					CustomFrames: tmpMergedFrames,
					SelectionStartTime: (pExisting && typeof pExisting.SelectionStartTime === 'number') ? pExisting.SelectionStartTime : -1,
					SelectionEndTime: (pExisting && typeof pExisting.SelectionEndTime === 'number') ? pExisting.SelectionEndTime : -1,
					UpdatedAt: new Date().toISOString()
				};

				tmpSelf.fable.Bibliograph.write(EXPLORER_STATE_SOURCE, tmpCacheKey, tmpState,
					(pWriteError) =>
					{
						if (pWriteError)
						{
							tmpSelf.fable.log.warn('Explorer state write error: ' + pWriteError.message);
						}
						return fCallback(null, tmpState);
					});
			});
	}

	/**
	 * Save video explorer selection state (start/end times) to Bibliograph.
	 * Reads existing state so that custom frames are preserved, then
	 * updates the selection fields and writes back.
	 *
	 * @param {string}   pRelPath        - Relative path to the video
	 * @param {number}   pMtimeMs        - Video file modification time in ms
	 * @param {Object}   pSelectionData  - { SelectionStartTime, SelectionEndTime }
	 * @param {Function} fCallback       - Callback(pError, pState)
	 */
	saveSelectionState(pRelPath, pMtimeMs, pSelectionData, fCallback)
	{
		let tmpSelf = this;
		let tmpCacheKey = this._buildExplorerStateKey(pRelPath, pMtimeMs);

		// Read existing state first to preserve custom frames
		this.fable.Bibliograph.read(EXPLORER_STATE_SOURCE, tmpCacheKey,
			(pReadError, pExisting) =>
			{
				if (pReadError)
				{
					pExisting = null;
				}

				let tmpState =
				{
					Path: pRelPath,
					ModifiedMs: pMtimeMs,
					CustomFrames: (pExisting && Array.isArray(pExisting.CustomFrames)) ? pExisting.CustomFrames : [],
					SelectionStartTime: (pSelectionData && typeof pSelectionData.SelectionStartTime === 'number') ? pSelectionData.SelectionStartTime : -1,
					SelectionEndTime: (pSelectionData && typeof pSelectionData.SelectionEndTime === 'number') ? pSelectionData.SelectionEndTime : -1,
					UpdatedAt: new Date().toISOString()
				};

				tmpSelf.fable.Bibliograph.write(EXPLORER_STATE_SOURCE, tmpCacheKey, tmpState,
					(pWriteError) =>
					{
						if (pWriteError)
						{
							tmpSelf.fable.log.warn('Explorer selection state write error: ' + pWriteError.message);
						}
						return fCallback(null, tmpState);
					});
			});
	}
}

module.exports = RetoldRemoteVideoFrameService;
