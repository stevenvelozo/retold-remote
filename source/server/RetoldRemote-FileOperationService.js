/**
 * Retold Remote -- File Operation Service
 *
 * Provides safe file move, directory creation, and undo capabilities.
 * All paths are sanitized and resolved within the content root to
 * prevent directory traversal attacks.
 *
 * Batch moves are recorded in Bibliograph for undo support.
 *
 * API:
 *   POST /api/files/mkdir       - Create directory recursively
 *   POST /api/files/move        - Move a single file
 *   POST /api/files/move-batch  - Move multiple files atomically
 *   POST /api/files/undo-batch  - Reverse a completed batch
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');

const SOURCE_NAME = 'retold-remote-file-ops';

const _DefaultServiceConfiguration =
{
	"ContentPath": ".",
	"MaxBatchSize": 1000
};

class RetoldRemoteFileOperationService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteFileOperationService';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		this.fable.log.info('File Operation Service: initialized');
		this.fable.log.info(`  Content root: ${this.contentPath}`);
		this.fable.log.info(`  Max batch size: ${this.options.MaxBatchSize}`);
	}

	/**
	 * Sanitize a path to prevent directory traversal.
	 * Returns null if invalid.
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

		// Resolve and verify it stays within content root
		let tmpAbsPath = libPath.join(this.contentPath, tmpPath);
		if (!tmpAbsPath.startsWith(this.contentPath))
		{
			return null;
		}

		return tmpPath;
	}

	/**
	 * Move a single file from source to destination within the content root.
	 * Creates parent directories as needed.
	 *
	 * @param {string} pSource - Relative source path
	 * @param {string} pDestination - Relative destination path
	 * @param {function} fCallback - Callback(pError, { Source, Destination })
	 */
	moveFile(pSource, pDestination, fCallback)
	{
		try
		{
			let tmpSourceRel = this._sanitizePath(pSource);
			let tmpDestRel = this._sanitizePath(pDestination);

			if (!tmpSourceRel)
			{
				return fCallback(new Error('Invalid source path.'));
			}
			if (!tmpDestRel)
			{
				return fCallback(new Error('Invalid destination path.'));
			}

			let tmpSourceAbs = libPath.join(this.contentPath, tmpSourceRel);
			let tmpDestAbs = libPath.join(this.contentPath, tmpDestRel);

			if (!libFs.existsSync(tmpSourceAbs))
			{
				return fCallback(new Error('Source file not found: ' + tmpSourceRel));
			}

			// Don't overwrite existing files
			if (libFs.existsSync(tmpDestAbs))
			{
				return fCallback(new Error('Destination already exists: ' + tmpDestRel));
			}

			// Create parent directory if needed
			let tmpDestDir = libPath.dirname(tmpDestAbs);
			if (!libFs.existsSync(tmpDestDir))
			{
				libFs.mkdirSync(tmpDestDir, { recursive: true });
			}

			// Try rename first (fast, same filesystem)
			try
			{
				libFs.renameSync(tmpSourceAbs, tmpDestAbs);
			}
			catch (pRenameError)
			{
				// EXDEV = cross-device link; fall back to copy+unlink
				if (pRenameError.code === 'EXDEV')
				{
					libFs.copyFileSync(tmpSourceAbs, tmpDestAbs);
					libFs.unlinkSync(tmpSourceAbs);
				}
				else
				{
					throw pRenameError;
				}
			}

			return fCallback(null, { Source: tmpSourceRel, Destination: tmpDestRel });
		}
		catch (pError)
		{
			return fCallback(pError);
		}
	}

	/**
	 * Move multiple files.  Records the batch in Bibliograph for undo.
	 *
	 * @param {Array<{Source:string, Destination:string}>} pMoves
	 * @param {function} fCallback - Callback(pError, { BatchGUID, Completed, Failed })
	 */
	moveBatch(pMoves, fCallback)
	{
		let tmpSelf = this;

		if (!Array.isArray(pMoves) || pMoves.length === 0)
		{
			return fCallback(new Error('No moves provided.'));
		}

		if (pMoves.length > this.options.MaxBatchSize)
		{
			return fCallback(new Error(`Batch exceeds maximum size of ${this.options.MaxBatchSize}.`));
		}

		// Pre-validate all paths before moving anything
		let tmpValidatedMoves = [];
		for (let i = 0; i < pMoves.length; i++)
		{
			let tmpMove = pMoves[i];
			let tmpSourceRel = this._sanitizePath(tmpMove.Source);
			let tmpDestRel = this._sanitizePath(tmpMove.Destination);

			if (!tmpSourceRel || !tmpDestRel)
			{
				return fCallback(new Error(`Invalid path at index ${i}.`));
			}

			let tmpSourceAbs = libPath.join(this.contentPath, tmpSourceRel);
			if (!libFs.existsSync(tmpSourceAbs))
			{
				return fCallback(new Error(`Source not found at index ${i}: ${tmpSourceRel}`));
			}

			let tmpDestAbs = libPath.join(this.contentPath, tmpDestRel);
			if (libFs.existsSync(tmpDestAbs))
			{
				return fCallback(new Error(`Destination already exists at index ${i}: ${tmpDestRel}`));
			}

			tmpValidatedMoves.push(
			{
				Source: tmpSourceRel,
				Destination: tmpDestRel,
				SourceAbs: tmpSourceAbs,
				DestAbs: tmpDestAbs
			});
		}

		// Execute moves sequentially
		let tmpCompleted = [];
		let tmpFailed = [];
		let tmpIndex = 0;

		function _moveNext()
		{
			if (tmpIndex >= tmpValidatedMoves.length)
			{
				// Record batch in Bibliograph for undo
				let tmpBatchGUID = tmpSelf.fable.getUUID();
				let tmpBatchRecord =
				{
					GUID: tmpBatchGUID,
					Timestamp: new Date().toISOString(),
					Moves: tmpCompleted,
					FailedCount: tmpFailed.length,
					Status: (tmpFailed.length === 0) ? 'completed' : 'partial'
				};

				tmpSelf.fable.Bibliograph.write(SOURCE_NAME, tmpBatchGUID, tmpBatchRecord,
					(pWriteError) =>
					{
						if (pWriteError)
						{
							tmpSelf.fable.log.warn(`Failed to record batch: ${pWriteError.message}`);
						}

						return fCallback(null,
						{
							BatchGUID: tmpBatchGUID,
							Completed: tmpCompleted,
							Failed: tmpFailed,
							TotalMoved: tmpCompleted.length,
							TotalFailed: tmpFailed.length
						});
					});
				return;
			}

			let tmpMove = tmpValidatedMoves[tmpIndex];
			tmpIndex++;

			try
			{
				// Create parent directory if needed
				let tmpDestDir = libPath.dirname(tmpMove.DestAbs);
				if (!libFs.existsSync(tmpDestDir))
				{
					libFs.mkdirSync(tmpDestDir, { recursive: true });
				}

				// Try rename first
				try
				{
					libFs.renameSync(tmpMove.SourceAbs, tmpMove.DestAbs);
				}
				catch (pRenameError)
				{
					if (pRenameError.code === 'EXDEV')
					{
						libFs.copyFileSync(tmpMove.SourceAbs, tmpMove.DestAbs);
						libFs.unlinkSync(tmpMove.SourceAbs);
					}
					else
					{
						throw pRenameError;
					}
				}

				tmpCompleted.push({ Source: tmpMove.Source, Destination: tmpMove.Destination });
			}
			catch (pMoveError)
			{
				tmpFailed.push(
				{
					Source: tmpMove.Source,
					Destination: tmpMove.Destination,
					Error: pMoveError.message
				});
			}

			_moveNext();
		}

		// Initialize Bibliograph source, then proceed
		this.fable.Bibliograph.createSource(SOURCE_NAME,
			(pCreateError) =>
			{
				// createSource may error if source exists; that's fine
				_moveNext();
			});
	}

	/**
	 * Undo a previously executed batch by reversing all moves.
	 *
	 * @param {string} pBatchGUID
	 * @param {function} fCallback - Callback(pError, { Reversed, Failed })
	 */
	undoBatch(pBatchGUID, fCallback)
	{
		let tmpSelf = this;

		this.fable.Bibliograph.createSource(SOURCE_NAME,
			(pCreateError) =>
			{
				tmpSelf.fable.Bibliograph.read(SOURCE_NAME, pBatchGUID,
					(pReadError, pRecord) =>
					{
						if (pReadError || !pRecord)
						{
							return fCallback(new Error('Batch not found: ' + pBatchGUID));
						}

						if (pRecord.Status === 'undone')
						{
							return fCallback(new Error('Batch already undone.'));
						}

						let tmpMoves = pRecord.Moves || [];
						let tmpReversed = [];
						let tmpFailed = [];

						// Reverse in reverse order
						for (let i = tmpMoves.length - 1; i >= 0; i--)
						{
							let tmpMove = tmpMoves[i];

							try
							{
								let tmpCurrentAbs = libPath.join(tmpSelf.contentPath, tmpMove.Destination);
								let tmpOriginalAbs = libPath.join(tmpSelf.contentPath, tmpMove.Source);

								if (!libFs.existsSync(tmpCurrentAbs))
								{
									tmpFailed.push(
									{
										Source: tmpMove.Destination,
										Destination: tmpMove.Source,
										Error: 'File not found at current location'
									});
									continue;
								}

								// Re-create original directory if needed
								let tmpOrigDir = libPath.dirname(tmpOriginalAbs);
								if (!libFs.existsSync(tmpOrigDir))
								{
									libFs.mkdirSync(tmpOrigDir, { recursive: true });
								}

								try
								{
									libFs.renameSync(tmpCurrentAbs, tmpOriginalAbs);
								}
								catch (pRenameError)
								{
									if (pRenameError.code === 'EXDEV')
									{
										libFs.copyFileSync(tmpCurrentAbs, tmpOriginalAbs);
										libFs.unlinkSync(tmpCurrentAbs);
									}
									else
									{
										throw pRenameError;
									}
								}

								tmpReversed.push({ Source: tmpMove.Destination, Destination: tmpMove.Source });
							}
							catch (pUndoError)
							{
								tmpFailed.push(
								{
									Source: tmpMove.Destination,
									Destination: tmpMove.Source,
									Error: pUndoError.message
								});
							}
						}

						// Update batch record
						pRecord.Status = 'undone';
						pRecord.UndoneAt = new Date().toISOString();

						tmpSelf.fable.Bibliograph.write(SOURCE_NAME, pBatchGUID, pRecord,
							(pWriteError) =>
							{
								return fCallback(null,
								{
									Reversed: tmpReversed,
									Failed: tmpFailed,
									TotalReversed: tmpReversed.length,
									TotalFailed: tmpFailed.length
								});
							});
					});
			});
	}

	/**
	 * Wire REST endpoints.
	 *
	 * @param {object} pServiceServer - The Orator service server
	 */
	connectRoutes(pServiceServer)
	{
		let tmpSelf = this;
		let tmpServer = pServiceServer.server;

		// --- POST /api/files/mkdir ---
		tmpServer.post('/api/files/mkdir',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpPath = tmpSelf._sanitizePath(pRequest.body && pRequest.body.Path);

					if (!tmpPath)
					{
						pResponse.send(400, { Success: false, Error: 'Invalid path.' });
						return fNext();
					}

					let tmpAbsPath = libPath.join(tmpSelf.contentPath, tmpPath);

					if (libFs.existsSync(tmpAbsPath))
					{
						pResponse.send(200, { Success: true, Path: tmpPath, AlreadyExists: true });
						return fNext();
					}

					libFs.mkdirSync(tmpAbsPath, { recursive: true });
					pResponse.send(200, { Success: true, Path: tmpPath });
					return fNext();
				}
				catch (pError)
				{
					pResponse.send(500, { Success: false, Error: pError.message });
					return fNext();
				}
			});

		// --- POST /api/files/move ---
		tmpServer.post('/api/files/move',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpSource = pRequest.body && pRequest.body.Source;
					let tmpDest = pRequest.body && pRequest.body.Destination;

					tmpSelf.moveFile(tmpSource, tmpDest,
						(pError, pResult) =>
						{
							if (pError)
							{
								pResponse.send(400, { Success: false, Error: pError.message });
								return fNext();
							}
							pResponse.send(200, { Success: true, Source: pResult.Source, Destination: pResult.Destination });
							return fNext();
						});
				}
				catch (pError)
				{
					pResponse.send(500, { Success: false, Error: pError.message });
					return fNext();
				}
			});

		// --- POST /api/files/move-batch ---
		tmpServer.post('/api/files/move-batch',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpMoves = pRequest.body && pRequest.body.Moves;

					tmpSelf.moveBatch(tmpMoves,
						(pError, pResult) =>
						{
							if (pError)
							{
								pResponse.send(400, { Success: false, Error: pError.message });
								return fNext();
							}
							pResponse.send(200,
							{
								Success: true,
								BatchGUID: pResult.BatchGUID,
								TotalMoved: pResult.TotalMoved,
								TotalFailed: pResult.TotalFailed,
								Completed: pResult.Completed,
								Failed: pResult.Failed
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

		// --- POST /api/files/undo-batch ---
		tmpServer.post('/api/files/undo-batch',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpBatchGUID = pRequest.body && pRequest.body.BatchGUID;

					if (!tmpBatchGUID)
					{
						pResponse.send(400, { Success: false, Error: 'Missing BatchGUID.' });
						return fNext();
					}

					tmpSelf.undoBatch(tmpBatchGUID,
						(pError, pResult) =>
						{
							if (pError)
							{
								pResponse.send(400, { Success: false, Error: pError.message });
								return fNext();
							}
							pResponse.send(200,
							{
								Success: true,
								TotalReversed: pResult.TotalReversed,
								TotalFailed: pResult.TotalFailed,
								Reversed: pResult.Reversed,
								Failed: pResult.Failed
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
	}
}

module.exports = RetoldRemoteFileOperationService;
