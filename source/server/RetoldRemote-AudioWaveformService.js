/**
 * Retold Remote -- Audio Waveform Service
 *
 * Extracts waveform peak data and audio segments from audio/video files.
 * Uses BBC audiowaveform when available, falls back to ffprobe/ffmpeg.
 * Results are cached so repeated requests are instant.
 *
 * API:
 *   extractWaveform(pAbsPath, pRelPath, pOptions, fCallback)
 *     -> { Peaks: [{ Min, Max }], Duration, SampleRate, Channels, ... }
 *
 *   extractSegment(pAbsPath, pRelPath, pOptions, fCallback)
 *     -> { SegmentPath, Duration, Start, End, Format, CacheKey, Filename }
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');
const libChildProcess = require('child_process');

const _DefaultServiceConfiguration =
{
	"ContentPath": ".",
	"CachePath": null,
	"DefaultPeakCount": 2000,
	"DefaultSegmentFormat": "mp3",
	"MaxSegmentDuration": 600
};

class RetoldRemoteAudioWaveformService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteAudioWaveformService';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		this.cachePath = this.options.CachePath
			|| libPath.join(process.cwd(), 'dist', 'retold-cache', 'audio-waveforms');

		// Ensure cache directory exists
		if (!libFs.existsSync(this.cachePath))
		{
			libFs.mkdirSync(this.cachePath, { recursive: true });
		}

		// Detect audiowaveform availability
		this.hasAudiowaveform = this._detectCommand('audiowaveform --version');

		this.fable.log.info(`Audio Waveform Service: cache at ${this.cachePath}`);
		this.fable.log.info(`  audiowaveform tool: ${this.hasAudiowaveform ? 'available' : 'not found (using ffprobe fallback)'}`);
	}

	/**
	 * Check if a command-line tool is available.
	 *
	 * @param {string} pCommand - The command to test
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
	 * Get the cache directory for a specific audio file's waveform.
	 *
	 * @param {string} pAbsPath - Absolute path to the audio file
	 * @param {number} pMtimeMs - Modification time in ms
	 * @param {number} pPeakCount - Number of peaks requested
	 * @returns {string} Absolute path to the cache directory
	 */
	_getWaveformCacheDir(pAbsPath, pMtimeMs, pPeakCount)
	{
		let tmpInput = `waveform:${pAbsPath}:${pMtimeMs}:${pPeakCount}`;
		let tmpHash = libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
		return libPath.join(this.cachePath, tmpHash);
	}

	/**
	 * Get the cache directory for an extracted audio segment.
	 *
	 * @param {string} pAbsPath - Absolute path to the audio file
	 * @param {number} pMtimeMs - Modification time in ms
	 * @param {number} pStart - Start time in seconds
	 * @param {number} pEnd - End time in seconds
	 * @param {string} pFormat - Output format
	 * @returns {string} Absolute path to the cache directory
	 */
	_getSegmentCacheDir(pAbsPath, pMtimeMs, pStart, pEnd, pFormat)
	{
		let tmpInput = `segment:${pAbsPath}:${pMtimeMs}:${pStart}:${pEnd}:${pFormat}`;
		let tmpHash = libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
		return libPath.join(this.cachePath, tmpHash);
	}

	/**
	 * Probe an audio file with ffprobe to get metadata.
	 *
	 * @param {string} pAbsPath - Absolute path to the audio file
	 * @param {Function} fCallback - Callback(pError, { duration, sampleRate, channels, codec, bitrate, size })
	 */
	_probeAudio(pAbsPath, fCallback)
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
				tmpResult.formatName = tmpData.format.format_name || null;
			}

			if (tmpData.streams)
			{
				for (let i = 0; i < tmpData.streams.length; i++)
				{
					let tmpStream = tmpData.streams[i];
					if (tmpStream.codec_type === 'audio')
					{
						tmpResult.sampleRate = parseInt(tmpStream.sample_rate, 10) || null;
						tmpResult.channels = tmpStream.channels || null;
						tmpResult.codec = tmpStream.codec_name || null;
						tmpResult.channelLayout = tmpStream.channel_layout || null;
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
	 * Extract waveform peaks using BBC audiowaveform tool.
	 * Generates a JSON file with min/max peak pairs.
	 *
	 * @param {string} pAbsPath - Absolute path to the audio file
	 * @param {number} pPeakCount - Desired number of peak data points
	 * @param {string} pOutputPath - Path for the output JSON file
	 * @param {number} pDuration - Duration of the audio in seconds
	 * @param {Function} fCallback - Callback(pError, pPeaksArray)
	 */
	_extractWithAudiowaveform(pAbsPath, pPeakCount, pOutputPath, pDuration, fCallback)
	{
		try
		{
			// audiowaveform uses pixels-per-second, so we calculate from desired peak count
			// and the duration. Each "pixel" gives us a min/max pair.
			let tmpSamplesPerPixel = Math.max(1, Math.round((pDuration * 44100) / pPeakCount));

			// audiowaveform requires specific input formats; for unsupported formats we
			// pipe through ffmpeg first.
			let tmpExt = libPath.extname(pAbsPath).toLowerCase();
			let tmpNativeFormats = { '.wav': true, '.mp3': true, '.flac': true, '.ogg': true };

			let tmpCmd;
			if (tmpNativeFormats[tmpExt])
			{
				tmpCmd = `audiowaveform -i "${pAbsPath}" -o "${pOutputPath}" --pixels-per-second ${Math.max(1, Math.round(pPeakCount / pDuration))} -b 8`;
			}
			else
			{
				// Pipe through ffmpeg to convert to wav first
				tmpCmd = `ffmpeg -i "${pAbsPath}" -f wav -ac 1 -ar 44100 pipe:1 2>/dev/null | audiowaveform -i - --input-format wav -o "${pOutputPath}" --pixels-per-second ${Math.max(1, Math.round(pPeakCount / pDuration))} -b 8`;
			}

			libChildProcess.execSync(tmpCmd, { stdio: ['pipe', 'pipe', 'ignore'], timeout: 120000, maxBuffer: 10 * 1024 * 1024 });

			if (!libFs.existsSync(pOutputPath))
			{
				return fCallback(new Error('audiowaveform did not produce output.'));
			}

			// Parse the audiowaveform JSON output
			let tmpRawData = JSON.parse(libFs.readFileSync(pOutputPath, 'utf8'));
			let tmpData = tmpRawData.data || [];

			// audiowaveform outputs interleaved min/max values
			let tmpPeaks = [];
			for (let i = 0; i < tmpData.length - 1; i += 2)
			{
				tmpPeaks.push(
				{
					Min: tmpData[i] / 128,    // Normalize from -128..127 to -1..1
					Max: tmpData[i + 1] / 128
				});
			}

			return fCallback(null, tmpPeaks);
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	/**
	 * Extract waveform peaks using ffprobe with the astats filter.
	 * This is the fallback when audiowaveform is not available.
	 *
	 * @param {string} pAbsPath - Absolute path to the audio file
	 * @param {number} pPeakCount - Desired number of peak data points
	 * @param {number} pDuration - Duration in seconds
	 * @param {Function} fCallback - Callback(pError, pPeaksArray)
	 */
	_extractWithFfprobe(pAbsPath, pPeakCount, pDuration, fCallback)
	{
		try
		{
			// Calculate the chunk size (number of samples per peak)
			// Default sample rate assumption: 44100
			let tmpSampleRate = 44100;
			let tmpTotalSamples = Math.round(pDuration * tmpSampleRate);
			let tmpSamplesPerChunk = Math.max(1, Math.round(tmpTotalSamples / pPeakCount));

			// Use ffmpeg to output raw peak levels as a series of volume measurements
			// The showvolume or volumedetect filter is too coarse; instead we use
			// the astats filter with frame-based analysis via ffprobe.
			let tmpCmd = `ffprobe -f lavfi -i "amovie='${pAbsPath.replace(/'/g, "'\\''")}',asetnsamples=${tmpSamplesPerChunk},astats=metadata=1:reset=1" -show_entries frame_tags=lavfi.astats.Overall.Peak_level,lavfi.astats.Overall.RMS_level -of json -v quiet`;

			let tmpOutput = libChildProcess.execSync(tmpCmd,
			{
				maxBuffer: 50 * 1024 * 1024,
				timeout: 120000
			});

			let tmpData = JSON.parse(tmpOutput.toString());
			let tmpFrames = tmpData.frames || [];

			let tmpPeaks = [];
			for (let i = 0; i < tmpFrames.length; i++)
			{
				let tmpTags = tmpFrames[i].tags || {};
				let tmpPeakLevel = parseFloat(tmpTags['lavfi.astats.Overall.Peak_level']);

				if (isNaN(tmpPeakLevel) || tmpPeakLevel === -Infinity || tmpPeakLevel < -120)
				{
					tmpPeaks.push({ Min: 0, Max: 0 });
				}
				else
				{
					// Convert dB to linear (0..1 range)
					let tmpLinear = Math.pow(10, tmpPeakLevel / 20);
					tmpLinear = Math.min(1.0, tmpLinear);
					tmpPeaks.push(
					{
						Min: -tmpLinear,
						Max: tmpLinear
					});
				}
			}

			// If we got no peaks, try a simpler approach
			if (tmpPeaks.length === 0)
			{
				return this._extractWithFfmpegFallback(pAbsPath, pPeakCount, pDuration, fCallback);
			}

			return fCallback(null, tmpPeaks);
		}
		catch (pError)
		{
			// Try simpler fallback
			return this._extractWithFfmpegFallback(pAbsPath, pPeakCount, pDuration, fCallback);
		}
	}

	/**
	 * Simplest fallback: use ffmpeg to generate a WAV representation and
	 * read raw PCM values directly. Works when ffprobe lavfi fails.
	 *
	 * @param {string} pAbsPath - Absolute path to the audio file
	 * @param {number} pPeakCount - Desired number of peak data points
	 * @param {number} pDuration - Duration in seconds
	 * @param {Function} fCallback - Callback(pError, pPeaksArray)
	 */
	_extractWithFfmpegFallback(pAbsPath, pPeakCount, pDuration, fCallback)
	{
		try
		{
			// Downsample to a low sample rate to reduce data; mono 8-bit signed
			let tmpTargetRate = Math.max(100, Math.round(pPeakCount / pDuration));
			// Use a maximum rate to avoid oversized buffers
			tmpTargetRate = Math.min(tmpTargetRate, 8000);

			let tmpCmd = `ffmpeg -i "${pAbsPath}" -ac 1 -ar ${tmpTargetRate} -f s16le -acodec pcm_s16le pipe:1 2>/dev/null`;

			let tmpBuffer = libChildProcess.execSync(tmpCmd,
			{
				maxBuffer: 50 * 1024 * 1024,
				timeout: 120000
			});

			// Each sample is 2 bytes (16-bit signed)
			let tmpTotalSamples = tmpBuffer.length / 2;
			let tmpSamplesPerPeak = Math.max(1, Math.round(tmpTotalSamples / pPeakCount));

			let tmpPeaks = [];
			for (let i = 0; i < tmpTotalSamples; i += tmpSamplesPerPeak)
			{
				let tmpMin = 0;
				let tmpMax = 0;
				let tmpEnd = Math.min(i + tmpSamplesPerPeak, tmpTotalSamples);

				for (let j = i; j < tmpEnd; j++)
				{
					let tmpSample = tmpBuffer.readInt16LE(j * 2);
					let tmpNorm = tmpSample / 32768;
					if (tmpNorm < tmpMin) tmpMin = tmpNorm;
					if (tmpNorm > tmpMax) tmpMax = tmpNorm;
				}

				tmpPeaks.push({ Min: tmpMin, Max: tmpMax });
			}

			if (tmpPeaks.length === 0)
			{
				return fCallback(new Error('Could not extract waveform data.'));
			}

			return fCallback(null, tmpPeaks);
		}
		catch (pError)
		{
			return fCallback(pError);
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
	 * Extract waveform peak data from an audio file.
	 * Results are cached for fast repeated access.
	 *
	 * @param {string}   pAbsPath  - Absolute path to the audio file
	 * @param {string}   pRelPath  - Relative path (for the response)
	 * @param {object}   pOptions  - { peaks }
	 * @param {Function} fCallback - Callback(pError, pResult)
	 */
	extractWaveform(pAbsPath, pRelPath, pOptions, fCallback)
	{
		let tmpSelf = this;
		let tmpPeakCount = parseInt(pOptions.peaks, 10) || this.options.DefaultPeakCount;

		// Clamp peak count
		tmpPeakCount = Math.min(Math.max(tmpPeakCount, 100), 10000);

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

		let tmpCacheDir = this._getWaveformCacheDir(pAbsPath, tmpStat.mtimeMs, tmpPeakCount);

		// Check for cached manifest
		let tmpManifestPath = libPath.join(tmpCacheDir, 'manifest.json');
		if (libFs.existsSync(tmpManifestPath))
		{
			try
			{
				let tmpManifest = JSON.parse(libFs.readFileSync(tmpManifestPath, 'utf8'));
				this.fable.log.info(`Audio waveform cache hit for ${pRelPath}`);
				return fCallback(null, tmpManifest);
			}
			catch (pError)
			{
				// Corrupted manifest, regenerate
			}
		}

		// Probe the audio for metadata
		this._probeAudio(pAbsPath,
			(pError, pAudioInfo) =>
			{
				if (pError || !pAudioInfo || !pAudioInfo.duration)
				{
					return fCallback(new Error('Could not probe audio file. ffprobe may not be available.'));
				}

				let tmpDuration = pAudioInfo.duration;

				// Ensure cache directory exists
				if (!libFs.existsSync(tmpCacheDir))
				{
					libFs.mkdirSync(tmpCacheDir, { recursive: true });
				}

				tmpSelf.fable.log.info(`Extracting waveform for ${pRelPath} (${tmpDuration.toFixed(1)}s, ${tmpPeakCount} peaks)`);

				let tmpExtractCallback = (pExtractError, pPeaks) =>
				{
					if (pExtractError || !pPeaks || pPeaks.length === 0)
					{
						return fCallback(new Error('Failed to extract waveform data: ' + (pExtractError ? pExtractError.message : 'no peaks generated')));
					}

					let tmpResult =
					{
						Success: true,
						Path: pRelPath,
						Duration: tmpDuration,
						DurationFormatted: tmpSelf._formatTimestamp(tmpDuration),
						SampleRate: pAudioInfo.sampleRate,
						Channels: pAudioInfo.channels,
						ChannelLayout: pAudioInfo.channelLayout,
						Codec: pAudioInfo.codec,
						Bitrate: pAudioInfo.bitrate,
						FileSize: pAudioInfo.size || tmpStat.size,
						FormatName: pAudioInfo.formatName,
						PeakCount: pPeaks.length,
						RequestedPeaks: tmpPeakCount,
						Method: tmpSelf.hasAudiowaveform ? 'audiowaveform' : 'ffmpeg',
						CacheKey: libPath.basename(tmpCacheDir),
						Peaks: pPeaks
					};

					// Write manifest to cache
					try
					{
						libFs.writeFileSync(tmpManifestPath, JSON.stringify(tmpResult, null, '\t'));
					}
					catch (pWriteError)
					{
						tmpSelf.fable.log.warn(`Could not write waveform manifest: ${pWriteError.message}`);
					}

					tmpSelf.fable.log.info(`Extracted ${pPeaks.length} peaks for ${pRelPath} (${tmpResult.Method})`);
					return fCallback(null, tmpResult);
				};

				// Use audiowaveform if available, otherwise fall back to ffprobe/ffmpeg
				if (tmpSelf.hasAudiowaveform)
				{
					let tmpAwfOutputPath = libPath.join(tmpCacheDir, 'waveform.json');
					tmpSelf._extractWithAudiowaveform(pAbsPath, tmpPeakCount, tmpAwfOutputPath, tmpDuration, tmpExtractCallback);
				}
				else
				{
					tmpSelf._extractWithFfprobe(pAbsPath, tmpPeakCount, tmpDuration, tmpExtractCallback);
				}
			});
	}

	/**
	 * Extract an audio segment (sub-clip) from a file.
	 * Uses stream copy when possible for lossless & fast extraction.
	 * Results are cached.
	 *
	 * @param {string}   pAbsPath  - Absolute path to the audio file
	 * @param {string}   pRelPath  - Relative path (for the response)
	 * @param {object}   pOptions  - { start, end, format }
	 * @param {Function} fCallback - Callback(pError, pResult)
	 */
	extractSegment(pAbsPath, pRelPath, pOptions, fCallback)
	{
		let tmpSelf = this;
		let tmpStart = parseFloat(pOptions.start) || 0;
		let tmpEnd = parseFloat(pOptions.end) || 0;
		let tmpFormat = pOptions.format || this.options.DefaultSegmentFormat;

		// Validate format
		let tmpValidFormats = { 'mp3': true, 'aac': true, 'ogg': true, 'wav': true, 'flac': true };
		if (!tmpValidFormats[tmpFormat])
		{
			tmpFormat = 'mp3';
		}

		if (tmpEnd <= tmpStart)
		{
			return fCallback(new Error('End time must be greater than start time.'));
		}

		let tmpDuration = tmpEnd - tmpStart;
		if (tmpDuration > this.options.MaxSegmentDuration)
		{
			return fCallback(new Error(`Segment too long. Maximum is ${this.options.MaxSegmentDuration} seconds.`));
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

		let tmpCacheDir = this._getSegmentCacheDir(pAbsPath, tmpStat.mtimeMs, tmpStart, tmpEnd, tmpFormat);

		// Check for cached segment
		let tmpFilename = `segment.${tmpFormat}`;
		let tmpSegmentPath = libPath.join(tmpCacheDir, tmpFilename);
		if (libFs.existsSync(tmpSegmentPath))
		{
			this.fable.log.info(`Audio segment cache hit for ${pRelPath} [${tmpStart}-${tmpEnd}]`);
			return fCallback(null,
			{
				Success: true,
				SegmentPath: tmpSegmentPath,
				CacheKey: libPath.basename(tmpCacheDir),
				Filename: tmpFilename,
				Start: tmpStart,
				End: tmpEnd,
				Duration: tmpDuration,
				Format: tmpFormat
			});
		}

		// Ensure cache directory exists
		if (!libFs.existsSync(tmpCacheDir))
		{
			libFs.mkdirSync(tmpCacheDir, { recursive: true });
		}

		this.fable.log.info(`Extracting audio segment from ${pRelPath} [${tmpStart.toFixed(1)}s - ${tmpEnd.toFixed(1)}s]`);

		try
		{
			// Format timestamps for ffmpeg
			let tmpStartStr = tmpStart.toFixed(3);
			let tmpDurationStr = tmpDuration.toFixed(3);

			// Map format to ffmpeg codec options
			let tmpCodecArgs;
			switch (tmpFormat)
			{
				case 'wav':
					tmpCodecArgs = '-c:a pcm_s16le';
					break;
				case 'flac':
					tmpCodecArgs = '-c:a flac';
					break;
				case 'ogg':
					tmpCodecArgs = '-c:a libvorbis -q:a 5';
					break;
				case 'aac':
					tmpCodecArgs = '-c:a aac -b:a 192k';
					break;
				case 'mp3':
				default:
					tmpCodecArgs = '-c:a libmp3lame -q:a 2';
					break;
			}

			let tmpCmd = `ffmpeg -ss ${tmpStartStr} -t ${tmpDurationStr} -i "${pAbsPath}" -vn ${tmpCodecArgs} -y "${tmpSegmentPath}"`;
			libChildProcess.execSync(tmpCmd, { stdio: 'ignore', timeout: 60000 });

			if (!libFs.existsSync(tmpSegmentPath))
			{
				return fCallback(new Error('Failed to extract audio segment.'));
			}

			this.fable.log.info(`Extracted audio segment for ${pRelPath} [${tmpStart.toFixed(1)}s - ${tmpEnd.toFixed(1)}s]`);

			return fCallback(null,
			{
				Success: true,
				SegmentPath: tmpSegmentPath,
				CacheKey: libPath.basename(tmpCacheDir),
				Filename: tmpFilename,
				Start: tmpStart,
				End: tmpEnd,
				Duration: tmpDuration,
				Format: tmpFormat
			});
		}
		catch (pError)
		{
			this.fable.log.warn(`Audio segment extraction failed: ${pError.message}`);
			return fCallback(new Error('Failed to extract audio segment.'));
		}
	}

	/**
	 * Get the absolute path to a cached segment file.
	 *
	 * @param {string} pCacheKey - The cache key (directory name)
	 * @param {string} pFilename - The segment filename
	 * @returns {string|null} Absolute path or null if not found
	 */
	getSegmentPath(pCacheKey, pFilename)
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

		let tmpPath = libPath.join(this.cachePath, pCacheKey, pFilename);

		// Double-check it's under our cache dir
		let tmpResolved = libPath.resolve(tmpPath);
		if (!tmpResolved.startsWith(this.cachePath))
		{
			return null;
		}

		if (libFs.existsSync(tmpPath))
		{
			return tmpPath;
		}

		return null;
	}
}

module.exports = RetoldRemoteAudioWaveformService;
