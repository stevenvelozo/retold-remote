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
	 * @returns {object} { sharp, imagemagick, ffmpeg, ffprobe }
	 */
	detect()
	{
		if (this._capabilities)
		{
			return this._capabilities;
		}

		this._capabilities =
		{
			sharp: this._detectSharp(),
			imagemagick: this._detectCommand('identify --version'),
			ffmpeg: this._detectCommand('ffmpeg -version'),
			ffprobe: this._detectCommand('ffprobe -version')
		};

		return this._capabilities;
	}

	/**
	 * Check if the sharp module is available.
	 *
	 * @returns {boolean}
	 */
	_detectSharp()
	{
		try
		{
			require('sharp');
			return true;
		}
		catch (pError)
		{
			return false;
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
