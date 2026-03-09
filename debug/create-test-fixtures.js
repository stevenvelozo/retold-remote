/**
 * Create a temporary content folder with sample files for manual testing.
 *
 * Usage:
 *   node test/create-test-fixtures.js          (prints the tmp path)
 *   node test/create-test-fixtures.js --serve   (creates fixtures and starts server)
 *
 * The folder is placed in os.tmpdir() so it never ends up in the repo.
 * Files are small stubs — enough to exercise the UI, thumbnails, and
 * extension categorization without bloating disk.
 */

const libFs = require('fs');
const libPath = require('path');
const libOs = require('os');

const _FIXTURE_ROOT = libPath.join(libOs.tmpdir(), 'retold-remote-fixtures');

// Minimal valid file stubs keyed by extension.
// A 1×1 white PNG (67 bytes).
const _PNG_1x1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB'
	+ 'Nl7BcQAAAABJRU5ErkJggg==', 'base64');

// Minimal valid JPEG (107 bytes) — 1×1 white pixel.
const _JPEG_1x1 = Buffer.from(
	'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS'
	+ 'Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ'
	+ 'CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy'
	+ 'MjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf'
	+ '/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAA'
	+ 'AAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=', 'base64');

// Stub: we write tiny files for non-image types since the server only
// needs them to exist for listings and category detection.
function _stub(pText)
{
	return Buffer.from(pText || '(stub)\n');
}

const _TREE =
{
	'Photos':
	{
		'vacation-sunset-2024.jpg': _JPEG_1x1,
		'family-portrait.png': _PNG_1x1,
		'mountain-landscape-panorama.webp': _stub(),
		'cat-sleeping.gif': _stub()
	},
	'Videos':
	{
		'birthday-party-compilation.mp4': _stub(),
		'tutorial-javascript-basics.webm': _stub()
	},
	'Music':
	{
		'favorite-song.mp3': _stub(),
		'podcast-episode-147.wav': _stub()
	},
	'Documents':
	{
		'meeting-notes-january.md': _stub('# Meeting Notes\n\nJanuary all-hands.\n'),
		'project-proposal-draft-v3-final-revised.docx': _stub(),
		'quarterly-financial-report-2025.pdf': _stub(),
		'README.txt': _stub('This is a sample README for testing.\n')
	},
	'Project Files':
	{
		'database-schema-migration-script.sql': _stub('-- migration stub\n'),
		'webpack.config.js': _stub('module.exports = {};\n'),
		'package-lock.json': _stub('{}')
	}
};

function createFixtures()
{
	// Wipe and recreate
	if (libFs.existsSync(_FIXTURE_ROOT))
	{
		libFs.rmSync(_FIXTURE_ROOT, { recursive: true, force: true });
	}

	for (let tmpFolder in _TREE)
	{
		let tmpFolderPath = libPath.join(_FIXTURE_ROOT, tmpFolder);
		libFs.mkdirSync(tmpFolderPath, { recursive: true });

		let tmpFiles = _TREE[tmpFolder];
		for (let tmpFile in tmpFiles)
		{
			libFs.writeFileSync(libPath.join(tmpFolderPath, tmpFile), tmpFiles[tmpFile]);
		}
	}

	return _FIXTURE_ROOT;
}

// ── Main ──────────────────────────────────────────────
let tmpPath = createFixtures();
console.log(tmpPath);

if (process.argv.includes('--serve'))
{
	let tmpSetupServer = require('../source/cli/RetoldRemote-Server-Setup.js');
	let tmpPort = 9002;
	for (let i = 0; i < process.argv.length; i++)
	{
		if ((process.argv[i] === '-p' || process.argv[i] === '--port') && process.argv[i + 1])
		{
			tmpPort = parseInt(process.argv[i + 1], 10) || tmpPort;
		}
	}

	tmpSetupServer(
		{
			ContentPath: tmpPath,
			DistPath: libPath.join(__dirname, '..', 'web-application'),
			Port: tmpPort,
			HashedFilenames: !process.argv.includes('--no-hash')
		},
		function (pError, pServerInfo)
		{
			if (pError)
			{
				console.error('Failed to start server:', pError.message);
				process.exit(1);
			}
			pServerInfo.Fable.log.info('==========================================================');
			pServerInfo.Fable.log.info(`  Test fixtures at: ${tmpPath}`);
			pServerInfo.Fable.log.info(`  Browse: http://localhost:${pServerInfo.Port}/`);
			pServerInfo.Fable.log.info('==========================================================');
		});
}
