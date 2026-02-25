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

const _ImageExtensions = { 'png': true, 'jpg': true, 'jpeg': true, 'gif': true, 'webp': true, 'svg': true, 'bmp': true, 'ico': true, 'avif': true, 'tiff': true, 'tif': true, 'heic': true, 'heif': true };
const _VideoExtensions = { 'mp4': true, 'webm': true, 'mov': true, 'mkv': true, 'avi': true, 'wmv': true, 'flv': true, 'm4v': true, 'ogv': true };
const _AudioExtensions = { 'mp3': true, 'wav': true, 'ogg': true, 'flac': true, 'aac': true, 'm4a': true, 'wma': true, 'oga': true };
const _DocumentExtensions = { 'pdf': true, 'epub': true, 'mobi': true, 'doc': true, 'docx': true };

const _DefaultServiceConfiguration =
{
	"ContentPath": ".",
	"ThumbnailCachePath": null,
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

		let tmpCachePath = this.options.ThumbnailCachePath
			|| libPath.join(process.cwd(), 'dist', 'retold-cache', 'thumbnails');

		this.toolDetector = new libToolDetector();
		this.capabilities = this.toolDetector.detect();
		this.thumbnailCache = new libThumbnailCache(tmpCachePath);
		this.pathRegistry = this.options.PathRegistry || null;

		this.fable.log.info(`Media Service: capabilities = ${JSON.stringify(this.capabilities)}`);
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
		if (_ImageExtensions[pExtension]) return 'image';
		if (_VideoExtensions[pExtension]) return 'video';
		if (_AudioExtensions[pExtension]) return 'audio';
		if (_DocumentExtensions[pExtension]) return 'document';
		return 'other';
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
								}
								pResponse.send(tmpProbe);
								return fNext();
							});
						return;
					}

					// Try sharp for image metadata
					if (tmpCategory === 'image' && tmpSelf.capabilities.sharp)
					{
						try
						{
							let tmpSharp = require('sharp');
							tmpSharp(tmpFullPath).metadata()
								.then((pMetadata) =>
								{
									tmpProbe.Width = pMetadata.width;
									tmpProbe.Height = pMetadata.height;
									tmpProbe.Format = pMetadata.format;
									tmpProbe.Space = pMetadata.space;
									tmpProbe.HasAlpha = pMetadata.hasAlpha;
									pResponse.send(tmpProbe);
									return fNext();
								})
								.catch(() =>
								{
									pResponse.send(tmpProbe);
									return fNext();
								});
							return;
						}
						catch (pErr)
						{
							// sharp not available after all
						}
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
	 */
	_generateImageThumbnail(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		// Try sharp first
		if (this.capabilities.sharp)
		{
			try
			{
				let tmpSharp = require('sharp');
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
	 * Generate a video thumbnail by extracting a frame with ffmpeg.
	 */
	_generateVideoThumbnail(pFullPath, pWidth, pHeight, pFormat, fCallback)
	{
		try
		{
			let tmpOutputFormat = pFormat === 'webp' ? 'webp' : 'mjpeg';
			// Extract a frame at 10% into the video
			let tmpCmd = `ffmpeg -ss 00:00:02 -i "${pFullPath}" -vframes 1 -vf "scale=${pWidth}:${pHeight}:force_original_aspect_ratio=decrease" -f image2 -c:v ${tmpOutputFormat} pipe:1`;
			let tmpBuffer = libChildProcess.execSync(tmpCmd, { maxBuffer: 10 * 1024 * 1024, timeout: 30000 });
			return fCallback(null, tmpBuffer);
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	/**
	 * Run ffprobe and parse the output.
	 */
	_ffprobe(pFullPath, fCallback)
	{
		try
		{
			let tmpCmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${pFullPath}"`;
			let tmpOutput = libChildProcess.execSync(tmpCmd, { maxBuffer: 1024 * 1024, timeout: 10000 });
			let tmpData = JSON.parse(tmpOutput.toString());

			let tmpResult = {};

			if (tmpData.format)
			{
				tmpResult.duration = parseFloat(tmpData.format.duration) || null;
				tmpResult.bitrate = parseInt(tmpData.format.bit_rate, 10) || null;
			}

			// Find video stream for dimensions
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
					if (tmpStream.codec_type === 'audio' && !tmpResult.codec)
					{
						tmpResult.codec = tmpStream.codec_name;
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

module.exports = RetoldRemoteMediaService;
