/**
 * Retold Remote -- Media Service
 *
 * Provides REST API endpoints for media operations:
 *   GET /api/media/capabilities   -- Detected tool availability
 *   GET /api/media/thumbnail      -- Generate/serve cached thumbnails
 *   GET /api/media/probe          -- Media metadata (dimensions, duration)
 *   GET /api/media/folder-summary -- Folder media type counts
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');
const libChildProcess = require('child_process');
const libUrl = require('url');

const libToolDetector = require('./RetoldRemote-ToolDetector.js');
const libThumbnailCache = require('./RetoldRemote-ThumbnailCache.js');

const libExtensionMaps = require('../RetoldRemote-ExtensionMaps.js');

const _DefaultServiceConfiguration =
{
	"ContentPath": ".",
	"APIRoutePrefix": "/api/media",
	"DefaultThumbnailWidth": 200,
	"DefaultThumbnailHeight": 200
};

class RetoldRemoteMediaService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteMediaService';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		this.toolDetector = new libToolDetector();
		this.capabilities = this.toolDetector.detect();
		this.thumbnailCache = new libThumbnailCache(this.fable);
		this.pathRegistry = this.options.PathRegistry || null;

		// Ultravisor dispatcher — set via setDispatcher()
		this._dispatcher = null;

		// Operation broadcaster — set via setBroadcaster()
		this._broadcaster = null;

		this.fable.log.info(`Media Service: capabilities = ${JSON.stringify(this.capabilities)}`);
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
	 * Set the operation broadcaster for progress events and cancellation.
	 *
	 * @param {object} pBroadcaster - RetoldRemoteOperationBroadcaster instance
	 */
	setBroadcaster(pBroadcaster)
	{
		this._broadcaster = pBroadcaster;
	}

	/**
	 * Emit a progress event if a broadcaster is attached and an operation id
	 * was supplied. Safe to call without either.
	 */
	_emitProgress(pOperationId, pPayload)
	{
		if (this._broadcaster && pOperationId)
		{
			this._broadcaster.broadcastProgress(pOperationId, pPayload);
		}
	}

	/**
	 * Check whether a given operation has been cancelled.
	 */
	_isCancelled(pOperationId)
	{
		return !!(this._broadcaster && pOperationId && this._broadcaster.isCancelled(pOperationId));
	}

	/**
	 * Sanitize a file path to prevent directory traversal.
	 *
	 * @param {string} pPath - Raw path from query
	 * @returns {string|null} Safe relative path or null
	 */
	_sanitizePath(pPath)
	{
		if (!pPath || typeof (pPath) !== 'string')
		{
			return null;
		}
		let tmpPath = decodeURIComponent(pPath);
		tmpPath = tmpPath.replace(/^\/+/, '');
		if (tmpPath.includes('..'))
		{
			return null;
		}
		if (libPath.isAbsolute(tmpPath))
		{
			return null;
		}
		return tmpPath || null;
	}

	/**
	 * Get the media category for a file extension.
	 *
	 * @param {string} pExtension - Lowercase extension
	 * @returns {string} 'image', 'video', 'audio', 'document', or 'other'
	 */
	_getMediaCategory(pExtension)
	{
		return libExtensionMaps.getCategory(pExtension);
	}

	/**
	 * Connect all media API routes to the server.
	 *
	 * @param {object} pServer - The Restify server instance
	 */
	connectRoutes(pServer)
	{
		let tmpSelf = this;
		let tmpPrefix = this.options.APIRoutePrefix;

		// --- GET /api/media/capabilities ---
		pServer.get(`${tmpPrefix}/capabilities`,
			(pRequest, pResponse, fNext) =>
			{
				pResponse.send(
				{
					Success: true,
					Capabilities: tmpSelf.capabilities,
					CachePath: tmpSelf.thumbnailCache.getCachePath()
				});
				return fNext();
			});

		// --- GET /api/media/thumbnail ---
		pServer.get(`${tmpPrefix}/thumbnail`,
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpParsedUrl = libUrl.parse(pRequest.url, true);
					let tmpQuery = tmpParsedUrl.query;
					let tmpRelPath = tmpSelf._sanitizePath(tmpQuery.path);

					if (!tmpRelPath)
					{
						pResponse.send(400, { Success: false, Error: 'Invalid path.' });
						return fNext();
					}

					let tmpFullPath = libPath.join(tmpSelf.contentPath, tmpRelPath);
					if (!libFs.existsSync(tmpFullPath))
					{
						pResponse.send(404, { Success: false, Error: 'File not found.' });
						return fNext();
					}

					let tmpWidth = parseInt(tmpQuery.width, 10) || tmpSelf.options.DefaultThumbnailWidth;
					let tmpHeight = parseInt(tmpQuery.height, 10) || tmpSelf.options.DefaultThumbnailHeight;
					let tmpFormat = tmpQuery.format || 'webp';

					// Clamp dimensions
					tmpWidth = Math.min(Math.max(tmpWidth, 32), 1024);
					tmpHeight = Math.min(Math.max(tmpHeight, 32), 1024);

					let tmpStat = libFs.statSync(tmpFullPath);
					let tmpCacheKey = tmpSelf.thumbnailCache.buildKey(tmpRelPath, tmpStat.mtimeMs, tmpWidth, tmpHeight);
					let tmpCachedPath = tmpSelf.thumbnailCache.get(tmpCacheKey, tmpFormat);

					if (tmpCachedPath)
					{
						// Serve from cache
						let tmpBuffer = libFs.readFileSync(tmpCachedPath);
						pResponse.writeHead(200,
						{
							'Content-Type': `image/${tmpFormat}`,
							'Content-Length': tmpBuffer.length,
							'Cache-Control': 'public, max-age=86400'
						});
						pResponse.end(tmpBuffer);
						return fNext();
					}

					// Generate thumbnail
					let tmpExtension = libPath.extname(tmpRelPath).replace('.', '').toLowerCase();
					let tmpCategory = tmpSelf._getMediaCategory(tmpExtension);

					tmpSelf._generateThumbnail(tmpFullPath, tmpCategory, tmpWidth, tmpHeight, tmpFormat,
						(pError, pBuffer) =>
						{
							if (pError || !pBuffer)
							{
								pResponse.send(404, { Success: false, Fallback: true, Error: pError ? pError.message : 'No thumbnail tools available.' });
								return fNext();
							}

							// Cache the result
							tmpSelf.thumbnailCache.put(tmpCacheKey, pBuffer, tmpFormat);

							pResponse.writeHead(200,
							{
								'Content-Type': `image/${tmpFormat}`,
								'Content-Length': pBuffer.length,
								'Cache-Control': 'public, max-age=86400'
							});
							pResponse.end(pBuffer);
							return fNext();
						});
				}
				catch (pError)
				{
					tmpSelf.fable.log.error(`Thumbnail error: ${pError.message}`);
					pResponse.send(500, { Success: false, Error: pError.message });
					return fNext();
				}
			});

		// --- GET /api/media/probe ---
		pServer.get(`${tmpPrefix}/probe`,
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpParsedUrl = libUrl.parse(pRequest.url, true);
					let tmpQuery = tmpParsedUrl.query;
					let tmpRelPath = tmpSelf._sanitizePath(tmpQuery.path);

					if (!tmpRelPath)
					{
						pResponse.send(400, { Success: false, Error: 'Invalid path.' });
						return fNext();
					}

					let tmpFullPath = libPath.join(tmpSelf.contentPath, tmpRelPath);
					if (!libFs.existsSync(tmpFullPath))
					{
						pResponse.send(404, { Success: false, Error: 'File not found.' });
						return fNext();
					}

					let tmpStat = libFs.statSync(tmpFullPath);
					let tmpExtension = libPath.extname(tmpRelPath).replace('.', '').toLowerCase();
					let tmpCategory = tmpSelf._getMediaCategory(tmpExtension);

					let tmpProbe =
					{
						Success: true,
						Path: tmpRelPath,
						Size: tmpStat.size,
						Modified: tmpStat.mtime,
						Created: tmpStat.birthtime,
						Extension: tmpExtension,
						Category: tmpCategory
					};

					// Annotate with hash when path registry is available
					if (tmpSelf.pathRegistry && tmpSelf.pathRegistry.isEnabled())
					{
						tmpProbe.Hash = tmpSelf.pathRegistry.register(tmpRelPath);
					}

					// Try ffprobe for video/audio metadata
					if ((tmpCategory === 'video' || tmpCategory === 'audio') && tmpSelf.capabilities.ffprobe)
					{
						tmpSelf._ffprobe(tmpFullPath,
							(pError, pMetadata) =>
							{
								if (!pError && pMetadata)
								{
									tmpProbe.Duration = pMetadata.duration;
									tmpProbe.Width = pMetadata.width;
									tmpProbe.Height = pMetadata.height;
									tmpProbe.Codec = pMetadata.codec;
									tmpProbe.Bitrate = pMetadata.bitrate;
									tmpProbe.Tags = pMetadata.tags || {};
								}
								pResponse.send(tmpProbe);
								return fNext();
							});
						return;
					}

					// Try sharp for image metadata
					if (tmpCategory === 'image' && tmpSelf.capabilities.sharp)
					{
						let tmpIsRawFile = libExtensionMaps.isRawImage(tmpExtension);
						try
						{
							let tmpSharp = tmpSelf.capabilities.sharpModule;
							tmpSharp(tmpFullPath).metadata()
								.then((pMetadata) =>
								{
									tmpProbe.Width = pMetadata.width;
									tmpProbe.Height = pMetadata.height;
									tmpProbe.Format = pMetadata.format;
									tmpProbe.Space = pMetadata.space;
									tmpProbe.HasAlpha = pMetadata.hasAlpha;
									if (tmpIsRawFile)
									{
										tmpProbe.IsRawFormat = true;
									}
									pResponse.send(tmpProbe);
									return fNext();
								})
								.catch(() =>
								{
									// Sharp failed — for raw files, try exifr as fallback
									if (tmpIsRawFile)
									{
										tmpSelf._probeRawWithExifr(tmpFullPath, tmpProbe, pResponse, fNext);
										return;
									}
									pResponse.send(tmpProbe);
									return fNext();
								});
							return;
						}
						catch (pErr)
						{
							// sharp not available after all — try exifr for raw
							if (tmpIsRawFile)
							{
								tmpSelf._probeRawWithExifr(tmpFullPath, tmpProbe, pResponse, fNext);
								return;
							}
						}
					}
					// For raw images without sharp, still try exifr
					else if (tmpCategory === 'image' && libExtensionMaps.isRawImage(tmpExtension))
					{
						tmpSelf._probeRawWithExifr(tmpFullPath, tmpProbe, pResponse, fNext);
						return;
					}

					pResponse.send(tmpProbe);
					return fNext();
				}
				catch (pError)
				{
					pResponse.send(500, { Success: false, Error: pError.message });
					return fNext();
				}
			});

		// --- GET /api/media/folder-summary ---
		pServer.get(`${tmpPrefix}/folder-summary`,
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpParsedUrl = libUrl.parse(pRequest.url, true);
					let tmpQuery = tmpParsedUrl.query;
					let tmpRelPath = tmpSelf._sanitizePath(tmpQuery.path || '');
					let tmpDirPath = tmpRelPath
						? libPath.join(tmpSelf.contentPath, tmpRelPath)
						: tmpSelf.contentPath;

					if (!libFs.existsSync(tmpDirPath) || !libFs.statSync(tmpDirPath).isDirectory())
					{
						pResponse.send(404, { Success: false, Error: 'Directory not found.' });
						return fNext();
					}

					let tmpEntries = libFs.readdirSync(tmpDirPath);
					let tmpSummary =
					{
						Success: true,
						Path: tmpRelPath || '',
						TotalFiles: 0,
						Folders: 0,
						MediaFiles: 0,
						Images: 0,
						Videos: 0,
						Audio: 0,
						Documents: 0,
						Other: 0
					};

					for (let i = 0; i < tmpEntries.length; i++)
					{
						let tmpEntry = tmpEntries[i];
						// Skip hidden files
						if (tmpEntry.startsWith('.'))
						{
							continue;
						}

						let tmpEntryPath = libPath.join(tmpDirPath, tmpEntry);
						let tmpEntryStat;
						try
						{
							tmpEntryStat = libFs.statSync(tmpEntryPath);
						}
						catch (pErr)
						{
							continue;
						}

						if (tmpEntryStat.isDirectory())
						{
							tmpSummary.Folders++;
							continue;
						}

						tmpSummary.TotalFiles++;
						let tmpExt = libPath.extname(tmpEntry).replace('.', '').toLowerCase();
						let tmpCat = tmpSelf._getMediaCategory(tmpExt);

						if (tmpCat === 'image') { tmpSummary.Images++; tmpSummary.MediaFiles++; }
						else if (tmpCat === 'video') { tmpSummary.Videos++; tmpSummary.MediaFiles++; }
						else if (tmpCat === 'audio') { tmpSummary.Audio++; tmpSummary.MediaFiles++; }
						else if (tmpCat === 'document') { tmpSummary.Documents++; tmpSummary.MediaFiles++; }
						else { tmpSummary.Other++; }
					}

					tmpSummary.HasThumbnailableContent = (tmpSummary.Images > 0 || tmpSummary.Videos > 0);

					pResponse.send(tmpSummary);
					return fNext();
				}
				catch (pError)
				{
					pResponse.send(500, { Success: false, Error: pError.message });
					return fNext();
				}
			});
	}

	/**
	 * Generate a thumbnail for the given file.
	 *
	 * @param {string}   pFullPath  - Absolute path to source file
	 * @param {string}   pCategory  - 'image', 'video', etc.
	 * @param {number}   pWidth     - Target width
	 * @param {number}   pHeight    - Target height
	 * @param {string}   pFormat    - Output format ('webp', 'jpg', 'png')
	 * @param {Function} fCallback  - Callback(pError, pBuffer)
	 */
	_generateThumbnail(pFullPath, pCategory, pWidth, pHeight, pFormat, fCallback)
	{
		if (pCategory === 'image')
		{
			return this._generateImageThumbnail(pFullPath, pWidth, pHeight, pFormat, fCallback);
		}

		if (pCategory === 'video' && this.capabilities.ffmpeg)
		{
			return this._generateVideoThumbnail(pFullPath, pWidth, pHeight, pFormat, fCallback);
		}

		// No thumbnail generation available for this type
		return fCallback(new Error('No thumbnail strategy for this file type.'));
	}

	/**
	 * Generate an image thumbnail using sharp or ImageMagick.
	 * Raw camera formats are routed to _generateRawThumbnail.
	 * Prefers Ultravisor dispatch when a beacon is available.
	 */
	_generateImageThumbnail(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		let tmpSelf = this;

		// Raw camera formats need special handling
		let tmpExt = libPath.extname(pFullPath).replace(/^\./, '').toLowerCase();
		if (libExtensionMaps.RawImageExtensions[tmpExt])
		{
			return this._generateRawThumbnail(pFullPath, pWidth, pHeight, pFormat, fCallback);
		}

		// Prefer Ultravisor operation trigger when available.
		if (this._dispatcher && this._dispatcher.isAvailable())
		{
			let tmpRelPath;
			try
			{
				tmpRelPath = libPath.relative(this.contentPath, pFullPath);
			}
			catch (pErr)
			{
				tmpRelPath = null;
			}

			if (tmpRelPath && !tmpRelPath.startsWith('..'))
			{
				let tmpOutputFormat = pFormat === 'webp' ? 'webp' : 'jpeg';

				this._dispatcher.triggerOperation('rr-image-thumbnail',
				{
					ImageAddress: '>retold-remote/File/' + tmpRelPath,
					Width: pWidth,
					Height: pHeight,
					Format: tmpOutputFormat,
					Quality: 80
				},
				(pTriggerError, pResult) =>
				{
					if (!pTriggerError && pResult && pResult.OutputBuffer)
					{
						tmpSelf.fable.log.info(`Image thumbnail generated via operation trigger for ${tmpRelPath}`);
						return fCallback(null, pResult.OutputBuffer);
					}

					// Trigger failed — fall through to local processing
					tmpSelf.fable.log.info(`Operation trigger failed for image thumbnail, falling back to local: ${pTriggerError ? pTriggerError.message : 'no result'}`);
					tmpSelf._generateImageThumbnailLocal(pFullPath, pWidth, pHeight, pFormat, fCallback);
				});
				return;
			}
		}

		return this._generateImageThumbnailLocal(pFullPath, pWidth, pHeight, pFormat, fCallback);
	}

	/**
	 * Generate an image thumbnail using local tools (Sharp or ImageMagick).
	 */
	_generateImageThumbnailLocal(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		// Try sharp first
		if (this.capabilities.sharp)
		{
			try
			{
				let tmpSharp = this.capabilities.sharpModule;
				tmpSharp(pFullPath)
					.resize(pWidth, pHeight, { fit: 'inside', withoutEnlargement: true })
					.toFormat(pFormat === 'webp' ? 'webp' : 'jpeg', { quality: 80 })
					.toBuffer()
					.then((pBuffer) => fCallback(null, pBuffer))
					.catch((pError) => fCallback(pError));
				return;
			}
			catch (pError)
			{
				// Fall through to ImageMagick
			}
		}

		// Try ImageMagick
		if (this.capabilities.imagemagick)
		{
			try
			{
				let tmpOutputFormat = pFormat === 'webp' ? 'webp' : 'jpeg';
				let tmpCmd = `convert "${pFullPath}" -thumbnail ${pWidth}x${pHeight} -auto-orient ${tmpOutputFormat}:-`;
				let tmpBuffer = libChildProcess.execSync(tmpCmd, { maxBuffer: 10 * 1024 * 1024, timeout: 15000 });
				return fCallback(null, tmpBuffer);
			}
			catch (pError)
			{
				return fCallback(pError);
			}
		}

		return fCallback(new Error('No image thumbnail tools available.'));
	}

	/**
	 * Generate a thumbnail for a raw camera image.
	 * Fallback chain: Ultravisor dispatch → Sharp direct → dcraw.js → native dcraw → ImageMagick → exifr/JPEG scan.
	 */
	_generateRawThumbnail(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		let tmpSelf = this;

		// Try Ultravisor operation trigger when available.
		if (this._dispatcher && this._dispatcher.isAvailable())
		{
			let tmpRelPath;
			try
			{
				tmpRelPath = libPath.relative(this.contentPath, pFullPath);
			}
			catch (pErr)
			{
				tmpRelPath = null;
			}

			if (tmpRelPath && !tmpRelPath.startsWith('..'))
			{
				let tmpOutputFormat = pFormat === 'webp' ? 'webp' : 'jpeg';

				this._dispatcher.triggerOperation('rr-image-thumbnail',
				{
					ImageAddress: '>retold-remote/File/' + tmpRelPath,
					Width: pWidth,
					Height: pHeight,
					Format: tmpOutputFormat,
					Quality: 80
				},
				(pTriggerError, pResult) =>
				{
					if (!pTriggerError && pResult && pResult.OutputBuffer)
					{
						tmpSelf.fable.log.info(`Raw thumbnail generated via operation trigger for ${tmpRelPath}`);
						return fCallback(null, pResult.OutputBuffer);
					}

					// Trigger failed — fall through to local processing
					tmpSelf.fable.log.info(`Operation trigger failed for raw thumbnail, falling back to local: ${pTriggerError ? pTriggerError.message : 'no result'}`);
					tmpSelf._generateRawThumbnailLocal(pFullPath, pWidth, pHeight, pFormat, fCallback);
				});
				return;
			}
		}

		return this._generateRawThumbnailLocal(pFullPath, pWidth, pHeight, pFormat, fCallback);
	}

	/**
	 * Generate a raw thumbnail using local tools.
	 * Fallback chain: Sharp direct → native dcraw → ImageMagick → dcraw.js → exifr.
	 */
	_generateRawThumbnailLocal(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		let tmpSelf = this;
		let tmpOutputFormat = pFormat === 'webp' ? 'webp' : 'jpeg';

		// Try Sharp directly — libvips can natively decode DNG
		// and some other raw formats without needing external tools.
		if (this.capabilities.sharp)
		{
			try
			{
				let tmpSharp = this.capabilities.sharpModule;
				tmpSharp(pFullPath)
					.resize(pWidth, pHeight, { fit: 'inside', withoutEnlargement: true })
					.toFormat(tmpOutputFormat, { quality: 80 })
					.toBuffer()
					.then((pOutBuf) => fCallback(null, pOutBuf))
					.catch(() =>
					{
						// Sharp can't decode this format — fall through to native dcraw
						tmpSelf._generateRawThumbnailNativeDcraw(pFullPath, pWidth, pHeight, pFormat, fCallback);
					});
				return;
			}
			catch (pError)
			{
				// Fall through
			}
		}

		return this._generateRawThumbnailNativeDcraw(pFullPath, pWidth, pHeight, pFormat, fCallback);
	}

	/**
	 * Generate a raw thumbnail using dcraw.js (Emscripten port).
	 * Pure JavaScript, no native binary needed. Outputs TIFF → Sharp resize.
	 * Slow and memory-heavy — last resort before exifr embedded preview.
	 */
	_generateRawThumbnailDcrawJs(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		let tmpSelf = this;
		let tmpOutputFormat = pFormat === 'webp' ? 'webp' : 'jpeg';

		if (this.capabilities.dcrawJs && this.capabilities.dcrawJsModule && this.capabilities.sharp)
		{
			try
			{
				let tmpRawBuffer = libFs.readFileSync(pFullPath);
				let tmpDcrawJs = this.capabilities.dcrawJsModule;
				let tmpTiffData = tmpDcrawJs(tmpRawBuffer, { exportAsTiff: true, useCameraWhiteBalance: true, setHalfSizeMode: true });

				if (tmpTiffData && typeof tmpTiffData !== 'string' && tmpTiffData.length > 0)
				{
					let tmpSharp = this.capabilities.sharpModule;
					tmpSharp(Buffer.from(tmpTiffData))
						.resize(pWidth, pHeight, { fit: 'inside', withoutEnlargement: true })
						.toFormat(tmpOutputFormat, { quality: 80 })
						.toBuffer()
						.then((pOutBuf) => fCallback(null, pOutBuf))
						.catch(() =>
						{
							tmpSelf._generateRawThumbnailExifr(pFullPath, pWidth, pHeight, pFormat, fCallback);
						});
					return;
				}
			}
			catch (pError)
			{
				// Fall through to exifr
			}
		}

		return this._generateRawThumbnailExifr(pFullPath, pWidth, pHeight, pFormat, fCallback);
	}

	/**
	 * Generate a raw thumbnail using native dcraw binary + sharp.
	 * Called after Sharp direct fails.
	 */
	_generateRawThumbnailNativeDcraw(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		let tmpSelf = this;
		let tmpOutputFormat = pFormat === 'webp' ? 'webp' : 'jpeg';

		// Native dcraw piped to sharp (half-size for speed)
		if (this.capabilities.dcraw && this.capabilities.sharp)
		{
			try
			{
				let tmpSharp = this.capabilities.sharpModule;
				let tmpDcraw = libChildProcess.spawn('dcraw', ['-c', '-w', '-h', pFullPath], { timeout: 60000 });
				let tmpChunks = [];

				tmpDcraw.stdout.on('data', (pChunk) =>
				{
					tmpChunks.push(pChunk);
				});

				tmpDcraw.on('error', () =>
				{
					// Fall through to ImageMagick
					tmpSelf._generateRawThumbnailImageMagick(pFullPath, pWidth, pHeight, pFormat, fCallback);
				});

				tmpDcraw.on('close', (pCode) =>
				{
					if (pCode !== 0 || tmpChunks.length === 0)
					{
						return tmpSelf._generateRawThumbnailImageMagick(pFullPath, pWidth, pHeight, pFormat, fCallback);
					}

					let tmpBuffer = Buffer.concat(tmpChunks);
					tmpSharp(tmpBuffer)
						.resize(pWidth, pHeight, { fit: 'inside', withoutEnlargement: true })
						.toFormat(tmpOutputFormat, { quality: 80 })
						.toBuffer()
						.then((pOutBuf) => fCallback(null, pOutBuf))
						.catch(() =>
						{
							tmpSelf._generateRawThumbnailImageMagick(pFullPath, pWidth, pHeight, pFormat, fCallback);
						});
				});
				return;
			}
			catch (pError)
			{
				// Fall through
			}
		}

		return this._generateRawThumbnailImageMagick(pFullPath, pWidth, pHeight, pFormat, fCallback);
	}

	/**
	 * Generate a raw thumbnail using ImageMagick (may have dcraw/ufraw delegate).
	 * Called after native dcraw fails.
	 */
	_generateRawThumbnailImageMagick(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		let tmpOutputFormat = pFormat === 'webp' ? 'webp' : 'jpeg';

		if (this.capabilities.imagemagick)
		{
			try
			{
				let tmpCmd = `convert "${pFullPath}" -thumbnail ${pWidth}x${pHeight} -auto-orient ${tmpOutputFormat}:-`;
				let tmpBuffer = libChildProcess.execSync(tmpCmd, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 });
				return fCallback(null, tmpBuffer);
			}
			catch (pError)
			{
				// Fall through to dcraw.js
			}
		}

		return this._generateRawThumbnailDcrawJs(pFullPath, pWidth, pHeight, pFormat, fCallback);
	}

	/**
	 * Strategy 3 for raw thumbnails: extract embedded JPEG preview via exifr,
	 * resize with sharp. Most cameras embed a full-size JPEG preview in the raw file.
	 */
	_generateRawThumbnailExifr(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		let tmpOutputFormat = pFormat === 'webp' ? 'webp' : 'jpeg';

		if (this.capabilities.sharp)
		{
			let tmpSharp = this.capabilities.sharpModule;

			let _resizeBuffer = (pJpegBuffer) =>
			{
				tmpSharp(pJpegBuffer)
					.resize(pWidth, pHeight, { fit: 'inside', withoutEnlargement: true })
					.toFormat(tmpOutputFormat, { quality: 80 })
					.toBuffer()
					.then((pOutBuf) => fCallback(null, pOutBuf))
					.catch(fCallback);
			};

			try
			{
				let tmpExifr = require('exifr');
				tmpExifr.thumbnailBuffer(pFullPath)
					.then((pBuffer) =>
					{
						if (pBuffer && pBuffer.length > 0)
						{
							return _resizeBuffer(pBuffer);
						}
						// exifr found nothing — try manual JPEG scan
						let tmpJpeg = this._extractLargestEmbeddedJpeg(pFullPath);
						if (tmpJpeg)
						{
							return _resizeBuffer(tmpJpeg);
						}
						return fCallback(new Error('No embedded preview available.'));
					})
					.catch(() =>
					{
						// exifr parse failed — try manual JPEG scan
						let tmpJpeg = this._extractLargestEmbeddedJpeg(pFullPath);
						if (tmpJpeg)
						{
							return _resizeBuffer(tmpJpeg);
						}
						return fCallback(new Error('No embedded preview available.'));
					});
				return;
			}
			catch (pError)
			{
				// Fall through
			}
		}

		return fCallback(new Error('No raw thumbnail tools available.'));
	}

	/**
	 * Scan a raw file for embedded JPEG data by looking for SOI/EOI markers.
	 * Returns the largest JPEG block found as a Buffer, or null.
	 *
	 * @param {string} pFullPath - Path to the raw file
	 * @returns {Buffer|null}
	 */
	_extractLargestEmbeddedJpeg(pFullPath)
	{
		try
		{
			let tmpFileBuffer = libFs.readFileSync(pFullPath);
			let tmpLargestJpeg = null;
			let tmpLargestSize = 0;

			for (let i = 0; i < tmpFileBuffer.length - 1; i++)
			{
				if (tmpFileBuffer[i] === 0xFF && tmpFileBuffer[i + 1] === 0xD8)
				{
					for (let j = i + 2; j < tmpFileBuffer.length - 1; j++)
					{
						if (tmpFileBuffer[j] === 0xFF && tmpFileBuffer[j + 1] === 0xD9)
						{
							let tmpJpegSize = j + 2 - i;
							if (tmpJpegSize > tmpLargestSize && tmpJpegSize > 10240)
							{
								tmpLargestSize = tmpJpegSize;
								tmpLargestJpeg = tmpFileBuffer.subarray(i, j + 2);
							}
							break;
						}
					}
				}
			}

			return tmpLargestJpeg;
		}
		catch (pError)
		{
			return null;
		}
	}

	/**
	 * Generate a video thumbnail by extracting a frame with ffmpeg.
	 * Tries Ultravisor dispatch first, falls back to local execution.
	 */
	_generateVideoThumbnail(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		let tmpSelf = this;

		// Try Ultravisor operation trigger first
		if (this._dispatcher && this._dispatcher.isAvailable())
		{
			let tmpRelPath;
			try
			{
				tmpRelPath = libPath.relative(this.contentPath, pFullPath);
			}
			catch (pErr)
			{
				tmpRelPath = null;
			}

			if (tmpRelPath && !tmpRelPath.startsWith('..'))
			{
				this._dispatcher.triggerOperation('rr-video-thumbnail',
				{
					VideoAddress: '>retold-remote/File/' + tmpRelPath,
					Timestamp: '00:00:02',
					Width: pWidth,
					TimeoutMs: 1800000
				},
				(pTriggerError, pResult) =>
				{
					if (!pTriggerError && pResult && pResult.OutputBuffer)
					{
						tmpSelf.fable.log.info(`Video thumbnail generated via operation trigger for ${tmpRelPath}`);
						return fCallback(null, pResult.OutputBuffer);
					}

					// Fall through to local processing
					tmpSelf.fable.log.info(`Operation trigger failed for video thumbnail, falling back to local: ${pTriggerError ? pTriggerError.message : 'no output'}`);
					tmpSelf._generateVideoThumbnailLocal(pFullPath, pWidth, pHeight, pFormat, fCallback);
				});
				return;
			}
		}

		return this._generateVideoThumbnailLocal(pFullPath, pWidth, pHeight, pFormat, fCallback);
	}

	/**
	 * Generate a video thumbnail locally using ffmpeg.
	 */
	_generateVideoThumbnailLocal(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		try
		{
			let tmpOutputFormat = pFormat === 'webp' ? 'webp' : 'mjpeg';
			// Extract a frame at 10% into the video
			let tmpCmd = `ffmpeg -ss 00:00:02 -i "${pFullPath}" -vframes 1 -vf "scale=${pWidth}:${pHeight}:force_original_aspect_ratio=decrease" -f ${tmpOutputFormat} pipe:1`;
			let tmpBuffer = libChildProcess.execSync(tmpCmd, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 });
			return fCallback(null, tmpBuffer);
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	/**
	 * Probe a raw camera image for dimensions using exifr.
	 * Used when Sharp fails to read the raw format.
	 */
	_probeRawWithExifr(pFullPath, pProbe, pResponse, fNext)
	{
		try
		{
			let tmpExifr = require('exifr');
			tmpExifr.parse(pFullPath, { tiff: true, exif: true })
				.then((pExif) =>
				{
					if (pExif)
					{
						pProbe.Width = pExif.ImageWidth || pExif.ExifImageWidth || null;
						pProbe.Height = pExif.ImageHeight || pExif.ExifImageHeight || null;
						pProbe.Format = 'raw';
					}
					pProbe.IsRawFormat = true;
					pResponse.send(pProbe);
					return fNext();
				})
				.catch(() =>
				{
					pProbe.IsRawFormat = true;
					pResponse.send(pProbe);
					return fNext();
				});
		}
		catch (pError)
		{
			pProbe.IsRawFormat = true;
			pResponse.send(pProbe);
			return fNext();
		}
	}

	/**
	 * Run ffprobe and parse the output.
	 *
	 * Strategy ordering (most efficient first):
	 *   1. LOCAL ffprobe — when this process has the binary on PATH (the
	 *      ToolDetector flagged `capabilities.ffprobe` true). Reads the
	 *      container index in milliseconds, no Ultravisor pipeline involved,
	 *      no file copies, no shared-fs negotiation. This is the right call
	 *      for stack-mode deployments where retold-remote and orator-conversion
	 *      live in the same image.
	 *   2. DISPATCHED probe — only when the local binary is missing. Goes
	 *      through the rr-media-probe operation graph (resolve → transfer →
	 *      probe → result). With shared-fs the file isn't actually copied,
	 *      but the operation graph still runs.
	 *
	 * The previous implementation had this BACKWARDS — it dispatched first
	 * even when the local binary was available, which made every gallery
	 * thumbnail probe pay an extra Ultravisor round trip.
	 */
	_ffprobe(pFullPath, fCallback)
	{
		let tmpSelf = this;

		// Local-first: if ffprobe is on this host, just run it.
		if (this.capabilities && this.capabilities.ffprobe)
		{
			return this._ffprobeLocal(pFullPath, fCallback);
		}

		// No local ffprobe — fall back to dispatching the probe through the
		// Ultravisor mesh. This requires the dispatcher to be available and
		// the file to be addressable through the File context.
		if (this._dispatcher && this._dispatcher.isAvailable())
		{
			let tmpRelPath;
			try
			{
				tmpRelPath = libPath.relative(this.contentPath, pFullPath);
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
								let tmpParsed = tmpSelf._parseFfprobeData(tmpData);
								tmpSelf.fable.log.info(`ffprobe via operation trigger for ${tmpRelPath} (no local ffprobe)`);
								return fCallback(null, tmpParsed);
							}
						}
						catch (pParseError)
						{
							// Fall through to local — even though the constructor
							// said ffprobe was missing, the binary could have been
							// installed since startup.
						}
					}

					// Fall through to local processing
					tmpSelf._ffprobeLocal(pFullPath, fCallback);
				});
				return;
			}
		}

		// Last resort: try local even though detection said it was missing.
		return this._ffprobeLocal(pFullPath, fCallback);
	}

	/**
	 * Run ffprobe locally and parse the output.
	 */
	_ffprobeLocal(pFullPath, fCallback)
	{
		try
		{
			let tmpCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${pFullPath}"`;
			let tmpOutput = libChildProcess.execSync(tmpCmd, { maxBuffer: 1024 * 1024, timeout: 10000 });
			let tmpData = JSON.parse(tmpOutput.toString());
			return fCallback(null, this._parseFfprobeData(tmpData));
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	/**
	 * Parse ffprobe JSON output into a normalized result object.
	 */
	_parseFfprobeData(pData)
	{
		let tmpResult = {};

		if (pData.format)
		{
			tmpResult.duration = parseFloat(pData.format.duration) || null;
			tmpResult.bitrate = parseInt(pData.format.bit_rate, 10) || null;

			// Extract format-level tags (ID3, Vorbis comments, etc.)
			if (pData.format.tags)
			{
				tmpResult.tags = {};
				let tmpTagKeys = Object.keys(pData.format.tags);
				for (let t = 0; t < tmpTagKeys.length; t++)
				{
					tmpResult.tags[tmpTagKeys[t].toLowerCase()] = pData.format.tags[tmpTagKeys[t]];
				}
			}
		}

		// Find video stream for dimensions
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
				if (tmpStream.codec_type === 'audio' && !tmpResult.codec)
				{
					tmpResult.codec = tmpStream.codec_name;
				}
			}
		}

		return tmpResult;
	}
}

module.exports = RetoldRemoteMediaService;
