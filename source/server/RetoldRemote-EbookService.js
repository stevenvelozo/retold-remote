/**
 * Retold Remote -- Document Conversion Service
 *
 * Converts ebooks (MOBI/AZW/KF8) to EPUB and document formats
 * (DOC/DOCX/RTF/ODT/WPD) to PDF for in-browser viewing.
 *
 * Uses:
 *   - Calibre's ebook-convert for EPUB conversions
 *   - LibreOffice headless for PDF conversions (preferred for layout docs)
 *   - ebook-convert as fallback for PDF if LibreOffice unavailable
 *
 * API:
 *   convertToEpub(pAbsPath, pRelPath, fCallback)
 *     -> { Success, CacheKey, OutputFilename, SourcePath, FileSize }
 *   convertToPdf(pAbsPath, pRelPath, fCallback)
 *     -> { Success, CacheKey, OutputFilename, SourcePath, FileSize }
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');
const libChildProcess = require('child_process');

const _DefaultServiceConfiguration =
{
	"ContentPath": "."
};

// Extensions that can be converted to EPUB by ebook-convert
const _ConvertibleExtensions =
{
	'mobi': true,
	'azw': true,
	'azw3': true,
	'kf8': true,
	'kfx': true,
	'fb2': true,
	'lit': true,
	'pdb': true,
	'rtf': true,
	'txt': true,
	'docx': true,
	'odt': true,
	'cbz': true,
	'cbr': true
};

// Extensions that should be converted to PDF for viewing
// (layout-heavy documents that benefit from fixed-page rendering)
const _PdfConvertibleExtensions =
{
	'doc': true,
	'docx': true,
	'rtf': true,
	'odt': true,
	'wpd': true,    // WordPerfect
	'wps': true,    // Microsoft Works
	'pages': true,  // Apple Pages (LibreOffice can sometimes handle)
	'odp': true,    // OpenDocument Presentation
	'ppt': true,    // PowerPoint
	'pptx': true,   // PowerPoint (XML)
	'ods': true,    // OpenDocument Spreadsheet
	'xls': true,    // Excel
	'xlsx': true,   // Excel (XML)
	'csv': true     // CSV (renders as table in PDF)
};

class RetoldRemoteEbookService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteEbookService';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		// Ultravisor dispatcher — set via setDispatcher()
		this._dispatcher = null;

		// Orator-Conversion service reference — set via setConversionService()
		this._conversionService = null;

		// Operation broadcaster — set via setBroadcaster()
		this._broadcaster = null;

		this.fable.log.info('Ebook Service: using ParimeBinaryStorage (category: ebook-cache)');
	}

	/**
	 * Set the orator-conversion service reference for document conversion.
	 * Called from Server-Setup after the conversion service is instantiated.
	 *
	 * @param {object} pService - OratorFileTranslation instance
	 */
	setConversionService(pService)
	{
		this._conversionService = pService;
	}

	/**
	 * Set the Ultravisor dispatcher for offloading heavy processing.
	 *
	 * @param {object} pDispatcher - RetoldRemoteUltravisorDispatcher instance
	 */
	setDispatcher(pDispatcher)
	{
		this._dispatcher = pDispatcher;
	}

	/**
	 * Set the operation broadcaster for progress events and cancellation.
	 */
	setBroadcaster(pBroadcaster)
	{
		this._broadcaster = pBroadcaster;
	}

	_emitProgress(pOperationId, pPayload)
	{
		if (this._broadcaster && pOperationId)
		{
			this._broadcaster.broadcastProgress(pOperationId, pPayload);
		}
	}

	_isCancelled(pOperationId)
	{
		return !!(this._broadcaster && pOperationId && this._broadcaster.isCancelled(pOperationId));
	}

	/**
	 * Check if a file extension is convertible to EPUB.
	 *
	 * @param {string} pExtension - Lowercase file extension (no dot)
	 * @returns {boolean}
	 */
	isConvertible(pExtension)
	{
		return !!_ConvertibleExtensions[pExtension];
	}

	/**
	 * Check if a file extension can be converted to PDF for viewing.
	 *
	 * @param {string} pExtension - Lowercase file extension (no dot)
	 * @returns {boolean}
	 */
	isPdfConvertible(pExtension)
	{
		return !!_PdfConvertibleExtensions[pExtension];
	}

	/**
	 * Get the cache directory for a specific ebook file.
	 * The key is based on the absolute path and modification time,
	 * so cache is automatically invalidated when the file changes.
	 *
	 * @param {string} pAbsPath - Absolute path to the ebook
	 * @param {number} pMtimeMs - Modification time in ms
	 * @returns {string} Absolute path to the cache directory
	 */
	_getCacheDir(pAbsPath, pMtimeMs)
	{
		let tmpInput = `${pAbsPath}:${pMtimeMs}`;
		let tmpHash = libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
		return this.fable.ParimeBinaryStorage.resolvePath('ebook-cache', tmpHash);
	}

	/**
	 * Convert an ebook to EPUB using Calibre's ebook-convert.
	 * Results are cached for fast repeated access.
	 *
	 * @param {string}   pAbsPath  - Absolute path to the source ebook
	 * @param {string}   pRelPath  - Relative path (for the response)
	 * @param {Function} fCallback - Callback(pError, pResult)
	 */
	convertToEpub(pAbsPath, pRelPath, fCallback)
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

		let tmpCacheDir = this._getCacheDir(pAbsPath, tmpStat.mtimeMs);

		// Check for cached manifest
		let tmpManifestPath = libPath.join(tmpCacheDir, 'manifest.json');
		if (libFs.existsSync(tmpManifestPath))
		{
			try
			{
				let tmpManifest = JSON.parse(libFs.readFileSync(tmpManifestPath, 'utf8'));
				// Verify the output file still exists
				let tmpOutputPath = libPath.join(tmpCacheDir, tmpManifest.OutputFilename);
				if (libFs.existsSync(tmpOutputPath))
				{
					this.fable.log.info(`Ebook conversion cache hit for ${pRelPath}`);
					return fCallback(null, tmpManifest);
				}
			}
			catch (pError)
			{
				// Corrupted manifest, regenerate
			}
		}

		// Ensure cache directory exists
		if (!libFs.existsSync(tmpCacheDir))
		{
			libFs.mkdirSync(tmpCacheDir, { recursive: true });
		}

		let tmpOutputFilename = 'converted.epub';
		let tmpOutputPath = libPath.join(tmpCacheDir, tmpOutputFilename);

		this.fable.log.info(`Converting ebook: ${pRelPath} -> EPUB`);

		let _finishConversion = (pOutputPath, pOutputFilename, pCacheDir, pManifestPath) =>
		{
			if (!libFs.existsSync(pOutputPath))
			{
				return fCallback(new Error('Conversion completed but output file not found.'));
			}

			let tmpOutputStat = libFs.statSync(pOutputPath);

			let tmpResult =
			{
				Success: true,
				SourcePath: pRelPath,
				CacheKey: libPath.basename(pCacheDir),
				OutputFilename: pOutputFilename,
				FileSize: tmpOutputStat.size,
				ConvertedAt: new Date().toISOString()
			};

			// Write manifest to cache
			try
			{
				libFs.writeFileSync(pManifestPath, JSON.stringify(tmpResult, null, '\t'));
			}
			catch (pWriteError)
			{
				tmpSelf.fable.log.warn(`Could not write ebook manifest: ${pWriteError.message}`);
			}

			tmpSelf.fable.log.info(`Converted ebook: ${pRelPath} (${tmpOutputStat.size} bytes)`);
			return fCallback(null, tmpResult);
		};

		// Try Ultravisor operation trigger first
		if (this._dispatcher && this._dispatcher.isAvailable())
		{
			let tmpRelPath;
			try
			{
				tmpRelPath = libPath.relative(this.contentPath, pAbsPath);
			}
			catch (pErr)
			{
				tmpRelPath = null;
			}

			if (tmpRelPath && !tmpRelPath.startsWith('..'))
			{
				this._dispatcher.triggerOperation('rr-ebook-convert',
				{
					EbookAddress: '>retold-remote/File/' + tmpRelPath
				},
				(pTriggerError, pResult) =>
				{
					if (!pTriggerError && pResult && pResult.OutputBuffer)
					{
						try
						{
							libFs.writeFileSync(tmpOutputPath, pResult.OutputBuffer);
							tmpSelf.fable.log.info(`Ebook converted via operation trigger for ${tmpRelPath}`);
							return _finishConversion(tmpOutputPath, tmpOutputFilename, tmpCacheDir, tmpManifestPath);
						}
						catch (pWriteError)
						{
							// Fall through to local
						}
					}

					// Fall through to local processing
					tmpSelf.fable.log.info(`Operation trigger failed for ebook conversion, falling back to local: ${pTriggerError ? pTriggerError.message : 'no output'}`);
					tmpSelf._convertToEpubLocal(pAbsPath, tmpOutputPath, tmpOutputFilename, tmpCacheDir, tmpManifestPath, pRelPath, fCallback);
				});
				return;
			}
		}

		this._convertToEpubLocal(pAbsPath, tmpOutputPath, tmpOutputFilename, tmpCacheDir, tmpManifestPath, pRelPath, fCallback);
	}

	/**
	 * Convert an ebook to EPUB locally using ebook-convert.
	 *
	 * @param {string}   pAbsPath        - Absolute path to the source ebook
	 * @param {string}   pOutputPath     - Absolute path for the output EPUB
	 * @param {string}   pOutputFilename - Output filename
	 * @param {string}   pCacheDir       - Cache directory path
	 * @param {string}   pManifestPath   - Manifest file path
	 * @param {string}   pRelPath        - Relative path (for logging)
	 * @param {Function} fCallback       - Callback(pError, pResult)
	 */
	_convertToEpubLocal(pAbsPath, pOutputPath, pOutputFilename, pCacheDir, pManifestPath, pRelPath, fCallback)
	{
		let tmpSelf = this;

		try
		{
			// ebook-convert input.mobi output.epub
			let tmpCmd = `ebook-convert "${pAbsPath}" "${pOutputPath}"`;
			libChildProcess.execSync(tmpCmd, { stdio: 'ignore', timeout: 120000 });

			if (!libFs.existsSync(pOutputPath))
			{
				return fCallback(new Error('Conversion completed but output file not found.'));
			}

			let tmpOutputStat = libFs.statSync(pOutputPath);

			let tmpResult =
			{
				Success: true,
				SourcePath: pRelPath,
				CacheKey: libPath.basename(pCacheDir),
				OutputFilename: pOutputFilename,
				FileSize: tmpOutputStat.size,
				ConvertedAt: new Date().toISOString()
			};

			// Write manifest to cache
			try
			{
				libFs.writeFileSync(pManifestPath, JSON.stringify(tmpResult, null, '\t'));
			}
			catch (pWriteError)
			{
				tmpSelf.fable.log.warn(`Could not write ebook manifest: ${pWriteError.message}`);
			}

			tmpSelf.fable.log.info(`Converted ebook: ${pRelPath} (${tmpOutputStat.size} bytes)`);
			return fCallback(null, tmpResult);
		}
		catch (pError)
		{
			return fCallback(new Error('Ebook conversion failed: ' + pError.message));
		}
	}

	/**
	 * Convert a document to PDF via the orator-conversion doc-to-pdf converter.
	 * Falls back to ebook-convert if the conversion service is not available.
	 * Results are cached for fast repeated access.
	 *
	 * @param {string}   pAbsPath  - Absolute path to the source document
	 * @param {string}   pRelPath  - Relative path (for the response)
	 * @param {Function} fCallback - Callback(pError, pResult)
	 */
	convertToPdf(pAbsPath, pRelPath, fCallback)
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

		let tmpCacheDir = this._getCacheDir(pAbsPath, tmpStat.mtimeMs);

		// Check for cached manifest
		let tmpManifestPath = libPath.join(tmpCacheDir, 'manifest-pdf.json');
		if (libFs.existsSync(tmpManifestPath))
		{
			try
			{
				let tmpManifest = JSON.parse(libFs.readFileSync(tmpManifestPath, 'utf8'));
				let tmpOutputPath = libPath.join(tmpCacheDir, tmpManifest.OutputFilename);
				if (libFs.existsSync(tmpOutputPath))
				{
					this.fable.log.info(`PDF conversion cache hit for ${pRelPath}`);
					return fCallback(null, tmpManifest);
				}
			}
			catch (pError)
			{
				// Corrupted manifest, regenerate
			}
		}

		// Ensure cache directory exists
		if (!libFs.existsSync(tmpCacheDir))
		{
			libFs.mkdirSync(tmpCacheDir, { recursive: true });
		}

		let tmpOutputFilename = 'converted.pdf';
		let tmpOutputPath = libPath.join(tmpCacheDir, tmpOutputFilename);
		let tmpExt = libPath.extname(pAbsPath).replace(/^\./, '').toLowerCase();

		this.fable.log.info(`Converting document to PDF: ${pRelPath}`);

		// Try orator-conversion doc-to-pdf converter first
		if (this._conversionService && this._conversionService.converters['doc-to-pdf'])
		{
			let tmpInputBuffer = libFs.readFileSync(pAbsPath);
			let tmpMockRequest = { query: { ext: tmpExt }, params: {} };

			this._conversionService.converters['doc-to-pdf'](tmpInputBuffer, tmpMockRequest,
				(pConvertError, pPdfBuffer) =>
				{
					if (!pConvertError && pPdfBuffer && pPdfBuffer.length > 0)
					{
						libFs.writeFileSync(tmpOutputPath, pPdfBuffer);
						return tmpSelf._finishPdfConversion(tmpOutputPath, tmpOutputFilename, tmpCacheDir, tmpManifestPath, pRelPath, 'orator-conversion', fCallback);
					}

					// Fall back to ebook-convert
					tmpSelf.fable.log.info(`Orator-conversion failed, trying ebook-convert: ${pConvertError ? pConvertError.message : 'empty output'}`);
					tmpSelf._convertToPdfLocal(pAbsPath, tmpOutputPath, tmpOutputFilename, tmpCacheDir, tmpManifestPath, pRelPath, fCallback);
				});
		}
		else
		{
			// No orator-conversion doc-to-pdf — fall back to ebook-convert
			this._convertToPdfLocal(pAbsPath, tmpOutputPath, tmpOutputFilename, tmpCacheDir, tmpManifestPath, pRelPath, fCallback);
		}
	}

	/**
	 * Convert to PDF locally using Calibre's ebook-convert.
	 */
	_convertToPdfLocal(pAbsPath, pOutputPath, pOutputFilename, pCacheDir, pManifestPath, pRelPath, fCallback)
	{
		try
		{
			let tmpCmd = `ebook-convert "${pAbsPath}" "${pOutputPath}"`;
			libChildProcess.execSync(tmpCmd, { stdio: 'ignore', timeout: 120000 });

			if (!libFs.existsSync(pOutputPath))
			{
				return fCallback(new Error('ebook-convert produced no output file.'));
			}

			return this._finishPdfConversion(pOutputPath, pOutputFilename, pCacheDir, pManifestPath, pRelPath, 'ebook-convert', fCallback);
		}
		catch (pError)
		{
			return fCallback(new Error('Document conversion failed: ' + pError.message));
		}
	}

	/**
	 * Finalize a PDF conversion: write manifest and return result.
	 */
	_finishPdfConversion(pOutputPath, pOutputFilename, pCacheDir, pManifestPath, pRelPath, pTool, fCallback)
	{
		let tmpOutputStat = libFs.statSync(pOutputPath);

		let tmpResult =
		{
			Success: true,
			SourcePath: pRelPath,
			CacheKey: libPath.basename(pCacheDir),
			OutputFilename: pOutputFilename,
			FileSize: tmpOutputStat.size,
			ConvertedAt: new Date().toISOString(),
			ConvertedWith: pTool
		};

		try
		{
			libFs.writeFileSync(pManifestPath, JSON.stringify(tmpResult, null, '\t'));
		}
		catch (pWriteError)
		{
			this.fable.log.warn(`Could not write PDF manifest: ${pWriteError.message}`);
		}

		this.fable.log.info(`Converted to PDF: ${pRelPath} (${tmpOutputStat.size} bytes, via ${pTool})`);
		return fCallback(null, tmpResult);
	}

	/**
	 * Get the absolute path to a cached converted ebook file.
	 *
	 * @param {string} pCacheKey  - The cache key (directory name)
	 * @param {string} pFilename  - The output filename
	 * @returns {string|null} Absolute path or null if not found
	 */
	getConvertedPath(pCacheKey, pFilename)
	{
		// Sanitize inputs to prevent directory traversal
		if (!pCacheKey || !pFilename)
		{
			return null;
		}
		if (pCacheKey.includes('..') || pCacheKey.includes('/') || pCacheKey.includes('\\'))
		{
			return null;
		}
		if (pFilename.includes('..') || pFilename.includes('/') || pFilename.includes('\\'))
		{
			return null;
		}

		let tmpCacheDir = this.fable.ParimeBinaryStorage.resolvePath('ebook-cache', pCacheKey);
		let tmpPath = libPath.join(tmpCacheDir, pFilename);

		// Double-check it's under the storage root
		let tmpResolved = libPath.resolve(tmpPath);
		if (!tmpResolved.startsWith(this.fable.ParimeBinaryStorage.storageRoot))
		{
			return null;
		}

		if (libFs.existsSync(tmpPath))
		{
			return tmpPath;
		}

		return null;
	}
}

module.exports = RetoldRemoteEbookService;
