const libPictProvider = require('pict-provider');

const _ThemeDefinitions = require('./RetoldRemote-ThemeDefinitions');

const _ProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-Theme',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0
};

/**
 * Theme provider for retold-remote.
 *
 * Manages 15 themes (5 grey-only + 10 fun) via CSS custom properties.
 * Injects a <style id="retold-remote-theme"> block into <head> with
 * :root { --retold-* } variables.  Calls the icon provider's setColors()
 * to keep SVG icons in sync with the active theme.
 *
 * Theme definitions live in RetoldRemote-ThemeDefinitions.js.
 */
class RetoldRemoteThemeProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._themes = {};
		this._themeOrder = [];
		this._currentTheme = 'twilight';

		// Load theme definitions from the data module
		for (let i = 0; i < _ThemeDefinitions.length; i++)
		{
			let tmpDef = _ThemeDefinitions[i];
			this._addTheme(tmpDef.Key, tmpDef);
		}
	}

	/**
	 * Register a theme in the internal map and order list.
	 */
	_addTheme(pKey, pTheme)
	{
		this._themes[pKey] = pTheme;
		this._themeOrder.push(pKey);
	}

	/**
	 * Apply a theme by key.  Injects CSS variables into a dedicated <style>
	 * element and updates the icon provider colors.
	 *
	 * @param {string} pThemeName - Theme key (e.g. 'twilight', 'neo-tokyo')
	 * @returns {boolean} True if theme was applied successfully
	 */
	applyTheme(pThemeName)
	{
		let tmpTheme = this._themes[pThemeName];
		if (!tmpTheme)
		{
			// Fall back to twilight if unknown theme key
			tmpTheme = this._themes['twilight'];
			pThemeName = 'twilight';
		}

		this._currentTheme = pThemeName;

		// Build CSS variable block
		let tmpCSS = ':root {\n';
		let tmpVars = tmpTheme.Variables;
		let tmpKeys = Object.keys(tmpVars);
		for (let i = 0; i < tmpKeys.length; i++)
		{
			tmpCSS += '\t' + tmpKeys[i] + ': ' + tmpVars[tmpKeys[i]] + ';\n';
		}
		tmpCSS += '}\n';

		// Inject into dedicated style element
		if (typeof document !== 'undefined')
		{
			let tmpStyleEl = document.getElementById('retold-remote-theme');
			if (!tmpStyleEl)
			{
				tmpStyleEl = document.createElement('style');
				tmpStyleEl.id = 'retold-remote-theme';
				document.head.appendChild(tmpStyleEl);
			}
			tmpStyleEl.textContent = tmpCSS;
		}

		// Update icon provider colors
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		if (tmpIconProvider && tmpTheme.IconColors)
		{
			tmpIconProvider.setColors(tmpTheme.IconColors);
		}

		// Update AppData
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (tmpRemote)
		{
			tmpRemote.Theme = pThemeName;
		}

		return true;
	}

	/**
	 * Get the ordered list of themes for building a dropdown.
	 *
	 * @returns {Array<Object>} Array of { key, name, category, description }
	 */
	getThemeList()
	{
		let tmpList = [];
		for (let i = 0; i < this._themeOrder.length; i++)
		{
			let tmpKey = this._themeOrder[i];
			let tmpTheme = this._themes[tmpKey];
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

	/**
	 * Get the currently active theme key.
	 *
	 * @returns {string}
	 */
	getCurrentTheme()
	{
		return this._currentTheme;
	}

	/**
	 * Get a theme definition by key.
	 *
	 * @param {string} pThemeKey
	 * @returns {Object|null}
	 */
	getTheme(pThemeKey)
	{
		return this._themes[pThemeKey] || null;
	}
}

RetoldRemoteThemeProvider.default_configuration = _ProviderConfiguration;

module.exports = RetoldRemoteThemeProvider;
