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

		this.addCommand();
	}

	onRunAsync(fCallback)
	{
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
		let tmpSetupServer = require('../RetoldRemote-Server-Setup.js');

		let tmpHashedFilenames = !(this.CommandOptions.noHash);

		let tmpCacheRoot = this.CommandOptions.cachePath
			? libPath.resolve(this.CommandOptions.cachePath)
			: null;
		let tmpCacheServer = this.CommandOptions.cacheServer || null;

		tmpSetupServer(
			{
				ContentPath: tmpContentPath,
				DistPath: tmpDistPath,
				Port: tmpPort,
				HashedFilenames: tmpHashedFilenames,
				CacheRoot: tmpCacheRoot,
				CacheServer: tmpCacheServer
			},
			function (pError, pServerInfo)
			{
				if (pError)
				{
					tmpSelf.log.error(`Failed to start server: ${pError.message}`);
					return fCallback(pError);
				}

				tmpSelf.log.info('');
				tmpSelf.log.info('==========================================================');
				tmpSelf.log.info(`  Retold Remote running on http://localhost:${pServerInfo.Port}`);
				tmpSelf.log.info('==========================================================');
				tmpSelf.log.info(`  Content: ${tmpContentPath}`);
				tmpSelf.log.info(`  Assets:  ${tmpDistPath}`);
				tmpSelf.log.info(`  Browse:  http://localhost:${pServerInfo.Port}/`);
				tmpSelf.log.info('==========================================================');
				tmpSelf.log.info('');
				tmpSelf.log.info('  Press Ctrl+C to stop.');
				tmpSelf.log.info('');

				// Intentionally do NOT call fCallback() here.
				// The server should keep running.
			});
	}
}

module.exports = RetoldRemoteCommandServe;
