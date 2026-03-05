/**
 * Retold Remote -- Orator Server Setup
 *
 * Composes an Orator server with:
 *   1. pict-section-filebrowser service for directory browsing
 *   2. Content static serving at /content/*
 *   3. Media service (thumbnails, probing, folder summaries)
 *   4. Static serving of the retold-remote web application
 *
 * This is intentionally a standalone server setup (not calling content-system's
 * server setup) so that we control all routes and avoid conflicts with editor-
 * specific endpoints (save, upload) that aren't needed here.
 *
 * Cache storage is managed by Parime's BinaryStorage with configurable
 * hash-based subfolder sharding to avoid huge flat directories.
 *
 * @param {object}   pOptions
 * @param {string}   pOptions.ContentPath          - Absolute path to the media folder to browse
 * @param {string}   pOptions.DistPath             - Absolute path to the built web-application folder
 * @param {number}   pOptions.Port                 - HTTP port
 * @param {boolean}  [pOptions.HashedFilenames]      - Enable hashed filenames mode
 * @param {string}   [pOptions.CacheRoot]            - Root cache directory (default: ./dist/retold-cache/)
 * @param {string}   [pOptions.CacheServer]          - URL to a remote parime cache server
 * @param {Function} fCallback                     - Callback(pError, { Fable, Orator, Port })
 */

const libFs = require('fs');
const libPath = require('path');
const libChildProcess = require('child_process');

const libFable = require('fable');
const libOrator = require('orator');
const libOratorServiceServerRestify = require('orator-serviceserver-restify');
const libFileBrowserService = require('pict-section-filebrowser').FileBrowserService;

const libParimeStorage = require('parime/storage');
const libRetoldRemoteParimeCache = require('../server/RetoldRemote-ParimeCache.js');

const libRetoldRemoteMediaService = require('../server/RetoldRemote-MediaService.js');
const libRetoldRemotePathRegistry = require('../server/RetoldRemote-PathRegistry.js');
const libRetoldRemoteArchiveService = require('../server/RetoldRemote-ArchiveService.js');
const libRetoldRemoteVideoFrameService = require('../server/RetoldRemote-VideoFrameService.js');
const libRetoldRemoteAudioWaveformService = require('../server/RetoldRemote-AudioWaveformService.js');
const libRetoldRemoteEbookService = require('../server/RetoldRemote-EbookService.js');
const libUrl = require('url');

