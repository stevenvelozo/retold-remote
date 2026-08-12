/**
 * Retold Remote -- Media Service route-level tests.
 *
 * Proves the FORWARD multi-root resolution in the media routes: an incoming
 * ?path= parameter of the form "<root>/<rel>" resolves against the named root,
 * a bare "<rel>" still resolves against the default (content) root (back-compat),
 * and an escaping path is refused.
 *
 * Hermetic: two real temp directories, a fake in-memory request/response, and a
 * mock server that just captures the route handlers. The probe route needs no
 * image/video tooling (it stats the file and returns metadata), so the resolution
 * is proven end-to-end without depending on sharp/ffmpeg being installed. The
 * thumbnail route stubs generation + cache so it stays synchronous and tool-free,
 * asserting only the ABSOLUTE path handed to the generator -- which is exactly
 * what the forward-resolution change decides.
 */

const libAssert = require('assert');
const libFs = require('fs');
const libPath = require('path');
const libOs = require('os');

const libFable = require('fable');
const RetoldRemoteContentRoots = require('../source/server/RetoldRemote-ContentRoots.js');
const RetoldRemoteMediaService = require('../source/server/RetoldRemote-MediaService.js');

// A mock restify server that captures the route handlers connectRoutes() registers.
function createMockServer()
{
	let tmpHandlers = { get: {}, post: {} };
	return {
		handlers: tmpHandlers,
		get: (pRoute, fHandler) => { tmpHandlers.get[pRoute] = fHandler; },
		post: (pRoute, fHandler) => { tmpHandlers.post[pRoute] = fHandler; }
	};
}

// A minimal request carrying just the URL (handlers parse the query out of it).
function createMockRequest(pUrl)
{
	return { url: pUrl };
}

// A minimal response capturing both send() and the writeHead()/end() streaming path.
function createMockResponse()
{
	return {
		statusCode: null,
		body: null,
		headers: null,
		buffer: null,
		ended: false,
		send: function (pStatusOrBody, pMaybeBody)
		{
			if (typeof (pStatusOrBody) === 'number')
			{
				this.statusCode = pStatusOrBody;
				this.body = pMaybeBody;
			}
			else
			{
				this.statusCode = 200;
				this.body = pStatusOrBody;
			}
		},
		writeHead: function (pStatus, pHeaders) { this.statusCode = pStatus; this.headers = pHeaders; },
		write: function (pChunk) { this.buffer = this.buffer ? Buffer.concat([this.buffer, pChunk]) : pChunk; },
		end: function (pChunk)
		{
			if (pChunk)
			{
				let tmpChunk = Buffer.isBuffer(pChunk) ? pChunk : Buffer.from(pChunk);
				this.buffer = this.buffer ? Buffer.concat([this.buffer, tmpChunk]) : tmpChunk;
			}
			this.ended = true;
		},
		header: function () { }
	};
}

