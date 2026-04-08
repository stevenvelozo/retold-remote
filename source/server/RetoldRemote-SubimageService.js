/**
 * Retold Remote -- Region Service
 *
 * Stores and retrieves labeled regions for any file type: images,
 * EPUB ebooks, PDF documents, CBZ/CBR comic pages. Each file can
 * have multiple named regions that are persisted in Bibliograph.
 *
 * Region types:
 *   - visual-region: rectangular crop area (X, Y, Width, Height)
 *   - text-selection: captured text with location (CFI, PageNumber, SelectedText)
 *
 * Handles archive subfile paths (e.g. "comic.cbz/page001.jpg") by
 * resolving to the archive file for existence checks and mtime keys.
 *
 * API:
 *   GET    /api/media/subimage-regions?path=     — List regions for a file
 *   POST   /api/media/subimage-regions           — Add a region
 *   PUT    /api/media/subimage-regions/:id       — Update a region
 *   DELETE /api/media/subimage-regions/:id       — Remove a region
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');
const libUrl = require('url');

const libExplorerStateMixin = require('./RetoldRemote-ExplorerStateMixin');

const SUBIMAGE_SOURCE = 'retold-remote-subimage-regions';

const _DefaultServiceConfiguration =
{
	"ContentPath": "."
};

class RetoldRemoteSubimageService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteSubimageService';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		// Sharp module reference (set by Server-Setup via setSharpModule)
		this._sharp = null;

		// In-memory cache for the folder-scoped region listing (Part D).
		// null means "not populated"; an array means "populated with all
		// file records". Mutations invalidate this via _invalidateFolderCache.
		this._folderCache = null;

		// Apply explorer state persistence mixin for the Bibliograph source
		libExplorerStateMixin.apply(this, SUBIMAGE_SOURCE, 'subimage');

		this.fable.log.info('Subimage Region Service: regions stored in Bibliograph');
	}

	/**
	 * Set the sharp module reference for thumbnail generation.
	 *
	 * @param {object} pSharp - The sharp module
	 */
	setSharpModule(pSharp)
	{
		this._sharp = pSharp;
	}

	// Regex to detect archive extensions within a path
	static get ARCHIVE_PATH_PATTERN()
	{
		return /^(.*?\.(zip|7z|rar|tar|tgz|cbz|cbr|tar\.gz|tar\.bz2|tar\.xz))\//i;
	}

	/**
	 * Validate and sanitize a relative path.
	 *
	 * @param {string} pRelPath - Relative path
	 * @returns {string|null} Sanitized path or null if invalid
	 */
	_sanitizePath(pRelPath)
	{
		if (!pRelPath || typeof pRelPath !== 'string')
		{
			return null;
		}
		let tmpClean = pRelPath.replace(/^\/+/, '');
		if (tmpClean.includes('..') || libPath.isAbsolute(tmpClean))
		{
			return null;
		}
		return tmpClean;
	}

	/**
	 * Resolve a file path to an absolute path and stat, handling archive subfiles.
	 * For paths like "comics/batman.cbz/page001.jpg", the file doesn't exist on disk
	 * (it's extracted on the fly), so we resolve to the archive file itself.
	 *
	 * @param {string} pRelPath - Relative file path
	 * @returns {object|null} { absPath, stat } or null if not found
	 */
	_resolveFileStat(pRelPath)
	{
		let tmpAbsPath = libPath.join(this.contentPath, pRelPath);

		// Try direct file first
		if (libFs.existsSync(tmpAbsPath))
		{
			return { absPath: tmpAbsPath, stat: libFs.statSync(tmpAbsPath) };
		}

		// Check if this is an archive subfile path
		let tmpArchiveMatch = pRelPath.match(RetoldRemoteSubimageService.ARCHIVE_PATH_PATTERN);
		if (tmpArchiveMatch)
		{
			let tmpArchivePath = libPath.join(this.contentPath, tmpArchiveMatch[1]);
			if (libFs.existsSync(tmpArchivePath))
			{
				return { absPath: tmpArchivePath, stat: libFs.statSync(tmpArchivePath) };
			}
		}

		return null;
	}

	/**
	 * Load the regions record for a file, creating an empty one if none exists.
	 *
	 * @param {string}   pRelPath  - Relative file path
	 * @param {number}   pMtimeMs  - File modification time in ms
	 * @param {Function} fCallback - Callback(pError, pRecord)
	 */
	_loadOrCreateRecord(pRelPath, pMtimeMs, fCallback)
	{
		this.loadExplorerState(pRelPath, pMtimeMs,
			(pError, pRecord) =>
			{
				if (pError)
				{
					return fCallback(pError);
				}

				if (!pRecord)
				{
					pRecord =
					{
						Path: pRelPath,
						Regions: []
					};
				}

				// Ensure Regions array exists (guard against old records)
				if (!Array.isArray(pRecord.Regions))
				{
					pRecord.Regions = [];
				}

				return fCallback(null, pRecord);
			});
	}

	/**
	 * Invalidate the folder-regions cache. Called after any POST/PUT/DELETE
	 * so subsequent folder-listing requests see fresh data.
	 */
	_invalidateFolderCache()
	{
		this._folderCache = null;
	}

	/**
	 * List all regions across all files under a folder prefix. Uses an
	 * in-memory cache (`this._folderCache`) that's populated on first call
	 * after a mutation and reused until the next mutation invalidates it.
	 *
	 * The cache stores the complete `[{ Path, Regions }, ...]` list. The
	 * folder filter is applied on every request (cheap — just a startsWith
	 * check per entry).
	 *
	 * Empty pFolderPrefix returns everything.
	 *
	 * NOTE: mtime-hash orphans are NOT filtered out here. If a file was
	 * modified after a region was created, the region stays in the cache
	 * under its original mtime-hash key. The navigateToRegion flow is
	 * expected to handle missing-file errors gracefully.
	 *
	 * @param {string}   pFolderPrefix - Folder prefix (trailing / stripped); '' means all
	 * @param {Function} fCallback - (pError, pFiles) where pFiles is [{ Path, Regions }]
	 */
	_listRegionsByFolder(pFolderPrefix, fCallback)
	{
		let tmpSelf = this;
		let tmpFilter = function (pAllFiles)
		{
			let tmpOut = [];
			for (let i = 0; i < pAllFiles.length; i++)
			{
				let tmpEntry = pAllFiles[i];
				if (!tmpEntry || !tmpEntry.Path) continue;
				if (!Array.isArray(tmpEntry.Regions) || tmpEntry.Regions.length === 0) continue;
				if (pFolderPrefix === ''
					|| tmpEntry.Path === pFolderPrefix
					|| tmpEntry.Path.indexOf(pFolderPrefix + '/') === 0)
				{
					tmpOut.push({ Path: tmpEntry.Path, Regions: tmpEntry.Regions });
				}
			}
			tmpOut.sort((a, b) => (a.Path || '').localeCompare(b.Path || ''));
			return tmpOut;
		};

		// Cache hit — apply filter and return
		if (Array.isArray(this._folderCache))
		{
			return fCallback(null, tmpFilter(this._folderCache));
		}

		// Cache miss — enumerate Bibliograph records
		this.fable.Bibliograph.readRecordKeys(SUBIMAGE_SOURCE,
			(pError, pKeys) =>
			{
				if (pError)
				{
					return fCallback(pError);
				}
				if (!Array.isArray(pKeys) || pKeys.length === 0)
				{
					tmpSelf._folderCache = [];
					return fCallback(null, []);
				}

				let tmpAll = [];
				let tmpPending = pKeys.length;
				for (let i = 0; i < pKeys.length; i++)
				{
					tmpSelf.fable.Bibliograph.read(SUBIMAGE_SOURCE, pKeys[i],
						(pReadError, pRecord) =>
						{
							if (!pReadError && pRecord && pRecord.Path)
							{
								tmpAll.push(
								{
									Path: pRecord.Path,
									Regions: Array.isArray(pRecord.Regions) ? pRecord.Regions : []
								});
							}
							tmpPending--;
							if (tmpPending <= 0)
							{
								tmpSelf._folderCache = tmpAll;
								return fCallback(null, tmpFilter(tmpAll));
							}
						});
				}
			});
	}

	/**
	 * Connect REST routes to the Orator service server.
	 *
	 * @param {object} pServiceServer - The Orator service server instance
	 */
	connectRoutes(pServiceServer)
	{
		let tmpSelf = this;
		let tmpContentPath = this.contentPath;

		// -----------------------------------------------------------------
		// GET /api/media/subimage-regions?path=         — regions for one file
		// GET /api/media/subimage-regions?folder=<pref> — regions for all files
		//                                                  under a folder prefix
		// GET /api/media/subimage-regions?folder=       — regions for every file
		//                                                  (use with caution)
		//
		// The folder form uses an in-memory cache (this._folderCache) that
		// is invalidated by POST/PUT/DELETE mutations. First call after a
		// mutation pays the O(n) cost; everything else is O(1) plus a filter.
		// -----------------------------------------------------------------
		pServiceServer.get('/api/media/subimage-regions',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpParsedUrl = libUrl.parse(pRequest.url, true);

					// Folder mode — new in Part D of the regions work.
					if (typeof tmpParsedUrl.query.folder === 'string')
					{
						let tmpFolderPrefix = tmpParsedUrl.query.folder.replace(/\/+$/, '').replace(/^\/+/, '');
						if (tmpFolderPrefix.includes('..'))
						{
							pResponse.send(400, { Success: false, Error: 'Invalid folder parameter.' });
							return fNext();
						}
						tmpSelf._listRegionsByFolder(tmpFolderPrefix,
							(pError, pFiles) =>
							{
								if (pError)
								{
									pResponse.send(500, { Success: false, Error: pError.message });
									return fNext();
								}
								pResponse.send(
								{
									Success: true,
									Folder: tmpFolderPrefix,
									Files: pFiles
								});
								return fNext();
							});
						return;
					}

					// Per-file mode (existing behavior)
					let tmpRelPath = tmpSelf._sanitizePath(tmpParsedUrl.query.path);
					if (!tmpRelPath)
					{
						pResponse.send(400, { Success: false, Error: 'Missing or invalid path parameter.' });
						return fNext();
					}

					let tmpResolved = tmpSelf._resolveFileStat(tmpRelPath);
					if (!tmpResolved)
					{
						pResponse.send(404, { Success: false, Error: 'File not found.' });
						return fNext();
					}

					let tmpStat = tmpResolved.stat;

					tmpSelf._loadOrCreateRecord(tmpRelPath, tmpStat.mtimeMs,
						(pError, pRecord) =>
						{
							if (pError)
							{
								pResponse.send(500, { Success: false, Error: pError.message });
								return fNext();
							}

							pResponse.send(
							{
								Success: true,
								Path: tmpRelPath,
								Regions: pRecord.Regions
							});
							return fNext();
						});
				}
				catch (pError)
				{
					pResponse.send(500, { Success: false, Error: pError.message });
					return fNext();
				}
			});

		// -----------------------------------------------------------------
		// POST /api/media/subimage-regions — Add a new region
		// Body: { Path, Region: { Label, X, Y, Width, Height } }
		// -----------------------------------------------------------------
		pServiceServer.post('/api/media/subimage-regions',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpBody = pRequest.body || {};
					let tmpRelPath = tmpSelf._sanitizePath(tmpBody.Path);

					if (!tmpRelPath)
					{
						pResponse.send(400, { Success: false, Error: 'Missing or invalid Path in request body.' });
						return fNext();
					}

					let tmpRegionInput = tmpBody.Region;
					if (!tmpRegionInput || typeof tmpRegionInput !== 'object')
					{
						pResponse.send(400, { Success: false, Error: 'Missing Region object in request body.' });
						return fNext();
					}

					// Validate: visual regions need coordinates, text selections need SelectedText
					let tmpIsTextSelection = (tmpRegionInput.Type === 'text-selection');
					if (!tmpIsTextSelection)
					{
						if (typeof tmpRegionInput.X !== 'number' || typeof tmpRegionInput.Y !== 'number'
							|| typeof tmpRegionInput.Width !== 'number' || typeof tmpRegionInput.Height !== 'number'
							|| tmpRegionInput.Width <= 0 || tmpRegionInput.Height <= 0)
						{
							pResponse.send(400, { Success: false, Error: 'Visual region must have numeric X, Y, Width (>0), Height (>0).' });
							return fNext();
						}
					}

					let tmpResolved = tmpSelf._resolveFileStat(tmpRelPath);
					if (!tmpResolved)
					{
						pResponse.send(404, { Success: false, Error: 'File not found.' });
						return fNext();
					}

					let tmpStat = tmpResolved.stat;

					tmpSelf._loadOrCreateRecord(tmpRelPath, tmpStat.mtimeMs,
						(pLoadError, pRecord) =>
						{
							if (pLoadError)
							{
								pResponse.send(500, { Success: false, Error: pLoadError.message });
								return fNext();
							}

							let tmpRegion =
							{
								ID: tmpSelf.fable.getUUID(),
								Type: tmpRegionInput.Type || 'visual-region',
								Label: tmpRegionInput.Label || '',
								X: (typeof tmpRegionInput.X === 'number') ? Math.round(tmpRegionInput.X) : null,
								Y: (typeof tmpRegionInput.Y === 'number') ? Math.round(tmpRegionInput.Y) : null,
								Width: (typeof tmpRegionInput.Width === 'number') ? Math.round(tmpRegionInput.Width) : null,
								Height: (typeof tmpRegionInput.Height === 'number') ? Math.round(tmpRegionInput.Height) : null,
								CreatedAt: new Date().toISOString(),
								// Document-specific fields
								PageNumber: (typeof tmpRegionInput.PageNumber === 'number') ? tmpRegionInput.PageNumber : null,
								CFI: tmpRegionInput.CFI || null,
								SpineIndex: (typeof tmpRegionInput.SpineIndex === 'number') ? tmpRegionInput.SpineIndex : null,
								ChapterTitle: tmpRegionInput.ChapterTitle || null,
								SelectedText: tmpRegionInput.SelectedText || null,
								ViewportWidth: (typeof tmpRegionInput.ViewportWidth === 'number') ? tmpRegionInput.ViewportWidth : null,
								ViewportHeight: (typeof tmpRegionInput.ViewportHeight === 'number') ? tmpRegionInput.ViewportHeight : null
							};

							pRecord.Regions.push(tmpRegion);

							tmpSelf.saveExplorerState(tmpRelPath, tmpStat.mtimeMs, pRecord,
								(pSaveError) =>
								{
									if (pSaveError)
									{
										pResponse.send(500, { Success: false, Error: pSaveError.message });
										return fNext();
									}

									// Invalidate the folder cache so the next
									// folder-listing request re-scans.
									tmpSelf._invalidateFolderCache();

									pResponse.send(
									{
										Success: true,
										Region: tmpRegion,
										Regions: pRecord.Regions
									});
									return fNext();
								});
						});
				}
				catch (pError)
				{
					pResponse.send(500, { Success: false, Error: pError.message });
					return fNext();
				}
			});

		// -----------------------------------------------------------------
		// PUT /api/media/subimage-regions/:id — Update a region's label or bounds
		// Body: { Path, Label?, X?, Y?, Width?, Height? }
		// -----------------------------------------------------------------
		pServiceServer.put('/api/media/subimage-regions/:id',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpRegionId = pRequest.params.id;
					let tmpBody = pRequest.body || {};
					let tmpRelPath = tmpSelf._sanitizePath(tmpBody.Path);

					if (!tmpRelPath || !tmpRegionId)
					{
						pResponse.send(400, { Success: false, Error: 'Missing Path or region ID.' });
						return fNext();
					}

					let tmpResolved = tmpSelf._resolveFileStat(tmpRelPath);
					if (!tmpResolved)
					{
						pResponse.send(404, { Success: false, Error: 'File not found.' });
						return fNext();
					}

					let tmpStat = tmpResolved.stat;

					tmpSelf._loadOrCreateRecord(tmpRelPath, tmpStat.mtimeMs,
						(pLoadError, pRecord) =>
						{
							if (pLoadError)
							{
								pResponse.send(500, { Success: false, Error: pLoadError.message });
								return fNext();
							}

							let tmpRegion = null;
							for (let i = 0; i < pRecord.Regions.length; i++)
							{
								if (pRecord.Regions[i].ID === tmpRegionId)
								{
									tmpRegion = pRecord.Regions[i];
									break;
								}
							}

							if (!tmpRegion)
							{
								pResponse.send(404, { Success: false, Error: 'Region not found.' });
								return fNext();
							}

							// Apply updates
							if (typeof tmpBody.Label === 'string')
							{
								tmpRegion.Label = tmpBody.Label;
							}
							if (typeof tmpBody.X === 'number')
							{
								tmpRegion.X = Math.round(tmpBody.X);
							}
							if (typeof tmpBody.Y === 'number')
							{
								tmpRegion.Y = Math.round(tmpBody.Y);
							}
							if (typeof tmpBody.Width === 'number' && tmpBody.Width > 0)
							{
								tmpRegion.Width = Math.round(tmpBody.Width);
							}
							if (typeof tmpBody.Height === 'number' && tmpBody.Height > 0)
							{
								tmpRegion.Height = Math.round(tmpBody.Height);
							}
							// Document-specific field updates
							if (typeof tmpBody.SelectedText === 'string')
							{
								tmpRegion.SelectedText = tmpBody.SelectedText;
							}
							if (typeof tmpBody.ChapterTitle === 'string')
							{
								tmpRegion.ChapterTitle = tmpBody.ChapterTitle;
							}
							if (typeof tmpBody.PageNumber === 'number')
							{
								tmpRegion.PageNumber = tmpBody.PageNumber;
							}

							tmpSelf.saveExplorerState(tmpRelPath, tmpStat.mtimeMs, pRecord,
								(pSaveError) =>
								{
									if (pSaveError)
									{
										pResponse.send(500, { Success: false, Error: pSaveError.message });
										return fNext();
									}

									// Invalidate the folder cache — changes
									// to label/bounds may affect listing results.
									tmpSelf._invalidateFolderCache();

									pResponse.send(
									{
										Success: true,
										Region: tmpRegion,
										Regions: pRecord.Regions
									});
									return fNext();
								});
						});
				}
				catch (pError)
				{
					pResponse.send(500, { Success: false, Error: pError.message });
					return fNext();
				}
			});

		// -----------------------------------------------------------------
		// DELETE /api/media/subimage-regions/:id?path= — Remove a region
		// -----------------------------------------------------------------
		pServiceServer.del('/api/media/subimage-regions/:id',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpRegionId = pRequest.params.id;
					let tmpParsedUrl = libUrl.parse(pRequest.url, true);
					let tmpRelPath = tmpSelf._sanitizePath(tmpParsedUrl.query.path);

					if (!tmpRelPath || !tmpRegionId)
					{
						pResponse.send(400, { Success: false, Error: 'Missing path or region ID.' });
						return fNext();
					}

					let tmpResolved = tmpSelf._resolveFileStat(tmpRelPath);
					if (!tmpResolved)
					{
						pResponse.send(404, { Success: false, Error: 'File not found.' });
						return fNext();
					}

					let tmpStat = tmpResolved.stat;

					tmpSelf._loadOrCreateRecord(tmpRelPath, tmpStat.mtimeMs,
						(pLoadError, pRecord) =>
						{
							if (pLoadError)
							{
								pResponse.send(500, { Success: false, Error: pLoadError.message });
								return fNext();
							}

							let tmpFound = false;
							pRecord.Regions = pRecord.Regions.filter(
								(pRegion) =>
								{
									if (pRegion.ID === tmpRegionId)
									{
										tmpFound = true;
										return false;
									}
									return true;
								});

							if (!tmpFound)
							{
								pResponse.send(404, { Success: false, Error: 'Region not found.' });
								return fNext();
							}

							tmpSelf.saveExplorerState(tmpRelPath, tmpStat.mtimeMs, pRecord,
								(pSaveError) =>
								{
									if (pSaveError)
									{
										pResponse.send(500, { Success: false, Error: pSaveError.message });
										return fNext();
									}

									// Invalidate the folder cache so the
									// next folder-listing request re-scans.
									tmpSelf._invalidateFolderCache();

									pResponse.send(
									{
										Success: true,
										Regions: pRecord.Regions
									});
									return fNext();
								});
						});
				}
				catch (pError)
				{
					pResponse.send(500, { Success: false, Error: pError.message });
					return fNext();
				}
			});
	}
}

module.exports = RetoldRemoteSubimageService;
