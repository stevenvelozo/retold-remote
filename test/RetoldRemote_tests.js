/**
 * Retold Remote -- Tests
 */
const libAssert = require('assert');

suite
(
	'RetoldRemote',
	() =>
	{
		test
		(
			'Module exports the RetoldRemoteApplication class',
			(fDone) =>
			{
				let tmpModule = require('../source/Pict-RetoldRemote-Bundle.js');
				libAssert.ok(tmpModule.RetoldRemoteApplication, 'RetoldRemoteApplication should be exported');
				libAssert.strictEqual(typeof (tmpModule.RetoldRemoteApplication), 'function', 'RetoldRemoteApplication should be a function/class');
				return fDone();
			}
		);

		test
		(
			'ToolDetector detects available tools',
			(fDone) =>
			{
				let libToolDetector = require('../source/server/RetoldRemote-ToolDetector.js');
				let tmpDetector = new libToolDetector();
				let tmpCapabilities = tmpDetector.detect();

				libAssert.ok(typeof (tmpCapabilities) === 'object', 'Capabilities should be an object');
				libAssert.ok(typeof (tmpCapabilities.sharp) === 'boolean', 'sharp should be boolean');
				libAssert.ok(typeof (tmpCapabilities.imagemagick) === 'boolean', 'imagemagick should be boolean');
				libAssert.ok(typeof (tmpCapabilities.ffmpeg) === 'boolean', 'ffmpeg should be boolean');
				libAssert.ok(typeof (tmpCapabilities.ffprobe) === 'boolean', 'ffprobe should be boolean');

				// Second call should return cached result
				let tmpCapabilities2 = tmpDetector.detect();
				libAssert.strictEqual(tmpCapabilities, tmpCapabilities2, 'Second detect call should return cached result');

				return fDone();
			}
		);

		test
		(
			'ThumbnailCache builds deterministic keys with folder co-location',
			(fDone) =>
			{
				let libThumbnailCache = require('../source/server/RetoldRemote-ThumbnailCache.js');
				let libFable = require('fable');
				let libParimeStorage = require('parime/storage');
				let libPath = require('path');
				let libOs = require('os');

				let tmpCachePath = libPath.join(libOs.tmpdir(), '.retold-remote-test-cache-' + Date.now());
				let tmpFable = new libFable(
				{
					ParimeBinaryStorageRoot: tmpCachePath,
					ParimeBinarySharding: { Enabled: true, SegmentSize: 2, Depth: 4 }
				});

				tmpFable.serviceManager.addServiceType('ParimeStorage', libParimeStorage);
				let tmpParimeStorage = tmpFable.serviceManager.instantiateServiceProvider('ParimeStorage');

				tmpParimeStorage.initialize(
					(pError) =>
					{
						libAssert.ok(!pError, 'ParimeStorage should initialize without error');

						let tmpCache = new libThumbnailCache(tmpFable);

						let tmpKey1 = tmpCache.buildKey('albums/vacation/photo.jpg', 1700000000000, 200, 200);
						let tmpKey2 = tmpCache.buildKey('albums/vacation/photo.jpg', 1700000000000, 200, 200);
						let tmpKey3 = tmpCache.buildKey('albums/vacation/photo.jpg', 1700000000001, 200, 200);

						libAssert.strictEqual(tmpKey1, tmpKey2, 'Same inputs should produce same key');
						libAssert.notStrictEqual(tmpKey1, tmpKey3, 'Different mtime should produce different key');

						// Key should contain a slash (folderHash/fileHash)
						libAssert.ok(tmpKey1.indexOf('/') > 0, 'Key should have folderHash/fileHash structure');

						// Files in the same folder should share the same folder hash prefix
						let tmpKeyOther = tmpCache.buildKey('albums/vacation/sunset.png', 1700000000000, 200, 200);
						let tmpFolderHash1 = tmpKey1.split('/')[0];
						let tmpFolderHashOther = tmpKeyOther.split('/')[0];
						libAssert.strictEqual(tmpFolderHash1, tmpFolderHashOther, 'Same folder should produce same folder hash');

						// Files in different folders should have different folder hashes
						let tmpKeyDiffFolder = tmpCache.buildKey('albums/birthday/photo.jpg', 1700000000000, 200, 200);
						let tmpFolderHashDiff = tmpKeyDiffFolder.split('/')[0];
						libAssert.notStrictEqual(tmpFolderHash1, tmpFolderHashDiff, 'Different folders should produce different folder hashes');

						// Test put and get
						let tmpBuffer = Buffer.from('fake-thumbnail-data');
						tmpCache.put(tmpKey1, tmpBuffer, 'webp');
						let tmpCachedPath = tmpCache.get(tmpKey1, 'webp');
						libAssert.ok(tmpCachedPath, 'Should find cached thumbnail');

						let tmpMissPath = tmpCache.get(tmpKey3, 'webp');
						libAssert.strictEqual(tmpMissPath, null, 'Should not find uncached thumbnail');

						// Clean up
						let libFs = require('fs');
						libFs.rmSync(tmpCachePath, { recursive: true, force: true });

						return fDone();
					});
			}
		);

		test
		(
			'PathRegistry produces deterministic 10-char hex hashes',
			(fDone) =>
			{
				let libFable = require('fable');
				let libPathRegistry = require('../source/server/RetoldRemote-PathRegistry.js');

				let tmpFable = new libFable({});
				let tmpRegistry = new libPathRegistry(tmpFable, { Enabled: true });

				let tmpHash1 = tmpRegistry.hashPath('some/deep/nested/folder/photo.jpg');
				let tmpHash2 = tmpRegistry.hashPath('some/deep/nested/folder/photo.jpg');
				let tmpHash3 = tmpRegistry.hashPath('some/other/file.png');

				// Deterministic: same input, same output
				libAssert.strictEqual(tmpHash1, tmpHash2, 'Same path should produce same hash');

				// Different inputs, different outputs
				libAssert.notStrictEqual(tmpHash1, tmpHash3, 'Different paths should produce different hashes');

				// Exactly 10 hex characters
				libAssert.strictEqual(tmpHash1.length, 10, 'Hash should be 10 characters');
				libAssert.ok(/^[a-f0-9]{10}$/.test(tmpHash1), 'Hash should be lowercase hex');

				return fDone();
			}
		);

		test
		(
			'PathRegistry register/resolve round-trip',
			(fDone) =>
			{
				let libFable = require('fable');
				let libPathRegistry = require('../source/server/RetoldRemote-PathRegistry.js');

				let tmpFable = new libFable({});
				let tmpRegistry = new libPathRegistry(tmpFable, { Enabled: true });

				let tmpPath = 'folder/subfolder/image.jpg';
				let tmpHash = tmpRegistry.register(tmpPath);

				// resolve should return the original path
				libAssert.strictEqual(tmpRegistry.resolve(tmpHash), tmpPath, 'resolve should return original path');

				// getHash should return the hash
				libAssert.strictEqual(tmpRegistry.getHash(tmpPath), tmpHash, 'getHash should return the hash');

				// Unknown hash returns null
				libAssert.strictEqual(tmpRegistry.resolve('0000000000'), null, 'Unknown hash should return null');

				// isEnabled should be true
				libAssert.strictEqual(tmpRegistry.isEnabled(), true, 'Registry should be enabled');

				return fDone();
			}
		);

		test
		(
			'PathRegistry annotateFileList adds Hash fields',
			(fDone) =>
			{
				let libFable = require('fable');
				let libPathRegistry = require('../source/server/RetoldRemote-PathRegistry.js');

				let tmpFable = new libFable({});
				let tmpRegistry = new libPathRegistry(tmpFable, { Enabled: true });

				let tmpFileList =
				[
					{ Name: 'photo.jpg', Path: 'albums/photo.jpg', Type: 'file' },
					{ Name: 'video.mp4', Path: 'albums/video.mp4', Type: 'file' },
					{ Name: 'subfolder', Path: 'albums/subfolder', Type: 'directory' }
				];

				tmpRegistry.annotateFileList(tmpFileList);

				for (let i = 0; i < tmpFileList.length; i++)
				{
					libAssert.ok(tmpFileList[i].Hash, 'Entry should have a Hash field');
					libAssert.strictEqual(tmpFileList[i].Hash.length, 10, 'Hash should be 10 characters');
					// Resolve should work for each entry
					libAssert.strictEqual(tmpRegistry.resolve(tmpFileList[i].Hash), tmpFileList[i].Path, 'Hash should resolve back to path');
				}

				return fDone();
			}
		);
	}
);
