/**
 * Retold Remote -- Archive Service
 *
 * Provides transparent browsing of archive files (zip, 7z, rar, tar.*).
 * When 7z (p7zip) is available, it is used for listing and extraction.
 * Otherwise, falls back to yauzl for .zip files only.
 *
 * Archives are treated as navigable containers — their contents appear
 * as standard file entries that the gallery and viewer can consume.
 *
 * Extracted files are cached under dist/retold-cache/archives/<hash>/
 * so repeated access is fast.  The cache key includes the archive's mtime
 * so modifications automatically invalidate the cache.
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFs = require('fs');
const libPath = require('path');
const libCrypto = require('crypto');
const libChildProcess = require('child_process');

const libToolDetector = require('./RetoldRemote-ToolDetector.js');

// Multi-segment extensions must come first so they match before single-segment ones
const _ArchiveExtensions = ['.tar.gz', '.tar.bz2', '.tar.xz', '.tgz', '.zip', '.7z', '.rar', '.tar', '.cbz', '.cbr'];

// Extensions that the native yauzl fallback can handle (cbz is zip-based)
const _NativeZipExtensions = { '.zip': true, '.cbz': true };

// Quick lookup set for isArchiveFile()
const _ArchiveExtensionSet = {};
for (let i = 0; i < _ArchiveExtensions.length; i++)
{
	_ArchiveExtensionSet[_ArchiveExtensions[i]] = true;
}

// Common MIME types for serving extracted files
const _MimeTypes =
{
	'.html': 'text/html', '.htm': 'text/html',
	'.css': 'text/css', '.js': 'application/javascript',
	'.json': 'application/json', '.xml': 'application/xml',
	'.txt': 'text/plain', '.md': 'text/plain',
	'.csv': 'text/csv',
	'.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
	'.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
	'.bmp': 'image/bmp', '.ico': 'image/x-icon',
	'.avif': 'image/avif', '.tiff': 'image/tiff', '.tif': 'image/tiff',
	'.heic': 'image/heic', '.heif': 'image/heif',
	'.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
	'.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
	'.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
	'.flac': 'audio/flac', '.aac': 'audio/aac', '.m4a': 'audio/mp4',
	'.pdf': 'application/pdf', '.zip': 'application/zip',
	'.7z': 'application/x-7z-compressed', '.rar': 'application/x-rar-compressed',
	'.tar': 'application/x-tar', '.gz': 'application/gzip'
};

const _DefaultServiceConfiguration =
{
	"ContentPath": ".",
	"CachePath": null
};

class RetoldRemoteArchiveService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteArchiveService';

		// Merge with defaults
		for (let tmpKey in _DefaultServiceConfiguration)
		{
			if (!(tmpKey in this.options))
			{
				this.options[tmpKey] = _DefaultServiceConfiguration[tmpKey];
			}
		}

		this.contentPath = libPath.resolve(this.options.ContentPath);

		this.archiveCachePath = this.options.CachePath
			|| libPath.join(process.cwd(), 'dist', 'retold-cache', 'archives');

		// Ensure cache directory exists
		if (!libFs.existsSync(this.archiveCachePath))
		{
			libFs.mkdirSync(this.archiveCachePath, { recursive: true });
		}

		// Detect 7z availability
		let tmpDetector = new libToolDetector();
		let tmpCapabilities = tmpDetector.detect();
		this.has7z = !!tmpCapabilities.p7zip;

		// Try to load yauzl
		this.hasYauzl = false;
		try
		{
			this._yauzl = require('yauzl');
			this.hasYauzl = true;
		}
		catch (pError)
		{
			this._yauzl = null;
		}

		this.fable.log.info(`Archive Service: 7z=${this.has7z}, yauzl=${this.hasYauzl}`);
	}

	// ──────────────────────────────────────────────
	// Path parsing
	// ──────────────────────────────────────────────

	/**
	 * Scan a relative path for an archive boundary.
	 *
	 * Walks segments of the path, checking if the accumulated path ends
	 * with a known archive extension.  Multi-segment extensions like
	 * .tar.gz are tested first.
	 *
	 * @param {string} pRelativePath - The relative path to parse
	 * @returns {object|null} { archivePath, innerPath, extension } or null
	 */
	parseArchivePath(pRelativePath)
	{
		if (!pRelativePath || typeof (pRelativePath) !== 'string')
		{
			return null;
		}

		let tmpSegments = pRelativePath.split('/');
		let tmpAccumulated = '';

		for (let i = 0; i < tmpSegments.length; i++)
		{
			tmpAccumulated = tmpAccumulated
				? (tmpAccumulated + '/' + tmpSegments[i])
				: tmpSegments[i];

			let tmpLower = tmpAccumulated.toLowerCase();

			for (let j = 0; j < _ArchiveExtensions.length; j++)
			{
				if (tmpLower.endsWith(_ArchiveExtensions[j]))
				{
					let tmpInnerPath = tmpSegments.slice(i + 1).join('/');
					return {
						archivePath: tmpAccumulated,
						innerPath: tmpInnerPath || '',
						extension: _ArchiveExtensions[j]
					};
				}
			}
		}

		return null;
	}

	/**
	 * Check if a file extension is a known archive type.
	 *
	 * @param {string} pExtension - Extension including dot (e.g. '.zip')
	 * @returns {boolean}
	 */
	isArchiveFile(pExtension)
	{
		if (!pExtension)
		{
			return false;
		}
		let tmpExt = pExtension.toLowerCase();
		// Also handle compound extensions
		return !!_ArchiveExtensionSet[tmpExt];
	}

	/**
	 * Check if a given archive extension can be handled with the current tools.
	 *
	 * @param {string} pExtension - Archive extension (e.g. '.zip')
	 * @returns {boolean}
	 */
	canHandle(pExtension)
	{
		if (this.has7z)
		{
			// 7z can handle all archive types
			return this.isArchiveFile(pExtension);
		}
		// yauzl only handles .zip
		return this.hasYauzl && !!_NativeZipExtensions[pExtension.toLowerCase()];
	}

	/**
	 * Get the list of supported extensions.
	 *
	 * @returns {Array} Array of extension strings
	 */
	getSupportedExtensions()
	{
		if (this.has7z)
		{
			return _ArchiveExtensions.slice();
		}
		return Object.keys(_NativeZipExtensions);
	}

	/**
	 * Get MIME type for a file extension.
	 *
	 * @param {string} pExtension - Extension including dot (e.g. '.jpg')
	 * @returns {string}
	 */
	getMimeType(pExtension)
	{
		return _MimeTypes[pExtension.toLowerCase()] || 'application/octet-stream';
	}

	// ──────────────────────────────────────────────
	// Cache management
	// ──────────────────────────────────────────────

	/**
	 * Build a cache directory path for a given archive file.
	 * The key is derived from the archive path and its mtime
	 * so that modifications automatically invalidate the cache.
	 *
	 * @param {string} pArchiveAbsPath - Absolute path to the archive
	 * @returns {string} Absolute path to the cache subdirectory
	 */
	_getArchiveCacheDir(pArchiveAbsPath)
	{
		let tmpMtime = 0;
		try
		{
			let tmpStat = libFs.statSync(pArchiveAbsPath);
			tmpMtime = tmpStat.mtimeMs;
		}
		catch (pError)
		{
			// Use 0 if stat fails
		}

		let tmpInput = `${pArchiveAbsPath}:${tmpMtime}`;
		let tmpHash = libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
		let tmpDir = libPath.join(this.archiveCachePath, tmpHash);

		if (!libFs.existsSync(tmpDir))
		{
			libFs.mkdirSync(tmpDir, { recursive: true });
		}

		return tmpDir;
	}

	// ──────────────────────────────────────────────
	// Listing
	// ──────────────────────────────────────────────

	/**
	 * List the contents of an archive, filtered to direct children
	 * of the given inner path.
	 *
	 * @param {string}   pArchiveAbsPath  - Absolute path to the archive file
	 * @param {string}   pInnerPath       - Path within the archive ('' for root)
	 * @param {string}   pArchiveRelPath  - Relative path of the archive (for building entry Paths)
	 * @param {Function} fCallback        - Callback(pError, pFileList)
	 */
	listContents(pArchiveAbsPath, pInnerPath, pArchiveRelPath, fCallback)
	{
		let tmpSelf = this;
		let tmpExtension = '';

		// Determine the extension of the archive
		let tmpLower = pArchiveAbsPath.toLowerCase();
		for (let i = 0; i < _ArchiveExtensions.length; i++)
		{
			if (tmpLower.endsWith(_ArchiveExtensions[i]))
			{
				tmpExtension = _ArchiveExtensions[i];
				break;
			}
		}

		if (!this.canHandle(tmpExtension))
		{
			return fCallback(new Error(`No tools available for ${tmpExtension} archives.`));
		}

		// Get the full listing, then filter to the requested directory
		let tmpListFn = this.has7z
			? this._list7z.bind(this)
			: this._listYauzl.bind(this);

		tmpListFn(pArchiveAbsPath,
			(pError, pAllEntries) =>
			{
				if (pError)
				{
					return fCallback(pError);
				}

				// Filter to direct children of pInnerPath
				let tmpResult = tmpSelf._filterToDirectory(pAllEntries, pInnerPath, pArchiveRelPath);
				return fCallback(null, tmpResult);
			});
	}

	/**
	 * Filter a flat list of archive entries to the direct children of
	 * the given directory path.  Synthesizes folder entries for
	 * intermediate directories that don't have explicit entries.
	 *
	 * @param {Array}  pAllEntries     - Flat list of all entries in the archive
	 * @param {string} pInnerPath      - The directory within the archive to list
	 * @param {string} pArchiveRelPath - Relative archive path for building entry Paths
	 * @returns {Array} File entries for the requested directory
	 */
	_filterToDirectory(pAllEntries, pInnerPath, pArchiveRelPath)
	{
		let tmpPrefix = pInnerPath ? (pInnerPath + '/') : '';
		let tmpPrefixLen = tmpPrefix.length;

		// Track which direct child names we've seen (to avoid duplicates and synthesize folders)
		let tmpSeenNames = {};
		let tmpResult = [];

		for (let i = 0; i < pAllEntries.length; i++)
		{
			let tmpEntry = pAllEntries[i];
			let tmpEntryPath = tmpEntry._innerPath || '';

			// Skip entries that aren't under the requested directory
			if (tmpPrefix && !tmpEntryPath.startsWith(tmpPrefix))
			{
				continue;
			}

			// If no prefix, skip the root directory itself (empty path)
			if (!tmpPrefix && !tmpEntryPath)
			{
				continue;
			}

			// Get the portion after the prefix
			let tmpRemainder = tmpEntryPath.substring(tmpPrefixLen);

			// Remove trailing slash for directory entries
			if (tmpRemainder.endsWith('/'))
			{
				tmpRemainder = tmpRemainder.substring(0, tmpRemainder.length - 1);
			}

			if (!tmpRemainder)
			{
				continue;
			}

			// Check if this is a direct child (no more slashes)
			let tmpSlashIdx = tmpRemainder.indexOf('/');

			if (tmpSlashIdx >= 0)
			{
				// This is a deeper entry — synthesize a folder for the first segment
				let tmpFolderName = tmpRemainder.substring(0, tmpSlashIdx);
				if (!tmpSeenNames[tmpFolderName])
				{
					tmpSeenNames[tmpFolderName] = true;
					let tmpFolderInnerPath = tmpPrefix + tmpFolderName;
					tmpResult.push(
					{
						Type: 'folder',
						Name: tmpFolderName,
						Path: pArchiveRelPath + '/' + tmpFolderInnerPath,
						Size: 0,
						Modified: tmpEntry.Modified || '',
						Extension: ''
					});
				}
			}
			else
			{
				// Direct child
				let tmpName = tmpRemainder;
				if (tmpSeenNames[tmpName])
				{
					continue;
				}
				tmpSeenNames[tmpName] = true;

				if (tmpEntry.Type === 'folder')
				{
					tmpResult.push(
					{
						Type: 'folder',
						Name: tmpName,
						Path: pArchiveRelPath + '/' + (tmpPrefix + tmpName),
						Size: 0,
						Modified: tmpEntry.Modified || '',
						Extension: ''
					});
				}
				else
				{
					let tmpExt = libPath.extname(tmpName).toLowerCase();
					let tmpFileEntry =
					{
						Type: 'file',
						Name: tmpName,
						Path: pArchiveRelPath + '/' + (tmpPrefix + tmpName),
						Size: tmpEntry.Size || 0,
						Modified: tmpEntry.Modified || '',
						Extension: tmpExt
					};

					// If this is itself an archive, mark it
					if (this.isArchiveFile(tmpExt) && this.canHandle(tmpExt))
					{
						tmpFileEntry.Type = 'archive';
					}

					tmpResult.push(tmpFileEntry);
				}
			}
		}

		// Sort: folders first, then alphabetically
		tmpResult.sort((pA, pB) =>
		{
			if (pA.Type === 'folder' && pB.Type !== 'folder') return -1;
			if (pA.Type !== 'folder' && pB.Type === 'folder') return 1;
			return pA.Name.localeCompare(pB.Name);
		});

		return tmpResult;
	}

	/**
	 * List archive contents using 7z.
	 *
	 * @param {string}   pArchiveAbsPath - Absolute path to the archive
	 * @param {Function} fCallback       - Callback(pError, pEntries)
	 */
	_list7z(pArchiveAbsPath, fCallback)
	{
		try
		{
			let tmpOutput = libChildProcess.execSync(
				`7z l -slt "${pArchiveAbsPath}"`,
				{
					maxBuffer: 50 * 1024 * 1024,
					timeout: 60000,
					encoding: 'utf8'
				});

			let tmpEntries = this._parse7zOutput(tmpOutput);
			return fCallback(null, tmpEntries);
		}
		catch (pError)
		{
			return fCallback(new Error(`7z listing failed: ${pError.message}`));
		}
	}

	/**
	 * Parse the structured output of `7z l -slt`.
	 *
	 * Output has blocks separated by blank lines.  Each block contains
	 * key = value lines.  We look for Path, Size, Attributes, and Modified.
	 *
	 * @param {string} pOutput - Raw stdout from 7z
	 * @returns {Array} Parsed entry objects with _innerPath, Type, Size, Modified
	 */
	_parse7zOutput(pOutput)
	{
		let tmpEntries = [];
		let tmpLines = pOutput.split('\n');
		let tmpCurrent = null;
		let tmpInHeader = true;

		for (let i = 0; i < tmpLines.length; i++)
		{
			let tmpLine = tmpLines[i].trim();

			if (tmpLine === '')
			{
				if (tmpCurrent && tmpCurrent._innerPath)
				{
					tmpEntries.push(tmpCurrent);
				}
				tmpCurrent = null;
				continue;
			}

			// Lines before the first "----------" are header
			if (tmpLine.startsWith('----------'))
			{
				tmpInHeader = false;
				continue;
			}

			if (tmpInHeader)
			{
				continue;
			}

			let tmpEqIdx = tmpLine.indexOf(' = ');
			if (tmpEqIdx < 0)
			{
				continue;
			}

			let tmpKey = tmpLine.substring(0, tmpEqIdx).trim();
			let tmpValue = tmpLine.substring(tmpEqIdx + 3).trim();

			if (!tmpCurrent)
			{
				tmpCurrent = { _innerPath: '', Type: 'file', Size: 0, Modified: '' };
			}

			switch (tmpKey)
			{
				case 'Path':
					// Normalize separators to forward slashes
					tmpCurrent._innerPath = tmpValue.replace(/\\/g, '/');
					break;
				case 'Size':
					tmpCurrent.Size = parseInt(tmpValue, 10) || 0;
					break;
				case 'Attributes':
					if (tmpValue.indexOf('D') >= 0)
					{
						tmpCurrent.Type = 'folder';
					}
					break;
				case 'Modified':
					tmpCurrent.Modified = tmpValue;
					break;
			}
		}

		// Flush the last entry
		if (tmpCurrent && tmpCurrent._innerPath)
		{
			tmpEntries.push(tmpCurrent);
		}

		return tmpEntries;
	}

	/**
	 * List archive contents using yauzl (zip-only fallback).
	 *
	 * @param {string}   pArchiveAbsPath - Absolute path to the zip file
	 * @param {Function} fCallback       - Callback(pError, pEntries)
	 */
	_listYauzl(pArchiveAbsPath, fCallback)
	{
		if (!this._yauzl)
		{
			return fCallback(new Error('yauzl is not available.'));
		}

		this._yauzl.open(pArchiveAbsPath, { lazyEntries: true },
			(pError, pZipFile) =>
			{
				if (pError)
				{
					return fCallback(new Error(`Failed to open zip: ${pError.message}`));
				}

				let tmpEntries = [];

				pZipFile.on('entry',
					(pEntry) =>
					{
						let tmpPath = pEntry.fileName;
						let tmpIsDir = tmpPath.endsWith('/');

						tmpEntries.push(
						{
							_innerPath: tmpPath,
							Type: tmpIsDir ? 'folder' : 'file',
							Size: tmpIsDir ? 0 : (pEntry.uncompressedSize || 0),
							Modified: pEntry.getLastModDate ? pEntry.getLastModDate().toISOString() : ''
						});

						pZipFile.readEntry();
					});

				pZipFile.on('end',
					() =>
					{
						return fCallback(null, tmpEntries);
					});

				pZipFile.on('error',
					(pZipError) =>
					{
						return fCallback(new Error(`Zip read error: ${pZipError.message}`));
					});

				pZipFile.readEntry();
			});
	}

	// ──────────────────────────────────────────────
	// Extraction
	// ──────────────────────────────────────────────

	/**
	 * Extract a single file from an archive to the cache directory.
	 * Returns the absolute path to the extracted file.
	 *
	 * Checks cache first — if the file is already extracted, returns
	 * immediately.
	 *
	 * @param {string}   pArchiveAbsPath - Absolute path to the archive
	 * @param {string}   pInnerFilePath  - Path within the archive
	 * @param {Function} fCallback       - Callback(pError, pExtractedPath)
	 */
	extractFile(pArchiveAbsPath, pInnerFilePath, fCallback)
	{
		if (!pInnerFilePath)
		{
			return fCallback(new Error('No inner file path specified.'));
		}

		// Security: reject path traversal in archive entries
		let tmpNormalized = libPath.normalize(pInnerFilePath);
		if (tmpNormalized.startsWith('..') || libPath.isAbsolute(tmpNormalized))
		{
			return fCallback(new Error('Invalid inner path.'));
		}

		let tmpCacheDir = this._getArchiveCacheDir(pArchiveAbsPath);
		let tmpOutputPath = libPath.join(tmpCacheDir, tmpNormalized);

		// Security: verify the output path stays within the cache dir
		let tmpResolvedOutput = libPath.resolve(tmpOutputPath);
		let tmpResolvedCache = libPath.resolve(tmpCacheDir);
		if (!tmpResolvedOutput.startsWith(tmpResolvedCache))
		{
			return fCallback(new Error('Path traversal detected in archive entry.'));
		}

		// Check cache
		if (libFs.existsSync(tmpOutputPath))
		{
			return fCallback(null, tmpOutputPath);
		}

		// Ensure parent directory exists
		let tmpParentDir = libPath.dirname(tmpOutputPath);
		if (!libFs.existsSync(tmpParentDir))
		{
			libFs.mkdirSync(tmpParentDir, { recursive: true });
		}

		// Determine extension to choose extraction method
		let tmpLower = pArchiveAbsPath.toLowerCase();
		let tmpExtension = '';
		for (let i = 0; i < _ArchiveExtensions.length; i++)
		{
			if (tmpLower.endsWith(_ArchiveExtensions[i]))
			{
				tmpExtension = _ArchiveExtensions[i];
				break;
			}
		}

		if (this.has7z)
		{
			return this._extract7z(pArchiveAbsPath, pInnerFilePath, tmpOutputPath, fCallback);
		}
		else if (this.hasYauzl && _NativeZipExtensions[tmpExtension])
		{
			return this._extractYauzl(pArchiveAbsPath, pInnerFilePath, tmpOutputPath, fCallback);
		}
		else
		{
			return fCallback(new Error(`No extraction tools available for ${tmpExtension}.`));
		}
	}

	/**
	 * Extract a single file using 7z.
	 *
	 * @param {string}   pArchiveAbsPath - Absolute path to the archive
	 * @param {string}   pInnerFilePath  - Path within the archive
	 * @param {string}   pOutputPath     - Absolute destination path
	 * @param {Function} fCallback       - Callback(pError, pExtractedPath)
	 */
	_extract7z(pArchiveAbsPath, pInnerFilePath, pOutputPath, fCallback)
	{
		try
		{
			// 7z x extracts with full paths; we extract to the cache dir
			let tmpCacheDir = libPath.dirname(pOutputPath);

			// Use 7z e (extract without paths) to a temp location, then move
			// Or use 7z x to preserve directory structure
			// Using x with -o to extract maintaining structure into cache
			let tmpBaseDir = this._getArchiveCacheDir(pArchiveAbsPath);

			libChildProcess.execSync(
				`7z x "${pArchiveAbsPath}" -o"${tmpBaseDir}" "${pInnerFilePath}" -y`,
				{
					maxBuffer: 50 * 1024 * 1024,
					timeout: 120000,
					stdio: 'ignore'
				});

			// The file should now be at tmpBaseDir + pInnerFilePath
			let tmpExtractedPath = libPath.join(tmpBaseDir, pInnerFilePath);

			if (libFs.existsSync(tmpExtractedPath))
			{
				return fCallback(null, tmpExtractedPath);
			}
			else
			{
				return fCallback(new Error('7z extraction produced no output file.'));
			}
		}
		catch (pError)
		{
			return fCallback(new Error(`7z extraction failed: ${pError.message}`));
		}
	}

	/**
	 * Extract a single file using yauzl (zip-only).
	 *
	 * @param {string}   pArchiveAbsPath - Absolute path to the zip file
	 * @param {string}   pInnerFilePath  - Path within the zip
	 * @param {string}   pOutputPath     - Absolute destination path
	 * @param {Function} fCallback       - Callback(pError, pExtractedPath)
	 */
	_extractYauzl(pArchiveAbsPath, pInnerFilePath, pOutputPath, fCallback)
	{
		if (!this._yauzl)
		{
			return fCallback(new Error('yauzl is not available.'));
		}

		let tmpCallbackFired = false;

		function fireCallback(pError, pResult)
		{
			if (tmpCallbackFired) return;
			tmpCallbackFired = true;
			return fCallback(pError, pResult);
		}

		this._yauzl.open(pArchiveAbsPath, { lazyEntries: true },
			(pError, pZipFile) =>
			{
				if (pError)
				{
					return fireCallback(new Error(`Failed to open zip: ${pError.message}`));
				}

				let tmpFound = false;

				pZipFile.on('entry',
					(pEntry) =>
					{
						// Match the requested file (normalize slashes)
						let tmpEntryPath = pEntry.fileName.replace(/\\/g, '/');
						let tmpTargetPath = pInnerFilePath.replace(/\\/g, '/');

						if (tmpEntryPath === tmpTargetPath)
						{
							tmpFound = true;
							pZipFile.openReadStream(pEntry,
								(pStreamError, pReadStream) =>
								{
									if (pStreamError)
									{
										return fireCallback(new Error(`Zip stream error: ${pStreamError.message}`));
									}

									let tmpWriteStream = libFs.createWriteStream(pOutputPath);

									tmpWriteStream.on('finish',
										() =>
										{
											return fireCallback(null, pOutputPath);
										});

									tmpWriteStream.on('error',
										(pWriteError) =>
										{
											return fireCallback(new Error(`Write error: ${pWriteError.message}`));
										});

									pReadStream.pipe(tmpWriteStream);
								});
						}
						else
						{
							pZipFile.readEntry();
						}
					});

				pZipFile.on('end',
					() =>
					{
						if (!tmpFound)
						{
							return fireCallback(new Error(`File not found in archive: ${pInnerFilePath}`));
						}
					});

				pZipFile.on('error',
					(pZipError) =>
					{
						return fireCallback(new Error(`Zip error: ${pZipError.message}`));
					});

				pZipFile.readEntry();
			});
	}
}

module.exports = RetoldRemoteArchiveService;
