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
 * @param {object}   pOptions
 * @param {string}   pOptions.ContentPath        - Absolute path to the media folder to browse
 * @param {string}   pOptions.DistPath           - Absolute path to the built web-application folder
 * @param {number}   pOptions.Port               - HTTP port
 * @param {string}   [pOptions.ThumbnailCachePath] - Override thumbnail cache location
 * @param {boolean}  [pOptions.HashedFilenames]    - Enable hashed filenames mode
 * @param {Function} fCallback                   - Callback(pError, { Fable, Orator, Port })
 */

const libFs = require('fs');
const libPath = require('path');

const libFable = require('fable');
const libOrator = require('orator');
const libOratorServiceServerRestify = require('orator-serviceserver-restify');
const libFileBrowserService = require('pict-section-filebrowser').FileBrowserService;

const libRetoldRemoteMediaService = require('../server/RetoldRemote-MediaService.js');
const libRetoldRemotePathRegistry = require('../server/RetoldRemote-PathRegistry.js');

function setupRetoldRemoteServer(pOptions, fCallback)
{
	let tmpContentPath = pOptions.ContentPath;
	let tmpDistFolder = pOptions.DistPath;
	let tmpPort = pOptions.Port;
	let tmpHashedFilenames = !!(pOptions.HashedFilenames || process.env.RETOLD_HASHED_FILENAMES === 'true');

	let tmpSettings =
	{
		Product: 'Retold-Remote',
		ProductVersion: require('../../package.json').version,
		APIServerPort: tmpPort,
		ContentPath: tmpContentPath
	};

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

	// Set up the media service
	let tmpMediaService = new libRetoldRemoteMediaService(tmpFable,
	{
		ContentPath: tmpContentPath,
		ThumbnailCachePath: pOptions.ThumbnailCachePath || null,
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
						HashedFilenames: tmpHashedFilenames
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
						PathRegistry: tmpPathRegistry,
						Port: tmpPort
					});
				});
		});
}

module.exports = setupRetoldRemoteServer;
