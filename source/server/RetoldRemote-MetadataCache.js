/**
 * Retold Remote -- Metadata Cache
 *
 * Wraps ffprobe/exifr/pdf-parse calls with a Parime BinaryStorage cache
 * layer so that file metadata (duration, codec, dimensions, EXIF, GPS,
 * ID3/format tags, PDF info, MD5, etc.) is extracted once and served
 * from cache on subsequent requests.
 *
 * Cache key: SHA-256 of "metadata:{relativePath}:{mtimeMs}" truncated
 * to 16 hex chars.  Invalidation is mtime-based -- if the source file
 * is modified, the stale entry is automatically bypassed and replaced.
 *
 * Storage category: "file-extended-metadata" in ParimeBinaryStorage.
 *
 * API:
 *   getMetadata(pRelPath, fCallback)
 *     -> { Path, FileSize, Modified, Category, Extension, MD5, ...
 *          Tags, Video, Audio, Image, Document, Chapters }
 *
 *   getMetadataBatch(pRelPaths, fCallback)
 *     -> [ metadata, metadata, ... ]
 *
 *   checkCached(pRelPath, fCallback)
 *     -> cached metadata if available, or { Success: false, Cached: false }
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

const CACHE_CATEGORY = 'file-extended-metadata';

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

		// Detect tool availability
		this.hasFfprobe = this._detectCommand('ffprobe -version');
		this.hasExifr = this._detectModule('exifr');
		this.hasPdfParse = this._detectModule('pdf-parse');
		// Sharp is set via setSharpModule() from the centrally-verified instance
		this.hasSharp = false;
		this._sharpModule = null;

		this.fable.log.info(`Metadata Cache: using ParimeBinaryStorage (category: ${CACHE_CATEGORY})`);
		this.fable.log.info(`  ffprobe: ${this.hasFfprobe ? 'available' : 'not found'}`);
		this.fable.log.info(`  exifr: ${this.hasExifr ? 'available' : 'not found'}`);
		this.fable.log.info(`  pdf-parse: ${this.hasPdfParse ? 'available' : 'not found'}`);
		this.fable.log.info(`  sharp: deferred (set via setSharpModule)`);
	}

	/**
	 * Set the centrally-verified sharp module reference.
	 * Called from Server-Setup after ToolDetector has validated sharp.
	 *
	 * @param {function} pSharpModule - The working sharp function, or null
	 */
	setSharpModule(pSharpModule)
	{
		if (pSharpModule)
		{
			this._sharpModule = pSharpModule;
			this.hasSharp = true;
			this.fable.log.info('Metadata Cache: sharp module set (available)');
		}
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
	 * Check if a Node module is available.
	 *
	 * @param {string} pModuleName
	 * @returns {boolean}
	 */
	_detectModule(pModuleName)
	{
		try
		{
			require(pModuleName);
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
	 * the file has not been modified; otherwise probes and caches
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
	 * Check if metadata is cached for a file without triggering extraction.
	 *
	 * @param {string} pRelPath - Path relative to the content root
	 * @param {function} fCallback - Callback(pError, pResult)
	 */
	checkCached(pRelPath, fCallback)
	{
		try
		{
			let tmpAbsPath = libPath.join(this.contentPath, pRelPath);

			if (!libFs.existsSync(tmpAbsPath))
			{
				return fCallback(new Error('File not found: ' + pRelPath));
			}

			let tmpStat = libFs.statSync(tmpAbsPath);
			let tmpCacheKey = this._buildCacheKey(pRelPath, tmpStat.mtimeMs);

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
							// Corrupted entry
						}
					}

					// Not cached
					return fCallback(null,
					{
						Success: false,
						Cached: false,
						Path: pRelPath
					});
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

	// ---------------------------------------------------------------
	// Probing and caching
	// ---------------------------------------------------------------

	/**
	 * Probe a file for metadata, build the extended record, cache it,
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
			Created: pStat.birthtime.toISOString(),
			Category: tmpCategory,
			Extension: tmpExtension,

			// File hashes and signatures
			MD5: null,
			MagicBytes: null,
			TailBytes: null,

			// Format-level (populated by ffprobe for video/audio)
			FormatName: null,
			Duration: null,
			Bitrate: null,

			// Tags (populated by ffprobe for video/audio)
			Tags: {},

			// Video stream (null if absent)
			Video: null,

			// Audio stream (null if absent)
			Audio: null,

			// Chapters (populated by ffprobe)
			Chapters: [],

			// Image metadata (null if not an image)
			Image: null,

			// Document metadata (null if not a document)
			Document: null,

			// Timestamp
			CachedAt: new Date().toISOString()
		};

		// Step 1: Compute MD5 hash
		tmpSelf._computeMD5(pAbsPath,
			(pMD5) =>
			{
				tmpMetadata.MD5 = pMD5;

				// Step 2: Read magic bytes and tail bytes
				tmpMetadata.MagicBytes = tmpSelf._readHeadBytes(pAbsPath, 100);
				tmpMetadata.TailBytes = tmpSelf._readTailBytes(pAbsPath, 100);

				// Step 3: Category-specific probing
				if ((tmpCategory === 'video' || tmpCategory === 'audio') && tmpSelf.hasFfprobe)
				{
					tmpSelf._probe(pAbsPath,
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
								tmpMetadata.Chapters = pProbeData.chapters || [];
							}

							tmpSelf._writeCache(pCacheKey, tmpMetadata, fCallback);
						});
				}
				else if (tmpCategory === 'image')
				{
					tmpSelf._probeImage(pAbsPath,
						(pImageError, pImageData) =>
						{
							if (!pImageError && pImageData)
							{
								tmpMetadata.Image = pImageData;
							}

							tmpSelf._writeCache(pCacheKey, tmpMetadata, fCallback);
						});
				}
				else if (tmpCategory === 'document' && tmpExtension === 'pdf')
				{
					tmpSelf._probePDF(pAbsPath,
						(pPDFError, pPDFData) =>
						{
							if (!pPDFError && pPDFData)
							{
								tmpMetadata.Document = pPDFData;
							}

							tmpSelf._writeCache(pCacheKey, tmpMetadata, fCallback);
						});
				}
				else
				{
					// Non-probeable file; cache basic stat + hash data
					tmpSelf._writeCache(pCacheKey, tmpMetadata, fCallback);
				}
			});
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

	// ---------------------------------------------------------------
	// Hash and byte extraction helpers
	// ---------------------------------------------------------------

	/**
	 * Compute MD5 hash of a file using streaming reads.
	 *
	 * @param {string} pAbsPath - Absolute path to file
	 * @param {function} fCallback - Callback(pMD5HexOrNull)
	 * @private
	 */
	_computeMD5(pAbsPath, fCallback)
	{
		try
		{
			let tmpHash = libCrypto.createHash('md5');
			let tmpStream = libFs.createReadStream(pAbsPath);

			tmpStream.on('data', (pChunk) =>
			{
				tmpHash.update(pChunk);
			});

			tmpStream.on('end', () =>
			{
				return fCallback(tmpHash.digest('hex'));
			});

			tmpStream.on('error', (pError) =>
			{
				this.fable.log.warn(`MD5 compute error for ${pAbsPath}: ${pError.message}`);
				return fCallback(null);
			});
		}
		catch (pError)
		{
			this.fable.log.warn(`MD5 compute error for ${pAbsPath}: ${pError.message}`);
			return fCallback(null);
		}
	}

	/**
	 * Read the first N bytes of a file.
	 *
	 * @param {string} pAbsPath - Absolute path to file
	 * @param {number} pCount - Number of bytes to read
	 * @returns {string|null} Hex-encoded bytes or null on error
	 * @private
	 */
	_readHeadBytes(pAbsPath, pCount)
	{
		try
		{
			let tmpFd = libFs.openSync(pAbsPath, 'r');
			let tmpStat = libFs.fstatSync(tmpFd);
			let tmpLen = Math.min(pCount, tmpStat.size);
			let tmpBuf = Buffer.alloc(tmpLen);
			libFs.readSync(tmpFd, tmpBuf, 0, tmpLen, 0);
			libFs.closeSync(tmpFd);
			return tmpBuf.toString('hex');
		}
		catch (pError)
		{
			return null;
		}
	}

	/**
	 * Read the last N bytes of a file.
	 *
	 * @param {string} pAbsPath - Absolute path to file
	 * @param {number} pCount - Number of bytes to read
	 * @returns {string|null} Hex-encoded bytes or null on error
	 * @private
	 */
	_readTailBytes(pAbsPath, pCount)
	{
		try
		{
			let tmpFd = libFs.openSync(pAbsPath, 'r');
			let tmpStat = libFs.fstatSync(tmpFd);
			let tmpLen = Math.min(pCount, tmpStat.size);
			let tmpOffset = tmpStat.size - tmpLen;
			let tmpBuf = Buffer.alloc(tmpLen);
			libFs.readSync(tmpFd, tmpBuf, 0, tmpLen, tmpOffset);
			libFs.closeSync(tmpFd);
			return tmpBuf.toString('hex');
		}
		catch (pError)
		{
			return null;
		}
	}

	// ---------------------------------------------------------------
	// ffprobe (video / audio)
	// ---------------------------------------------------------------

	/**
	 * Run ffprobe and parse the full output including format tags,
	 * all stream details, and chapters.
	 *
	 * @param {string} pAbsPath - Absolute path to the file
	 * @param {function} fCallback - Callback(pError, pResult)
	 * @private
	 */
	_probe(pAbsPath, fCallback)
	{
		try
		{
			let tmpCmd = `ffprobe -v quiet -print_format json -show_format -show_streams -show_chapters "${pAbsPath}"`;
			let tmpOutput = libChildProcess.execSync(tmpCmd, { maxBuffer: 2 * 1024 * 1024, timeout: 30000 });
			let tmpData = JSON.parse(tmpOutput.toString());

			let tmpResult =
			{
				formatName: null,
				duration: null,
				bitrate: null,
				tags: {},
				video: null,
				audio: null,
				chapters: []
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
							Profile: tmpStream.profile || null,
							Level: tmpStream.level || null,
							Width: tmpStream.width || null,
							Height: tmpStream.height || null,
							FrameRate: tmpStream.r_frame_rate || tmpStream.avg_frame_rate || null,
							PixelFormat: tmpStream.pix_fmt || null,
							ColorSpace: tmpStream.color_space || null,
							ColorRange: tmpStream.color_range || null,
							Bitrate: parseInt(tmpStream.bit_rate, 10) || null
						};
					}
					else if (tmpStream.codec_type === 'audio' && !tmpResult.audio)
					{
						tmpResult.audio =
						{
							Codec: tmpStream.codec_name || null,
							Profile: tmpStream.profile || null,
							SampleRate: parseInt(tmpStream.sample_rate, 10) || null,
							Channels: tmpStream.channels || null,
							ChannelLayout: tmpStream.channel_layout || null,
							Bitrate: parseInt(tmpStream.bit_rate, 10) || null,
							BitsPerSample: parseInt(tmpStream.bits_per_raw_sample, 10) || null
						};
					}
				}
			}

			// Parse chapters
			if (tmpData.chapters && tmpData.chapters.length > 0)
			{
				for (let c = 0; c < tmpData.chapters.length; c++)
				{
					let tmpChapter = tmpData.chapters[c];
					tmpResult.chapters.push(
					{
						Id: tmpChapter.id,
						StartTime: parseFloat(tmpChapter.start_time) || 0,
						EndTime: parseFloat(tmpChapter.end_time) || 0,
						Title: (tmpChapter.tags && tmpChapter.tags.title) || `Chapter ${tmpChapter.id + 1}`
					});
				}
			}

			return fCallback(null, tmpResult);
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	// ---------------------------------------------------------------
	// Image EXIF / GPS
	// ---------------------------------------------------------------

	/**
	 * Probe an image file for EXIF, GPS, and dimension metadata.
	 *
	 * @param {string} pAbsPath - Absolute path to the image
	 * @param {function} fCallback - Callback(pError, pImageData)
	 * @private
	 */
	_probeImage(pAbsPath, fCallback)
	{
		let tmpImageData =
		{
			Width: null,
			Height: null,
			Format: null,
			Space: null,
			HasAlpha: null,
			DPI: null,
			EXIF: null,
			GPS: null
		};

		let tmpSelf = this;

		// Try sharp first for basic dimensions
		let tmpSharpDone = false;

		function _afterSharp()
		{
			if (tmpSharpDone)
			{
				return;
			}
			tmpSharpDone = true;

			// Then try exifr for comprehensive EXIF + GPS
			if (tmpSelf.hasExifr)
			{
				try
				{
					let tmpExifr = require('exifr');
					tmpExifr.parse(pAbsPath,
					{
						tiff: true,
						exif: true,
						gps: true,
						ifd1: true,
						iptc: true,
						xmp: true,
						translateKeys: true,
						translateValues: true,
						reviveValues: true,
						mergeOutput: true
					})
					.then((pExifData) =>
					{
						if (pExifData)
						{
							// Fill in dimensions from EXIF if sharp didn't provide them
							if (!tmpImageData.Width && (pExifData.ImageWidth || pExifData.ExifImageWidth))
							{
								tmpImageData.Width = pExifData.ImageWidth || pExifData.ExifImageWidth;
							}
							if (!tmpImageData.Height && (pExifData.ImageHeight || pExifData.ExifImageHeight))
							{
								tmpImageData.Height = pExifData.ImageHeight || pExifData.ExifImageHeight;
							}

							tmpImageData.EXIF =
							{
								Make: pExifData.Make || null,
								Model: pExifData.Model || null,
								LensModel: pExifData.LensModel || null,
								Software: pExifData.Software || null,
								ExposureTime: pExifData.ExposureTime || null,
								FNumber: pExifData.FNumber || null,
								ISO: pExifData.ISO || null,
								FocalLength: pExifData.FocalLength || null,
								DateTimeOriginal: pExifData.DateTimeOriginal
									? (pExifData.DateTimeOriginal instanceof Date
										? pExifData.DateTimeOriginal.toISOString()
										: String(pExifData.DateTimeOriginal))
									: null,
								Orientation: pExifData.Orientation || null,
								ColorSpace: pExifData.ColorSpace || null,
								WhiteBalance: pExifData.WhiteBalance || null,
								Flash: pExifData.Flash || null
							};

							// GPS
							if (pExifData.latitude !== undefined && pExifData.longitude !== undefined)
							{
								tmpImageData.GPS =
								{
									Latitude: pExifData.latitude,
									Longitude: pExifData.longitude,
									Altitude: pExifData.GPSAltitude || null
								};
							}
						}

						return fCallback(null, tmpImageData);
					})
					.catch((pExifError) =>
					{
						// EXIF parse failed, still return what we have
						tmpSelf.fable.log.trace(`EXIF parse failed for ${pAbsPath}: ${pExifError.message}`);
						return fCallback(null, tmpImageData);
					});
				}
				catch (pError)
				{
					return fCallback(null, tmpImageData);
				}
			}
			else
			{
				return fCallback(null, tmpImageData);
			}
		}

		if (this.hasSharp && this._sharpModule)
		{
			try
			{
				this._sharpModule(pAbsPath).metadata()
					.then((pMeta) =>
					{
						tmpImageData.Width = pMeta.width || null;
						tmpImageData.Height = pMeta.height || null;
						tmpImageData.Format = pMeta.format || null;
						tmpImageData.Space = pMeta.space || null;
						tmpImageData.HasAlpha = pMeta.hasAlpha || false;
						tmpImageData.DPI = pMeta.density || null;
						_afterSharp();
					})
					.catch(() =>
					{
						_afterSharp();
					});
				return;
			}
			catch (pError)
			{
				// sharp not available after all
			}
		}

		_afterSharp();
	}

	// ---------------------------------------------------------------
	// PDF metadata
	// ---------------------------------------------------------------

	/**
	 * Probe a PDF file for metadata.
	 *
	 * @param {string} pAbsPath - Absolute path to the PDF
	 * @param {function} fCallback - Callback(pError, pDocumentData)
	 * @private
	 */
	_probePDF(pAbsPath, fCallback)
	{
		if (!this.hasPdfParse)
		{
			return fCallback(null, null);
		}

		try
		{
			// pdf-parse v2.x exports a PDFParse class with async getInfo().
			// (v1.x used a default async function — that API is gone.)
			let tmpPdfParseModule = require('pdf-parse');
			let tmpPDFParseClass = tmpPdfParseModule.PDFParse;
			if (typeof tmpPDFParseClass !== 'function')
			{
				this.fable.log.warn(`pdf-parse module does not export PDFParse class. PDF metadata disabled.`);
				return fCallback(null, null);
			}

			let tmpBuffer = libFs.readFileSync(pAbsPath);
			let tmpParser = new tmpPDFParseClass({ data: tmpBuffer });
			let tmpSelf = this;

			tmpParser.getInfo()
				.then((pData) =>
				{
					let tmpDocData =
					{
						PageCount: (pData && typeof pData.total === 'number') ? pData.total : null,
						Title: null,
						Author: null,
						Subject: null,
						Keywords: null,
						Creator: null,
						Producer: null,
						CreatedDate: null,
						ModifiedDate: null
					};

					// pdf-parse v2: pData.info is the document info dict
					if (pData && pData.info)
					{
						tmpDocData.Title = pData.info.Title || null;
						tmpDocData.Author = pData.info.Author || null;
						tmpDocData.Subject = pData.info.Subject || null;
						tmpDocData.Keywords = pData.info.Keywords || null;
						tmpDocData.Creator = pData.info.Creator || null;
						tmpDocData.Producer = pData.info.Producer || null;
						tmpDocData.CreatedDate = pData.info.CreationDate || null;
						tmpDocData.ModifiedDate = pData.info.ModDate || null;
					}

					if (typeof tmpParser.destroy === 'function')
					{
						tmpParser.destroy().catch(() => { /* ignore */ });
					}
					return fCallback(null, tmpDocData);
				})
				.catch((pError) =>
				{
					if (typeof tmpParser.destroy === 'function')
					{
						tmpParser.destroy().catch(() => { /* ignore */ });
					}
					tmpSelf.fable.log.warn(`PDF parse error for ${pAbsPath}: ${pError.message}`);
					return fCallback(null, null);
				});
		}
		catch (pError)
		{
			this.fable.log.warn(`PDF parse error for ${pAbsPath}: ${pError.message}`);
			return fCallback(null, null);
		}
	}
}

module.exports = RetoldRemoteMetadataCache;
