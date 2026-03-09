/**
 * Convenience wrapper for preview tools that expect a server.js entry point.
 * Starts the retold-remote server with test fixtures (or current directory).
 */
const libPath = require('path');
const libFs = require('fs');

const tmpFixturePath = '/var/folders/qn/7_p4k3152xz2ymzmn2lgltsh0000gn/T/retold-remote-fixtures';
const tmpContentPath = libFs.existsSync(tmpFixturePath) ? tmpFixturePath : process.cwd();
const tmpPort = parseInt(process.env.PORT, 10) || 7500;

require('./source/cli/RetoldRemote-Server-Setup.js')(
{
	ContentPath: tmpContentPath,
	DistPath: libPath.join(__dirname, 'web-application'),
	Port: tmpPort,
	HashedFilenames: false
},
function (pError, pServerInfo)
{
	if (pError)
	{
		console.error('Failed to start server:', pError.message);
		process.exit(1);
	}
	console.log('Retold Remote listening on port ' + tmpPort);
});
