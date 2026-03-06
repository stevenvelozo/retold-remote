/**
 * Retold Remote -- EPUB Metadata Extraction Service
 *
 * Parses EPUB files (ZIP archives containing XML), extracts metadata
 * (title, author, TOC, spine/chapter list, cover image, word counts),
 * and caches the results in Bibliograph (JSON key-value store).
 *
 * Cover images are cached separately in ParimeBinaryStorage.
 *
 * API:
 *   initialize(fCallback)
 *     -> Creates Bibliograph sources, must be called after Parime init
 *
 *   extractMetadata(pAbsPath, pRelPath, fCallback)
 *     -> { Path, CacheKey, Metadata, Cover, Spine, TOC, ... }
 *
 *   loadExplorerState(pRelPath, pMtimeMs, fCallback)
 *     -> { Path, CurrentSpineIndex, SelectionStartIndex, SelectionEndIndex, ... }
 *
 *   saveExplorerState(pRelPath, pMtimeMs, pState, fCallback)
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');
const libYauzl = require('yauzl');

const libExplorerStateMixin = require('./RetoldRemote-ExplorerStateMixin');
const libEpubXmlParser = require('./RetoldRemote-EpubXmlParser');

const METADATA_SOURCE = 'retold-remote-ebook-metadata';
const STATE_SOURCE = 'retold-remote-ebook-explorer-state';

const _DefaultServiceConfiguration =
{
	"ContentPath": "."
};

class RetoldRemoteEpubMetadataService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteEpubMetadataService';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		// Apply explorer state persistence mixin for ebook explorer state
		libExplorerStateMixin.apply(this, STATE_SOURCE, 'ebook-explorer');

		this.fable.log.info('EPUB Metadata Service: using Bibliograph (sources: ' + METADATA_SOURCE + ', ' + STATE_SOURCE + ')');
	}

	/**
	 * Create the Bibliograph sources.  Must be called after Parime
	 * initialization completes.
	 *
	 * Creates the metadata source here; the explorer state source is
	 * created by the mixin's initializeState().
	 *
	 * @param {Function} fCallback - Callback(pError)
	 */
	initialize(fCallback)
	{
		let tmpSelf = this;

		this.fable.Bibliograph.createSource(METADATA_SOURCE,
			(pError) =>
			{
				if (pError)
				{
					tmpSelf.fable.log.warn('EPUB metadata source creation notice: ' + pError.message);
				}

				// Initialize the explorer state source via mixin
				tmpSelf.initializeState(fCallback);
			});
	}

	// ──────────────────────────────────────────────
	// Cache key helpers
	// ──────────────────────────────────────────────

	/**
	 * Build a 16-char hex cache key for metadata records.
	 *
	 * @param {string} pAbsPath - Absolute path to the EPUB
	 * @param {number} pMtimeMs - Modification time in ms
	 * @returns {string}
	 */
	_buildMetadataCacheKey(pAbsPath, pMtimeMs)
	{
		let tmpInput = `${pAbsPath}:${pMtimeMs}`;
		return libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
	}

	// Note: _buildExplorerStateKey is provided by the explorer state mixin

	// ──────────────────────────────────────────────
	// Metadata extraction
	// ──────────────────────────────────────────────

	/**
	 * Extract metadata from an EPUB file.  Returns a cached result if
	 * available and the file has not been modified.
	 *
	 * @param {string}   pAbsPath  - Absolute path to the EPUB file
	 * @param {string}   pRelPath  - Relative path (for the response)
	 * @param {Function} fCallback - Callback(pError, pMetadataRecord)
	 */
	extractMetadata(pAbsPath, pRelPath, fCallback)
	{
		let tmpSelf = this;

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

		let tmpCacheKey = this._buildMetadataCacheKey(pAbsPath, tmpStat.mtimeMs);

		// Check Bibliograph for cached record
		this.fable.Bibliograph.read(METADATA_SOURCE, tmpCacheKey,
			(pReadError, pRecord) =>
			{
				if (!pReadError && pRecord && pRecord.ModifiedMs === tmpStat.mtimeMs)
				{
					tmpSelf.fable.log.info(`EPUB metadata cache hit for ${pRelPath}`);
					return fCallback(null, pRecord);
				}

				// Cache miss — parse the EPUB
				tmpSelf.fable.log.info(`Parsing EPUB metadata: ${pRelPath}`);
				tmpSelf._parseEpub(pAbsPath, tmpCacheKey,
					(pParseError, pMetadata) =>
					{
						if (pParseError)
						{
							return fCallback(pParseError);
						}

						// Populate record fields
						pMetadata.Path = pRelPath;
						pMetadata.CacheKey = tmpCacheKey;
						pMetadata.FileSize = tmpStat.size;
						pMetadata.ModifiedMs = tmpStat.mtimeMs;
						pMetadata.ExtractedAt = new Date().toISOString();

						// Write to Bibliograph
						tmpSelf.fable.Bibliograph.write(METADATA_SOURCE, tmpCacheKey, pMetadata,
							(pWriteError) =>
							{
								if (pWriteError)
								{
									tmpSelf.fable.log.warn('EPUB metadata write error: ' + pWriteError.message);
								}

								return fCallback(null, pMetadata);
							});
					});
			});
	}

	/**
	 * Parse an EPUB file and extract all metadata.
	 *
	 * @param {string}   pAbsPath  - Absolute path to the EPUB
	 * @param {string}   pCacheKey - Cache key for cover image storage
	 * @param {Function} fCallback - Callback(pError, pResult)
	 */
	_parseEpub(pAbsPath, pCacheKey, fCallback)
	{
		let tmpSelf = this;

		// First pass: collect all ZIP entries and their buffers for key files
		libYauzl.open(pAbsPath, { lazyEntries: true },
			(pError, pZipFile) =>
			{
				if (pError)
				{
					return fCallback(new Error('Failed to open EPUB: ' + pError.message));
				}

				// Collect entries: { fileName, entry }
				let tmpEntries = {};
				let tmpEntryList = [];

				pZipFile.on('entry',
					(pEntry) =>
					{
						tmpEntries[pEntry.fileName] = pEntry;
						tmpEntryList.push(pEntry);
						pZipFile.readEntry();
					});

				pZipFile.on('error',
					(pZipError) =>
					{
						return fCallback(new Error('EPUB read error: ' + pZipError.message));
					});

				pZipFile.on('end',
					() =>
					{
						// Now we have all entries — parse the book structure
						tmpSelf._processEntries(pAbsPath, pZipFile, tmpEntries, tmpEntryList, pCacheKey, fCallback);
					});

				pZipFile.readEntry();
			});
	}

	/**
	 * Process ZIP entries: read container.xml, OPF, TOC, spine content,
	 * and cover image.
	 *
	 * @param {string}   pAbsPath   - Absolute path (for re-opening ZIP)
	 * @param {object}   pZipFile   - The yauzl zip file (already at end, closed for reading)
	 * @param {object}   pEntries   - Map of fileName → entry
	 * @param {Array}    pEntryList - Array of all entries
	 * @param {string}   pCacheKey  - Cache key for cover image storage
	 * @param {Function} fCallback  - Callback(pError, pResult)
	 */
	_processEntries(pAbsPath, pZipFile, pEntries, pEntryList, pCacheKey, fCallback)
	{
		let tmpSelf = this;

		// We need to re-open the ZIP to read specific entries.
		// yauzl with lazyEntries doesn't allow random access after enumeration.
		// We'll read the files we need in sequence.

		let tmpFilesToRead = ['META-INF/container.xml'];
		let tmpFileContents = {};

		tmpSelf._readMultipleEntries(pAbsPath, tmpFilesToRead,
			(pError, pContents) =>
			{
				if (pError || !pContents['META-INF/container.xml'])
				{
					return fCallback(new Error('Invalid EPUB: missing container.xml'));
				}

				// 1. Parse container.xml to find the OPF path
				let tmpOpfPath = libEpubXmlParser.parseContainerXml(pContents['META-INF/container.xml'].toString('utf8'), tmpSelf.fable.log);
				if (!tmpOpfPath)
				{
					return fCallback(new Error('Invalid EPUB: no rootfile in container.xml'));
				}

				let tmpOpfDir = tmpOpfPath.includes('/') ? tmpOpfPath.substring(0, tmpOpfPath.lastIndexOf('/') + 1) : '';

				// 2. Read the OPF file
				tmpSelf._readMultipleEntries(pAbsPath, [tmpOpfPath],
					(pOpfError, pOpfContents) =>
					{
						if (pOpfError || !pOpfContents[tmpOpfPath])
						{
							return fCallback(new Error('Invalid EPUB: cannot read OPF file'));
						}

						// 3. Parse the OPF
						let tmpOpfData = libEpubXmlParser.parseOpf(pOpfContents[tmpOpfPath].toString('utf8'), tmpOpfDir, tmpSelf.fable.log);
						if (!tmpOpfData)
						{
							return fCallback(new Error('Invalid EPUB: failed to parse OPF'));
						}

						// 4. Determine what else to read: TOC file, cover image, spine content files
						let tmpExtraFiles = [];

						// TOC file
						let tmpTocPath = null;
						if (tmpOpfData.navHref)
						{
							tmpTocPath = tmpOpfData.navHref;
							tmpExtraFiles.push(tmpTocPath);
						}
						else if (tmpOpfData.ncxHref)
						{
							tmpTocPath = tmpOpfData.ncxHref;
							tmpExtraFiles.push(tmpTocPath);
						}

						// Cover image
						let tmpCoverHref = null;
						if (tmpOpfData.coverItemId && tmpOpfData.manifest[tmpOpfData.coverItemId])
						{
							tmpCoverHref = tmpOpfData.manifest[tmpOpfData.coverItemId].href;
							tmpExtraFiles.push(tmpCoverHref);
						}

						// Spine content files (for word count estimation)
						let tmpSpineItems = tmpOpfData.spine;
						for (let i = 0; i < tmpSpineItems.length; i++)
						{
							let tmpItemId = tmpSpineItems[i].idref;
							if (tmpOpfData.manifest[tmpItemId])
							{
								let tmpHref = tmpOpfData.manifest[tmpItemId].href;
								if (tmpExtraFiles.indexOf(tmpHref) < 0)
								{
									tmpExtraFiles.push(tmpHref);
								}
							}
						}

						// 5. Read all extra files
						tmpSelf._readMultipleEntries(pAbsPath, tmpExtraFiles,
							(pExtraError, pExtraContents) =>
							{
								if (pExtraError)
								{
									// Non-fatal — we can still return partial data
									tmpSelf.fable.log.warn('EPUB: error reading some entries: ' + pExtraError.message);
									pExtraContents = pExtraContents || {};
								}

								// 6. Parse TOC
								let tmpToc = { MaxDepth: 0, Chapters: [] };
								if (tmpTocPath && pExtraContents[tmpTocPath])
								{
									let tmpTocString = pExtraContents[tmpTocPath].toString('utf8');
									if (tmpOpfData.navHref)
									{
										tmpToc = libEpubXmlParser.parseNavXhtml(tmpTocString, tmpSelf.fable.log);
									}
									else
									{
										tmpToc = libEpubXmlParser.parseNcx(tmpTocString, tmpOpfDir, tmpSelf.fable.log);
									}
								}

								// 7. Build spine items with word counts
								let tmpSpineResult = [];
								let tmpTotalWordCount = 0;
								for (let i = 0; i < tmpSpineItems.length; i++)
								{
									let tmpItemId = tmpSpineItems[i].idref;
									let tmpManifestItem = tmpOpfData.manifest[tmpItemId];
									let tmpWordCount = 0;

									if (tmpManifestItem && pExtraContents[tmpManifestItem.href])
									{
										tmpWordCount = libEpubXmlParser.estimateWordCount(pExtraContents[tmpManifestItem.href].toString('utf8'));
									}

									tmpTotalWordCount += tmpWordCount;

									tmpSpineResult.push(
									{
										Index: i,
										IdRef: tmpItemId,
										Href: tmpManifestItem ? tmpManifestItem.href : '',
										MediaType: tmpManifestItem ? tmpManifestItem.mediaType : '',
										WordCount: tmpWordCount
									});
								}

								// 8. Match TOC entries to spine indices
								libEpubXmlParser.matchTocToSpine(tmpToc.Chapters, tmpSpineResult);

								// 9. Cache cover image in ParimeBinaryStorage
								let tmpCoverInfo = null;
								if (tmpCoverHref && pExtraContents[tmpCoverHref])
								{
									let tmpCoverBuffer = pExtraContents[tmpCoverHref];
									let tmpCoverMediaType = 'image/jpeg';
									if (tmpOpfData.coverItemId && tmpOpfData.manifest[tmpOpfData.coverItemId])
									{
										tmpCoverMediaType = tmpOpfData.manifest[tmpOpfData.coverItemId].mediaType || 'image/jpeg';
									}

									let tmpCoverExt = tmpCoverHref.split('.').pop().toLowerCase();

									tmpCoverInfo =
									{
										CoverCacheKey: pCacheKey,
										Filename: 'cover.' + tmpCoverExt,
										MediaType: tmpCoverMediaType,
										Size: tmpCoverBuffer.length
									};

									// Fire-and-forget write to binary storage
									tmpSelf.fable.ParimeBinaryStorage.write('ebook-covers', pCacheKey, tmpCoverBuffer,
										(pCoverError) =>
										{
											if (pCoverError)
											{
												tmpSelf.fable.log.warn('Failed to cache EPUB cover: ' + pCoverError.message);
											}
										});
								}

								// 10. Build the final result
								let tmpResult =
								{
									Metadata: tmpOpfData.metadata,
									Cover: tmpCoverInfo,
									Spine:
									{
										ItemCount: tmpSpineResult.length,
										TotalWordCount: tmpTotalWordCount,
										Items: tmpSpineResult
									},
									TOC: tmpToc
								};

								return fCallback(null, tmpResult);
							});
					});
			});
	}

	// ──────────────────────────────────────────────
	// ZIP reading helpers
	// ──────────────────────────────────────────────

	/**
	 * Read multiple entries from an EPUB (ZIP) file by their paths.
	 * Re-opens the ZIP for sequential read access.
	 *
	 * @param {string}   pAbsPath   - Absolute path to the EPUB
	 * @param {Array}    pFilePaths - Array of entry paths to read
	 * @param {Function} fCallback  - Callback(pError, pContents) where pContents is { path: Buffer }
	 */
	_readMultipleEntries(pAbsPath, pFilePaths, fCallback)
	{
		if (!pFilePaths || pFilePaths.length === 0)
		{
			return fCallback(null, {});
		}

		let tmpTargets = {};
		for (let i = 0; i < pFilePaths.length; i++)
		{
			tmpTargets[pFilePaths[i]] = true;
		}

		let tmpContents = {};
		let tmpPendingReads = 0;
		let tmpCallbackFired = false;

		libYauzl.open(pAbsPath, { lazyEntries: true },
			(pError, pZipFile) =>
			{
				if (pError)
				{
					return fCallback(new Error('Failed to re-open EPUB: ' + pError.message));
				}

				pZipFile.on('entry',
					(pEntry) =>
					{
						if (tmpTargets[pEntry.fileName] && !pEntry.fileName.endsWith('/'))
						{
							tmpPendingReads++;
							pZipFile.openReadStream(pEntry,
								(pStreamError, pReadStream) =>
								{
									if (pStreamError)
									{
										tmpPendingReads--;
										pZipFile.readEntry();
										return;
									}

									let tmpChunks = [];
									pReadStream.on('data', (pChunk) => { tmpChunks.push(pChunk); });
									pReadStream.on('end', () =>
									{
										tmpContents[pEntry.fileName] = Buffer.concat(tmpChunks);
										tmpPendingReads--;

										// If we've found all targets, no need to continue
										if (Object.keys(tmpContents).length === pFilePaths.length && !tmpCallbackFired)
										{
											tmpCallbackFired = true;
											return fCallback(null, tmpContents);
										}
									});
									pReadStream.on('error', () =>
									{
										tmpPendingReads--;
									});
								});
						}

						pZipFile.readEntry();
					});

				pZipFile.on('end',
					() =>
					{
						// Wait for any pending reads to finish
						let tmpCheckInterval = setInterval(() =>
						{
							if (tmpPendingReads <= 0)
							{
								clearInterval(tmpCheckInterval);
								if (!tmpCallbackFired)
								{
									tmpCallbackFired = true;
									return fCallback(null, tmpContents);
								}
							}
						}, 10);

						// Safety timeout
						setTimeout(() =>
						{
							clearInterval(tmpCheckInterval);
							if (!tmpCallbackFired)
							{
								tmpCallbackFired = true;
								return fCallback(null, tmpContents);
							}
						}, 5000);
					});

				pZipFile.on('error',
					(pZipError) =>
					{
						if (!tmpCallbackFired)
						{
							tmpCallbackFired = true;
							return fCallback(new Error('EPUB ZIP error: ' + pZipError.message));
						}
					});

				pZipFile.readEntry();
			});
	}

	// Note: XML parsing (container, OPF, nav, NCX) and utility helpers
	// (word count, depth calc, element text) are in RetoldRemote-EpubXmlParser.js.
	//
	// Note: loadExplorerState, saveExplorerState, and initializeState
	// are provided by the explorer state mixin (RetoldRemote-ExplorerStateMixin).
}

module.exports = RetoldRemoteEpubMetadataService;
