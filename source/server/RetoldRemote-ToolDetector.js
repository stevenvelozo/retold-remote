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
			exiftool: this._detectCommand('exiftool -ver'),
			dcraw: this._detectCommandExists('dcraw'),
			dcrawJs: this._detectModule('dcraw'),
			dcrawJsModule: this._loadModule('dcraw')
		};

		return this._capabilities;
	}

	/**
	 * Check if the sharp module is available AND functional.
	 *
	 * A bare require('sharp') can succeed even when the native binary
	 * is missing or incompatible (e.g. on Synology NAS where node-gyp
	 * can't compile).  To catch that, we create a tiny 1×1 pixel
	 * buffer synchronously — this exercises the native or WASM binding.
	 *
	 * Sharp's internal resolution chain tries the native platform binary
	 * first, then falls back to @img/sharp-wasm32 if installed.  We
	 * detect which mode is active by checking whether the native
	 * platform package resolves.
	 *
	 * @returns {{ available: boolean, mode: string|null, module: function|null }}
	 */
	_detectSharp()
	{
		try
		{
			let tmpSharp = require('sharp');
			// Smoke test: instantiate with raw pixel data to exercise the
			// native or WASM binding (the constructor validates immediately).
			tmpSharp(Buffer.from([0, 0, 0]), { raw: { width: 1, height: 1, channels: 3 } });

			// Determine mode: check if the native platform package directory
			// exists in node_modules.  require.resolve() can fail due to
			// exports map issues, so we check the filesystem directly.
			let tmpMode = 'native';
			try
			{
				let tmpLibFs = require('fs');
				let tmpLibPath = require('path');
				let tmpPlatform = process.platform + '-' + process.arch;
				let tmpNativePkgDir = tmpLibPath.join(__dirname, '..', '..', 'node_modules', '@img', 'sharp-' + tmpPlatform);
				if (!tmpLibFs.existsSync(tmpNativePkgDir))
				{
					tmpMode = 'wasm';
				}
			}
			catch (pError)
			{
				tmpMode = 'wasm';
			}

			return { available: true, mode: tmpMode, module: tmpSharp };
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
