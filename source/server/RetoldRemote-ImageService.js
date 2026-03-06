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

	/**
	 * Generate a downscaled preview of a large image.
	 * Results are cached in ParimeBinaryStorage under 'image-previews'.
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

		// Get metadata first to check if downscaling is needed
		this._sharp(pAbsPath, { limitInputPixels: false }).metadata()
			.then((pMetadata) =>
			{
				let tmpOrigWidth = pMetadata.width;
				let tmpOrigHeight = pMetadata.height;
				let tmpLongest = Math.max(tmpOrigWidth, tmpOrigHeight);

				// If image is smaller than threshold, just note it — no preview needed
				if (tmpLongest <= tmpMaxDim)
				{
					let tmpResult =
					{
						Success: true,
						SourcePath: pRelPath,
						CacheKey: tmpCacheKey,
						OutputFilename: tmpOutputFilename,
						Width: tmpOrigWidth,
						Height: tmpOrigHeight,
						OrigWidth: tmpOrigWidth,
						OrigHeight: tmpOrigHeight,
						FileSize: tmpStat.size,
						NeedsPreview: false,
						GeneratedAt: new Date().toISOString()
					};

					try
					{
						libFs.writeFileSync(tmpManifestPath, JSON.stringify(tmpResult, null, '\t'));
					}
					catch (pWriteError)
					{
						tmpSelf.fable.log.warn(`Could not write preview manifest: ${pWriteError.message}`);
					}

					return fCallback(null, tmpResult);
				}

				// Calculate new dimensions maintaining aspect ratio
				let tmpScale = tmpMaxDim / tmpLongest;
				let tmpNewWidth = Math.round(tmpOrigWidth * tmpScale);
				let tmpNewHeight = Math.round(tmpOrigHeight * tmpScale);

				// Generate the preview
				tmpSelf._sharp(pAbsPath, { limitInputPixels: false })
					.resize(tmpNewWidth, tmpNewHeight, { fit: 'inside', withoutEnlargement: true })
					.jpeg({ quality: tmpSelf.options.PreviewQuality })
					.toFile(tmpOutputPath)
					.then(() =>
					{
						let tmpOutputStat = libFs.statSync(tmpOutputPath);

						let tmpResult =
						{
							Success: true,
							SourcePath: pRelPath,
							CacheKey: tmpCacheKey,
							OutputFilename: tmpOutputFilename,
							Width: tmpNewWidth,
							Height: tmpNewHeight,
							OrigWidth: tmpOrigWidth,
							OrigHeight: tmpOrigHeight,
							FileSize: tmpOutputStat.size,
							NeedsPreview: true,
							GeneratedAt: new Date().toISOString()
						};

						try
						{
							libFs.writeFileSync(tmpManifestPath, JSON.stringify(tmpResult, null, '\t'));
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

	/**
	 * Generate DZI (Deep Zoom Image) tiles for an image.
	 * Results are cached in ParimeBinaryStorage under 'dzi-tiles'.
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

		// Get metadata first
		this._sharp(pAbsPath, { limitInputPixels: false }).metadata()
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
				let tmpOutputBase = libPath.join(tmpCacheDir, tmpBaseName);

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

				tmpSelf._sharp(pAbsPath, { limitInputPixels: false })
					.toFormat(tmpFormat, tmpFormatOptions)
					.tile(tmpSharpOptions)
					.toFile(tmpOutputBase)
					.then((pInfo) =>
					{
						let tmpResult =
						{
							Success: true,
							SourcePath: pRelPath,
							CacheKey: tmpCacheKey,
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
							libFs.writeFileSync(tmpManifestPath, JSON.stringify(tmpResult, null, '\t'));
						}
						catch (pWriteError)
						{
							tmpSelf.fable.log.warn(`Could not write DZI manifest: ${pWriteError.message}`);
						}

						tmpSelf.fable.log.info(`Generated DZI tiles: ${pRelPath} (${pMetadata.width}×${pMetadata.height})`);

						// Notify queued waiters
						let tmpWaiters = tmpSelf._dziInFlight.get(tmpCacheKey) || [];
						tmpSelf._dziInFlight.delete(tmpCacheKey);
						for (let i = 0; i < tmpWaiters.length; i++)
						{
							tmpWaiters[i](null, tmpResult);
						}

						return fCallback(null, tmpResult);
					})
					.catch((pError) =>
					{
						let tmpErr = new Error('DZI tile generation failed: ' + pError.message);
						let tmpWaiters = tmpSelf._dziInFlight.get(tmpCacheKey) || [];
						tmpSelf._dziInFlight.delete(tmpCacheKey);
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
				let tmpWaiters = tmpSelf._dziInFlight.get(tmpCacheKey) || [];
				tmpSelf._dziInFlight.delete(tmpCacheKey);
				for (let i = 0; i < tmpWaiters.length; i++)
				{
					tmpWaiters[i](tmpErr);
				}
				return fCallback(tmpErr);
			});
	}

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

	/**
	 * Check if an image is considered "large" by probing its dimensions.
	 *
	 * @param {string}   pAbsPath  - Absolute path to the image
	 * @param {Function} fCallback - Callback(pError, pResult) where pResult = { IsLarge, Width, Height }
	 */
	checkImageSize(pAbsPath, fCallback)
	{
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
					IsLarge: tmpLongest > this.options.LargeImageThreshold,
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
