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
const { DOMParser } = require('@xmldom/xmldom');

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

		this.fable.log.info('EPUB Metadata Service: using Bibliograph (sources: ' + METADATA_SOURCE + ', ' + STATE_SOURCE + ')');
	}

	/**
	 * Create the Bibliograph sources.  Must be called after Parime
	 * initialization completes.
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

				tmpSelf.fable.Bibliograph.createSource(STATE_SOURCE,
					(pError2) =>
					{
						if (pError2)
						{
							tmpSelf.fable.log.warn('EPUB explorer-state source creation notice: ' + pError2.message);
						}

						return fCallback();
					});
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

	/**
	 * Build a 16-char hex cache key for explorer state records.
	 *
	 * @param {string} pRelPath - Relative path to the EPUB
	 * @param {number} pMtimeMs - Modification time in ms
	 * @returns {string}
	 */
	_buildStateCacheKey(pRelPath, pMtimeMs)
	{
		let tmpInput = `ebook-explorer:${pRelPath}:${pMtimeMs}`;
		return libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
	}

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
				let tmpOpfPath = tmpSelf._parseContainerXml(pContents['META-INF/container.xml'].toString('utf8'));
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
						let tmpOpfData = tmpSelf._parseOpf(pOpfContents[tmpOpfPath].toString('utf8'), tmpOpfDir);
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
										tmpToc = tmpSelf._parseNavXhtml(tmpTocString);
									}
									else
									{
										tmpToc = tmpSelf._parseNcx(tmpTocString, tmpOpfDir);
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
										tmpWordCount = tmpSelf._estimateWordCount(pExtraContents[tmpManifestItem.href].toString('utf8'));
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
								tmpSelf._matchTocToSpine(tmpToc.Chapters, tmpSpineResult);

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

	// ──────────────────────────────────────────────
	// XML parsing
	// ──────────────────────────────────────────────

	/**
	 * Parse container.xml to find the rootfile (OPF) path.
	 *
	 * @param {string} pXmlString - The container.xml content
	 * @returns {string|null} Path to the OPF file, or null
	 */
	_parseContainerXml(pXmlString)
	{
		try
		{
			let tmpDoc = new DOMParser().parseFromString(pXmlString, 'text/xml');
			let tmpRootfiles = tmpDoc.getElementsByTagName('rootfile');
			if (tmpRootfiles.length > 0)
			{
				return tmpRootfiles[0].getAttribute('full-path') || null;
			}
		}
		catch (pError)
		{
			this.fable.log.warn('container.xml parse error: ' + pError.message);
		}

		return null;
	}

	/**
	 * Parse an OPF (Open Packaging Format) file to extract metadata,
	 * manifest, spine, cover item ID, and TOC reference.
	 *
	 * @param {string} pXmlString - The OPF file content
	 * @param {string} pOpfDir    - Directory of the OPF file (for resolving hrefs)
	 * @returns {object|null} { metadata, manifest, spine, coverItemId, navHref, ncxHref }
	 */
	_parseOpf(pXmlString, pOpfDir)
	{
		try
		{
			let tmpDoc = new DOMParser().parseFromString(pXmlString, 'text/xml');

			// --- Metadata ---
			let tmpMetadata =
			{
				Title: '',
				Creator: '',
				Language: '',
				Publisher: '',
				Description: '',
				Date: '',
				Identifier: '',
				Rights: ''
			};

			let tmpMetaEl = tmpDoc.getElementsByTagName('metadata')[0];
			if (tmpMetaEl)
			{
				tmpMetadata.Title = this._getElementText(tmpMetaEl, 'dc:title') || this._getElementText(tmpMetaEl, 'title') || '';
				tmpMetadata.Creator = this._getElementText(tmpMetaEl, 'dc:creator') || this._getElementText(tmpMetaEl, 'creator') || '';
				tmpMetadata.Language = this._getElementText(tmpMetaEl, 'dc:language') || this._getElementText(tmpMetaEl, 'language') || '';
				tmpMetadata.Publisher = this._getElementText(tmpMetaEl, 'dc:publisher') || this._getElementText(tmpMetaEl, 'publisher') || '';
				tmpMetadata.Description = this._getElementText(tmpMetaEl, 'dc:description') || this._getElementText(tmpMetaEl, 'description') || '';
				tmpMetadata.Date = this._getElementText(tmpMetaEl, 'dc:date') || this._getElementText(tmpMetaEl, 'date') || '';
				tmpMetadata.Identifier = this._getElementText(tmpMetaEl, 'dc:identifier') || this._getElementText(tmpMetaEl, 'identifier') || '';
				tmpMetadata.Rights = this._getElementText(tmpMetaEl, 'dc:rights') || this._getElementText(tmpMetaEl, 'rights') || '';
			}

			// --- Manifest ---
			let tmpManifest = {};
			let tmpManifestEl = tmpDoc.getElementsByTagName('manifest')[0];
			let tmpNavHref = null;
			let tmpCoverItemId = null;

			if (tmpManifestEl)
			{
				let tmpItems = tmpManifestEl.getElementsByTagName('item');
				for (let i = 0; i < tmpItems.length; i++)
				{
					let tmpItem = tmpItems[i];
					let tmpId = tmpItem.getAttribute('id') || '';
					let tmpHref = tmpItem.getAttribute('href') || '';
					let tmpMediaType = tmpItem.getAttribute('media-type') || '';
					let tmpProperties = tmpItem.getAttribute('properties') || '';

					// Resolve href relative to OPF directory
					let tmpResolvedHref = pOpfDir + tmpHref;

					tmpManifest[tmpId] =
					{
						id: tmpId,
						href: tmpResolvedHref,
						mediaType: tmpMediaType,
						properties: tmpProperties
					};

					// EPUB3: nav document
					if (tmpProperties.indexOf('nav') >= 0)
					{
						tmpNavHref = tmpResolvedHref;
					}

					// EPUB3: cover-image
					if (tmpProperties.indexOf('cover-image') >= 0)
					{
						tmpCoverItemId = tmpId;
					}
				}
			}

			// --- EPUB2 cover detection (meta name="cover") ---
			if (!tmpCoverItemId && tmpMetaEl)
			{
				let tmpMetas = tmpMetaEl.getElementsByTagName('meta');
				for (let i = 0; i < tmpMetas.length; i++)
				{
					if (tmpMetas[i].getAttribute('name') === 'cover')
					{
						let tmpCoverId = tmpMetas[i].getAttribute('content');
						if (tmpCoverId && tmpManifest[tmpCoverId])
						{
							tmpCoverItemId = tmpCoverId;
						}
						break;
					}
				}
			}

			// --- Spine ---
			let tmpSpine = [];
			let tmpNcxHref = null;
			let tmpSpineEl = tmpDoc.getElementsByTagName('spine')[0];

			if (tmpSpineEl)
			{
				// EPUB2: toc attribute references NCX id
				let tmpTocAttr = tmpSpineEl.getAttribute('toc');
				if (tmpTocAttr && tmpManifest[tmpTocAttr])
				{
					tmpNcxHref = tmpManifest[tmpTocAttr].href;
				}

				let tmpItemRefs = tmpSpineEl.getElementsByTagName('itemref');
				for (let i = 0; i < tmpItemRefs.length; i++)
				{
					tmpSpine.push(
					{
						idref: tmpItemRefs[i].getAttribute('idref') || ''
					});
				}
			}

			return {
				metadata: tmpMetadata,
				manifest: tmpManifest,
				spine: tmpSpine,
				coverItemId: tmpCoverItemId,
				navHref: tmpNavHref,
				ncxHref: tmpNcxHref
			};
		}
		catch (pError)
		{
			this.fable.log.warn('OPF parse error: ' + pError.message);
			return null;
		}
	}

	/**
	 * Parse an EPUB3 navigation document (nav.xhtml) for the TOC.
	 *
	 * @param {string} pXmlString - The nav.xhtml content
	 * @returns {object} { MaxDepth, Chapters: [...] }
	 */
	_parseNavXhtml(pXmlString)
	{
		let tmpResult = { MaxDepth: 0, Chapters: [] };

		try
		{
			let tmpDoc = new DOMParser().parseFromString(pXmlString, 'application/xhtml+xml');

			// Find <nav epub:type="toc"> or just the first <nav>
			let tmpNavElements = tmpDoc.getElementsByTagName('nav');
			let tmpTocNav = null;

			for (let i = 0; i < tmpNavElements.length; i++)
			{
				let tmpType = tmpNavElements[i].getAttribute('epub:type') || '';
				if (tmpType === 'toc' || tmpType.indexOf('toc') >= 0)
				{
					tmpTocNav = tmpNavElements[i];
					break;
				}
			}

			// Fallback to first nav
			if (!tmpTocNav && tmpNavElements.length > 0)
			{
				tmpTocNav = tmpNavElements[0];
			}

			if (tmpTocNav)
			{
				// Find the top-level <ol>
				let tmpOlElements = tmpTocNav.getElementsByTagName('ol');
				if (tmpOlElements.length > 0)
				{
					tmpResult.Chapters = this._parseNavOl(tmpOlElements[0], 1);
					tmpResult.MaxDepth = this._calcMaxDepth(tmpResult.Chapters, 1);
				}
			}
		}
		catch (pError)
		{
			this.fable.log.warn('nav.xhtml parse error: ' + pError.message);
		}

		return tmpResult;
	}

	/**
	 * Recursively parse an <ol> element from a nav document.
	 *
	 * @param {Element} pOlElement - The <ol> DOM element
	 * @param {number}  pDepth     - Current nesting depth
	 * @returns {Array} Array of chapter objects
	 */
	_parseNavOl(pOlElement, pDepth)
	{
		let tmpChapters = [];
		let tmpChildren = pOlElement.childNodes;

		for (let i = 0; i < tmpChildren.length; i++)
		{
			let tmpChild = tmpChildren[i];
			if (tmpChild.nodeName !== 'li')
			{
				continue;
			}

			let tmpChapter = { Label: '', Href: '', SpineIndex: -1, SubItems: [] };

			// Find <a> element for label and href
			let tmpLinks = tmpChild.getElementsByTagName('a');
			if (tmpLinks.length > 0)
			{
				tmpChapter.Label = (tmpLinks[0].textContent || '').trim();
				tmpChapter.Href = tmpLinks[0].getAttribute('href') || '';
			}
			else
			{
				// Might be a <span> label without a link
				let tmpSpans = tmpChild.getElementsByTagName('span');
				if (tmpSpans.length > 0)
				{
					tmpChapter.Label = (tmpSpans[0].textContent || '').trim();
				}
			}

			// Check for nested <ol>
			let tmpNestedOl = tmpChild.getElementsByTagName('ol');
			if (tmpNestedOl.length > 0)
			{
				tmpChapter.SubItems = this._parseNavOl(tmpNestedOl[0], pDepth + 1);
			}

			if (tmpChapter.Label)
			{
				tmpChapters.push(tmpChapter);
			}
		}

		return tmpChapters;
	}

	/**
	 * Parse an EPUB2 NCX table of contents.
	 *
	 * @param {string} pXmlString - The toc.ncx content
	 * @param {string} pOpfDir    - OPF directory for resolving relative hrefs
	 * @returns {object} { MaxDepth, Chapters: [...] }
	 */
	_parseNcx(pXmlString, pOpfDir)
	{
		let tmpResult = { MaxDepth: 0, Chapters: [] };

		try
		{
			let tmpDoc = new DOMParser().parseFromString(pXmlString, 'text/xml');
			let tmpNavMap = tmpDoc.getElementsByTagName('navMap')[0];

			if (tmpNavMap)
			{
				tmpResult.Chapters = this._parseNcxNavPoints(tmpNavMap, pOpfDir, 1);
				tmpResult.MaxDepth = this._calcMaxDepth(tmpResult.Chapters, 1);
			}
		}
		catch (pError)
		{
			this.fable.log.warn('toc.ncx parse error: ' + pError.message);
		}

		return tmpResult;
	}

	/**
	 * Recursively parse <navPoint> elements from an NCX navMap.
	 *
	 * @param {Element} pParentElement - Parent element containing navPoints
	 * @param {string}  pOpfDir        - OPF directory for href resolution
	 * @param {number}  pDepth         - Current nesting depth
	 * @returns {Array} Array of chapter objects
	 */
	_parseNcxNavPoints(pParentElement, pOpfDir, pDepth)
	{
		let tmpChapters = [];
		let tmpChildren = pParentElement.childNodes;

		for (let i = 0; i < tmpChildren.length; i++)
		{
			let tmpChild = tmpChildren[i];
			if (tmpChild.nodeName !== 'navPoint')
			{
				continue;
			}

			let tmpChapter = { Label: '', Href: '', SpineIndex: -1, SubItems: [] };

			// Get label from <navLabel><text>
			let tmpLabels = tmpChild.getElementsByTagName('navLabel');
			if (tmpLabels.length > 0)
			{
				let tmpTexts = tmpLabels[0].getElementsByTagName('text');
				if (tmpTexts.length > 0)
				{
					tmpChapter.Label = (tmpTexts[0].textContent || '').trim();
				}
			}

			// Get href from <content src="...">
			let tmpContents = tmpChild.getElementsByTagName('content');
			if (tmpContents.length > 0)
			{
				let tmpSrc = tmpContents[0].getAttribute('src') || '';
				tmpChapter.Href = pOpfDir + tmpSrc;
			}

			// Recurse into nested navPoints
			tmpChapter.SubItems = this._parseNcxNavPoints(tmpChild, pOpfDir, pDepth + 1);

			if (tmpChapter.Label)
			{
				tmpChapters.push(tmpChapter);
			}
		}

		return tmpChapters;
	}

	// ──────────────────────────────────────────────
	// TOC/Spine matching
	// ──────────────────────────────────────────────

	/**
	 * For each TOC chapter, find the matching spine index by comparing
	 * hrefs (stripping fragment identifiers).
	 *
	 * @param {Array} pChapters  - Array of TOC chapter objects (mutated in place)
	 * @param {Array} pSpineItems - Array of spine items with Href field
	 */
	_matchTocToSpine(pChapters, pSpineItems)
	{
		for (let i = 0; i < pChapters.length; i++)
		{
			let tmpChapterHref = (pChapters[i].Href || '').split('#')[0];

			for (let j = 0; j < pSpineItems.length; j++)
			{
				if (pSpineItems[j].Href === tmpChapterHref)
				{
					pChapters[i].SpineIndex = j;
					break;
				}
			}

			// Recurse into sub-items
			if (pChapters[i].SubItems && pChapters[i].SubItems.length > 0)
			{
				this._matchTocToSpine(pChapters[i].SubItems, pSpineItems);
			}
		}
	}

	// ──────────────────────────────────────────────
	// Utility helpers
	// ──────────────────────────────────────────────

	/**
	 * Get the text content of the first child element with the given tag name.
	 *
	 * @param {Element} pParent  - Parent element
	 * @param {string}  pTagName - Tag name to find
	 * @returns {string|null} Text content or null
	 */
	_getElementText(pParent, pTagName)
	{
		let tmpElements = pParent.getElementsByTagName(pTagName);
		if (tmpElements.length > 0 && tmpElements[0].textContent)
		{
			return tmpElements[0].textContent.trim();
		}
		return null;
	}

	/**
	 * Estimate word count from an HTML/XHTML string by stripping tags
	 * and counting whitespace-delimited tokens.
	 *
	 * @param {string} pHtmlString - HTML content
	 * @returns {number} Estimated word count
	 */
	_estimateWordCount(pHtmlString)
	{
		if (!pHtmlString)
		{
			return 0;
		}

		// Strip all HTML tags
		let tmpText = pHtmlString.replace(/<[^>]+>/g, ' ');

		// Decode common HTML entities
		tmpText = tmpText.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&#?\w+;/g, ' ');

		// Split by whitespace and count non-empty tokens
		let tmpWords = tmpText.split(/\s+/).filter((pWord) => pWord.length > 0);
		return tmpWords.length;
	}

	/**
	 * Calculate the maximum nesting depth of a chapter tree.
	 *
	 * @param {Array}  pChapters - Array of chapter objects
	 * @param {number} pDepth    - Current depth
	 * @returns {number} Maximum depth
	 */
	_calcMaxDepth(pChapters, pDepth)
	{
		let tmpMax = pDepth;
		for (let i = 0; i < pChapters.length; i++)
		{
			if (pChapters[i].SubItems && pChapters[i].SubItems.length > 0)
			{
				let tmpChildDepth = this._calcMaxDepth(pChapters[i].SubItems, pDepth + 1);
				if (tmpChildDepth > tmpMax)
				{
					tmpMax = tmpChildDepth;
				}
			}
		}
		return tmpMax;
	}

	// ──────────────────────────────────────────────
	// Explorer state persistence
	// ──────────────────────────────────────────────

	/**
	 * Load saved explorer state for an ebook file.
	 *
	 * @param {string}   pRelPath  - Relative path to the ebook
	 * @param {number}   pMtimeMs  - Modification time in ms
	 * @param {Function} fCallback - Callback(pError, pState) where pState is the record or null
	 */
	loadExplorerState(pRelPath, pMtimeMs, fCallback)
	{
		let tmpKey = this._buildStateCacheKey(pRelPath, pMtimeMs);

		this.fable.Bibliograph.read(STATE_SOURCE, tmpKey,
			(pError, pRecord) =>
			{
				if (pError || !pRecord)
				{
					return fCallback(null, null);
				}

				return fCallback(null, pRecord);
			});
	}

	/**
	 * Save explorer state for an ebook file.
	 *
	 * @param {string}   pRelPath   - Relative path to the ebook
	 * @param {number}   pMtimeMs   - Modification time in ms
	 * @param {object}   pStateData - State data to save
	 * @param {Function} fCallback  - Callback(pError)
	 */
	saveExplorerState(pRelPath, pMtimeMs, pStateData, fCallback)
	{
		let tmpSelf = this;
		let tmpKey = this._buildStateCacheKey(pRelPath, pMtimeMs);

		let tmpState =
		{
			Path: pRelPath,
			ModifiedMs: pMtimeMs,
			CurrentSpineIndex: (typeof pStateData.CurrentSpineIndex === 'number') ? pStateData.CurrentSpineIndex : -1,
			SelectionStartIndex: (typeof pStateData.SelectionStartIndex === 'number') ? pStateData.SelectionStartIndex : -1,
			SelectionEndIndex: (typeof pStateData.SelectionEndIndex === 'number') ? pStateData.SelectionEndIndex : -1,
			UpdatedAt: new Date().toISOString()
		};

		this.fable.Bibliograph.write(STATE_SOURCE, tmpKey, tmpState,
			(pError) =>
			{
				if (pError)
				{
					tmpSelf.fable.log.error('EPUB Explorer State: failed to save state for ' + pRelPath + ': ' + pError.message);
				}
				return fCallback(pError);
			});
	}
}

module.exports = RetoldRemoteEpubMetadataService;
