const libCommandLineCommand = require('pict-service-commandlineutility').ServiceCommandLineCommand;

const libFs = require('fs');
const libPath = require('path');

class RetoldRemoteCommandServe extends libCommandLineCommand
{
	constructor(pFable, pManifest, pServiceHash)
	{
		super(pFable, pManifest, pServiceHash);

		this.options.CommandKeyword = 'serve';
		this.options.Description = 'Start the Retold Remote media browser for a folder.';

		this.options.CommandArguments.push(
			{ Name: '[content-path]', Description: 'Path to the media folder to browse (defaults to current directory).' });

		this.options.CommandOptions.push(
			{ Name: '-p, --port [port]', Description: 'Port to serve on (defaults to random 7000-7999).', Default: '0' });

		this.options.CommandOptions.push(
			{ Name: '--no-hash', Description: 'Disable hashed filenames mode (use plain paths in URLs instead of short hashes).', Default: false });

		this.options.CommandOptions.push(
			{ Name: '-c, --cache-path [path]', Description: 'Root cache directory (defaults to ./dist/retold-cache/).', Default: '' });
		this.options.CommandOptions.push(
			{ Name: '--cache-server [url]', Description: 'URL of a remote parime cache server (e.g. http://host:9999).', Default: '' });

		this.options.CommandOptions.push(
			{ Name: '-u, --ultravisor [url]', Description: 'Connect to Ultravisor mesh. URL defaults to http://localhost:54321 if omitted.', Default: '' });

		this.options.CommandOptions.push(
			{ Name: '--stack', Description: 'Run the full stack: spawn Ultravisor as a child process and connect to it. Uses XDG-style data paths under ~/.local/share and ~/.cache.', Default: false });

		this.options.CommandOptions.push(
			{ Name: '-l, --logfile [path]', Description: 'Write logs to a file (auto-generates timestamped name if path omitted).', Default: '' });

		this.options.CommandOptions.push(
			{ Name: '--direct-image-max-px [pixels]', Description: 'Max image pixel dimension (longest side) at-or-below which the viewer loads the source directly with a plain <img> tag. Above this and <= --explorer-launch-px, the server-generated preview is used. Default 5000.', Default: '' });

		this.options.CommandOptions.push(
			{ Name: '--explorer-launch-px [pixels]', Description: 'Pixel dimension (longest side) above which clicking an image auto-launches the OpenSeadragon explorer. Default 8192.', Default: '' });

		this.addCommand();
	}

