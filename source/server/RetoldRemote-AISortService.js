/**
 * Retold Remote -- AI Sort Service
 *
 * Orchestrates AI-powered file sorting:
 *   1. Scans a folder and extracts metadata via MetadataCache
 *   2. Sends metadata to a configurable AI endpoint (Ollama / OpenAI-compatible)
 *   3. Generates an operation-plan collection with proposed file moves
 *
 * Two-pass plan generation:
 *   Pass 1 (no AI): Files with complete tags (artist + album + title) are
 *     sorted purely by naming template substitution.
 *   Pass 2 (AI):    Files with missing tags are batched to the AI for inference.
 *
 * Endpoints:
 *   POST /api/ai-sort/test-connection  -- Test AI endpoint reachability
 *   POST /api/ai-sort/scan             -- Scan folder, extract metadata
 *   POST /api/ai-sort/generate-plan    -- Generate sort plan → creates collection
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');

const libExtensionMaps = require('../RetoldRemote-ExtensionMaps.js');

const COLLECTION_SOURCE = 'retold-remote-collections';

const _DefaultServiceConfiguration =
{
	"ContentPath": ".",
	"AIEndpoint": "http://localhost:11434",
	"AIModel": "llama3.1",
	"AIProvider": "ollama",
	"NamingTemplate": "{artist}/{album}/{track} - {title}",
	"MaxFilesPerBatch": 30,
	"AITimeout": 120000
};

class RetoldRemoteAISortService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteAISortService';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		// Will be set by server setup
		this._metadataCache = null;

		this.fable.log.info('AI Sort Service: initialized');
		this.fable.log.info(`  AI endpoint: ${this.options.AIEndpoint}`);
		this.fable.log.info(`  AI model: ${this.options.AIModel}`);
		this.fable.log.info(`  AI provider: ${this.options.AIProvider}`);
	}

	/**
	 * Set the metadata cache instance.
	 *
	 * @param {RetoldRemoteMetadataCache} pCache
	 */
	setMetadataCache(pCache)
	{
		this._metadataCache = pCache;
	}

	// -- Helpers ----------------------------------------------------------

	/**
	 * Sanitize a path to prevent directory traversal.
	 *
	 * @param {string} pPath
	 * @returns {string|null}
	 */
	_sanitizePath(pPath)
	{
		if (!pPath || typeof (pPath) !== 'string')
		{
			return null;
		}

		let tmpPath = decodeURIComponent(pPath).replace(/^\/+/, '');

		if (tmpPath.includes('..') || libPath.isAbsolute(tmpPath))
		{
			return null;
		}

		return tmpPath;
	}

	/**
	 * Scan a directory for audio files.
	 *
	 * @param {string} pRelPath - Relative directory path
	 * @param {boolean} pRecursive - Whether to scan subdirectories
	 * @returns {Array<string>} Array of relative file paths
	 */
	_scanAudioFiles(pRelPath, pRecursive)
	{
		let tmpAbsDir = libPath.join(this.contentPath, pRelPath);
		let tmpFiles = [];

		if (!libFs.existsSync(tmpAbsDir) || !libFs.statSync(tmpAbsDir).isDirectory())
		{
			return tmpFiles;
		}

		let tmpEntries = libFs.readdirSync(tmpAbsDir);

		for (let i = 0; i < tmpEntries.length; i++)
		{
			let tmpEntry = tmpEntries[i];
			let tmpFullPath = libPath.join(tmpAbsDir, tmpEntry);
			let tmpRelFilePath = pRelPath ? (pRelPath + '/' + tmpEntry) : tmpEntry;

			try
			{
				let tmpStat = libFs.statSync(tmpFullPath);

				if (tmpStat.isFile())
				{
					let tmpExt = libPath.extname(tmpEntry).replace('.', '').toLowerCase();
					if (libExtensionMaps.AudioExtensions[tmpExt])
					{
						tmpFiles.push(tmpRelFilePath);
					}
				}
				else if (tmpStat.isDirectory() && pRecursive)
				{
					let tmpSubFiles = this._scanAudioFiles(tmpRelFilePath, true);
					tmpFiles = tmpFiles.concat(tmpSubFiles);
				}
			}
			catch (pError)
			{
				// Skip inaccessible files
				this.fable.log.warn('AI Sort scan skip: ' + pError.message);
			}
		}

		return tmpFiles;
	}

	/**
	 * Apply a naming template using metadata tags.
	 *
	 * @param {string} pTemplate - Template string like "{artist}/{album}/{track} - {title}"
	 * @param {object} pTags - Tag object with lowercase keys
	 * @param {string} pOriginalFilename - Original filename for extension
	 * @returns {string|null} Resulting path, or null if insufficient data
	 */
	_applyNamingTemplate(pTemplate, pTags, pOriginalFilename)
	{
		let tmpExt = libPath.extname(pOriginalFilename).toLowerCase();

		let tmpResult = pTemplate;

		// Substitute known placeholders
		let tmpArtist = pTags.artist || pTags.album_artist || '';
		let tmpAlbum = pTags.album || '';
		let tmpTitle = pTags.title || '';
		let tmpTrack = pTags.track || '';
		let tmpYear = pTags.date || pTags.year || '';
		let tmpGenre = pTags.genre || '';

		// Zero-pad track number to 2 digits
		if (tmpTrack)
		{
			// Handle "3/12" format
			let tmpTrackNum = parseInt(tmpTrack.toString().split('/')[0], 10);
			if (!isNaN(tmpTrackNum))
			{
				tmpTrack = (tmpTrackNum < 10 ? '0' : '') + tmpTrackNum;
			}
		}

		tmpResult = tmpResult.replace(/\{artist\}/gi, tmpArtist);
		tmpResult = tmpResult.replace(/\{album\}/gi, tmpAlbum);
		tmpResult = tmpResult.replace(/\{title\}/gi, tmpTitle);
		tmpResult = tmpResult.replace(/\{track\}/gi, tmpTrack);
		tmpResult = tmpResult.replace(/\{year\}/gi, tmpYear);
		tmpResult = tmpResult.replace(/\{genre\}/gi, tmpGenre);

		// Sanitize for filesystem safety
		tmpResult = this._sanitizeFilename(tmpResult);

		// Add extension
		tmpResult = tmpResult + tmpExt;

		return tmpResult;
	}

	/**
	 * Sanitize a string for use in filesystem paths.
	 * Preserves forward slashes as directory separators.
	 *
	 * @param {string} pPath
	 * @returns {string}
	 */
	_sanitizeFilename(pPath)
	{
		// Remove/replace characters invalid on most filesystems
		let tmpSanitized = pPath
			.replace(/[\\:*?"<>|]/g, '')
			.replace(/\s+/g, ' ')
			.trim();

		// Clean up each path segment
		let tmpSegments = tmpSanitized.split('/');
		for (let i = 0; i < tmpSegments.length; i++)
		{
			// Remove leading/trailing dots and spaces from each segment
			tmpSegments[i] = tmpSegments[i].replace(/^[\s.]+|[\s.]+$/g, '').trim();
		}

		// Filter out empty segments
		tmpSegments = tmpSegments.filter((s) => s.length > 0);

		return tmpSegments.join('/');
	}

	/**
	 * Call the AI endpoint with a prompt and return the parsed response.
	 *
	 * @param {string} pPrompt - The prompt to send
	 * @param {function} fCallback - Callback(pError, pResponseText)
	 */
	_callAI(pPrompt, fCallback)
	{
		let tmpSelf = this;
		let tmpEndpoint = this.options.AIEndpoint;
		let tmpModel = this.options.AIModel;
		let tmpProvider = this.options.AIProvider;

		let tmpBody;
		let tmpPath;

		if (tmpProvider === 'ollama')
		{
			tmpPath = '/api/generate';
			tmpBody = JSON.stringify(
			{
				model: tmpModel,
				prompt: pPrompt,
				stream: false,
				format: 'json'
			});
		}
		else
		{
			// OpenAI-compatible
			tmpPath = '/v1/chat/completions';
			tmpBody = JSON.stringify(
			{
				model: tmpModel,
				messages: [{ role: 'user', content: pPrompt }],
				response_format: { type: 'json_object' },
				temperature: 0.1
			});
		}

		let tmpParsed;
		try
		{
			tmpParsed = new URL(tmpEndpoint);
		}
		catch (pError)
		{
			return fCallback(new Error('Invalid AI endpoint URL: ' + tmpEndpoint));
		}

		let tmpLib = (tmpParsed.protocol === 'https:') ? require('https') : require('http');

		let tmpReq = tmpLib.request(
		{
			hostname: tmpParsed.hostname,
			port: tmpParsed.port,
			path: tmpPath,
			method: 'POST',
			headers:
			{
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(tmpBody)
			},
			timeout: tmpSelf.options.AITimeout
		},
		(pResponse) =>
		{
			let tmpChunks = [];
			pResponse.on('data', (pChunk) => { tmpChunks.push(pChunk); });
			pResponse.on('end', () =>
			{
				if (pResponse.statusCode >= 400)
				{
					return fCallback(new Error('AI endpoint returned status ' + pResponse.statusCode));
				}

				try
				{
					let tmpResponseBody = Buffer.concat(tmpChunks).toString();
					let tmpParsedResponse = JSON.parse(tmpResponseBody);

					let tmpResponseText;

					if (tmpProvider === 'ollama')
					{
						tmpResponseText = tmpParsedResponse.response || '';
					}
					else
					{
						// OpenAI-compatible
						tmpResponseText = (tmpParsedResponse.choices &&
							tmpParsedResponse.choices[0] &&
							tmpParsedResponse.choices[0].message &&
							tmpParsedResponse.choices[0].message.content) || '';
					}

					return fCallback(null, tmpResponseText);
				}
				catch (pParseError)
				{
					return fCallback(new Error('Failed to parse AI response: ' + pParseError.message));
				}
			});
		});

		tmpReq.on('error', (pError) => { return fCallback(pError); });
		tmpReq.on('timeout', () =>
		{
			tmpReq.destroy();
			return fCallback(new Error('AI request timed out after ' + tmpSelf.options.AITimeout + 'ms'));
		});
		tmpReq.write(tmpBody);
		tmpReq.end();
	}

	/**
	 * Build the AI prompt for file sorting.
	 *
	 * @param {Array} pFiles - Array of { Path, Tags, Filename } objects
	 * @param {string} pTemplate - Naming template
	 * @returns {string} The prompt
	 */
	_buildPrompt(pFiles, pTemplate)
	{
		let tmpFileList = pFiles.map((f) =>
		{
			let tmpEntry = { filename: f.Filename };
			if (f.Tags && Object.keys(f.Tags).length > 0)
			{
				tmpEntry.tags = f.Tags;
			}
			return tmpEntry;
		});

		return `You are a music file organizer. I will give you a list of audio files with their current filenames and any available metadata (ID3 tags). For each file, determine the correct Artist, Album, Title, Track Number, and Year.

Rules:
1. Use existing ID3 tags when they are present and seem correct.
2. For files missing tags, infer from the filename pattern. Common patterns:
   - "Artist - Title.mp3"
   - "01 - Title.mp3" (track number prefix)
   - "Artist - Album - 01 - Title.mp3"
   - "01. Title.mp3"
3. If the album cannot be determined, use "Singles" as the album name.
4. If the artist cannot be determined, use "Unknown Artist".
5. Clean up common issues: extra spaces, underscores as spaces, case normalization (Title Case for names).
6. Track numbers should be zero-padded to 2 digits.

The naming template is: ${pTemplate}

Respond with a JSON object containing a "files" array. Each entry must have:
- "source": the original filename (exactly as provided)
- "artist": the determined artist name
- "album": the determined album name
- "title": the determined song title
- "track": track number as a zero-padded string (e.g. "01"), or "" if unknown
- "year": year if known, or ""
- "destination": the full destination path using the naming template above
- "confidence": "high", "medium", or "low"

Files to organize:
${JSON.stringify(tmpFileList, null, 2)}`;
	}

	/**
	 * Generate a sort plan.  Pass 1 uses tags directly; Pass 2 uses AI.
	 *
	 * @param {Array} pMetadataArray - Array of metadata objects from MetadataCache
	 * @param {string} pNamingTemplate - Naming template
	 * @param {string} pBasePath - Base path prefix for source files
	 * @param {function} fCallback - Callback(pError, pPlanItems)
	 */
	_generateSortPlan(pMetadataArray, pNamingTemplate, pBasePath, fCallback)
	{
		let tmpSelf = this;
		let tmpPlanItems = [];
		let tmpNeedAI = [];

		// Pass 1: Files with complete tags → template substitution
		for (let i = 0; i < pMetadataArray.length; i++)
		{
			let tmpMeta = pMetadataArray[i];

			if (!tmpMeta.Success)
			{
				continue;
			}

			let tmpTags = tmpMeta.Tags || {};
			let tmpFilename = tmpMeta.Path.split('/').pop();
			let tmpArtist = tmpTags.artist || tmpTags.album_artist;
			let tmpTitle = tmpTags.title;

			if (tmpArtist && tmpTitle)
			{
				// Has enough tags for template substitution
				let tmpDest = this._applyNamingTemplate(pNamingTemplate, tmpTags, tmpFilename);
				if (tmpDest)
				{
					// Prefix with base path if provided
					if (pBasePath)
					{
						tmpDest = pBasePath + '/' + tmpDest;
					}

					tmpPlanItems.push(
					{
						ID: this.fable.getUUID(),
						Type: 'file',
						Path: tmpMeta.Path,
						Label: tmpFilename,
						Note: '',
						SortOrder: tmpPlanItems.length,
						AddedAt: new Date().toISOString(),
						Operation: 'move',
						DestinationPath: tmpDest,
						OperationStatus: 'pending',
						OperationError: null
					});
				}
			}
			else
			{
				// Needs AI inference
				tmpNeedAI.push(
				{
					Path: tmpMeta.Path,
					Filename: tmpFilename,
					Tags: tmpTags
				});
			}
		}

		// Pass 2: Files needing AI
		if (tmpNeedAI.length === 0)
		{
			return fCallback(null, tmpPlanItems);
		}

		// Batch files for AI (in groups of MaxFilesPerBatch)
		let tmpBatchSize = this.options.MaxFilesPerBatch;
		let tmpBatches = [];
		for (let i = 0; i < tmpNeedAI.length; i += tmpBatchSize)
		{
			tmpBatches.push(tmpNeedAI.slice(i, i + tmpBatchSize));
		}

		let tmpBatchIndex = 0;

		function _processNextBatch()
		{
			if (tmpBatchIndex >= tmpBatches.length)
			{
				return fCallback(null, tmpPlanItems);
			}

			let tmpBatch = tmpBatches[tmpBatchIndex];
			tmpBatchIndex++;

			let tmpPrompt = tmpSelf._buildPrompt(tmpBatch, pNamingTemplate);

			tmpSelf._callAI(tmpPrompt,
				(pError, pResponseText) =>
				{
					if (pError)
					{
						tmpSelf.fable.log.warn('AI sort batch error: ' + pError.message);
						// Add files with error as failed items
						for (let j = 0; j < tmpBatch.length; j++)
						{
							tmpPlanItems.push(
							{
								ID: tmpSelf.fable.getUUID(),
								Type: 'file',
								Path: tmpBatch[j].Path,
								Label: tmpBatch[j].Filename,
								Note: 'AI inference failed: ' + pError.message,
								SortOrder: tmpPlanItems.length,
								AddedAt: new Date().toISOString(),
								Operation: 'move',
								DestinationPath: null,
								OperationStatus: 'pending',
								OperationError: 'AI inference failed'
							});
						}
						return _processNextBatch();
					}

					// Parse AI response
					try
					{
						let tmpAIResult = JSON.parse(pResponseText);
						let tmpAIFiles = tmpAIResult.files || [];

						// Build lookup by source filename
						let tmpResultMap = {};
						for (let j = 0; j < tmpAIFiles.length; j++)
						{
							tmpResultMap[tmpAIFiles[j].source] = tmpAIFiles[j];
						}

						for (let j = 0; j < tmpBatch.length; j++)
						{
							let tmpFile = tmpBatch[j];
							let tmpAIFile = tmpResultMap[tmpFile.Filename];

							let tmpDest = null;
							if (tmpAIFile && tmpAIFile.destination)
							{
								tmpDest = tmpSelf._sanitizeFilename(tmpAIFile.destination);
								// Add extension if missing
								let tmpOrigExt = libPath.extname(tmpFile.Filename).toLowerCase();
								if (tmpDest && !tmpDest.toLowerCase().endsWith(tmpOrigExt))
								{
									tmpDest = tmpDest + tmpOrigExt;
								}
								// Prefix with base path
								if (pBasePath && tmpDest)
								{
									tmpDest = pBasePath + '/' + tmpDest;
								}
							}

							tmpPlanItems.push(
							{
								ID: tmpSelf.fable.getUUID(),
								Type: 'file',
								Path: tmpFile.Path,
								Label: tmpFile.Filename,
								Note: tmpAIFile ? ('AI confidence: ' + (tmpAIFile.confidence || 'unknown')) : '',
								SortOrder: tmpPlanItems.length,
								AddedAt: new Date().toISOString(),
								Operation: 'move',
								DestinationPath: tmpDest,
								OperationStatus: tmpDest ? 'pending' : null,
								OperationError: tmpDest ? null : 'AI could not determine destination'
							});
						}
					}
					catch (pParseError)
					{
						tmpSelf.fable.log.warn('AI response parse error: ' + pParseError.message);
						// Try to extract JSON from response text
						let tmpJsonMatch = pResponseText.match(/\{[\s\S]*\}/);
						if (tmpJsonMatch)
						{
							try
							{
								let tmpRetry = JSON.parse(tmpJsonMatch[0]);
								// Recurse on successful extraction... but keep it simple
								tmpSelf.fable.log.warn('Extracted JSON from AI response on retry');
							}
							catch (e)
							{
								// Truly failed
							}
						}

						for (let j = 0; j < tmpBatch.length; j++)
						{
							tmpPlanItems.push(
							{
								ID: tmpSelf.fable.getUUID(),
								Type: 'file',
								Path: tmpBatch[j].Path,
								Label: tmpBatch[j].Filename,
								Note: 'AI response could not be parsed',
								SortOrder: tmpPlanItems.length,
								AddedAt: new Date().toISOString(),
								Operation: 'move',
								DestinationPath: null,
								OperationStatus: null,
								OperationError: 'AI response parse error'
							});
						}
					}

					_processNextBatch();
				});
		}

		_processNextBatch();
	}

	// -- Route Wiring -----------------------------------------------------

	/**
	 * Wire REST endpoints.
	 *
	 * @param {object} pServiceServer - The Orator service server
	 */
	connectRoutes(pServiceServer)
	{
		let tmpSelf = this;
		let tmpServer = pServiceServer.server;

		// --- POST /api/ai-sort/test-connection ---
		tmpServer.post('/api/ai-sort/test-connection',
			(pRequest, pResponse, fNext) =>
			{
				let tmpEndpoint = (pRequest.body && pRequest.body.AIEndpoint) || tmpSelf.options.AIEndpoint;
				let tmpModel = (pRequest.body && pRequest.body.AIModel) || tmpSelf.options.AIModel;
				let tmpProvider = (pRequest.body && pRequest.body.AIProvider) || tmpSelf.options.AIProvider;

				// Temporarily override settings for this test
				let tmpOrigEndpoint = tmpSelf.options.AIEndpoint;
				let tmpOrigModel = tmpSelf.options.AIModel;
				let tmpOrigProvider = tmpSelf.options.AIProvider;

				tmpSelf.options.AIEndpoint = tmpEndpoint;
				tmpSelf.options.AIModel = tmpModel;
				tmpSelf.options.AIProvider = tmpProvider;

				let tmpStartTime = Date.now();

				tmpSelf._callAI('Respond with JSON: {"status": "ok"}',
					(pError, pResponseText) =>
					{
						let tmpResponseTime = Date.now() - tmpStartTime;

						// Restore original settings
						tmpSelf.options.AIEndpoint = tmpOrigEndpoint;
						tmpSelf.options.AIModel = tmpOrigModel;
						tmpSelf.options.AIProvider = tmpOrigProvider;

						if (pError)
						{
							pResponse.send(200,
							{
								Success: false,
								Error: pError.message,
								Endpoint: tmpEndpoint,
								Model: tmpModel,
								Provider: tmpProvider
							});
							return fNext();
						}

						pResponse.send(200,
						{
							Success: true,
							ResponseTime: tmpResponseTime,
							Endpoint: tmpEndpoint,
							Model: tmpModel,
							Provider: tmpProvider,
							Response: pResponseText
						});
						return fNext();
					});
			});

		// --- POST /api/ai-sort/scan ---
		tmpServer.post('/api/ai-sort/scan',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpPath = tmpSelf._sanitizePath(pRequest.body && pRequest.body.Path);
					let tmpRecursive = (pRequest.body && pRequest.body.Recursive === true);

					if (!tmpPath && tmpPath !== '')
					{
						pResponse.send(400, { Success: false, Error: 'Invalid path.' });
						return fNext();
					}

					// Scan for audio files
					let tmpAudioFiles = tmpSelf._scanAudioFiles(tmpPath, tmpRecursive);

					if (tmpAudioFiles.length === 0)
					{
						pResponse.send(200,
						{
							Success: true,
							Path: tmpPath,
							FileCount: 0,
							Files: []
						});
						return fNext();
					}

					// Get metadata for all audio files
					if (!tmpSelf._metadataCache)
					{
						pResponse.send(500, { Success: false, Error: 'Metadata cache not available.' });
						return fNext();
					}

					tmpSelf._metadataCache.getMetadataBatch(tmpAudioFiles,
						(pError, pMetadata) =>
						{
							if (pError)
							{
								pResponse.send(500, { Success: false, Error: pError.message });
								return fNext();
							}

							pResponse.send(200,
							{
								Success: true,
								Path: tmpPath,
								FileCount: pMetadata.length,
								Files: pMetadata
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

		// --- POST /api/ai-sort/generate-plan ---
		tmpServer.post('/api/ai-sort/generate-plan',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpPath = tmpSelf._sanitizePath(pRequest.body && pRequest.body.Path);
					let tmpNamingTemplate = (pRequest.body && pRequest.body.NamingTemplate) || tmpSelf.options.NamingTemplate;
					let tmpRecursive = (pRequest.body && pRequest.body.Recursive === true);

					// Allow overriding AI settings per-request
					if (pRequest.body && pRequest.body.AIEndpoint)
					{
						tmpSelf.options.AIEndpoint = pRequest.body.AIEndpoint;
					}
					if (pRequest.body && pRequest.body.AIModel)
					{
						tmpSelf.options.AIModel = pRequest.body.AIModel;
					}
					if (pRequest.body && pRequest.body.AIProvider)
					{
						tmpSelf.options.AIProvider = pRequest.body.AIProvider;
					}

					if (!tmpPath && tmpPath !== '')
					{
						pResponse.send(400, { Success: false, Error: 'Invalid path.' });
						return fNext();
					}

					// Scan for audio files
					let tmpAudioFiles = tmpSelf._scanAudioFiles(tmpPath, tmpRecursive);

					if (tmpAudioFiles.length === 0)
					{
						pResponse.send(200, { Success: true, Message: 'No audio files found.', CollectionGUID: null });
						return fNext();
					}

					if (!tmpSelf._metadataCache)
					{
						pResponse.send(500, { Success: false, Error: 'Metadata cache not available.' });
						return fNext();
					}

					// Get metadata for all audio files
					tmpSelf._metadataCache.getMetadataBatch(tmpAudioFiles,
						(pMetaError, pMetadata) =>
						{
							if (pMetaError)
							{
								pResponse.send(500, { Success: false, Error: pMetaError.message });
								return fNext();
							}

							// Determine base path: the parent directory where sorted files will land
							// Default: same directory level as the source folder
							let tmpBasePath = tmpPath ? libPath.dirname(tmpPath) : '';
							if (tmpBasePath === '.') tmpBasePath = '';

							// Generate the sort plan
							tmpSelf._generateSortPlan(pMetadata, tmpNamingTemplate, tmpBasePath,
								(pPlanError, pPlanItems) =>
								{
									if (pPlanError)
									{
										pResponse.send(500, { Success: false, Error: pPlanError.message });
										return fNext();
									}

									// Create the operation-plan collection
									let tmpCollectionGUID = tmpSelf.fable.getUUID();
									let tmpFolderName = tmpPath ? tmpPath.split('/').pop() : 'root';
									let tmpNow = new Date().toISOString();

									let tmpCollection =
									{
										GUID: tmpCollectionGUID,
										Name: 'Sort: ' + tmpFolderName,
										Description: 'AI sort plan for ' + tmpPath + '\nTemplate: ' + tmpNamingTemplate,
										CoverImage: '',
										Icon: 'bookmark',
										CreatedAt: tmpNow,
										ModifiedAt: tmpNow,
										SortMode: 'manual',
										SortDirection: 'asc',
										Tags: ['ai-sort'],
										CollectionType: 'operation-plan',
										OperationBatchGUID: null,
										Items: pPlanItems
									};

									// Save via Bibliograph
									tmpSelf.fable.Bibliograph.createSource(COLLECTION_SOURCE,
										() =>
										{
											tmpSelf.fable.Bibliograph.write(COLLECTION_SOURCE, tmpCollectionGUID, tmpCollection,
												(pWriteError) =>
												{
													if (pWriteError)
													{
														pResponse.send(500, { Success: false, Error: 'Failed to save sort plan: ' + pWriteError.message });
														return fNext();
													}

													pResponse.send(200,
													{
														Success: true,
														CollectionGUID: tmpCollectionGUID,
														TotalFiles: pPlanItems.length,
														TaggedFiles: pPlanItems.filter((item) => !item.Note || item.Note.indexOf('AI') < 0).length,
														AIFiles: pPlanItems.filter((item) => item.Note && item.Note.indexOf('AI') >= 0).length,
														Collection: tmpCollection
													});
													return fNext();
												});
										});
								});
						});
				}
				catch (pError)
				{
					pResponse.send(500, { Success: false, Error: pError.message });
					return fNext();
				}
			});

		this.fable.log.info('AI Sort Service: routes connected.');
	}
}

module.exports = RetoldRemoteAISortService;
