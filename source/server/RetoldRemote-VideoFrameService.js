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

const libExplorerStateMixin = require('./RetoldRemote-ExplorerStateMixin');

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

		// Ultravisor dispatcher — set via setDispatcher()
		this._dispatcher = null;

		// Apply explorer state persistence mixin (initializeState,
		// _buildExplorerStateKey, loadExplorerState, saveExplorerState)
		libExplorerStateMixin.apply(this, EXPLORER_STATE_SOURCE, 'video-explorer');

		// Override saveExplorerState with custom merge logic for video
		// frames, and add saveSelectionState.
		this._initVideoStateMethods();

		this.fable.log.info('Video Frame Service: frames in ParimeBinaryStorage, state in Bibliograph');
	}

	/**
	 * Set the Ultravisor dispatcher for offloading heavy processing.
	 *
	 * @param {object} pDispatcher - RetoldRemoteUltravisorDispatcher instance
	 */
	setDispatcher(pDispatcher)
	{
		this._dispatcher = pDispatcher;
	}

	/**
	 * Install video-specific explorer state methods that need read-merge-write
	 * behavior (merging custom frames, preserving selection across saves).
	 * These override the generic mixin version of saveExplorerState.
	 */
	_initVideoStateMethods()
	{
		let tmpSelf = this;

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
		this.saveExplorerState = function saveExplorerState(pRelPath, pMtimeMs, pCustomFrames, fCallback)
		{
			let tmpCacheKey = tmpSelf._buildExplorerStateKey(pRelPath, pMtimeMs);

			// Read existing state first for merge
			tmpSelf.fable.Bibliograph.read(EXPLORER_STATE_SOURCE, tmpCacheKey,
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
		};
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
	 * Tries Ultravisor dispatch first, falls back to local execution.
	 *
	 * @param {string} pAbsPath - Absolute path to the video
	 * @param {Function} fCallback - Callback(pError, { duration, width, height, codec })
	 */
	_probeVideo(pAbsPath, fCallback)
	{
		let tmpSelf = this;

		// Try Ultravisor operation trigger first
		if (this._dispatcher && this._dispatcher.isAvailable())
		{
			let tmpRelPath;
			try
			{
				tmpRelPath = libPath.relative(this.contentPath, pAbsPath);
			}
			catch (pErr)
			{
				tmpRelPath = null;
			}

			if (tmpRelPath && !tmpRelPath.startsWith('..'))
			{
				this._dispatcher.triggerOperation('rr-media-probe',
				{
					MediaAddress: '>retold-remote/File/' + tmpRelPath
				},
				(pTriggerError, pResult) =>
				{
					if (!pTriggerError && pResult && pResult.TaskOutputs)
					{
						try
						{
							let tmpProcessOutput = pResult.TaskOutputs['rr-media-probe-process'];
							if (tmpProcessOutput && tmpProcessOutput.Result)
							{
								let tmpData = JSON.parse(tmpProcessOutput.Result);
								let tmpParsed = tmpSelf._parseProbeData(tmpData);
								tmpSelf.fable.log.info(`ffprobe via operation trigger for ${tmpRelPath}`);
								return fCallback(null, tmpParsed);
							}
						}
						catch (pParseError)
						{
							// Fall through to local
						}
					}

					tmpSelf._probeVideoLocal(pAbsPath, fCallback);
				});
				return;
			}
		}

		return this._probeVideoLocal(pAbsPath, fCallback);
	}

	/**
	 * Probe a video file locally with ffprobe.
	 */
	_probeVideoLocal(pAbsPath, fCallback)
	{
		try
		{
			let tmpCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${pAbsPath}"`;
			let tmpOutput = libChildProcess.execSync(tmpCmd, { maxBuffer: 1024 * 1024, timeout: 15000 });
			let tmpData = JSON.parse(tmpOutput.toString());
			return fCallback(null, this._parseProbeData(tmpData));
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	/**
	 * Parse ffprobe JSON output into a normalized result object.
	 */
	_parseProbeData(pData)
	{
		let tmpResult = {};

		if (pData.format)
		{
			tmpResult.duration = parseFloat(pData.format.duration) || null;
			tmpResult.bitrate = parseInt(pData.format.bit_rate, 10) || null;
			tmpResult.size = parseInt(pData.format.size, 10) || null;
		}

		if (pData.streams)
		{
			for (let i = 0; i < pData.streams.length; i++)
			{
				let tmpStream = pData.streams[i];
				if (tmpStream.codec_type === 'video')
				{
					tmpResult.width = tmpStream.width;
					tmpResult.height = tmpStream.height;
					tmpResult.codec = tmpStream.codec_name;
					break;
				}
			}
		}

		return tmpResult;
	}

	/**
	 * Extract a single frame from a video at a given timestamp.
	 * Synchronous version for backward compatibility.
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
		return this._extractFrameLocal(pAbsPath, pTimestamp, pOutputPath, pWidth, pHeight, pFormat);
	}

	/**
	 * Extract a single frame locally using ffmpeg (synchronous).
	 */
	_extractFrameLocal(pAbsPath, pTimestamp, pOutputPath, pWidth, pHeight, pFormat)
	{
		try
		{
			let tmpTimeStr = this._formatFfmpegTimestamp(pTimestamp);
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
	 * Extract a single frame asynchronously, trying Ultravisor dispatch first.
	 *
	 * @param {string} pAbsPath - Absolute path to the video
	 * @param {number} pTimestamp - Timestamp in seconds
	 * @param {string} pOutputPath - Absolute path for the output image
	 * @param {number} pWidth - Target width
	 * @param {number} pHeight - Target height
	 * @param {string} pFormat - Output format (jpg, png, webp)
	 * @param {Function} fCallback - Callback(pError, pSuccess)
	 */
	_extractFrameAsync(pAbsPath, pTimestamp, pOutputPath, pWidth, pHeight, pFormat, fCallback)
	{
		let tmpSelf = this;

		// Try Ultravisor operation trigger first
		if (this._dispatcher && this._dispatcher.isAvailable())
		{
			let tmpRelPath;
			try
			{
				tmpRelPath = libPath.relative(this.contentPath, pAbsPath);
			}
			catch (pErr)
			{
				tmpRelPath = null;
			}

			if (tmpRelPath && !tmpRelPath.startsWith('..'))
			{
				let tmpTimeStr = this._formatFfmpegTimestamp(pTimestamp);

				this._dispatcher.triggerOperation('rr-video-frame-extraction',
				{
					VideoAddress: '>retold-remote/File/' + tmpRelPath,
					Timestamp: tmpTimeStr,
					Width: pWidth
				},
				(pTriggerError, pResult) =>
				{
					if (!pTriggerError && pResult && pResult.OutputBuffer)
					{
						try
						{
							// Write the output buffer to the expected path
							let tmpDir = libPath.dirname(pOutputPath);
							if (!libFs.existsSync(tmpDir))
							{
								libFs.mkdirSync(tmpDir, { recursive: true });
							}
							libFs.writeFileSync(pOutputPath, pResult.OutputBuffer);
							return fCallback(null, true);
						}
						catch (pWriteError)
						{
							// Fall through to local
						}
					}

					// Fall through to local processing
					let tmpSuccess = tmpSelf._extractFrameLocal(pAbsPath, pTimestamp, pOutputPath, pWidth, pHeight, pFormat);
					return fCallback(null, tmpSuccess);
				});
				return;
			}
		}

		// Local processing
		let tmpSuccess = this._extractFrameLocal(pAbsPath, pTimestamp, pOutputPath, pWidth, pHeight, pFormat);
		return fCallback(null, tmpSuccess);
	}

	/**
	 * Format a timestamp in seconds to ffmpeg's HH:MM:SS.mmm format.
	 *
	 * @param {number} pTimestamp - Timestamp in seconds
	 * @returns {string}
	 */
	_formatFfmpegTimestamp(pTimestamp)
	{
		let tmpHours = Math.floor(pTimestamp / 3600);
		let tmpMinutes = Math.floor((pTimestamp % 3600) / 60);
		let tmpSeconds = pTimestamp % 60;
		return `${String(tmpHours).padStart(2, '0')}:${String(tmpMinutes).padStart(2, '0')}:${tmpSeconds.toFixed(3).padStart(6, '0')}`;
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

				// Use async serial extraction when dispatcher is available,
				// otherwise use synchronous loop for backward compatibility
				let tmpUseAsync = !!(tmpSelf._dispatcher && tmpSelf._dispatcher.isAvailable());

				let _finishExtraction = () =>
				{
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
				};

				if (tmpUseAsync)
				{
					// Serial async extraction
					let tmpFrameIndex = 0;

					let _extractNext = () =>
					{
						if (tmpFrameIndex >= tmpTimestamps.length)
						{
							return _finishExtraction();
						}

						let tmpI = tmpFrameIndex;
						let tmpTimestamp = tmpTimestamps[tmpI];
						let tmpFrameFilename = `frame_${String(tmpI).padStart(4, '0')}.${tmpFormat}`;
						let tmpFramePath = libPath.join(tmpCacheDir, tmpFrameFilename);
						tmpFrameIndex++;

						tmpSelf._extractFrameAsync(
							pAbsPath, tmpTimestamp, tmpFramePath, tmpWidth, tmpHeight, tmpFormat,
							(pExtractError, pSuccess) =>
							{
								if (pSuccess)
								{
									try
									{
										let tmpFrameStat = libFs.statSync(tmpFramePath);
										tmpFrames.push(
										{
											Index: tmpI,
											Timestamp: tmpTimestamp,
											TimestampFormatted: tmpSelf._formatTimestamp(tmpTimestamp),
											Filename: tmpFrameFilename,
											Size: tmpFrameStat.size
										});
										tmpExtractedCount++;
									}
									catch (pStatErr)
									{
										// Frame file disappeared — skip
									}
								}
								_extractNext();
							});
					};

					_extractNext();
				}
				else
				{
					// Synchronous extraction (original behavior)
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

					_finishExtraction();
				}
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

	// Note: initializeState, _buildExplorerStateKey, and loadExplorerState
	// are provided by the explorer state mixin.
	// saveExplorerState is overridden in _initVideoStateMethods() with
	// custom merge logic for video frames.
}

module.exports = RetoldRemoteVideoFrameService;
