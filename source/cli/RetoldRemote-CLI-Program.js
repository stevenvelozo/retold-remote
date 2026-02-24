const libCLIProgram = require('pict-service-commandlineutility');

let _PictCLIProgram = new libCLIProgram(
	{
		Product: 'retold-remote',
		Version: require('../../package.json').version,

		Command: 'retold-remote',
		Description: 'Browse and view media files on a NAS or local folder with gallery views and keyboard navigation.'
	},
	[
		require('./commands/RetoldRemote-Command-Serve.js')
	]);

module.exports = _PictCLIProgram;
