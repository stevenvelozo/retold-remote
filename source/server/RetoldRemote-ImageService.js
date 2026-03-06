/**
 * Retold Remote -- Image Service
 *
 * Provides two tiers of large-image handling:
 *
 * 1. Preview Generation — Downscales large images to a browser-friendly
 *    resolution (default 4096px max dimension) for the normal media viewer.
 *    This prevents the browser from choking on massive scans (16K×24K etc).
 *
 * 2. DZI Tile Generation — Generates Deep Zoom Image tiles using sharp's
 *    tile() method.  These tiles power an OpenSeadragon-based image explorer
 *    for full-resolution pan+zoom exploration.
 *
 * Both tiers cache their output in ParimeBinaryStorage.
 *
 * Raw camera formats (NEF, CR2, ARW, DNG, etc.) are supported via a
 * conversion pipeline: dcraw → ImageMagick → exifr embedded preview.
 * The converted JPEG is cached and then fed to the normal Sharp pipeline.
 *
 * API:
 *   generatePreview(pAbsPath, pRelPath, pMaxDimension, fCallback)
 *     -> { Success, CacheKey, OutputFilename, Width, Height, OrigWidth, OrigHeight, FileSize }
 *
 *   generateDziTiles(pAbsPath, pRelPath, fCallback)
 *     -> { Success, CacheKey, DziFilename, TileDir, Width, Height, TileSize, Overlap, Format }
 *
 *   getPreviewPath(pCacheKey, pFilename)
 *     -> absolute path or null
 *
 *   getDziPath(pCacheKey)
 *     -> absolute path to DZI directory or null
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');
const libChildProcess = require('child_process');
const libExtensionMaps = require('../RetoldRemote-ExtensionMaps.js');

const _DefaultServiceConfiguration =
{
	"ContentPath": ".",
	"DefaultMaxPreviewDimension": 4096,
	"DziTileSize": 256,
	"DziOverlap": 1,
	"DziFormat": "jpeg",
	"DziQuality": 80,
	"PreviewQuality": 85,
	// Only generate preview/tiles for images larger than this (pixels on longest side)
	"LargeImageThreshold": 4096
};

class RetoldRemoteImageService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteImageService';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);
		this._sharp = null;

		// Track in-flight DZI generation requests to coalesce concurrent requests
		// for the same image instead of regenerating tiles in parallel.
		this._dziInFlight = new Map();

		// Tool capabilities — set by MediaService after ToolDetector runs
		this._capabilities = {};

		// Try to load sharp
		try
		{
			this._sharp = require('sharp');
			this.fable.log.info('Image Service: sharp loaded successfully');
		}
		catch (pError)
		{
			this.fable.log.warn('Image Service: sharp not available — large image features disabled');
		}
	}

	/**
	 * Check if sharp is available.
	 *
	 * @returns {boolean}
	 */
	isAvailable()
	{
		return !!this._sharp;
	}

	/**
	 * Set tool capabilities from ToolDetector results.
	 *
	 * @param {object} pCapabilities - { dcraw, imagemagick, sharp, ... }
	 */
	setCapabilities(pCapabilities)
	{
		this._capabilities = pCapabilities || {};
	}

	// ---------------------------------------------------------------
	// Raw format detection and conversion
	// ---------------------------------------------------------------

	/**
	 * Check if a file is a raw camera format that needs conversion.
	 *
	 * @param {string} pAbsPath - Absolute path to check
	 * @returns {boolean}
	 */
	_isRawFormat(pAbsPath)
	{
		let tmpExt = libPath.extname(pAbsPath).replace(/^\./, '').toLowerCase();
		return !!libExtensionMaps.RawImageExtensions[tmpExt];
	}

	/**
	 * Ensure a raw camera image has been converted to a JPEG that Sharp can process.
	 * The converted file is cached in ParimeBinaryStorage under 'raw-conversions'.
	 *
	 * @param {string}   pAbsPath        - Absolute path to the raw file
	 * @param {number}   pMtimeMs        - File modification time in ms
	 * @param {boolean}  pFullResolution - true for full-size (DZI), false for half-size (previews)
	 * @param {Function} fCallback       - Callback(pError, pConvertedPath)
	 */
	_ensureConvertedRaw(pAbsPath, pMtimeMs, pFullResolution, fCallback)
	{
		// Handle optional pFullResolution parameter
		if (typeof (pFullResolution) === 'function')
		{
			fCallback = pFullResolution;
			pFullResolution = false;
		}

		let tmpSelf = this;
		let tmpSuffix = pFullResolution ? 'raw-full' : 'raw-half';
		let tmpCacheKey = this._buildCacheKey(pAbsPath, pMtimeMs, tmpSuffix);
		let tmpCacheDir = this.fable.ParimeBinaryStorage.resolvePath('raw-conversions', tmpCacheKey);
		let tmpOutputPath = libPath.join(tmpCacheDir, 'converted.jpg');

		// Check cache
		if (libFs.existsSync(tmpOutputPath))
		{
			this.fable.log.info(`Raw conversion cache hit: ${libPath.basename(pAbsPath)}`);
			return fCallback(null, tmpOutputPath);
		}

		// Ensure cache directory
		if (!libFs.existsSync(tmpCacheDir))
		{
			libFs.mkdirSync(tmpCacheDir, { recursive: true });
		}

		this.fable.log.info(`Converting raw image: ${libPath.basename(pAbsPath)} (${pFullResolution ? 'full' : 'half'} resolution)`);

		// Try dcraw → Sharp pipeline
		this._convertWithDcraw(pAbsPath, tmpOutputPath, pFullResolution, (pError) =>
		{
			if (!pError)
			{
				tmpSelf.fable.log.info(`Raw conversion complete (dcraw): ${libPath.basename(pAbsPath)}`);
				return fCallback(null, tmpOutputPath);
			}

			// Fallback: ImageMagick convert
			tmpSelf._convertWithImageMagick(pAbsPath, tmpOutputPath, (pError2) =>
			{
				if (!pError2)
				{
					tmpSelf.fable.log.info(`Raw conversion complete (ImageMagick): ${libPath.basename(pAbsPath)}`);
					return fCallback(null, tmpOutputPath);
				}

				// Last resort: extract embedded JPEG preview via exifr
				tmpSelf._extractEmbeddedPreview(pAbsPath, tmpOutputPath, (pError3) =>
				{
					if (!pError3)
					{
						tmpSelf.fable.log.info(`Raw conversion complete (embedded preview): ${libPath.basename(pAbsPath)}`);
						return fCallback(null, tmpOutputPath);
					}

					tmpSelf.fable.log.warn(`Raw conversion failed for ${libPath.basename(pAbsPath)}: no conversion tool available`);
					return fCallback(new Error('No raw conversion tool available.'));
				});
			});
		});
	}

	/**
	 * Convert a raw image to JPEG using dcraw piped through Sharp.
	 * dcraw outputs PPM to stdout; Sharp converts to JPEG.
	 *
	 * @param {string}   pAbsPath        - Raw file path
	 * @param {string}   pOutputPath     - Output JPEG path
	 * @param {boolean}  pFullResolution - false = -h (half-size, fast), true = full size
	 * @param {Function} fCallback       - Callback(pError)
	 */
	_convertWithDcraw(pAbsPath, pOutputPath, pFullResolution, fCallback)
	{
		if (!this._capabilities.dcraw || !this._sharp)
		{
			return fCallback(new Error('dcraw or sharp not available'));
		}

		let tmpSelf = this;

		try
		{
			// dcraw -c = write to stdout, -w = use camera white balance
			// -h = half-size interpolation (fast, good for previews)
			let tmpArgs = ['-c', '-w'];
			if (!pFullResolution)
			{
				tmpArgs.push('-h');
			}
			tmpArgs.push(pAbsPath);

			let tmpDcraw = libChildProcess.spawn('dcraw', tmpArgs, { timeout: 120000 });
			let tmpChunks = [];
			let tmpErrorOutput = '';

			tmpDcraw.stdout.on('data', (pChunk) =>
			{
				tmpChunks.push(pChunk);
			});

			tmpDcraw.stderr.on('data', (pData) =>
			{
				tmpErrorOutput += pData.toString();
			});

			tmpDcraw.on('error', (pError) =>
			{
				return fCallback(pError);
			});

			tmpDcraw.on('close', (pCode) =>
			{
				if (pCode !== 0 || tmpChunks.length === 0)
				{
					return fCallback(new Error('dcraw failed (exit ' + pCode + '): ' + tmpErrorOutput));
				}

				let tmpBuffer = Buffer.concat(tmpChunks);

				// Convert PPM buffer to JPEG via Sharp
				tmpSelf._sharp(tmpBuffer, { limitInputPixels: false })
					.jpeg({ quality: 92 })
					.toFile(pOutputPath)
					.then(() =>
					{
						return fCallback(null);
					})
					.catch((pSharpError) =>
					{
						return fCallback(pSharpError);
					});
			});
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	/**
	 * Convert a raw image to JPEG using ImageMagick's convert command.
	 * Works if ImageMagick has the dcraw/ufraw delegate installed.
	 *
	 * @param {string}   pAbsPath    - Raw file path
	 * @param {string}   pOutputPath - Output JPEG path
	 * @param {Function} fCallback   - Callback(pError)
	 */
	_convertWithImageMagick(pAbsPath, pOutputPath, fCallback)
	{
		if (!this._capabilities.imagemagick)
		{
			return fCallback(new Error('ImageMagick not available'));
		}

		try
		{
			let tmpCmd = `convert "${pAbsPath}" -auto-orient -quality 92 "${pOutputPath}"`;
			libChildProcess.exec(tmpCmd, { timeout: 120000 }, (pError, pStdout, pStderr) =>
			{
				if (pError)
				{
					return fCallback(pError);
				}
				if (!libFs.existsSync(pOutputPath))
				{
					return fCallback(new Error('ImageMagick produced no output'));
				}
				return fCallback(null);
			});
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	/**
	 * Extract the embedded JPEG preview from a raw file using exifr.
	 * Most cameras embed a full-size or near-full-size JPEG preview
	 * inside the raw file — this is the fastest extraction method
	 * but may produce a lower-resolution image.
	 *
	 * @param {string}   pAbsPath    - Raw file path
	 * @param {string}   pOutputPath - Output JPEG path
	 * @param {Function} fCallback   - Callback(pError)
	 */
	_extractEmbeddedPreview(pAbsPath, pOutputPath, fCallback)
	{
		try
		{
			let tmpExifr = require('exifr');
			tmpExifr.thumbnailBuffer(pAbsPath)
				.then((pBuffer) =>
				{
					if (!pBuffer || pBuffer.length === 0)
					{
						return fCallback(new Error('No embedded preview found.'));
					}
					try
					{
						libFs.writeFileSync(pOutputPath, pBuffer);
						return fCallback(null);
					}
					catch (pWriteError)
					{
						return fCallback(pWriteError);
					}
				})
				.catch((pError) =>
				{
					return fCallback(pError);
				});
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	// ---------------------------------------------------------------
	// Cache key generation
	// ---------------------------------------------------------------

	/**
	 * Build a cache key from an absolute path and modification time.
	 *
	 * @param {string} pAbsPath - Absolute path to the image
	 * @param {number} pMtimeMs - Modification time in ms
	 * @param {string} pSuffix  - Optional suffix (e.g. '4096' for preview dimension)
	 * @returns {string} First 16 hex chars of SHA256
	 */
	_buildCacheKey(pAbsPath, pMtimeMs, pSuffix)
	{
		let tmpInput = `${pAbsPath}:${pMtimeMs}`;
		if (pSuffix)
		{
			tmpInput += ':' + pSuffix;
		}
		return libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
	}

	// ---------------------------------------------------------------
	// Preview generation
	// ---------------------------------------------------------------

	/**
	 * Generate a downscaled preview of a large image.
	 * Results are cached in ParimeBinaryStorage under 'image-previews'.
	 *
	 * For raw camera formats, the file is first converted to JPEG via
	 * dcraw/ImageMagick/exifr, then processed normally with Sharp.
	 * Raw files always get a preview JPEG (even if small) because
	 * browsers cannot display raw formats directly.
	 *
	 * @param {string}   pAbsPath       - Absolute path to the source image
	 * @param {string}   pRelPath       - Relative path (for the response)
	 * @param {number}   pMaxDimension  - Max pixels on the longest side
	 * @param {Function} fCallback      - Callback(pError, pResult)
	 */
	generatePreview(pAbsPath, pRelPath, pMaxDimension, fCallback)
	{
		let tmpSelf = this;

		if (!this._sharp)
		{
			return fCallback(new Error('sharp is not available.'));
		}

		let tmpMaxDim = pMaxDimension || this.options.DefaultMaxPreviewDimension;

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

		let tmpCacheKey = this._buildCacheKey(pAbsPath, tmpStat.mtimeMs, 'preview-' + tmpMaxDim);
		let tmpOutputFilename = 'preview.jpg';
		let tmpCacheDir = this.fable.ParimeBinaryStorage.resolvePath('image-previews', tmpCacheKey);
		let tmpManifestPath = libPath.join(tmpCacheDir, 'manifest.json');
		let tmpIsRaw = this._isRawFormat(pAbsPath);

		// Check for cached manifest
		if (libFs.existsSync(tmpManifestPath))
		{
			try
			{
				let tmpManifest = JSON.parse(libFs.readFileSync(tmpManifestPath, 'utf8'));
				let tmpOutputPath = libPath.join(tmpCacheDir, tmpManifest.OutputFilename);
				if (libFs.existsSync(tmpOutputPath))
				{
					this.fable.log.info(`Image preview cache hit for ${pRelPath}`);
					return fCallback(null, tmpManifest);
				}
			}
			catch (pError)
			{
				// Corrupted manifest, regenerate
			}
		}

		// Ensure cache directory exists
		if (!libFs.existsSync(tmpCacheDir))
		{
			libFs.mkdirSync(tmpCacheDir, { recursive: true });
		}

		let tmpOutputPath = libPath.join(tmpCacheDir, tmpOutputFilename);

		this.fable.log.info(`Generating image preview: ${pRelPath} (max ${tmpMaxDim}px)`);

		// For raw formats, convert first then process the converted file
		if (tmpIsRaw)
		{
			this._ensureConvertedRaw(pAbsPath, tmpStat.mtimeMs, false, (pError, pConvertedPath) =>
			{
				if (pError)
				{
					return fCallback(new Error('Raw conversion failed: ' + pError.message));
				}
				tmpSelf._doGeneratePreview(pConvertedPath, pAbsPath, pRelPath, tmpMaxDim, tmpCacheKey, tmpOutputFilename, tmpCacheDir, tmpManifestPath, tmpOutputPath, tmpStat, true, fCallback);
			});
		}
		else
		{
			this._doGeneratePreview(pAbsPath, pAbsPath, pRelPath, tmpMaxDim, tmpCacheKey, tmpOutputFilename, tmpCacheDir, tmpManifestPath, tmpOutputPath, tmpStat, false, fCallback);
		}
	}

	/**
	 * Internal preview generation — shared by both raw and standard image paths.
	 *
	 * @param {string}   pInputPath      - Path to read (converted JPEG for raw, original for standard)
	 * @param {string}   pOrigAbsPath    - Original file path (for metadata)
	 * @param {string}   pRelPath        - Relative path (for response)
	 * @param {number}   pMaxDim         - Max dimension
	 * @param {string}   pCacheKey       - Cache key
	 * @param {string}   pOutputFilename - Output filename
	 * @param {string}   pCacheDir       - Cache directory
	 * @param {string}   pManifestPath   - Manifest file path
	 * @param {string}   pOutputPath     - Output file path
	 * @param {object}   pStat           - Original file stat
	 * @param {boolean}  pIsRaw          - Whether this is a raw camera format
	 * @param {Function} fCallback       - Callback(pError, pResult)
	 */
	_doGeneratePreview(pInputPath, pOrigAbsPath, pRelPath, pMaxDim, pCacheKey, pOutputFilename, pCacheDir, pManifestPath, pOutputPath, pStat, pIsRaw, fCallback)
	{
		let tmpSelf = this;

		// Get metadata first to check if downscaling is needed
		this._sharp(pInputPath, { limitInputPixels: false }).metadata()
			.then((pMetadata) =>
			{
				let tmpOrigWidth = pMetadata.width;
				let tmpOrigHeight = pMetadata.height;
				let tmpLongest = Math.max(tmpOrigWidth, tmpOrigHeight);

				// If image is smaller than threshold AND not a raw format,
				// just note it — no preview needed (browser can display it directly).
				// Raw files always need a preview because browsers can't display them.
				if (tmpLongest <= pMaxDim && !pIsRaw)
				{
					let tmpResult =
					{
						Success: true,
						SourcePath: pRelPath,
						CacheKey: pCacheKey,
						OutputFilename: pOutputFilename,
						Width: tmpOrigWidth,
						Height: tmpOrigHeight,
						OrigWidth: tmpOrigWidth,
						OrigHeight: tmpOrigHeight,
						FileSize: pStat.size,
						NeedsPreview: false,
						IsRawFormat: false,
						GeneratedAt: new Date().toISOString()
					};

					try
					{
						libFs.writeFileSync(pManifestPath, JSON.stringify(tmpResult, null, '\t'));
					}
					catch (pWriteError)
					{
						tmpSelf.fable.log.warn(`Could not write preview manifest: ${pWriteError.message}`);
					}

					return fCallback(null, tmpResult);
				}

				// Calculate new dimensions maintaining aspect ratio
				let tmpNewWidth = tmpOrigWidth;
				let tmpNewHeight = tmpOrigHeight;
				if (tmpLongest > pMaxDim)
				{
					let tmpScale = pMaxDim / tmpLongest;
					tmpNewWidth = Math.round(tmpOrigWidth * tmpScale);
					tmpNewHeight = Math.round(tmpOrigHeight * tmpScale);
				}

				// Generate the preview
				tmpSelf._sharp(pInputPath, { limitInputPixels: false })
					.resize(tmpNewWidth, tmpNewHeight, { fit: 'inside', withoutEnlargement: true })
					.jpeg({ quality: tmpSelf.options.PreviewQuality })
					.toFile(pOutputPath)
					.then(() =>
					{
						let tmpOutputStat = libFs.statSync(pOutputPath);

						let tmpResult =
						{
							Success: true,
							SourcePath: pRelPath,
							CacheKey: pCacheKey,
							OutputFilename: pOutputFilename,
							Width: tmpNewWidth,
							Height: tmpNewHeight,
							OrigWidth: tmpOrigWidth,
							OrigHeight: tmpOrigHeight,
							FileSize: tmpOutputStat.size,
							NeedsPreview: true,
							IsRawFormat: pIsRaw,
							GeneratedAt: new Date().toISOString()
						};

						try
						{
							libFs.writeFileSync(pManifestPath, JSON.stringify(tmpResult, null, '\t'));
						}
						catch (pWriteError)
						{
							tmpSelf.fable.log.warn(`Could not write preview manifest: ${pWriteError.message}`);
						}

						tmpSelf.fable.log.info(`Generated image preview: ${pRelPath} (${tmpOrigWidth}×${tmpOrigHeight} → ${tmpNewWidth}×${tmpNewHeight})`);
						return fCallback(null, tmpResult);
					})
					.catch((pError) =>
					{
						return fCallback(new Error('Preview generation failed: ' + pError.message));
					});
			})
			.catch((pError) =>
			{
				return fCallback(new Error('Could not read image metadata: ' + pError.message));
			});
	}

	// ---------------------------------------------------------------
	// DZI tile generation
	// ---------------------------------------------------------------

	/**
	 * Generate DZI (Deep Zoom Image) tiles for an image.
	 * Results are cached in ParimeBinaryStorage under 'dzi-tiles'.
	 *
	 * For raw camera formats, the file is first converted to JPEG at
	 * full resolution, then tiled normally with Sharp.
	 *
	 * @param {string}   pAbsPath  - Absolute path to the source image
	 * @param {string}   pRelPath  - Relative path (for the response)
	 * @param {Function} fCallback - Callback(pError, pResult)
	 */
	generateDziTiles(pAbsPath, pRelPath, fCallback)
	{
		let tmpSelf = this;

		if (!this._sharp)
		{
			return fCallback(new Error('sharp is not available.'));
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

		let tmpCacheKey = this._buildCacheKey(pAbsPath, tmpStat.mtimeMs, 'dzi');
		let tmpCacheDir = this.fable.ParimeBinaryStorage.resolvePath('dzi-tiles', tmpCacheKey);
		let tmpManifestPath = libPath.join(tmpCacheDir, 'manifest.json');

		// Check for cached manifest
		if (libFs.existsSync(tmpManifestPath))
		{
			try
			{
				let tmpManifest = JSON.parse(libFs.readFileSync(tmpManifestPath, 'utf8'));
				// Verify the DZI descriptor still exists
				let tmpDziPath = libPath.join(tmpCacheDir, tmpManifest.DziFilename);
				if (libFs.existsSync(tmpDziPath))
				{
					this.fable.log.info(`DZI tile cache hit for ${pRelPath}`);
					return fCallback(null, tmpManifest);
				}
			}
			catch (pError)
			{
				// Corrupted manifest, regenerate
			}
		}

		// If another request is already generating tiles for this file,
		// queue our callback to receive the same result.
		if (this._dziInFlight.has(tmpCacheKey))
		{
			this.fable.log.info(`DZI tiles already generating, queuing: ${pRelPath}`);
			this._dziInFlight.get(tmpCacheKey).push(fCallback);
			return;
		}
		this._dziInFlight.set(tmpCacheKey, []);

		// Ensure cache directory exists
		if (!libFs.existsSync(tmpCacheDir))
		{
			libFs.mkdirSync(tmpCacheDir, { recursive: true });
		}

		this.fable.log.info(`Generating DZI tiles: ${pRelPath}`);

		// For raw formats, convert first then tile the converted file
		if (this._isRawFormat(pAbsPath))
		{
			this._ensureConvertedRaw(pAbsPath, tmpStat.mtimeMs, true, (pError, pConvertedPath) =>
			{
				if (pError)
				{
					let tmpErr = new Error('Raw conversion failed: ' + pError.message);
					let tmpWaiters = tmpSelf._dziInFlight.get(tmpCacheKey) || [];
					tmpSelf._dziInFlight.delete(tmpCacheKey);
					for (let i = 0; i < tmpWaiters.length; i++)
					{
						tmpWaiters[i](tmpErr);
					}
					return fCallback(tmpErr);
				}
				tmpSelf._doGenerateDziTiles(pConvertedPath, pRelPath, tmpCacheKey, tmpCacheDir, tmpManifestPath, fCallback);
			});
		}
		else
		{
			this._doGenerateDziTiles(pAbsPath, pRelPath, tmpCacheKey, tmpCacheDir, tmpManifestPath, fCallback);
		}
	}

	/**
	 * Internal DZI tile generation — shared by both raw and standard image paths.
	 *
	 * @param {string}   pInputPath    - Path to read (converted JPEG for raw, original for standard)
	 * @param {string}   pRelPath      - Relative path (for response)
	 * @param {string}   pCacheKey     - Cache key
	 * @param {string}   pCacheDir     - Cache directory
	 * @param {string}   pManifestPath - Manifest file path
	 * @param {Function} fCallback     - Callback(pError, pResult)
	 */
	_doGenerateDziTiles(pInputPath, pRelPath, pCacheKey, pCacheDir, pManifestPath, fCallback)
	{
		let tmpSelf = this;

		// Get metadata first
		this._sharp(pInputPath, { limitInputPixels: false }).metadata()
			.then((pMetadata) =>
			{
				let tmpTileSize = tmpSelf.options.DziTileSize;
				let tmpOverlap = tmpSelf.options.DziOverlap;
				let tmpFormat = tmpSelf.options.DziFormat;
				let tmpQuality = tmpSelf.options.DziQuality;

				// The output filename for sharp's tile() is based on the
				// input to toFile() — sharp generates:
				//   {basename}.dzi          (the XML descriptor)
				//   {basename}_files/       (the tile directory)
				//     0/, 1/, 2/, ...       (zoom levels)
				//       0_0.jpeg, 0_1.jpeg  (tiles)
				let tmpBaseName = 'image';
				let tmpOutputBase = libPath.join(pCacheDir, tmpBaseName);

				let tmpSharpOptions =
				{
					size: tmpTileSize,
					overlap: tmpOverlap,
					layout: 'dz'
				};

				// Set format-specific quality
				let tmpFormatOptions = {};
				if (tmpFormat === 'jpeg')
				{
					tmpFormatOptions = { quality: tmpQuality };
				}
				else if (tmpFormat === 'png')
				{
					tmpFormatOptions = { compressionLevel: 6 };
				}

				tmpSelf._sharp(pInputPath, { limitInputPixels: false })
					.toFormat(tmpFormat, tmpFormatOptions)
					.tile(tmpSharpOptions)
					.toFile(tmpOutputBase)
					.then((pInfo) =>
					{
						let tmpResult =
						{
							Success: true,
							SourcePath: pRelPath,
							CacheKey: pCacheKey,
							DziFilename: tmpBaseName + '.dzi',
							TileDir: tmpBaseName + '_files',
							Width: pMetadata.width,
							Height: pMetadata.height,
							TileSize: tmpTileSize,
							Overlap: tmpOverlap,
							Format: tmpFormat,
							GeneratedAt: new Date().toISOString()
						};

						try
						{
							libFs.writeFileSync(pManifestPath, JSON.stringify(tmpResult, null, '\t'));
						}
						catch (pWriteError)
						{
							tmpSelf.fable.log.warn(`Could not write DZI manifest: ${pWriteError.message}`);
						}

						tmpSelf.fable.log.info(`Generated DZI tiles: ${pRelPath} (${pMetadata.width}×${pMetadata.height})`);

						// Notify queued waiters
						let tmpWaiters = tmpSelf._dziInFlight.get(pCacheKey) || [];
						tmpSelf._dziInFlight.delete(pCacheKey);
						for (let i = 0; i < tmpWaiters.length; i++)
						{
							tmpWaiters[i](null, tmpResult);
						}

						return fCallback(null, tmpResult);
					})
					.catch((pError) =>
					{
						let tmpErr = new Error('DZI tile generation failed: ' + pError.message);
						let tmpWaiters = tmpSelf._dziInFlight.get(pCacheKey) || [];
						tmpSelf._dziInFlight.delete(pCacheKey);
						for (let i = 0; i < tmpWaiters.length; i++)
						{
							tmpWaiters[i](tmpErr);
						}
						return fCallback(tmpErr);
					});
			})
			.catch((pError) =>
			{
				let tmpErr = new Error('Could not read image metadata: ' + pError.message);
				let tmpWaiters = tmpSelf._dziInFlight.get(pCacheKey) || [];
				tmpSelf._dziInFlight.delete(pCacheKey);
				for (let i = 0; i < tmpWaiters.length; i++)
				{
					tmpWaiters[i](tmpErr);
				}
				return fCallback(tmpErr);
			});
	}

	// ---------------------------------------------------------------
	// Cache path resolution
	// ---------------------------------------------------------------

	/**
	 * Get the absolute path to a cached preview file.
	 *
	 * @param {string} pCacheKey  - The cache key (directory name)
	 * @param {string} pFilename  - The output filename
	 * @returns {string|null} Absolute path or null if not found
	 */
	getPreviewPath(pCacheKey, pFilename)
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

		let tmpCacheDir = this.fable.ParimeBinaryStorage.resolvePath('image-previews', pCacheKey);
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

	/**
	 * Get the absolute path to the DZI descriptor file.
	 *
	 * @param {string} pCacheKey   - The cache key
	 * @param {string} pDziFilename - The DZI filename (e.g. 'image.dzi')
	 * @returns {string|null} Absolute path or null if not found
	 */
	getDziDescriptorPath(pCacheKey, pDziFilename)
	{
		if (!pCacheKey || !pDziFilename)
		{
			return null;
		}
		if (pCacheKey.includes('..') || pCacheKey.includes('/') || pCacheKey.includes('\\'))
		{
			return null;
		}
		if (pDziFilename.includes('..') || pDziFilename.includes('/') || pDziFilename.includes('\\'))
		{
			return null;
		}

		let tmpCacheDir = this.fable.ParimeBinaryStorage.resolvePath('dzi-tiles', pCacheKey);
		let tmpPath = libPath.join(tmpCacheDir, pDziFilename);

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

	/**
	 * Get the absolute path to a specific DZI tile.
	 *
	 * @param {string} pCacheKey - The cache key
	 * @param {string} pLevel   - Zoom level (e.g. '12')
	 * @param {string} pTile    - Tile filename (e.g. '0_0.jpeg')
	 * @returns {string|null} Absolute path or null if not found
	 */
	getDziTilePath(pCacheKey, pLevel, pTile)
	{
		// Sanitize all inputs to prevent directory traversal
		if (!pCacheKey || !pLevel || !pTile)
		{
			return null;
		}
		if (pCacheKey.includes('..') || pCacheKey.includes('/') || pCacheKey.includes('\\'))
		{
			return null;
		}
		// Level should be numeric
		if (!/^\d+$/.test(pLevel))
		{
			return null;
		}
		if (pTile.includes('..') || pTile.includes('/') || pTile.includes('\\'))
		{
			return null;
		}

		let tmpCacheDir = this.fable.ParimeBinaryStorage.resolvePath('dzi-tiles', pCacheKey);
		let tmpPath = libPath.join(tmpCacheDir, 'image_files', pLevel, pTile);

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

	// ---------------------------------------------------------------
	// Size checking
	// ---------------------------------------------------------------

	/**
	 * Check if an image is considered "large" by probing its dimensions.
	 *
	 * For raw camera formats, uses exifr to read dimensions from EXIF
	 * headers (faster than converting the entire file just to check size).
	 *
	 * @param {string}   pAbsPath  - Absolute path to the image
	 * @param {Function} fCallback - Callback(pError, pResult) where pResult = { IsLarge, Width, Height }
	 */
	checkImageSize(pAbsPath, fCallback)
	{
		let tmpSelf = this;

		// For raw formats, try exifr first (no conversion needed for size check)
		if (this._isRawFormat(pAbsPath))
		{
			try
			{
				let tmpExifr = require('exifr');
				tmpExifr.parse(pAbsPath, { tiff: true, exif: true })
					.then((pExif) =>
					{
						if (!pExif)
						{
							return fCallback(null, { IsLarge: false, Width: 0, Height: 0, IsRawFormat: true });
						}
						let tmpW = pExif.ImageWidth || pExif.ExifImageWidth || 0;
						let tmpH = pExif.ImageHeight || pExif.ExifImageHeight || 0;
						let tmpLongest = Math.max(tmpW, tmpH);
						return fCallback(null,
						{
							IsLarge: tmpLongest > tmpSelf.options.LargeImageThreshold,
							Width: tmpW,
							Height: tmpH,
							IsRawFormat: true
						});
					})
					.catch(() =>
					{
						return fCallback(null, { IsLarge: false, Width: 0, Height: 0, IsRawFormat: true });
					});
				return;
			}
			catch (pError)
			{
				return fCallback(null, { IsLarge: false, Width: 0, Height: 0, IsRawFormat: true });
			}
		}

		if (!this._sharp)
		{
			return fCallback(null, { IsLarge: false, Width: 0, Height: 0 });
		}

		this._sharp(pAbsPath, { limitInputPixels: false }).metadata()
			.then((pMetadata) =>
			{
				let tmpLongest = Math.max(pMetadata.width || 0, pMetadata.height || 0);
				return fCallback(null,
				{
					IsLarge: tmpLongest > tmpSelf.options.LargeImageThreshold,
					Width: pMetadata.width,
					Height: pMetadata.height
				});
			})
			.catch((pError) =>
			{
				return fCallback(null, { IsLarge: false, Width: 0, Height: 0 });
			});
	}
}

module.exports = RetoldRemoteImageService;
