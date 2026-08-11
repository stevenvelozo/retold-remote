/**
 * Content roots resolver tests.
 *
 * Pure, hermetic (node:assert, no fixtures). Proves single-ContentPath back-compat (bare rels in and out),
 * multi-root addressing ("<root>/<rel>"), default-root fallthrough, the most-specific-root reverse, and
 * confinement (no absolute inputs, no `..` escapes).
 */

const libAssert = require('assert');
const libPath = require('path');
const RetoldRemoteContentRoots = require('../source/server/RetoldRemote-ContentRoots.js');

suite('RetoldRemote content roots', () =>
{
	suite('single ContentPath (back-compat)', () =>
	{
		let _roots = new RetoldRemoteContentRoots({ ContentPath: '/data/media' });

		test('a bare path resolves against the default root', () =>
		{
			libAssert.strictEqual(_roots.resolve('photos/a.jpg'), libPath.resolve('/data/media/photos/a.jpg'));
		});
		test('toRelative returns a BARE rel (unchanged cache keys)', () =>
		{
			libAssert.strictEqual(_roots.toRelative(libPath.resolve('/data/media/photos/a.jpg')), 'photos/a.jpg');
		});
		test('the default root is "content"', () =>
		{
			libAssert.strictEqual(_roots.defaultRoot(), 'content');
		});
	});

	suite('multiple roots', () =>
	{
		let _roots = new RetoldRemoteContentRoots(
			{
				ContentPath: '/data/storage',
				ContentRoots: { mount_nas: '/Volumes/nas', mount_usb: '/Volumes/usb' }
			});

		test('a "<root>/<rel>" path resolves against the named root', () =>
		{
			libAssert.strictEqual(_roots.resolve('mount_nas/video/clip.mp4'), libPath.resolve('/Volumes/nas/video/clip.mp4'));
			libAssert.strictEqual(_roots.resolve('mount_usb/x.png'), libPath.resolve('/Volumes/usb/x.png'));
		});
		test('a bare path still falls to the default (content) root', () =>
		{
			libAssert.strictEqual(_roots.resolve('a/b.jpg'), libPath.resolve('/data/storage/a/b.jpg'));
		});
		test('toRelative prefixes the root name for a non-default root, bare for the default', () =>
		{
			libAssert.strictEqual(_roots.toRelative(libPath.resolve('/Volumes/nas/video/clip.mp4')), 'mount_nas/video/clip.mp4');
			libAssert.strictEqual(_roots.toRelative(libPath.resolve('/data/storage/a/b.jpg')), 'a/b.jpg');
		});
		test('toRelative returns null for a path under no root', () =>
		{
			libAssert.strictEqual(_roots.toRelative(libPath.resolve('/etc/passwd')), null);
		});
	});

	suite('most-specific root wins when roots nest', () =>
	{
		let _roots = new RetoldRemoteContentRoots({ ContentRoots: { outer: '/data', inner: '/data/inner' } });
		test('a path under the nested root reverses to the nested root', () =>
		{
			libAssert.strictEqual(_roots.toRelative(libPath.resolve('/data/inner/x.jpg')), 'inner/x.jpg');
		});
	});

	suite('confinement', () =>
	{
		let _roots = new RetoldRemoteContentRoots({ ContentPath: '/data/media' });
		test('an absolute input is refused', () =>
		{
			libAssert.throws(() => _roots.resolve('/etc/passwd'));
		});
		test('a ".." escape is refused', () =>
		{
			libAssert.throws(() => _roots.resolve('../../etc/passwd'));
		});
		test('an unknown first segment is treated as a bare path under the default root, not a root', () =>
		{
			libAssert.strictEqual(_roots.resolve('notaroot/file.jpg'), libPath.resolve('/data/media/notaroot/file.jpg'));
		});
	});
});
