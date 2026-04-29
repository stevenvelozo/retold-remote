/**
 * Retold Remote -- Server-Side Tool Detector
 *
 * Detects availability of media processing tools at server startup.
 * Results are cached for the lifetime of the process.
 */
const libChildProcess = require('child_process');

class ToolDetector
{
	constructor()
	{
		this._capabilities = null;
	}

	/**
	 * Detect all available tools and return a capabilities object.
	 * Results are cached after the first call.
	 *
	 * @returns {object} { sharp, sharpMode, sharpModule, imagemagick, ffmpeg, ffprobe, ... }
	 */
	detect()
	{
		if (this._capabilities)
		{
			return this._capabilities;
		}

		let tmpSharpResult = this._detectSharp();

		this._capabilities =
		{
			sharp: tmpSharpResult.available,
			sharpMode: tmpSharpResult.mode,
			sharpModule: tmpSharpResult.module,
			imagemagick: this._detectCommand('identify --version'),
			ffmpeg: this._detectCommand('ffmpeg -version'),
			ffprobe: this._detectCommand('ffprobe -version'),
			vlc: this._detectVLC(),
			p7zip: this._detectCommand('7z --help'),
			audiowaveform: this._detectCommand('audiowaveform --version'),
			ebook_convert: this._detectCommand('ebook-convert --version'),
			libreoffice: this._detectLibreOffice(),
			exiftool: this._detectCommand('exiftool -ver'),
			dcraw: this._detectCommandExists('dcraw'),
			dcrawJs: this._detectModule('dcraw'),
			dcrawJsModule: this._loadModule('dcraw')
		};

		return this._capabilities;
	}

	/**
	 * Check if sharp is available AND functional via the retold-sharp wrapper.
	 * retold-sharp.checkAvailable() runs the smoke test (1x1 raw pixel buffer)
	 * to catch the case where the module loads but the underlying binary won't
	 * actually run on this machine (e.g. Synology NAS).
	 *
	 * @returns {{ available: boolean, mode: string|null, module: function|null }}
	 */
	_detectSharp()
	{
		try
		{
			let tmpRetoldSharp = require('retold-sharp');
			let tmpStatus = tmpRetoldSharp.checkAvailable();
			return {
				available: tmpStatus.available,
				mode: tmpStatus.mode,
				module: tmpStatus.available ? tmpRetoldSharp : null
			};
		}
		catch (pError)
		{
			return { available: false, mode: null, module: null };
		}
	}

	/**
	 * Check if VLC is available.
	 * macOS: check for the .app bundle.
	 * Windows: check the default install path.
	 * Linux: check the vlc command.
	 *
	 * @returns {boolean}
	 */
	_detectVLC()
	{
		const libFS = require('fs');

		// macOS: check for VLC.app
		try
		{
			if (libFS.existsSync('/Applications/VLC.app'))
			{
				return true;
			}
		}
		catch (pError)
		{
			// ignore
		}

		// Windows: check the default install path
		if (process.platform === 'win32')
		{
			try
			{
				if (libFS.existsSync('C:\\Program Files\\VideoLAN\\VLC\\vlc.exe'))
				{
					return true;
				}
				// Check 32-bit install location on 64-bit Windows
				if (libFS.existsSync('C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe'))
				{
					return true;
				}
			}
			catch (pError)
			{
				// ignore
			}
		}

		// Linux / other: try vlc --version
		return this._detectCommand('vlc --version');
	}

	/**
	 * Detect LibreOffice for headless document conversion.
	 * macOS: check for the .app bundle (soffice in the bundle).
	 * Linux: check the soffice command.
	 * Windows: check default install paths.
	 *
	 * @returns {boolean}
	 */
	_detectLibreOffice()
	{
		const libFS = require('fs');

		// macOS: check for LibreOffice.app
		try
		{
			if (libFS.existsSync('/Applications/LibreOffice.app/Contents/MacOS/soffice'))
			{
				return true;
			}
		}
		catch (pError)
		{
			// ignore
		}

		// Windows: check default install paths
		if (process.platform === 'win32')
		{
			try
			{
				if (libFS.existsSync('C:\\Program Files\\LibreOffice\\program\\soffice.exe'))
				{
					return true;
				}
				if (libFS.existsSync('C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe'))
				{
					return true;
				}
			}
			catch (pError)
			{
				// ignore
			}
		}

		// Linux / other: check soffice on PATH
		return this._detectCommandExists('soffice');
	}

	/**
	 * Check if a command-line tool exists on the PATH using 'which'.
	 * Useful for tools that exit non-zero when invoked with no arguments (e.g. dcraw).
	 *
	 * @param {string} pToolName - The tool name (e.g. 'dcraw')
	 * @returns {boolean}
	 */
	_detectCommandExists(pToolName)
	{
		try
		{
			libChildProcess.execSync('which ' + pToolName, { stdio: 'ignore', timeout: 5000 });
			return true;
		}
		catch (pError)
		{
			return false;
		}
	}

	/**
	 * Check if a Node module is available.
	 *
	 * @param {string} pModuleName - The module name (e.g. 'dcraw')
	 * @returns {boolean}
	 */
	_detectModule(pModuleName)
	{
		try
		{
			require(pModuleName);
			return true;
		}
		catch (pError)
		{
			return false;
		}
	}

	/**
	 * Load and return a Node module, or null if unavailable.
	 *
	 * @param {string} pModuleName - The module name (e.g. 'dcraw')
	 * @returns {*|null}
	 */
	_loadModule(pModuleName)
	{
		try
		{
			return require(pModuleName);
		}
		catch (pError)
		{
			return null;
		}
	}

	/**
	 * Check if a command-line tool is available by running it.
	 *
	 * @param {string} pCommand - The command to test (e.g. 'ffmpeg -version')
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
}

module.exports = ToolDetector;