	onRunAsync(fCallback)
	{
		// Set up file logging if -l was provided
		let tmpLogfileOpt = this.CommandOptions.logfile;
		if (tmpLogfileOpt)
		{
			let tmpLogfilePath;
			if (typeof tmpLogfileOpt === 'string' && tmpLogfileOpt.length > 0)
			{
				tmpLogfilePath = libPath.resolve(tmpLogfileOpt);
			}
			else
			{
				tmpLogfilePath = libPath.resolve(`retold-remote-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);
			}
			let tmpStreamDef = { loggertype: 'simpleflatfile', level: 'info', path: tmpLogfilePath, outputloglinestoconsole: false, outputobjectstoconsole: false };
			let tmpFileLogger = new this.fable.log._Providers.simpleflatfile(tmpStreamDef, this.fable.log);
			tmpFileLogger.initialize();
			this.fable.log.addLogger(tmpFileLogger, 'info');
			this.log.info(`Logging to file: ${tmpLogfilePath}`);
		}

		let tmpContentPath = libPath.resolve(this.ArgumentString || process.cwd());

		let tmpDistPath = libPath.resolve(__dirname, '..', '..', '..', 'web-application');
		let tmpPortOption = parseInt(this.CommandOptions.port, 10);
		let tmpPort = (tmpPortOption > 0) ? tmpPortOption : (7000 + Math.floor(Math.random() * 1000));

		// Validate web-application path
		if (!libFs.existsSync(tmpDistPath))
		{
			this.log.error(`Built assets not found at ${tmpDistPath}. Run 'npm run build' in the retold-remote package first.`);
			return fCallback(new Error('web-application folder not found'));
		}

		// Ensure content directory exists
		if (!libFs.existsSync(tmpContentPath))
		{
			libFs.mkdirSync(tmpContentPath, { recursive: true });
			this.log.info(`Created content directory: ${tmpContentPath}`);
		}

		let tmpSelf = this;
		let tmpHashedFilenames = !(this.CommandOptions.noHash);
		let tmpStackMode = !!this.CommandOptions.stack;

		// Resolve XDG-style stack paths once (used by --stack mode)
		let libStackLauncher = require('../RetoldRemote-Stack-Launcher.js');
		let tmpStackPaths = libStackLauncher.resolveStackPaths();

		// Cache root: explicit > stack default > package default
		let tmpCacheRoot = null;
		if (this.CommandOptions.cachePath)
		{
			tmpCacheRoot = libPath.resolve(this.CommandOptions.cachePath);
		}
		else if (tmpStackMode)
		{
			tmpCacheRoot = tmpStackPaths.RetoldCache;
		}

		let tmpCacheServer = this.CommandOptions.cacheServer || null;

		// -u with no URL → true (Commander behavior for [optional]), default to localhost
		let tmpUltravisorOpt = this.CommandOptions.ultravisor;
		let tmpUltravisorURL = null;
		if (tmpUltravisorOpt === true)
		{
			tmpUltravisorURL = 'http://localhost:54321';
		}
		else if (typeof tmpUltravisorOpt === 'string' && tmpUltravisorOpt.length > 0)
		{
			tmpUltravisorURL = tmpUltravisorOpt;
		}

		// In stack mode, automatically set the ultravisor URL
		if (tmpStackMode && !tmpUltravisorURL)
		{
			tmpUltravisorURL = 'http://localhost:54321';
		}

		// Hold the stack info so we can clean up on exit
		let tmpStackInfo = null;

		// Bind the actual server startup so we can call it after (optionally) launching ultravisor
		let _startRetoldRemote = () =>
		{
			let tmpSetupServer = require('../RetoldRemote-Server-Setup.js');

			let tmpSetupOptions =
			{
				ContentPath: tmpContentPath,
				DistPath: tmpDistPath,
				Port: tmpPort,
				HashedFilenames: tmpHashedFilenames,
				CacheRoot: tmpCacheRoot,
				CacheServer: tmpCacheServer,
				UltravisorURL: tmpUltravisorURL
			};

			let _parsePxOption = (pValue) =>
			{
				if (typeof pValue !== 'string' || pValue.length === 0)
				{
					return null;
				}
				let tmpPx = parseInt(pValue, 10);
				return (!isNaN(tmpPx) && tmpPx >= 0) ? tmpPx : null;
			};
			let tmpDirectMaxPx = _parsePxOption(this.CommandOptions.directImageMaxPx);
			if (tmpDirectMaxPx !== null)
			{
				tmpSetupOptions.DirectDisplayMaxPixelDimension = tmpDirectMaxPx;
			}
			let tmpExplorerMinPx = _parsePxOption(this.CommandOptions.explorerLaunchPx);
			if (tmpExplorerMinPx !== null)
			{
				tmpSetupOptions.ExplorerLaunchPixelDimension = tmpExplorerMinPx;
			}

			tmpSetupServer(
				tmpSetupOptions,
				function (pError, pServerInfo)
				{
					if (pError)
					{
						tmpSelf.log.error(`Failed to start server: ${pError.message}`);
						if (tmpStackInfo)
						{
							libStackLauncher.stop(tmpStackInfo, () => {});
						}
						return fCallback(pError);
					}

					tmpSelf.log.info('');
					tmpSelf.log.info('==========================================================');
					tmpSelf.log.info(`  Retold Remote running on http://localhost:${pServerInfo.Port}`);
					tmpSelf.log.info('==========================================================');
					tmpSelf.log.info(`  Content: ${tmpContentPath}`);
					tmpSelf.log.info(`  Cache:   ${tmpCacheRoot || '(default)'}`);
					tmpSelf.log.info(`  Browse:  http://localhost:${pServerInfo.Port}/`);
					if (pServerInfo.UltravisorBeacon && pServerInfo.UltravisorBeacon.isEnabled())
					{
						tmpSelf.log.info(`  Beacon:  registered with Ultravisor at ${tmpUltravisorURL}`);
					}
					else if (tmpUltravisorURL)
					{
						tmpSelf.log.info(`  Beacon:  not connected (Ultravisor may be unreachable)`);
					}
					if (tmpStackMode)
					{
						tmpSelf.log.info(`  Stack:   ultravisor + retold-remote (orator-conversion embedded)`);
					}
					tmpSelf.log.info('==========================================================');
					tmpSelf.log.info('');
					tmpSelf.log.info('  Press Ctrl+C to stop.');
					tmpSelf.log.info('');

					// Graceful shutdown: disconnect beacon and stop child processes before exit
					let _shutdown = () =>
					{
						tmpSelf.log.info('');
						tmpSelf.log.info('Shutting down...');

						let _finish = () =>
						{
							if (tmpStackInfo)
							{
								libStackLauncher.stop(tmpStackInfo, () => process.exit(0));
							}
							else
							{
								process.exit(0);
							}
						};

						if (pServerInfo.UltravisorBeacon && pServerInfo.UltravisorBeacon.isEnabled())
						{
							pServerInfo.UltravisorBeacon.disconnectBeacon(_finish);
						}
						else
						{
							_finish();
						}
					};

					process.on('SIGINT', _shutdown);
					process.on('SIGTERM', _shutdown);

					// Intentionally do NOT call fCallback() here.
					// The server should keep running.
				});
		};

		// In stack mode, launch ultravisor first, then start retold-remote
		if (tmpStackMode)
		{
			libStackLauncher.start(
				{
					Logger: tmpSelf.log,
					UltravisorPort: 54321
				},
				(pStackError, pStackInfo) =>
				{
					if (pStackError)
					{
						tmpSelf.log.error(`Stack launch failed: ${pStackError.message}`);
						return fCallback(pStackError);
					}
					tmpStackInfo = pStackInfo;
					_startRetoldRemote();
				});
		}
		else
		{
			_startRetoldRemote();
		}
	}
}

module.exports = RetoldRemoteCommandServe;