function setupRetoldRemoteServer(pOptions, fCallback)
{
	let tmpContentPath = pOptions.ContentPath;
	let tmpDistFolder = pOptions.DistPath;
	let tmpPort = pOptions.Port;
	let tmpHashedFilenames = (pOptions.HashedFilenames !== false) && (process.env.RETOLD_HASHED_FILENAMES !== 'false');

	// --- Resolve cache root ---
	let tmpCacheRoot = pOptions.CacheRoot
		|| libPath.resolve(process.cwd(), 'dist', 'retold-cache');

	let tmpSettings =
	{
		Product: 'Retold-Remote',
		ProductVersion: require('../../package.json').version,
		APIServerPort: tmpPort,
		ContentPath: tmpContentPath,
		ParimeBinaryStorageRoot: tmpCacheRoot,
		ParimeBinarySharding:
		{
			Enabled: true,
			SegmentSize: 2,
			Depth: 4
		}
	};

	// If a remote cache server is specified, route cache operations over HTTP
	if (pOptions.CacheServer)
	{
		tmpSettings.ParimeCacheServer = pOptions.CacheServer;
	}

	let tmpFable = new libFable(tmpSettings);

	// Ensure the content directory exists
	if (!libFs.existsSync(tmpContentPath))
	{
		libFs.mkdirSync(tmpContentPath, { recursive: true });
	}

	tmpFable.serviceManager.addServiceType('OratorServiceServer', libOratorServiceServerRestify);
	tmpFable.serviceManager.instantiateServiceProvider('OratorServiceServer');
	tmpFable.serviceManager.addServiceType('Orator', libOrator);
	let tmpOrator = tmpFable.serviceManager.instantiateServiceProvider('Orator');

	// Set up the file browser service
	let tmpFileBrowser = new libFileBrowserService(tmpFable,
	{
		BasePath: tmpContentPath,
		APIRoutePrefix: '/api/filebrowser',
		ServeWebApp: false,
		IncludeHiddenFiles: false
	});

	// Set up the path registry (for hashed filenames)
	let tmpPathRegistry = new libRetoldRemotePathRegistry(tmpFable,
	{
		Enabled: tmpHashedFilenames
	});

	if (tmpHashedFilenames)
	{
		tmpFable.log.info('Hashed filenames mode: ENABLED');
	}

	// --- Initialize Parime storage ---
	tmpFable.serviceManager.addServiceType('ParimeStorage', libParimeStorage);
	let tmpParimeStorage = tmpFable.serviceManager.instantiateServiceProvider('ParimeStorage');

	tmpFable.serviceManager.addServiceType('RetoldRemoteParimeCache', libRetoldRemoteParimeCache);
	let tmpParimeCache = tmpFable.serviceManager.instantiateServiceProvider('RetoldRemoteParimeCache');

	tmpParimeStorage.initialize(
		(pStorageError) =>
		{
			if (pStorageError)
			{
				return fCallback(pStorageError);
			}

			tmpFable.log.info(`Cache storage: ${tmpParimeCache.isRemote ? 'REMOTE (' + pOptions.CacheServer + ')' : tmpCacheRoot}`);

			// Set up the archive service
			let tmpArchiveService = new libRetoldRemoteArchiveService(tmpFable,
			{
				ContentPath: tmpContentPath
			});

			// Set up the video frame service
			let tmpVideoFrameService = new libRetoldRemoteVideoFrameService(tmpFable,
			{
				ContentPath: tmpContentPath
			});

			// Set up the audio waveform service
			let tmpAudioWaveformService = new libRetoldRemoteAudioWaveformService(tmpFable,
			{
				ContentPath: tmpContentPath
			});

			// Set up the ebook conversion service
			let tmpEbookService = new libRetoldRemoteEbookService(tmpFable,
			{
				ContentPath: tmpContentPath
			});

			// Set up the media service
			let tmpMediaService = new libRetoldRemoteMediaService(tmpFable,
			{
				ContentPath: tmpContentPath,
				APIRoutePrefix: '/api/media',
				PathRegistry: tmpPathRegistry
			});

			tmpOrator.initialize(
		function ()
		{
			let tmpServiceServer = tmpOrator.serviceServer;

			// Enable body parsing
			tmpServiceServer.server.use(tmpServiceServer.bodyParser());

			// Hash resolution middleware: if hashed filenames is enabled,
			// intercept ?path= query params and resolve hashes to paths.
			if (tmpHashedFilenames)
			{
				let libUrlMiddleware = require('url');
				tmpServiceServer.server.use(
					(pRequest, pResponse, fNext) =>
					{
						let tmpParsedUrl = libUrlMiddleware.parse(pRequest.url, true);
						let tmpPathParam = tmpParsedUrl.query && tmpParsedUrl.query.path;
						if (tmpPathParam && /^[a-f0-9]{10}$/.test(tmpPathParam))
						{
							let tmpResolved = tmpPathRegistry.resolve(tmpPathParam);
							if (tmpResolved !== null)
							{
								// Replace the hash with the resolved path in the query
								tmpParsedUrl.query.path = tmpResolved;
								delete tmpParsedUrl.search;
								pRequest.url = libUrlMiddleware.format(tmpParsedUrl);
								if (pRequest.query)
								{
									pRequest.query.path = tmpResolved;
								}
							}
						}
						return fNext();
					});
			}

			// --- GET /api/remote/settings ---
			// Returns server settings so the client knows if hashed filenames is on.
			tmpServiceServer.get('/api/remote/settings',
				(pRequest, pResponse, fNext) =>
				{
					pResponse.send(
					{
						Success: true,
						HashedFilenames: tmpHashedFilenames,
						CacheStorage:
						{
							Root: tmpCacheRoot,
							Remote: tmpParimeCache.isRemote,
							Sharding: true
						},
						ArchiveSupport:
						{
							Enabled: true,
							Has7z: tmpArchiveService.has7z,
							NativeZipOnly: !tmpArchiveService.has7z,
							SupportedExtensions: tmpArchiveService.getSupportedExtensions()
						}
					});
					return fNext();
				});

			// Response annotation middleware: when hashed filenames is enabled,
			// wrap res.send for /api/filebrowser/list to annotate entries with hashes.
			if (tmpHashedFilenames)
			{
				let libUrlListWrap = require('url');
				tmpServiceServer.server.use(
					(pRequest, pResponse, fNext) =>
					{
						if (!pRequest.url.startsWith('/api/filebrowser/list'))
						{
							return fNext();
						}

						let tmpOriginalSend = pResponse.send.bind(pResponse);
						pResponse.send = function (pStatusOrData, pData)
						{
							let tmpFileList = (typeof (pStatusOrData) === 'number') ? pData : pStatusOrData;

							if (Array.isArray(tmpFileList))
							{
								// Annotate entries with hashes
								tmpPathRegistry.annotateFileList(tmpFileList);

								// Register the current folder path and set header
								let tmpParsedListUrl = libUrlListWrap.parse(pRequest.url, true);
								let tmpFolderPath = (tmpParsedListUrl.query && tmpParsedListUrl.query.path) || '';
								if (tmpFolderPath)
								{
									let tmpFolderHash = tmpPathRegistry.register(tmpFolderPath);
									pResponse.header('X-Retold-Folder-Hash', tmpFolderHash);
								}
							}

							return tmpOriginalSend(pStatusOrData, pData);
						};

						return fNext();
					});
			}

			// Archive annotation middleware: wrap /api/filebrowser/list responses to
			// change Type: 'file' to Type: 'archive' for entries with archive extensions.
			// This makes archive files appear as navigable containers to the client.
			tmpServiceServer.server.use(
				(pRequest, pResponse, fNext) =>
				{
					if (!pRequest.url.startsWith('/api/filebrowser/list'))
					{
						return fNext();
					}

					let tmpOriginalSendArchive = pResponse.send.bind(pResponse);
					let tmpSendWrapped = pResponse.send;

					// Wrap send — there may already be a wrapper from hashed filenames.
					// We chain on top of whatever send is currently set.
					let tmpPreviousSend = pResponse.send;
					pResponse.send = function (pStatusOrData, pData)
					{
						let tmpFileList = (typeof (pStatusOrData) === 'number') ? pData : pStatusOrData;

						if (Array.isArray(tmpFileList))
						{
							for (let i = 0; i < tmpFileList.length; i++)
							{
								let tmpEntry = tmpFileList[i];
								if (tmpEntry.Type === 'file' && tmpEntry.Extension)
								{
									if (tmpArchiveService.isArchiveFile(tmpEntry.Extension)
										&& tmpArchiveService.canHandle(tmpEntry.Extension))
									{
										tmpEntry.Type = 'archive';
									}
								}
							}
						}

						return tmpPreviousSend.call(pResponse, pStatusOrData, pData);
					};

					return fNext();
				});

			// Connect file browser API routes
			tmpFileBrowser.connectRoutes();

			// PUT /api/filebrowser/settings -- toggle hidden files at runtime
			tmpServiceServer.put('/api/filebrowser/settings',
				(pRequest, pResponse, fNext) =>
				{
					try
					{
						if (pRequest.body && typeof (pRequest.body.IncludeHiddenFiles) === 'boolean')
						{
							tmpFileBrowser.options.IncludeHiddenFiles = pRequest.body.IncludeHiddenFiles;
						}
						pResponse.send({ Success: true });
					}
					catch (pError)
					{
						pResponse.send(500, { Error: pError.message });
					}
					return fNext();
				});

			// Connect media service API routes
			tmpMediaService.connectRoutes(tmpServiceServer);

			// --- GET /api/media/video-frames ---
			// Extract evenly-spaced frames from a video for the Video Explorer.
			tmpServiceServer.get('/api/media/video-frames',
				(pRequest, pResponse, fNext) =>
				{
					try
					{
						let tmpParsedUrl = libUrl.parse(pRequest.url, true);
						let tmpQuery = tmpParsedUrl.query;
						let tmpRelPath = tmpQuery.path;

						if (!tmpRelPath || typeof (tmpRelPath) !== 'string')
						{
							pResponse.send(400, { Success: false, Error: 'Missing path parameter.' });
							return fNext();
						}

						// Sanitize
						tmpRelPath = decodeURIComponent(tmpRelPath).replace(/^\/+/, '');
						if (tmpRelPath.includes('..') || libPath.isAbsolute(tmpRelPath))
						{
							pResponse.send(400, { Success: false, Error: 'Invalid path.' });
							return fNext();
						}

						let tmpAbsPath = libPath.join(tmpContentPath, tmpRelPath);
						if (!libFs.existsSync(tmpAbsPath))
						{
							pResponse.send(404, { Success: false, Error: 'File not found.' });
							return fNext();
						}

						tmpVideoFrameService.extractFrames(tmpAbsPath, tmpRelPath,
						{
							count: tmpQuery.count,
							width: tmpQuery.width,
							height: tmpQuery.height,
							format: tmpQuery.format
						},
						(pError, pResult) =>
						{
							if (pError)
							{
								pResponse.send(400, { Success: false, Error: pError.message });
								return fNext();
							}

							pResponse.send(pResult);
							return fNext();
						});
					}
					catch (pError)
					{
						pResponse.send(500, { Success: false, Error: pError.message });
						return fNext();
					}
				});

			// --- GET /api/media/video-frame/:cacheKey/:filename ---
			// Serve a single cached video frame image.
			tmpServiceServer.get('/api/media/video-frame/:cacheKey/:filename',
				(pRequest, pResponse, fNext) =>
				{
					try
					{
						let tmpCacheKey = pRequest.params.cacheKey;
						let tmpFilename = pRequest.params.filename;

						let tmpFramePath = tmpVideoFrameService.getFramePath(tmpCacheKey, tmpFilename);

						if (!tmpFramePath)
						{
							pResponse.send(404, { Success: false, Error: 'Frame not found.' });
							return fNext();
						}

						let tmpStat = libFs.statSync(tmpFramePath);
						let tmpExt = libPath.extname(tmpFilename).toLowerCase();
						let tmpMimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
						let tmpMime = tmpMimeTypes[tmpExt] || 'image/jpeg';

						pResponse.writeHead(200,
						{
							'Content-Type': tmpMime,
							'Content-Length': tmpStat.size,
							'Cache-Control': 'public, max-age=86400'
						});

						let tmpStream = libFs.createReadStream(tmpFramePath);
						tmpStream.pipe(pResponse);
						tmpStream.on('end', () => { return fNext(false); });
						tmpStream.on('error', () =>
						{
							pResponse.send(500, { Error: 'Failed to serve frame.' });
							return fNext(false);
						});
					}
					catch (pError)
					{
						pResponse.send(500, { Success: false, Error: pError.message });
						return fNext();
					}
				});

			// --- GET /api/media/video-frame-at ---
			// Extract a single frame at an arbitrary timestamp (for timeline click).
			tmpServiceServer.get('/api/media/video-frame-at',
				(pRequest, pResponse, fNext) =>
				{
					try
					{
						let tmpParsedUrl = libUrl.parse(pRequest.url, true);
						let tmpQuery = tmpParsedUrl.query;
						let tmpRelPath = tmpQuery.path;
						let tmpCacheKey = tmpQuery.cacheKey;
						let tmpTimestamp = parseFloat(tmpQuery.timestamp);

						if (!tmpRelPath || typeof (tmpRelPath) !== 'string')
						{
							pResponse.send(400, { Success: false, Error: 'Missing path parameter.' });
							return fNext();
						}
						if (!tmpCacheKey || typeof (tmpCacheKey) !== 'string')
						{
							pResponse.send(400, { Success: false, Error: 'Missing cacheKey parameter.' });
							return fNext();
						}
						if (isNaN(tmpTimestamp) || tmpTimestamp < 0)
						{
							pResponse.send(400, { Success: false, Error: 'Invalid timestamp.' });
							return fNext();
						}

						// Sanitize
						tmpRelPath = decodeURIComponent(tmpRelPath).replace(/^\/+/, '');
						if (tmpRelPath.includes('..') || libPath.isAbsolute(tmpRelPath))
						{
							pResponse.send(400, { Success: false, Error: 'Invalid path.' });
							return fNext();
						}

						let tmpAbsPath = libPath.join(tmpContentPath, tmpRelPath);
						if (!libFs.existsSync(tmpAbsPath))
						{
							pResponse.send(404, { Success: false, Error: 'File not found.' });
							return fNext();
						}

						tmpVideoFrameService.extractSingleFrame(tmpAbsPath, tmpCacheKey, tmpTimestamp,
						{
							width: tmpQuery.width,
							height: tmpQuery.height,
							format: tmpQuery.format
						},
						(pError, pResult) =>
						{
							if (pError)
							{
								pResponse.send(400, { Success: false, Error: pError.message });
								return fNext();
							}

							pResponse.send(pResult);
							return fNext();
						});
					}
					catch (pError)
					{
						pResponse.send(500, { Success: false, Error: pError.message });
						return fNext();
					}
				});

			// --- GET /api/media/audio-waveform ---
			// Extract waveform peak data from an audio file for the Audio Explorer.
			tmpServiceServer.get('/api/media/audio-waveform',
				(pRequest, pResponse, fNext) =>
				{
					try
					{
						let tmpParsedUrl = libUrl.parse(pRequest.url, true);
						let tmpQuery = tmpParsedUrl.query;
						let tmpRelPath = tmpQuery.path;

						if (!tmpRelPath || typeof (tmpRelPath) !== 'string')
						{
							pResponse.send(400, { Success: false, Error: 'Missing path parameter.' });
							return fNext();
						}

						// Sanitize
						tmpRelPath = decodeURIComponent(tmpRelPath).replace(/^\/+/, '');
						if (tmpRelPath.includes('..') || libPath.isAbsolute(tmpRelPath))
						{
							pResponse.send(400, { Success: false, Error: 'Invalid path.' });
							return fNext();
						}

						let tmpAbsPath = libPath.join(tmpContentPath, tmpRelPath);
						if (!libFs.existsSync(tmpAbsPath))
						{
							pResponse.send(404, { Success: false, Error: 'File not found.' });
							return fNext();
						}

						tmpAudioWaveformService.extractWaveform(tmpAbsPath, tmpRelPath,
						{
							peaks: tmpQuery.peaks
						},
						(pError, pResult) =>
						{
							if (pError)
							{
								pResponse.send(400, { Success: false, Error: pError.message });
								return fNext();
							}

							pResponse.send(pResult);
							return fNext();
						});
					}
					catch (pError)
					{
						pResponse.send(500, { Success: false, Error: pError.message });
						return fNext();
					}
				});

			// --- GET /api/media/audio-segment ---
			// Extract an audio sub-clip for remote playback.
			tmpServiceServer.get('/api/media/audio-segment',
				(pRequest, pResponse, fNext) =>
				{
					try
					{
						let tmpParsedUrl = libUrl.parse(pRequest.url, true);
						let tmpQuery = tmpParsedUrl.query;
						let tmpRelPath = tmpQuery.path;

						if (!tmpRelPath || typeof (tmpRelPath) !== 'string')
						{
							pResponse.send(400, { Success: false, Error: 'Missing path parameter.' });
							return fNext();
						}

						// Sanitize
						tmpRelPath = decodeURIComponent(tmpRelPath).replace(/^\/+/, '');
						if (tmpRelPath.includes('..') || libPath.isAbsolute(tmpRelPath))
						{
							pResponse.send(400, { Success: false, Error: 'Invalid path.' });
							return fNext();
						}

						let tmpAbsPath = libPath.join(tmpContentPath, tmpRelPath);
						if (!libFs.existsSync(tmpAbsPath))
						{
							pResponse.send(404, { Success: false, Error: 'File not found.' });
							return fNext();
						}

						tmpAudioWaveformService.extractSegment(tmpAbsPath, tmpRelPath,
						{
							start: tmpQuery.start,
							end: tmpQuery.end,
							format: tmpQuery.format
						},
						(pError, pResult) =>
						{
							if (pError)
							{
								pResponse.send(400, { Success: false, Error: pError.message });
								return fNext();
							}

							// Stream the segment file back
							try
							{
								let tmpSegPath = pResult.SegmentPath;
								let tmpSegStat = libFs.statSync(tmpSegPath);
								let tmpMimeMap = { 'mp3': 'audio/mpeg', 'aac': 'audio/aac', 'ogg': 'audio/ogg', 'wav': 'audio/wav', 'flac': 'audio/flac' };
								let tmpMime = tmpMimeMap[pResult.Format] || 'audio/mpeg';

								pResponse.writeHead(200,
								{
									'Content-Type': tmpMime,
									'Content-Length': tmpSegStat.size,
									'Cache-Control': 'public, max-age=86400',
									'Content-Disposition': `inline; filename="segment_${pResult.Start.toFixed(0)}-${pResult.End.toFixed(0)}.${pResult.Format}"`
								});

								let tmpStream = libFs.createReadStream(tmpSegPath);
								tmpStream.pipe(pResponse);
								tmpStream.on('end', () => { return fNext(false); });
								tmpStream.on('error', () =>
								{
									pResponse.send(500, { Error: 'Failed to serve segment.' });
									return fNext(false);
								});
							}
							catch (pStreamError)
							{
								pResponse.send(500, { Success: false, Error: pStreamError.message });
								return fNext();
							}
						});
					}
					catch (pError)
					{
						pResponse.send(500, { Success: false, Error: pError.message });
						return fNext();
					}
				});

			// --- GET /api/media/ebook-convert ---
			// Convert an ebook (MOBI, AZW, etc.) to EPUB for in-browser reading.
			tmpServiceServer.get('/api/media/ebook-convert',
				(pRequest, pResponse, fNext) =>
				{
					try
					{
						let tmpParsedUrl = libUrl.parse(pRequest.url, true);
						let tmpQuery = tmpParsedUrl.query;
						let tmpRelPath = tmpQuery.path;

						if (!tmpRelPath || typeof (tmpRelPath) !== 'string')
						{
							pResponse.send(400, { Success: false, Error: 'Missing path parameter.' });
							return fNext();
						}

						// Sanitize
						tmpRelPath = decodeURIComponent(tmpRelPath).replace(/^\/+/, '');
						if (tmpRelPath.includes('..') || libPath.isAbsolute(tmpRelPath))
						{
							pResponse.send(400, { Success: false, Error: 'Invalid path.' });
							return fNext();
						}

						let tmpAbsPath = libPath.join(tmpContentPath, tmpRelPath);
						if (!libFs.existsSync(tmpAbsPath))
						{
							pResponse.send(404, { Success: false, Error: 'File not found.' });
							return fNext();
						}

						tmpEbookService.convertToEpub(tmpAbsPath, tmpRelPath,
						(pError, pResult) =>
						{
							if (pError)
							{
								pResponse.send(400, { Success: false, Error: pError.message });
								return fNext();
							}

							pResponse.send(pResult);
							return fNext();
						});
					}
					catch (pError)
					{
						pResponse.send(500, { Success: false, Error: pError.message });
						return fNext();
					}
				});

			// --- GET /api/media/ebook/:cacheKey/:filename ---
			// Serve a cached converted ebook file.
			tmpServiceServer.get('/api/media/ebook/:cacheKey/:filename',
				(pRequest, pResponse, fNext) =>
				{
					try
					{
						let tmpCacheKey = pRequest.params.cacheKey;
						let tmpFilename = pRequest.params.filename;

						let tmpEbookPath = tmpEbookService.getConvertedPath(tmpCacheKey, tmpFilename);

						if (!tmpEbookPath)
						{
							pResponse.send(404, { Success: false, Error: 'Ebook not found.' });
							return fNext();
						}

						let tmpStat = libFs.statSync(tmpEbookPath);

						pResponse.writeHead(200,
						{
							'Content-Type': 'application/epub+zip',
							'Content-Length': tmpStat.size,
							'Cache-Control': 'public, max-age=86400'
						});

						let tmpStream = libFs.createReadStream(tmpEbookPath);
						tmpStream.pipe(pResponse);
						tmpStream.on('end', () => { return fNext(false); });
						tmpStream.on('error', () =>
						{
							pResponse.send(500, { Error: 'Failed to serve ebook.' });
							return fNext(false);
						});
					}
					catch (pError)
					{
						pResponse.send(500, { Success: false, Error: pError.message });
						return fNext();
					}
				});

			// --- POST /api/media/open ---
			// Open a media file with an external application (e.g. VLC).
			tmpServiceServer.post('/api/media/open',
				(pRequest, pResponse, fNext) =>
				{
					try
					{
						let tmpBody = pRequest.body || {};
						let tmpRelPath = tmpBody.path;

						if (!tmpRelPath || typeof (tmpRelPath) !== 'string')
						{
							pResponse.send(400, { Success: false, Error: 'Missing or invalid path.' });
							return fNext();
						}

						// Sanitize: no absolute paths, no directory traversal
						if (tmpRelPath.indexOf('..') !== -1 || libPath.isAbsolute(tmpRelPath))
						{
							pResponse.send(400, { Success: false, Error: 'Invalid path.' });
							return fNext();
						}

						let tmpAbsPath = libPath.join(tmpContentPath, tmpRelPath);

						// Verify file exists
						if (!libFs.existsSync(tmpAbsPath))
						{
							pResponse.send(404, { Success: false, Error: 'File not found.' });
							return fNext();
						}

						// Determine the open command based on platform
						let tmpSpawnArgs;
						if (process.platform === 'darwin')
						{
							tmpSpawnArgs = ['open', ['-a', 'VLC', tmpAbsPath]];
						}
						else
						{
							tmpSpawnArgs = ['vlc', [tmpAbsPath]];
						}

						let tmpChild = libChildProcess.spawn(tmpSpawnArgs[0], tmpSpawnArgs[1],
						{
							detached: true,
							stdio: 'ignore'
						});
						tmpChild.unref();

						pResponse.send({ Success: true });
					}
					catch (pError)
					{
						pResponse.send(500, { Success: false, Error: pError.message });
					}
					return fNext();
				});

			// Content-hashed URL rewrite: resolve /content-hashed/<hash>
			// to /content/<resolved-path> so the static route serves the file.
			// Uses server.pre() to rewrite BEFORE route matching.
			if (tmpHashedFilenames)
			{
				tmpServiceServer.server.pre(
					(pRequest, pResponse, fNext) =>
					{
						let tmpMatch = /^\/content-hashed\/([a-f0-9]{10})$/.exec(pRequest.url);
						if (!tmpMatch)
						{
							return fNext();
						}

						let tmpHash = tmpMatch[1];
						let tmpResolvedPath = tmpPathRegistry.resolve(tmpHash);

						if (!tmpResolvedPath)
						{
							pResponse.send(404, { Error: 'Unknown hash.' });
							return fNext(false);
						}

						// Rewrite URL to /content/<path> before route matching
						pRequest.url = '/content/' + tmpResolvedPath;
						return fNext();
					});
			}

			// Archive file listing: intercept /api/filebrowser/list requests
			// where the path crosses into an archive.  Uses server.pre() to
			// respond before the normal file browser route handler.
			tmpServiceServer.server.pre(
				(pRequest, pResponse, fNext) =>
				{
					if (!pRequest.url.startsWith('/api/filebrowser/list'))
					{
						return fNext();
					}

					let tmpParsedUrl = libUrl.parse(pRequest.url, true);
					let tmpPathParam = (tmpParsedUrl.query && tmpParsedUrl.query.path) || '';

					// Resolve hash to path if hashed filenames is enabled
					// (server.pre runs before server.use middleware, so hash resolution hasn't happened yet)
					if (tmpHashedFilenames && /^[a-f0-9]{10}$/.test(tmpPathParam))
					{
						let tmpResolved = tmpPathRegistry.resolve(tmpPathParam);
						if (tmpResolved !== null)
						{
							tmpPathParam = tmpResolved;
						}
					}

					let tmpArchiveInfo = tmpArchiveService.parseArchivePath(tmpPathParam);

					if (!tmpArchiveInfo)
					{
						return fNext();
					}

					let tmpArchiveAbsPath = libPath.join(tmpContentPath, tmpArchiveInfo.archivePath);

					if (!libFs.existsSync(tmpArchiveAbsPath))
					{
						pResponse.send(404, { Error: 'Archive not found.' });
						return fNext(false);
					}

					tmpArchiveService.listContents(
						tmpArchiveAbsPath, tmpArchiveInfo.innerPath, tmpArchiveInfo.archivePath,
						(pError, pFileList) =>
						{
							if (pError)
							{
								pResponse.send(400, { Error: pError.message });
								return fNext(false);
							}

							// Annotate with hashes if enabled
							if (tmpHashedFilenames)
							{
								tmpPathRegistry.annotateFileList(pFileList);

								// Register the archive inner path as a folder
								let tmpFolderPath = tmpArchiveInfo.innerPath
									? (tmpArchiveInfo.archivePath + '/' + tmpArchiveInfo.innerPath)
									: tmpArchiveInfo.archivePath;
								let tmpFolderHash = tmpPathRegistry.register(tmpFolderPath);
								pResponse.header('X-Retold-Folder-Hash', tmpFolderHash);
							}

							pResponse.send(pFileList);
							return fNext(false);
						});
				});

			// Archive content serving: intercept /content/* requests that cross
			// into an archive.  Extracts the file to cache and streams it back.
			tmpServiceServer.server.pre(
				(pRequest, pResponse, fNext) =>
				{
					if (!pRequest.url.startsWith('/content/'))
					{
						return fNext();
					}

					let tmpRelPath = decodeURIComponent(pRequest.url.replace(/^\/content\//, ''));
					let tmpArchiveInfo = tmpArchiveService.parseArchivePath(tmpRelPath);

					if (!tmpArchiveInfo || !tmpArchiveInfo.innerPath)
					{
						return fNext();
					}

					let tmpArchiveAbsPath = libPath.join(tmpContentPath, tmpArchiveInfo.archivePath);

					tmpArchiveService.extractFile(
						tmpArchiveAbsPath, tmpArchiveInfo.innerPath,
						(pError, pCachedPath) =>
						{
							if (pError || !pCachedPath)
							{
								pResponse.send(404, { Error: 'Could not extract file from archive.' });
								return fNext(false);
							}

							// Stream the cached file
							try
							{
								let tmpStat = libFs.statSync(pCachedPath);
								let tmpExt = libPath.extname(pCachedPath).toLowerCase();
								let tmpMime = tmpArchiveService.getMimeType(tmpExt);

								pResponse.writeHead(200,
								{
									'Content-Type': tmpMime,
									'Content-Length': tmpStat.size,
									'Cache-Control': 'public, max-age=3600'
								});

								let tmpStream = libFs.createReadStream(pCachedPath);
								tmpStream.pipe(pResponse);
								tmpStream.on('end', () => { return fNext(false); });
								tmpStream.on('error', () =>
								{
									pResponse.send(500, { Error: 'Failed to serve extracted file.' });
									return fNext(false);
								});
							}
							catch (pStreamError)
							{
								pResponse.send(500, { Error: pStreamError.message });
								return fNext(false);
							}
						});
				});

			// Archive-aware thumbnail/probe: intercept /api/media/thumbnail and
			// /api/media/probe requests for files inside archives.  Extracts the
			// file to cache first, then rewrites the URL to point at the cached
			// copy so the normal MediaService handler processes it.
			tmpServiceServer.server.pre(
				(pRequest, pResponse, fNext) =>
				{
					if (!pRequest.url.startsWith('/api/media/thumbnail')
						&& !pRequest.url.startsWith('/api/media/probe'))
					{
						return fNext();
					}

					let tmpParsedUrl = libUrl.parse(pRequest.url, true);
					let tmpPathParam = (tmpParsedUrl.query && tmpParsedUrl.query.path) || '';

					// Resolve hash to path if hashed filenames is enabled
					if (tmpHashedFilenames && /^[a-f0-9]{10}$/.test(tmpPathParam))
					{
						let tmpResolved = tmpPathRegistry.resolve(tmpPathParam);
						if (tmpResolved !== null)
						{
							tmpPathParam = tmpResolved;
						}
					}

					let tmpArchiveInfo = tmpArchiveService.parseArchivePath(tmpPathParam);

					if (!tmpArchiveInfo || !tmpArchiveInfo.innerPath)
					{
						return fNext();
					}

					let tmpArchiveAbsPath = libPath.join(tmpContentPath, tmpArchiveInfo.archivePath);

					tmpArchiveService.extractFile(
						tmpArchiveAbsPath, tmpArchiveInfo.innerPath,
						(pError, pCachedPath) =>
						{
							if (pError || !pCachedPath)
							{
								pResponse.send(404, { Error: 'Could not extract file from archive.' });
								return fNext(false);
							}

							// Rewrite the path query param to point at the cached file
							// relative to the content root.  The MediaService resolves
							// paths relative to ContentPath, so we need to compute the
							// relative path from contentPath to the cached file.
							let tmpRelCached = libPath.relative(tmpContentPath, pCachedPath);

							tmpParsedUrl.query.path = tmpRelCached;
							delete tmpParsedUrl.search;
							pRequest.url = libUrl.format(tmpParsedUrl);
							if (pRequest.query)
							{
								pRequest.query.path = tmpRelCached;
							}

							return fNext();
						});
				});

			// Serve content files at /content/ (for direct media access)
			tmpOrator.addStaticRoute(`${tmpContentPath}/`, 'index.html', '/content/*', '/content/');

			// Serve the built web application (main static route)
			tmpOrator.addStaticRoute(`${tmpDistFolder}/`, 'index.html');

			// Start the server
			tmpOrator.startService(
				function ()
				{
					return fCallback(null,
					{
						Fable: tmpFable,
						Orator: tmpOrator,
						MediaService: tmpMediaService,
						ArchiveService: tmpArchiveService,
						VideoFrameService: tmpVideoFrameService,
						AudioWaveformService: tmpAudioWaveformService,
						PathRegistry: tmpPathRegistry,
						ParimeCache: tmpParimeCache,
						Port: tmpPort
					});
				});
		});
	});
}

module.exports = setupRetoldRemoteServer;
