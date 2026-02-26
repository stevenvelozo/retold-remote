/**
 * Retold Remote -- Ebook Conversion Service
 *
 * Converts MOBI/AZW/KF8 ebooks to EPUB using Calibre's ebook-convert tool.
 * Conversions are cached so repeated requests are instant.
 *
 * API:
 *   convertToEpub(pAbsPath, pRelPath, fCallback)
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
	"ContentPath": ".",
	"CachePath": null
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

		this.cachePath = this.options.CachePath
			|| libPath.join(process.cwd(), 'dist', 'retold-cache', 'ebook-conversions');

		// Ensure cache directory exists
		if (!libFs.existsSync(this.cachePath))
		{
			libFs.mkdirSync(this.cachePath, { recursive: true });
		}

		this.fable.log.info(`Ebook Service: cache at ${this.cachePath}`);
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
		return libPath.join(this.cachePath, tmpHash);
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

		try
		{
			// ebook-convert input.mobi output.epub
			let tmpCmd = `ebook-convert "${pAbsPath}" "${tmpOutputPath}"`;
			libChildProcess.execSync(tmpCmd, { stdio: 'ignore', timeout: 120000 });

			if (!libFs.existsSync(tmpOutputPath))
			{
				return fCallback(new Error('Conversion completed but output file not found.'));
			}

			let tmpOutputStat = libFs.statSync(tmpOutputPath);

			let tmpResult =
			{
				Success: true,
				SourcePath: pRelPath,
				CacheKey: libPath.basename(tmpCacheDir),
				OutputFilename: tmpOutputFilename,
				FileSize: tmpOutputStat.size,
				ConvertedAt: new Date().toISOString()
			};

			// Write manifest to cache
			try
			{
				libFs.writeFileSync(tmpManifestPath, JSON.stringify(tmpResult, null, '\t'));
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

		let tmpPath = libPath.join(this.cachePath, pCacheKey, pFilename);

		// Double-check it's under our cache dir
		let tmpResolved = libPath.resolve(tmpPath);
		if (!tmpResolved.startsWith(this.cachePath))
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
