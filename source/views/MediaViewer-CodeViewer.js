/**
 * MediaViewer — Code Viewer Mixin
 *
 * Syntax-highlighted code display using pict-section-code and CodeJar.
 * Maps file extensions to highlight languages and renders read-only
 * code with line numbers.
 *
 * Mixed into RetoldRemoteMediaViewerView.prototype via Object.assign().
 * All methods access state through `this` (the view instance).
 *
 * @license MIT
 */

const libPictSectionCode = require('pict-section-code');

module.exports =
{
	_buildTextHTML: function _buildTextHTML(pURL, pFileName, pFilePath)
	{
		return '<div class="retold-remote-code-viewer-container" id="RetoldRemote-CodeViewer-Container">'
			+ '<div class="retold-remote-code-viewer-loading">Loading...</div>'
			+ '</div>';
	},

	/**
	 * Map a file extension to a pict-section-code highlight language.
	 *
	 * @param {string} pExtension - File extension (no dot)
	 * @returns {string} One of: javascript, json, html, css, sql
	 */
	_getHighlightLanguage: function _getHighlightLanguage(pExtension)
	{
		let tmpJSExtensions = { 'js': true, 'mjs': true, 'cjs': true, 'ts': true, 'tsx': true, 'jsx': true };
		if (tmpJSExtensions[pExtension]) return 'javascript';

		if (pExtension === 'json') return 'json';

		let tmpHTMLExtensions = { 'html': true, 'htm': true, 'xml': true, 'svg': true };
		if (tmpHTMLExtensions[pExtension]) return 'html';

		let tmpCSSExtensions = { 'css': true, 'scss': true, 'sass': true, 'less': true };
		if (tmpCSSExtensions[pExtension]) return 'css';

		if (pExtension === 'sql') return 'sql';

		// Default to javascript highlighting for other text files
		return 'javascript';
	},

	/**
	 * Load text content and display it using pict-section-code for
	 * syntax highlighting and line numbers.
	 *
	 * @param {string} pURL       - Content URL to fetch
	 * @param {string} pFilePath  - Full file path (used to derive extension)
	 */
	_loadCodeViewer: function _loadCodeViewer(pURL, pFilePath)
	{
		let tmpSelf = this;
		let tmpExtension = pFilePath.replace(/^.*\./, '').toLowerCase();

		fetch(pURL)
			.then((pResponse) =>
			{
				if (!pResponse.ok)
				{
					throw new Error('HTTP ' + pResponse.status);
				}
				return pResponse.text();
			})
			.then((pText) =>
			{
				let tmpContainer = document.getElementById('RetoldRemote-CodeViewer-Container');
				if (!tmpContainer)
				{
					return;
				}

				let tmpLanguage = tmpSelf._getHighlightLanguage(tmpExtension);

				// Destroy any previous CodeJar instance
				if (tmpSelf._activeCodeJar)
				{
					tmpSelf._activeCodeJar.destroy();
					tmpSelf._activeCodeJar = null;
				}

				// Check that CodeJar is available
				if (typeof (window) === 'undefined' || typeof (window.CodeJar) !== 'function')
				{
					tmpContainer.innerHTML = '<div class="retold-remote-code-viewer-loading">CodeJar not loaded; showing plain text.</div>';
					let tmpPre = document.createElement('pre');
					tmpPre.style.cssText = 'padding:16px 20px; margin:0; color:var(--retold-text-primary); font-family:monospace; white-space:pre; tab-size:4; overflow:auto; height:100%;';
					tmpPre.textContent = pText;
					tmpContainer.appendChild(tmpPre);
					return;
				}

				// Build the editor DOM (mirrors pict-section-code _buildEditorDOM)
				tmpContainer.innerHTML = '';

				let tmpWrap = document.createElement('div');
				tmpWrap.className = 'pict-code-editor-wrap';

				let tmpLineNumbers = document.createElement('div');
				tmpLineNumbers.className = 'pict-code-line-numbers';
				tmpWrap.appendChild(tmpLineNumbers);

				let tmpEditor = document.createElement('div');
				tmpEditor.className = 'pict-code-editor language-' + tmpLanguage;
				tmpWrap.appendChild(tmpEditor);

				tmpContainer.appendChild(tmpWrap);

				// Create the highlight function from pict-section-code
				let tmpHighlight = libPictSectionCode.createHighlighter(tmpLanguage);

				// Instantiate CodeJar
				tmpSelf._activeCodeJar = window.CodeJar(tmpEditor, tmpHighlight,
				{
					tab: '\t',
					catchTab: false,
					addClosing: false
				});

				// Reset inline styles that CodeJar forces
				tmpEditor.style.whiteSpace = 'pre';
				tmpEditor.style.overflowWrap = 'normal';

				// Set the content
				tmpSelf._activeCodeJar.updateCode(pText);

				// Make it read-only
				tmpEditor.setAttribute('contenteditable', 'false');

				// Render line numbers
				let tmpLineCount = pText.split('\n').length;
				let tmpLineHTML = '';
				for (let i = 1; i <= tmpLineCount; i++)
				{
					tmpLineHTML += '<span>' + i + '</span>';
				}
				tmpLineNumbers.innerHTML = tmpLineHTML;
			})
			.catch((pError) =>
			{
				let tmpContainer = document.getElementById('RetoldRemote-CodeViewer-Container');
				if (tmpContainer)
				{
					tmpContainer.innerHTML = '<div class="retold-remote-code-viewer-loading">Failed to load file: ' + pError.message + '</div>';
				}
			});
	}
};