suite('RetoldRemote media service (multi-root routes)', () =>
{
	let _dirDefault;   // the default "content" root
	let _dirMount;     // a named "mount_nas" root, OUTSIDE the default root
	let _service;
	let _server;

	// Known, DIFFERENT byte lengths so a probe's reported Size proves WHICH root answered.
	const _DEFAULT_TXT = 'default-root-file';        // 17 bytes
	const _MOUNT_TXT = 'the mount_nas root file';    // 23 bytes

	suiteSetup(() =>
	{
		let tmpStamp = `${Date.now()}-${process.pid}`;
		_dirDefault = libPath.join(libOs.tmpdir(), `rr-mediasvc-default-${tmpStamp}`);
		_dirMount = libPath.join(libOs.tmpdir(), `rr-mediasvc-mount-${tmpStamp}`);
		libFs.mkdirSync(_dirDefault, { recursive: true });
		libFs.mkdirSync(_dirMount, { recursive: true });

		libFs.writeFileSync(libPath.join(_dirDefault, 'note.txt'), _DEFAULT_TXT);
		libFs.writeFileSync(libPath.join(_dirMount, 'note.txt'), _MOUNT_TXT);
		libFs.writeFileSync(libPath.join(_dirDefault, 'base.png'), 'x');
		libFs.writeFileSync(libPath.join(_dirMount, 'pixel.png'), 'x');

		let tmpFable = new libFable({});
		let tmpContentRoots = new RetoldRemoteContentRoots(
			{
				ContentPath: _dirDefault,
				ContentRoots: { mount_nas: _dirMount }
			});
		_service = new RetoldRemoteMediaService(tmpFable,
			{
				ContentPath: _dirDefault,
				ContentRoots: tmpContentRoots
			});

		_server = createMockServer();
		_service.connectRoutes(_server);
	});

	suiteTeardown(() =>
	{
		try { libFs.rmSync(_dirDefault, { recursive: true, force: true }); } catch (pError) { /* best effort */ }
		try { libFs.rmSync(_dirMount, { recursive: true, force: true }); } catch (pError) { /* best effort */ }
	});

	suite('probe route forward resolution', () =>
	{
		test('a bare path resolves against the default (content) root', (fDone) =>
		{
			let tmpRequest = createMockRequest('/api/media/probe?path=note.txt');
			let tmpResponse = createMockResponse();
			_server.handlers.get['/api/media/probe'](tmpRequest, tmpResponse, () =>
			{
				libAssert.strictEqual(tmpResponse.statusCode, 200);
				libAssert.strictEqual(tmpResponse.body.Success, true);
				libAssert.strictEqual(tmpResponse.body.Path, 'note.txt');
				libAssert.strictEqual(tmpResponse.body.Size, Buffer.byteLength(_DEFAULT_TXT));
				return fDone();
			});
		});

		test('a "<root>/<rel>" path resolves against the named root (the multi-root fix)', (fDone) =>
		{
			let tmpRequest = createMockRequest('/api/media/probe?path=mount_nas/note.txt');
			let tmpResponse = createMockResponse();
			_server.handlers.get['/api/media/probe'](tmpRequest, tmpResponse, () =>
			{
				libAssert.strictEqual(tmpResponse.statusCode, 200);
				libAssert.strictEqual(tmpResponse.body.Success, true);
				libAssert.strictEqual(tmpResponse.body.Path, 'mount_nas/note.txt');
				// The mount_nas file is a DIFFERENT size than the default-root file:
				// this proves the request was resolved against _dirMount, not
				// <default>/mount_nas/note.txt (which does not exist).
				libAssert.strictEqual(tmpResponse.body.Size, Buffer.byteLength(_MOUNT_TXT));
				return fDone();
			});
		});

		test('a named-root path to a missing file 404s (proves it looked in the named root)', (fDone) =>
		{
			let tmpRequest = createMockRequest('/api/media/probe?path=mount_nas/absent.txt');
			let tmpResponse = createMockResponse();
			_server.handlers.get['/api/media/probe'](tmpRequest, tmpResponse, () =>
			{
				libAssert.strictEqual(tmpResponse.statusCode, 404);
				return fDone();
			});
		});

		test('an escaping path is refused with a 400', (fDone) =>
		{
			let tmpRequest = createMockRequest('/api/media/probe?path=mount_nas/../../etc/passwd');
			let tmpResponse = createMockResponse();
			_server.handlers.get['/api/media/probe'](tmpRequest, tmpResponse, () =>
			{
				libAssert.strictEqual(tmpResponse.statusCode, 400);
				return fDone();
			});
		});
	});

	suite('thumbnail route forward resolution', () =>
	{
		// Stub generation + cache so the assertion is purely about WHICH absolute
		// file the route hands to the generator, with no dependency on sharp/ffmpeg.
		function stubGeneration()
		{
			_service.thumbnailCache = { buildKey: () => 'k', get: () => null, put: () => '', getCachePath: () => '' };
			let tmpState = { path: null };
			_service._generateThumbnail = (pFullPath, pCategory, pWidth, pHeight, pFormat, fCallback) =>
			{
				tmpState.path = pFullPath;
				return fCallback(null, Buffer.from('thumb'));
			};
			return tmpState;
		}

		test('a "<root>/<rel>" path is resolved to the named root before generation', (fDone) =>
		{
			let tmpState = stubGeneration();
			let tmpRequest = createMockRequest('/api/media/thumbnail?path=mount_nas/pixel.png');
			let tmpResponse = createMockResponse();
			_server.handlers.get['/api/media/thumbnail'](tmpRequest, tmpResponse, () =>
			{
				libAssert.strictEqual(tmpResponse.statusCode, 200);
				libAssert.strictEqual(tmpState.path, libPath.resolve(_dirMount, 'pixel.png'));
				return fDone();
			});
		});

		test('a bare path is resolved to the default root before generation', (fDone) =>
		{
			let tmpState = stubGeneration();
			let tmpRequest = createMockRequest('/api/media/thumbnail?path=base.png');
			let tmpResponse = createMockResponse();
			_server.handlers.get['/api/media/thumbnail'](tmpRequest, tmpResponse, () =>
			{
				libAssert.strictEqual(tmpResponse.statusCode, 200);
				libAssert.strictEqual(tmpState.path, libPath.resolve(_dirDefault, 'base.png'));
				return fDone();
			});
		});
	});
});
