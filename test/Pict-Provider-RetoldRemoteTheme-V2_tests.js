/**
 * Tests for Pict-Provider-RetoldRemoteTheme-V2 — the bridge that delegates
 * to pict-provider-theme while preserving the original provider's API.
 *
 * Verifies:
 *   - All 16 compiled bundles are registered into the delegate at construction
 *   - applyTheme(key) drives the delegate and updates _currentTheme
 *   - IconColors from the bundle are forwarded to the
 *     RetoldRemote-Icons provider via setColors() (dual-payload bridge)
 *   - Public API (getThemeList / getCurrentTheme / getTheme) preserves
 *     the original return shapes
 *   - Unknown theme keys fall back to twilight (matches original behavior)
 */
const libAssert = require('assert');
const libFable = require('fable');

const libRRThemeV2 = require('../source/providers/Pict-Provider-RetoldRemoteTheme-V2.js');
const libThemeDefs = require('../source/providers/RetoldRemote-ThemeDefinitions.js');

function buildStubDocument()
{
	let tmpStyleEl = null;
	let tmpClasses = new Set();
	return {
		documentElement:
		{
			classList:
			{
				add: (c) => tmpClasses.add(c),
				remove: (c) => tmpClasses.delete(c),
				contains: (c) => tmpClasses.has(c)
			}
		},
		head: { appendChild: function (pEl) { tmpStyleEl = pEl; } },
		getElementById: function (pId) { return (tmpStyleEl && tmpStyleEl.id === pId) ? tmpStyleEl : null; },
		createElement: function (pTag) { return { tagName: pTag, id: '', textContent: '' }; }
	};
}

function buildStubIconProvider()
{
	let tmpReceived = [];
	return {
		setColors: function (pPalette) { tmpReceived.push(pPalette); },
		_received: () => tmpReceived
	};
}

function createBridge()
{
	let tmpFable = new libFable({
		Product: 'BridgeTest',
		LogStreams: [{ streamtype: 'console', level: 'fatal' }]
	});
	let tmpIconProvider = buildStubIconProvider();
	let tmpHostPict =
	{
		AppData: { RetoldRemote: { Theme: null } },
		providers: { 'RetoldRemote-Icons': tmpIconProvider },
		CSSMap: null
	};

	// Construct via direct ctor for unit testing — in the live app pict
	// addProvider() handles wiring.
	let tmpBridge = new libRRThemeV2(tmpFable, {}, 'RetoldRemote-Theme');
	tmpBridge.pict = tmpHostPict;
	tmpBridge.log = tmpFable.log;
	// Re-wire delegate's pict reference too (constructor captured the bare fable).
	tmpBridge._delegate.pict = tmpHostPict;
	tmpBridge._delegate.log = tmpFable.log;

	return { Bridge: tmpBridge, IconProvider: tmpIconProvider, HostPict: tmpHostPict };
}

suite
(
	'RetoldRemote-Theme V2 bridge',
	() =>
	{
		test('registers all 16 compiled bundles at construction', (fDone) =>
		{
			let tmpCtx = createBridge();
			let tmpList = tmpCtx.Bridge.getThemeList();
			libAssert.strictEqual(tmpList.length, 16, 'expected 16 themes');
			libAssert.ok(tmpList.find((t) => t.key === 'twilight'));
			libAssert.ok(tmpList.find((t) => t.key === 'mobile-debug'));
			fDone();
		});

		test('applyTheme drives the delegate and updates current theme', (fDone) =>
		{
			global.document = buildStubDocument();
			try
			{
				let tmpCtx = createBridge();
				libAssert.strictEqual(tmpCtx.Bridge.applyTheme('synthwave'), true);
				libAssert.strictEqual(tmpCtx.Bridge.getCurrentTheme(), 'synthwave');
				let tmpActive = tmpCtx.Bridge._delegate.getActiveTheme();
				libAssert.strictEqual(tmpActive.Hash, 'synthwave');
			}
			finally
			{
				delete global.document;
			}
			fDone();
		});

		test('IconColors flow through onApply -> RetoldRemote-Icons.setColors()', (fDone) =>
		{
			global.document = buildStubDocument();
			try
			{
				let tmpCtx = createBridge();
				tmpCtx.Bridge.applyTheme('twilight');
				let tmpDelivered = tmpCtx.IconProvider._received();
				libAssert.strictEqual(tmpDelivered.length, 1);

				// Compare to the legacy IconColors literal for twilight.
				let tmpLegacyTwilight = libThemeDefs.find((t) => t.Key === 'twilight');
				libAssert.deepStrictEqual(tmpDelivered[0], tmpLegacyTwilight.IconColors);

				tmpCtx.Bridge.applyTheme('hotdog');
				let tmpDelivered2 = tmpCtx.IconProvider._received();
				libAssert.strictEqual(tmpDelivered2.length, 2);
				let tmpLegacyHotdog = libThemeDefs.find((t) => t.Key === 'hotdog');
				libAssert.deepStrictEqual(tmpDelivered2[1], tmpLegacyHotdog.IconColors);
			}
			finally
			{
				delete global.document;
			}
			fDone();
		});

		test('AppData.RetoldRemote.Theme is updated on apply', (fDone) =>
		{
			global.document = buildStubDocument();
			try
			{
				let tmpCtx = createBridge();
				tmpCtx.Bridge.applyTheme('forest');
				libAssert.strictEqual(tmpCtx.HostPict.AppData.RetoldRemote.Theme, 'forest');
			}
			finally
			{
				delete global.document;
			}
			fDone();
		});

		test('unknown theme falls back to twilight (matches original behavior)', (fDone) =>
		{
			global.document = buildStubDocument();
			try
			{
				let tmpCtx = createBridge();
				libAssert.strictEqual(tmpCtx.Bridge.applyTheme('does-not-exist'), true);
				libAssert.strictEqual(tmpCtx.Bridge.getCurrentTheme(), 'twilight');
			}
			finally
			{
				delete global.document;
			}
			fDone();
		});

		test('getTheme returns a registered bundle', (fDone) =>
		{
			let tmpCtx = createBridge();
			let tmpBundle = tmpCtx.Bridge.getTheme('twilight');
			libAssert.ok(tmpBundle);
			libAssert.strictEqual(tmpBundle.Hash, 'twilight');
			libAssert.strictEqual(tmpCtx.Bridge.getTheme('does-not-exist'), null);
			fDone();
		});
	}
);
