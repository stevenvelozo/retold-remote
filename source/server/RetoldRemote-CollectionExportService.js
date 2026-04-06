/**
 * Retold Remote -- Collection Export Service
 *
 * Exports a collection's items to a subfolder within the content root.
 * Handles all item types:
 *   - file: copy directly
 *   - subfile: extract from archive
 *   - image-crop: extract region via sharp
 *   - video-clip: extract clip via ffmpeg
 *   - video-frame: extract single frame via ffmpeg
 *   - audio-clip: extract segment via ffmpeg
 *   - folder/folder-contents: copy folder or contents
 *
 * API:
 *   POST /api/collections/:guid/export
 *   Body: { DestinationPath: 'relative/path/within/content-root' }
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');
const libChildProcess = require('child_process');

const _DefaultServiceConfiguration =
{
	"ContentPath": "."
};

class RetoldRemoteCollectionExportService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteCollectionExportService';

		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		// External dependencies (set via setter methods)
		this._sharp = null;
		this._collectionService = null;
		this._hasFfmpeg = this._detectCommand('ffmpeg -version');

		this.fable.log.info('Collection Export Service initialized');
		this.fable.log.info(`  ffmpeg: ${this._hasFfmpeg ? 'available' : 'not found'}`);
	}

	/**
	 * Set the sharp module reference.
	 *
	 * @param {object} pSharp - The sharp module
	 */
	setSharpModule(pSharp)
	{
		this._sharp = pSharp;
	}

	/**
	 * Set the collection service reference (for reading collections).
	 *
	 * @param {object} pService - RetoldRemoteCollectionService instance
	 */
	setCollectionService(pService)
	{
		this._collectionService = pService;
	}

	/**
	 * Check if a command-line tool is available.
	 *
	 * @param {string} pCommand - The command to test
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
	 * Sanitize a string for use as a filename.
	 *
	 * @param {string} pStr - Input string
	 * @returns {string} Sanitized filename
	 */
	_sanitizeFilename(pStr)
	{
		return (pStr || 'unnamed')
			.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
			.replace(/\s+/g, '_')
			.replace(/_+/g, '_')
			.substring(0, 200);
	}

	/**
	 * Format a timestamp in seconds to a compact string for filenames.
	 *
	 * @param {number} pSeconds - Timestamp in seconds
	 * @returns {string} e.g. "1m30s" or "1h02m15s"
	 */
	_formatTimestampCompact(pSeconds)
	{
		if (typeof pSeconds !== 'number' || isNaN(pSeconds))
		{
			return '0s';
		}

		let tmpTotal = Math.floor(pSeconds);
		let tmpHours = Math.floor(tmpTotal / 3600);
		let tmpMinutes = Math.floor((tmpTotal % 3600) / 60);
		let tmpSecs = tmpTotal % 60;

		if (tmpHours > 0)
		{
			return tmpHours + 'h' + (tmpMinutes < 10 ? '0' : '') + tmpMinutes + 'm' + (tmpSecs < 10 ? '0' : '') + tmpSecs + 's';
		}
		if (tmpMinutes > 0)
		{
			return tmpMinutes + 'm' + (tmpSecs < 10 ? '0' : '') + tmpSecs + 's';
		}
		return tmpSecs + 's';
	}

	/**
	 * Format a ffmpeg-compatible timestamp.
	 *
	 * @param {number} pSeconds - Timestamp in seconds
	 * @returns {string} e.g. "00:01:30.500"
	 */
	_formatFfmpegTimestamp(pSeconds)
	{
		let tmpTotal = Math.floor(pSeconds);
		let tmpMs = Math.round((pSeconds - tmpTotal) * 1000);
		let tmpH = Math.floor(tmpTotal / 3600);
		let tmpM = Math.floor((tmpTotal % 3600) / 60);
		let tmpS = tmpTotal % 60;
		return (tmpH < 10 ? '0' : '') + tmpH + ':' +
			(tmpM < 10 ? '0' : '') + tmpM + ':' +
			(tmpS < 10 ? '0' : '') + tmpS + '.' +
			(tmpMs < 100 ? '0' : '') + (tmpMs < 10 ? '0' : '') + tmpMs;
	}

	/**
	 * Get the file extension from a path.
	 *
	 * @param {string} pPath - File path
	 * @returns {string} Extension without dot, lowercase
	 */
	_getExtension(pPath)
	{
		return (pPath || '').replace(/^.*\./, '').toLowerCase();
	}

	/**
	 * Export a single item to the destination folder.
	 *
	 * @param {object}   pItem      - Collection item
	 * @param {number}   pIndex     - Item index (for filename prefix)
	 * @param {string}   pDestDir   - Absolute destination directory path
	 * @param {Function} fCallback  - Callback(pError, pResult)
	 */
	_exportItem(pItem, pIndex, pDestDir, fCallback)
	{
		let tmpPrefix = String(pIndex + 1).padStart(3, '0');
		let tmpType = pItem.Type || 'file';

		try
		{
			switch (tmpType)
			{
				case 'file':
				case 'subfile':
					return this._exportFile(pItem, tmpPrefix, pDestDir, fCallback);

				case 'image-crop':
					return this._exportImageCrop(pItem, tmpPrefix, pDestDir, fCallback);

				case 'video-clip':
					return this._exportVideoClip(pItem, tmpPrefix, pDestDir, fCallback);

				case 'video-frame':
					return this._exportVideoFrame(pItem, tmpPrefix, pDestDir, fCallback);

				case 'audio-clip':
					return this._exportAudioClip(pItem, tmpPrefix, pDestDir, fCallback);

				case 'document-region':
					return this._exportDocumentRegion(pItem, tmpPrefix, pDestDir, fCallback);

				case 'folder':
				case 'folder-contents':
					return this._exportFolder(pItem, tmpPrefix, pDestDir, fCallback);

				default:
					return fCallback(null, { Skipped: true, Reason: 'Unsupported type: ' + tmpType });
			}
		}
		catch (pError)
		{
			return fCallback(null, { Error: pError.message });
		}
	}

	/**
	 * Export a regular file by copying it.
	 */
	_exportFile(pItem, pPrefix, pDestDir, fCallback)
	{
		let tmpSrcPath = libPath.join(this.contentPath, pItem.Path);
		if (!libFs.existsSync(tmpSrcPath))
		{
			return fCallback(null, { Error: 'Source file not found: ' + pItem.Path });
		}

		let tmpOrigName = libPath.basename(pItem.Path);
		let tmpLabel = pItem.Label ? this._sanitizeFilename(pItem.Label) : null;
		let tmpExt = libPath.extname(tmpOrigName);
		let tmpDestName = tmpLabel
			? pPrefix + '_' + tmpLabel + tmpExt
			: pPrefix + '_' + tmpOrigName;

		let tmpDestPath = libPath.join(pDestDir, tmpDestName);

		try
		{
			libFs.copyFileSync(tmpSrcPath, tmpDestPath);
			return fCallback(null, { Exported: tmpDestName });
		}
		catch (pError)
		{
			return fCallback(null, { Error: 'Copy failed: ' + pError.message });
		}
	}

	/**
	 * Export an image crop by extracting the region with sharp.
	 */
	_exportImageCrop(pItem, pPrefix, pDestDir, fCallback)
	{
		if (!this._sharp)
		{
			return fCallback(null, { Error: 'sharp not available — cannot export image crop' });
		}

		let tmpCrop = pItem.CropRegion;
		if (!tmpCrop || !tmpCrop.Width || !tmpCrop.Height)
		{
			return fCallback(null, { Error: 'Invalid crop region' });
		}

		let tmpSrcPath = libPath.join(this.contentPath, pItem.Path);
		if (!libFs.existsSync(tmpSrcPath))
		{
			return fCallback(null, { Error: 'Source file not found: ' + pItem.Path });
		}

		let tmpLabel = pItem.Label ? this._sanitizeFilename(pItem.Label) : 'crop';
		let tmpDestName = pPrefix + '_' + tmpLabel + '.jpg';
		let tmpDestPath = libPath.join(pDestDir, tmpDestName);

		this._sharp(tmpSrcPath, { limitInputPixels: false })
			.extract(
			{
				left: Math.max(0, Math.round(tmpCrop.X)),
				top: Math.max(0, Math.round(tmpCrop.Y)),
				width: Math.round(tmpCrop.Width),
				height: Math.round(tmpCrop.Height)
			})
			.jpeg({ quality: 95 })
			.toFile(tmpDestPath)
			.then(() =>
			{
				return fCallback(null, { Exported: tmpDestName });
			})
			.catch((pError) =>
			{
				return fCallback(null, { Error: 'Image crop failed: ' + pError.message });
			});
	}

	/**
	 * Export a video clip by extracting the time range with ffmpeg.
	 */
	_exportVideoClip(pItem, pPrefix, pDestDir, fCallback)
	{
		if (!this._hasFfmpeg)
		{
			return fCallback(null, { Error: 'ffmpeg not available — cannot export video clip' });
		}

		let tmpSrcPath = libPath.join(this.contentPath, pItem.Path);
		if (!libFs.existsSync(tmpSrcPath))
		{
			return fCallback(null, { Error: 'Source file not found: ' + pItem.Path });
		}

		let tmpStart = pItem.VideoStart || 0;
		let tmpEnd = pItem.VideoEnd || 0;
		let tmpDuration = tmpEnd - tmpStart;
		if (tmpDuration <= 0)
		{
			return fCallback(null, { Error: 'Invalid video clip range' });
		}

		let tmpExt = libPath.extname(pItem.Path) || '.mp4';
		let tmpLabel = pItem.Label
			? this._sanitizeFilename(pItem.Label)
			: 'clip_' + this._formatTimestampCompact(tmpStart) + '-' + this._formatTimestampCompact(tmpEnd);
		let tmpDestName = pPrefix + '_' + tmpLabel + tmpExt;
		let tmpDestPath = libPath.join(pDestDir, tmpDestName);

		let tmpStartStr = this._formatFfmpegTimestamp(tmpStart);
		let tmpDurationStr = this._formatFfmpegTimestamp(tmpDuration);

		try
		{
			let tmpCmd = `ffmpeg -ss ${tmpStartStr} -t ${tmpDurationStr} -i "${tmpSrcPath}" -c copy -y "${tmpDestPath}"`;
			libChildProcess.execSync(tmpCmd, { stdio: 'ignore', timeout: 120000 });

			if (libFs.existsSync(tmpDestPath))
			{
				return fCallback(null, { Exported: tmpDestName });
			}
			return fCallback(null, { Error: 'ffmpeg did not produce output file' });
		}
		catch (pError)
		{
			return fCallback(null, { Error: 'Video clip extraction failed: ' + pError.message });
		}
	}

	/**
	 * Export a single video frame as a JPEG image.
	 */
	_exportVideoFrame(pItem, pPrefix, pDestDir, fCallback)
	{
		if (!this._hasFfmpeg)
		{
			return fCallback(null, { Error: 'ffmpeg not available — cannot export video frame' });
		}

		let tmpSrcPath = libPath.join(this.contentPath, pItem.Path);
		if (!libFs.existsSync(tmpSrcPath))
		{
			return fCallback(null, { Error: 'Source file not found: ' + pItem.Path });
		}

		let tmpTimestamp = pItem.FrameTimestamp || 0;
		let tmpLabel = pItem.Label
			? this._sanitizeFilename(pItem.Label)
			: 'frame_' + this._formatTimestampCompact(tmpTimestamp);
		let tmpDestName = pPrefix + '_' + tmpLabel + '.jpg';
		let tmpDestPath = libPath.join(pDestDir, tmpDestName);

		let tmpTimeStr = this._formatFfmpegTimestamp(tmpTimestamp);

		try
		{
			let tmpCmd = `ffmpeg -ss ${tmpTimeStr} -i "${tmpSrcPath}" -vframes 1 -f mjpeg -y "${tmpDestPath}"`;
			libChildProcess.execSync(tmpCmd, { stdio: 'ignore', timeout: 30000 });

			if (libFs.existsSync(tmpDestPath))
			{
				return fCallback(null, { Exported: tmpDestName });
			}
			return fCallback(null, { Error: 'ffmpeg did not produce output file' });
		}
		catch (pError)
		{
			return fCallback(null, { Error: 'Frame extraction failed: ' + pError.message });
		}
	}

	/**
	 * Export an audio clip by extracting the time range with ffmpeg.
	 */
	_exportAudioClip(pItem, pPrefix, pDestDir, fCallback)
	{
		if (!this._hasFfmpeg)
		{
			return fCallback(null, { Error: 'ffmpeg not available — cannot export audio clip' });
		}

		let tmpSrcPath = libPath.join(this.contentPath, pItem.Path);
		if (!libFs.existsSync(tmpSrcPath))
		{
			return fCallback(null, { Error: 'Source file not found: ' + pItem.Path });
		}

		let tmpStart = pItem.AudioStart || 0;
		let tmpEnd = pItem.AudioEnd || 0;
		let tmpDuration = tmpEnd - tmpStart;
		if (tmpDuration <= 0)
		{
			return fCallback(null, { Error: 'Invalid audio clip range' });
		}

		let tmpExt = libPath.extname(pItem.Path) || '.mp3';
		let tmpLabel = pItem.Label
			? this._sanitizeFilename(pItem.Label)
			: 'clip_' + this._formatTimestampCompact(tmpStart) + '-' + this._formatTimestampCompact(tmpEnd);
		let tmpDestName = pPrefix + '_' + tmpLabel + tmpExt;
		let tmpDestPath = libPath.join(pDestDir, tmpDestName);

		let tmpStartStr = this._formatFfmpegTimestamp(tmpStart);
		let tmpDurationStr = this._formatFfmpegTimestamp(tmpDuration);

		try
		{
			let tmpCmd = `ffmpeg -ss ${tmpStartStr} -t ${tmpDurationStr} -i "${tmpSrcPath}" -vn -y "${tmpDestPath}"`;
			libChildProcess.execSync(tmpCmd, { stdio: 'ignore', timeout: 60000 });

			if (libFs.existsSync(tmpDestPath))
			{
				return fCallback(null, { Exported: tmpDestName });
			}
			return fCallback(null, { Error: 'ffmpeg did not produce output file' });
		}
		catch (pError)
		{
			return fCallback(null, { Error: 'Audio clip extraction failed: ' + pError.message });
		}
	}

	/**
	 * Export a document region — text selection as .txt, visual region as image crop if possible.
	 */
	_exportDocumentRegion(pItem, pPrefix, pDestDir, fCallback)
	{
		let tmpLabel = pItem.Label ? this._sanitizeFilename(pItem.Label) : 'region';
		let tmpRegionType = pItem.DocumentRegionType || 'text-selection';

		// If there's selected text, export as a text file
		if (pItem.SelectedText)
		{
			let tmpDestName = pPrefix + '_' + tmpLabel + '.txt';
			let tmpDestPath = libPath.join(pDestDir, tmpDestName);

			let tmpContent = '';
			if (pItem.Label)
			{
				tmpContent += pItem.Label + '\n';
				tmpContent += '='.repeat(pItem.Label.length) + '\n\n';
			}
			if (pItem.PageNumber)
			{
				tmpContent += 'Page ' + pItem.PageNumber + '\n';
			}
			if (pItem.Path)
			{
				tmpContent += 'Source: ' + pItem.Path + '\n';
			}
			tmpContent += '\n' + pItem.SelectedText;

			try
			{
				libFs.writeFileSync(tmpDestPath, tmpContent, 'utf8');
				return fCallback(null, { Exported: tmpDestName });
			}
			catch (pError)
			{
				return fCallback(null, { Error: 'Text export failed: ' + pError.message });
			}
		}

		// Visual region on PDF with crop coordinates — try to export as image
		if (tmpRegionType === 'visual-region' && pItem.CropRegion && pItem.PageNumber && this._sharp)
		{
			// For PDFs with visual regions, we'd need to render the page first
			// This is complex without pdfjs on the server — skip for now and export metadata
			let tmpDestName = pPrefix + '_' + tmpLabel + '.txt';
			let tmpDestPath = libPath.join(pDestDir, tmpDestName);
			let tmpContent = 'Visual region on ' + (pItem.Path || 'unknown') + '\n';
			tmpContent += 'Page ' + pItem.PageNumber + ', Region: '
				+ pItem.CropRegion.X + ',' + pItem.CropRegion.Y
				+ ' ' + pItem.CropRegion.Width + 'x' + pItem.CropRegion.Height + '\n';
			if (pItem.Label) tmpContent += 'Label: ' + pItem.Label + '\n';

			try
			{
				libFs.writeFileSync(tmpDestPath, tmpContent, 'utf8');
				return fCallback(null, { Exported: tmpDestName });
			}
			catch (pError)
			{
				return fCallback(null, { Error: 'Export failed: ' + pError.message });
			}
		}

		return fCallback(null, { Skipped: true, Reason: 'Document region has no exportable content' });
	}

	/**
	 * Export a folder or folder contents by copying files.
	 */
	_exportFolder(pItem, pPrefix, pDestDir, fCallback)
	{
		let tmpSrcDir = libPath.join(this.contentPath, pItem.Path);
		if (!libFs.existsSync(tmpSrcDir) || !libFs.statSync(tmpSrcDir).isDirectory())
		{
			return fCallback(null, { Error: 'Source folder not found: ' + pItem.Path });
		}

		let tmpFolderName = libPath.basename(pItem.Path);
		let tmpLabel = pItem.Label ? this._sanitizeFilename(pItem.Label) : tmpFolderName;

		if (pItem.Type === 'folder')
		{
			// Copy entire folder
			let tmpDestSubDir = libPath.join(pDestDir, pPrefix + '_' + tmpLabel);
			this._copyDirSync(tmpSrcDir, tmpDestSubDir);
			return fCallback(null, { Exported: pPrefix + '_' + tmpLabel + '/' });
		}

		// folder-contents: copy all files flat into the dest dir
		let tmpEntries = libFs.readdirSync(tmpSrcDir);
		let tmpCopied = 0;
		for (let i = 0; i < tmpEntries.length; i++)
		{
			let tmpEntry = libPath.join(tmpSrcDir, tmpEntries[i]);
			let tmpStat = libFs.statSync(tmpEntry);
			if (tmpStat.isFile())
			{
				libFs.copyFileSync(tmpEntry, libPath.join(pDestDir, tmpEntries[i]));
				tmpCopied++;
			}
		}
		return fCallback(null, { Exported: tmpCopied + ' files from ' + tmpFolderName });
	}

	/**
	 * Recursively copy a directory.
	 */
	_copyDirSync(pSrc, pDest)
	{
		libFs.mkdirSync(pDest, { recursive: true });
		let tmpEntries = libFs.readdirSync(pSrc);
		for (let i = 0; i < tmpEntries.length; i++)
		{
			let tmpSrcPath = libPath.join(pSrc, tmpEntries[i]);
			let tmpDestPath = libPath.join(pDest, tmpEntries[i]);
			let tmpStat = libFs.statSync(tmpSrcPath);
			if (tmpStat.isDirectory())
			{
				this._copyDirSync(tmpSrcPath, tmpDestPath);
			}
			else
			{
				libFs.copyFileSync(tmpSrcPath, tmpDestPath);
			}
		}
	}

	/**
	 * Connect REST routes for collection export.
	 *
	 * @param {object} pServiceServer - The Orator service server instance
	 */
	connectRoutes(pServiceServer)
	{
		let tmpSelf = this;
		let tmpContentPath = this.contentPath;

		// POST /api/collections/:guid/export
		pServiceServer.post('/api/collections/:guid/export',
			(pRequest, pResponse, fNext) =>
			{
				try
				{
					let tmpGUID = pRequest.params.guid;
					let tmpBody = pRequest.body || {};
					let tmpDestRelPath = tmpBody.DestinationPath;

					if (!tmpGUID)
					{
						pResponse.send(400, { Success: false, Error: 'Missing collection GUID.' });
						return fNext();
					}

					if (!tmpDestRelPath || typeof tmpDestRelPath !== 'string')
					{
						pResponse.send(400, { Success: false, Error: 'Missing DestinationPath in request body.' });
						return fNext();
					}

					// Sanitize destination path — must be within content root
					tmpDestRelPath = tmpDestRelPath.replace(/^\/+/, '');
					if (tmpDestRelPath.includes('..') || libPath.isAbsolute(tmpDestRelPath))
					{
						pResponse.send(400, { Success: false, Error: 'Destination path must be within the content root.' });
						return fNext();
					}

					let tmpDestDir = libPath.join(tmpContentPath, tmpDestRelPath);

					// Read the collection
					tmpSelf.fable.Bibliograph.read('retold-remote-collections', tmpGUID,
						(pReadError, pRecord) =>
						{
							if (pReadError || !pRecord)
							{
								pResponse.send(404, { Success: false, Error: 'Collection not found.' });
								return fNext();
							}

							let tmpItems = pRecord.Items || [];
							if (tmpItems.length === 0)
							{
								pResponse.send(400, { Success: false, Error: 'Collection is empty.' });
								return fNext();
							}

							// Create the destination directory
							try
							{
								libFs.mkdirSync(tmpDestDir, { recursive: true });
							}
							catch (pMkdirError)
							{
								pResponse.send(500, { Success: false, Error: 'Failed to create destination directory: ' + pMkdirError.message });
								return fNext();
							}

							// Export items sequentially (some use async sharp/ffmpeg)
							let tmpResults = [];
							let tmpExportedCount = 0;
							let tmpErrorCount = 0;

							let tmpExportNext = function (pIdx)
							{
								if (pIdx >= tmpItems.length)
								{
									// All done
									pResponse.send(
									{
										Success: true,
										ExportedCount: tmpExportedCount,
										ErrorCount: tmpErrorCount,
										TotalItems: tmpItems.length,
										DestinationPath: tmpDestRelPath,
										Results: tmpResults
									});
									return fNext();
								}

								tmpSelf._exportItem(tmpItems[pIdx], pIdx, tmpDestDir,
									(pItemError, pItemResult) =>
									{
										let tmpResult = pItemResult || {};
										tmpResult.Index = pIdx;
										tmpResult.Type = tmpItems[pIdx].Type;
										tmpResult.Label = tmpItems[pIdx].Label || '';

										if (tmpResult.Exported)
										{
											tmpExportedCount++;
										}
										else if (tmpResult.Error)
										{
											tmpErrorCount++;
										}

										tmpResults.push(tmpResult);
										tmpExportNext(pIdx + 1);
									});
							};

							tmpExportNext(0);
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

module.exports = RetoldRemoteCollectionExportService;
