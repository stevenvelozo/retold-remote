/**
 * Retold-Remote Theme Provider (V2)
 *
 * Drop-in replacement for the original Pict-Provider-RetoldRemoteTheme.js
 * that delegates to the generic `pict-provider-theme` runtime while
 * preserving the existing external API:
 *
 *   provider.applyTheme(themeKey)        -> bool
 *   provider.getThemeList()              -> [{key, name, category, description}, ...]
 *   provider.getCurrentTheme()           -> string
 *   provider.getTheme(themeKey)          -> bundle | null
 *
 * This means `Pict-Application-RetoldRemote.js` and the Settings panel
 * can switch to V2 by changing one require line — no other call-site
 * edits required.
 *
 * Dual-payload bridge:
 *   onApply listener forwards bundle.IconColors to the
 *   `RetoldRemote-Icons` provider's setColors() — same behavior as the
 *   original bespoke provider.
 *
 * Theme bundles are loaded synchronously from the compiled `theme/`
 * directory at instance construction.  In a packaged build that folder
 * is copied to the web-application output via copyFiles.
 */
const libPictProvider = require('pict-provider');
const libPictProviderTheme = require('pict-provider-theme');

const _ProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-Theme',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0
};

// Compiled bundles bundled into the JS bundle via STATIC require() so that
// browserify can find and include each one at build time.  Dynamic
// require with a concatenated path (require('../../theme/' + key + '.json'))
// would silently produce an empty registry in the browser.
const _CompiledBundles =
[
	require('../../theme/daylight.json'),
	require('../../theme/afternoon.json'),
	require('../../theme/evening.json'),
	require('../../theme/twilight.json'),
	require('../../theme/night.json'),
	require('../../theme/neo-tokyo.json'),
	require('../../theme/cyberpunk.json'),
	require('../../theme/hotdog.json'),
	require('../../theme/1970s-console.json'),
	require('../../theme/1980s-console.json'),
	require('../../theme/1990s-website.json'),
	require('../../theme/early-2000s.json'),
	require('../../theme/synthwave.json'),
	require('../../theme/solarized-dark.json'),
	require('../../theme/forest.json'),
	require('../../theme/mobile-debug.json')
];

const _ThemeKeys = _CompiledBundles.map((pBundle) => pBundle.Hash);

class RetoldRemoteThemeProviderV2 extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this.serviceType = 'PictProviderRetoldRemoteThemeV2';

		this._themeOrder = _ThemeKeys.slice();
		this._currentTheme = 'twilight';

		// Delegate runtime: hosts the actual register/apply/CSS injection
		// machinery.  We share the same fable / pict reference so it
		// participates in the host pict's CSSMap and template engine.
		this._delegate = new libPictProviderTheme(pFable, {}, (pServiceHash || 'RetoldRemote-Theme') + '-Delegate');
		this._delegate.pict = this.pict;
		this._delegate.log = this.log;

		// Register bundled compiled themes into the delegate.  Bundles live
		// at ../../theme/<key>.json relative to this file.  In a packaged
		// build they remain alongside the source.
		this._registerCompiledBundles();

		// Bridge IconColors -> RetoldRemote-Icons.setColors() on every
		// applyTheme()/setMode().  This mirrors the dual-payload behavior
		// of the original bespoke provider.
		let tmpSelf = this;
		this._delegate.onApply((pBundle) =>
		{
			let tmpIconProvider = tmpSelf.pict && tmpSelf.pict.providers && tmpSelf.pict.providers['RetoldRemote-Icons'];
			if (tmpIconProvider && pBundle && pBundle.IconColors)
			{
				tmpIconProvider.setColors(pBundle.IconColors);
			}
			let tmpAppData = tmpSelf.pict && tmpSelf.pict.AppData && tmpSelf.pict.AppData.RetoldRemote;
			if (tmpAppData && pBundle)
			{
				tmpAppData.Theme = pBundle.Hash;
			}
		});
	}

	_registerCompiledBundles()
	{
		for (let i = 0; i < _CompiledBundles.length; i++)
		{
			this._delegate.registerTheme(_CompiledBundles[i]);
		}
	}

	// ================================================================
	// Public API — preserved from the original provider so call sites
	// don't need to change.
	// ================================================================

	applyTheme(pThemeName)
	{
		let tmpKey = pThemeName;
		// Fall back to twilight when an unknown theme is requested,
		// matching the original provider's behavior.
		if (!this._delegate.getTheme(tmpKey))
		{
			tmpKey = 'twilight';
		}
		this._currentTheme = tmpKey;
		return this._delegate.applyTheme(tmpKey);
	}

	getThemeList()
	{
		let tmpList = [];
		for (let i = 0; i < this._themeOrder.length; i++)
		{
			let tmpKey = this._themeOrder[i];
			let tmpTheme = this._delegate.getTheme(tmpKey);
			if (!tmpTheme) continue;
			tmpList.push(
			{
				key: tmpKey,
				name: tmpTheme.Name,
				category: tmpTheme.Category,
				description: tmpTheme.Description
			});
		}
		return tmpList;
	}

	getCurrentTheme()
	{
		return this._currentTheme;
	}

	getTheme(pThemeKey)
	{
		return this._delegate.getTheme(pThemeKey);
	}

	// Forward-compatible accessors so new code can reach for tokens / assets
	// without depending on this bridge.
	get themeProvider()
	{
		return this._delegate;
	}
}

RetoldRemoteThemeProviderV2.default_configuration = _ProviderConfiguration;

module.exports = RetoldRemoteThemeProviderV2;
