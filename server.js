/**
 * Retold Remote -- Standalone Server Entry Point
 *
 * Usage:
 *   npm run build   (build client bundles first)
 *   npm start       (start this server)
 *   Open http://localhost:8086
 *
 * Or point to a specific media folder:
 *   node server.js [path-to-media-folder]
 */

const libPath = require('path');
const libSetupServer = require('./source/cli/RetoldRemote-Server-Setup.js');

let tmpContentPath = process.argv[2]
	? libPath.resolve(process.argv[2])
	: libPath.join(__dirname, 'test', 'content');

let tmpPort = parseInt(process.env.PORT, 10) || 8086;
let tmpHashedFilenames = (process.env.RETOLD_HASHED_FILENAMES === 'true');

libSetupServer(
	{
		ContentPath: tmpContentPath,
		DistPath: libPath.join(__dirname, 'web-application'),
		Port: tmpPort,
		HashedFilenames: tmpHashedFilenames
	},
	function (pError, pServerInfo)
	{
		if (pError)
		{
			console.error('Failed to start server:', pError.message);
			process.exit(1);
		}
		pServerInfo.Fable.log.info('==========================================================');
		pServerInfo.Fable.log.info(`  Retold Remote running on http://localhost:${pServerInfo.Port}`);
		pServerInfo.Fable.log.info('==========================================================');
		pServerInfo.Fable.log.info(`  Content path: ${tmpContentPath}`);
		pServerInfo.Fable.log.info(`  Browse:       http://localhost:${pServerInfo.Port}/`);
		pServerInfo.Fable.log.info('==========================================================');
	});
