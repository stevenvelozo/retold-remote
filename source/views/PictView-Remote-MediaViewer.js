const libPictView = require('pict-view');
const libPictSectionCode = require('pict-section-code');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-MediaViewer",
	DefaultRenderable: "RetoldRemote-MediaViewer",
	DefaultDestinationAddress: "#RetoldRemote-Viewer-Container",
	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-viewer
		{
			display: flex;
			flex-direction: column;
			height: 100%;
		}
		.retold-remote-viewer-header
		{
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 8px 16px;
			background: var(--retold-bg-secondary);
			border-bottom: 1px solid var(--retold-border);
			flex-shrink: 0;
			z-index: 5;
		}
		.retold-remote-viewer-nav-btn
		{
			padding: 4px 10px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.8rem;
			cursor: pointer;
			transition: color 0.15s, border-color 0.15s;
			font-family: inherit;
		}
		.retold-remote-viewer-nav-btn:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
		.retold-remote-viewer-title
		{
			flex: 1;
			font-size: 0.82rem;
			color: var(--retold-text-secondary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-align: center;
		}
		.retold-remote-viewer-body
		{
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: auto;
			position: relative;
		}
		/* File info overlay */
		.retold-remote-fileinfo-overlay
		{
			position: absolute;
			top: 48px;
			right: 16px;
			background: var(--retold-bg-secondary);
			border: 1px solid var(--retold-border);
			border-radius: 6px;
			padding: 16px;
			color: var(--retold-text-secondary);
			font-size: 0.78rem;
			z-index: 10;
			min-width: 200px;
			display: none;
		}
		.retold-remote-fileinfo-row
		{
			display: flex;
			justify-content: space-between;
			padding: 3px 0;
		}
		.retold-remote-fileinfo-label
		{
			color: var(--retold-text-dim);
		}
		.retold-remote-fileinfo-value
		{
			color: var(--retold-text-primary);
		}
		/* Code viewer container */
		.retold-remote-code-viewer-container
		{
			width: 100%;
			height: 100%;
			overflow: hidden;
		}
		.retold-remote-code-viewer-loading
		{
			padding: 16px 20px;
			color: var(--retold-text-dim);
			font-style: italic;
			font-size: 0.82rem;
		}
		/* pict-section-code dark theme overrides */
		.retold-remote-code-viewer-container .pict-code-editor-wrap
		{
			border: none;
			border-radius: 0;
			height: 100%;
			font-family: var(--retold-font-mono, 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', monospace);
			font-size: 0.82rem;
			line-height: 1.6;
		}
		.retold-remote-code-viewer-container .pict-code-line-numbers
		{
			background: var(--retold-bg-secondary);
			border-right: 1px solid var(--retold-border);
			color: var(--retold-text-dim);
			font-size: 0.78rem;
			line-height: 1.6;
			padding: 10px 0;
		}
		.retold-remote-code-viewer-container .pict-code-editor
		{
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-primary);
			padding: 10px 10px 10px 12px;
			tab-size: 4;
			-moz-tab-size: 4;
			caret-color: var(--retold-accent);
			border-radius: 0;
		}
		/* Syntax highlighting colors for dark themes */
		.retold-remote-code-viewer-container .pict-code-editor .keyword { color: #C678DD; }
		.retold-remote-code-viewer-container .pict-code-editor .string { color: #98C379; }
		.retold-remote-code-viewer-container .pict-code-editor .number { color: #D19A66; }
		.retold-remote-code-viewer-container .pict-code-editor .comment { color: #5C6370; font-style: italic; }
		.retold-remote-code-viewer-container .pict-code-editor .operator { color: #56B6C2; }
		.retold-remote-code-viewer-container .pict-code-editor .punctuation { color: #ABB2BF; }
		.retold-remote-code-viewer-container .pict-code-editor .function-name { color: #61AFEF; }
		.retold-remote-code-viewer-container .pict-code-editor .property { color: #E06C75; }
		.retold-remote-code-viewer-container .pict-code-editor .tag { color: #E06C75; }
		.retold-remote-code-viewer-container .pict-code-editor .attr-name { color: #D19A66; }
		.retold-remote-code-viewer-container .pict-code-editor .attr-value { color: #98C379; }
	`
};

class RetoldRemoteMediaViewerView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	/**
	 * Show the media viewer for a given file.
	 *
	 * @param {string} pFilePath  - Relative file path
	 * @param {string} pMediaType - 'image', 'video', 'audio', 'document', or 'other'
	 */
	showMedia(pFilePath, pMediaType)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ActiveMode = 'viewer';
		tmpRemote.CurrentViewerFile = pFilePath;
		tmpRemote.CurrentViewerMediaType = pMediaType;

		// Show viewer, hide gallery
		let tmpGalleryContainer = document.getElementById('RetoldRemote-Gallery-Container');
		let tmpViewerContainer = document.getElementById('RetoldRemote-Viewer-Container');

		if (tmpGalleryContainer) tmpGalleryContainer.style.display = 'none';
		if (tmpViewerContainer) tmpViewerContainer.style.display = 'block';

		let tmpFileName = pFilePath.replace(/^.*\//, '');
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpContentURL = tmpProvider ? tmpProvider.getContentURL(pFilePath) : ('/content/' + encodeURIComponent(pFilePath));

		// Build the viewer HTML
		let tmpHTML = '<div class="retold-remote-viewer">';

		// Header with nav
		tmpHTML += '<div class="retold-remote-viewer-header">';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\'].closeViewer()" title="Back (Esc)">&larr; Back</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\'].prevFile()" title="Previous (k)">&lsaquo; Prev</button>';
		tmpHTML += '<div class="retold-remote-viewer-title">' + this._escapeHTML(tmpFileName) + '</div>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\'].nextFile()" title="Next (j)">Next &rsaquo;</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._toggleFileInfo()" title="Info (i)">&#9432;</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._toggleFullscreen()" title="Fullscreen (f)">&#9634;</button>';
		tmpHTML += '</div>';

		// Body with media content
		tmpHTML += '<div class="retold-remote-viewer-body">';

		switch (pMediaType)
		{
			case 'image':
				tmpHTML += this._buildImageHTML(tmpContentURL, tmpFileName);
				break;
			case 'video':
				tmpHTML += this._buildVideoHTML(tmpContentURL, tmpFileName);
				break;
			case 'audio':
				tmpHTML += this._buildAudioHTML(tmpContentURL, tmpFileName);
				break;
			case 'text':
				tmpHTML += this._buildTextHTML(tmpContentURL, tmpFileName, pFilePath);
				break;
			case 'document':
				tmpHTML += this._buildDocumentHTML(tmpContentURL, tmpFileName, pFilePath);
				break;
			default:
				tmpHTML += this._buildFallbackHTML(tmpContentURL, tmpFileName);
				break;
		}

		// File info overlay (hidden by default)
		tmpHTML += '<div class="retold-remote-fileinfo-overlay" id="RetoldRemote-FileInfo-Overlay">';
		tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Loading...</span></div>';
		tmpHTML += '</div>';

		tmpHTML += '</div>'; // end body
		tmpHTML += '</div>'; // end viewer

		if (tmpViewerContainer)
		{
			tmpViewerContainer.innerHTML = tmpHTML;
		}

		// Fetch and populate file info
		this._loadFileInfo(pFilePath);

		// Fetch text content and initialize code viewer
		if (pMediaType === 'text')
		{
			this._loadCodeViewer(tmpContentURL, pFilePath);
		}

		// Update topbar
		let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBar)
		{
			tmpTopBar.updateInfo();
		}
	}

	_buildImageHTML(pURL, pFileName)
	{
		return '<img src="' + pURL + '" alt="' + this._escapeHTML(pFileName) + '" '
			+ 'style="max-width: 100%; max-height: 100%; object-fit: contain; cursor: zoom-in;" '
			+ 'id="RetoldRemote-ImageViewer-Img" '
			+ 'onload="pict.views[\'RetoldRemote-ImageViewer\'].initImage()" '
			+ 'onclick="pict.views[\'RetoldRemote-ImageViewer\'].toggleZoom()">';
	}

	_buildVideoHTML(pURL, pFileName)
	{
		return '<video controls autoplay preload="metadata" '
			+ 'style="max-width: 100%; max-height: 100%;" '
			+ 'id="RetoldRemote-VideoPlayer">'
			+ '<source src="' + pURL + '">'
			+ 'Your browser does not support the video tag.'
			+ '</video>';
	}

	_buildAudioHTML(pURL, pFileName)
	{
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpIconHTML = tmpIconProvider ? '<span class="retold-remote-icon retold-remote-icon-lg">' + tmpIconProvider.getIcon('music-note', 64) + '</span>' : '&#127925;';
		return '<div style="text-align: center; padding: 40px;">'
			+ '<div style="margin-bottom: 24px;">' + tmpIconHTML + '</div>'
			+ '<div style="font-size: 1.1rem; color: var(--retold-text-secondary); margin-bottom: 24px;">' + this._escapeHTML(pFileName) + '</div>'
			+ '<audio controls autoplay preload="metadata" id="RetoldRemote-AudioPlayer" style="width: 100%; max-width: 500px;">'
			+ '<source src="' + pURL + '">'
			+ 'Your browser does not support the audio tag.'
			+ '</audio>'
			+ '</div>';
	}

	_buildDocumentHTML(pURL, pFileName, pFilePath)
	{
		let tmpExtension = pFilePath.replace(/^.*\./, '').toLowerCase();

		if (tmpExtension === 'pdf')
		{
			return '<iframe src="' + pURL + '" '
				+ 'style="width: 100%; height: 100%; border: none;">'
				+ '</iframe>';
		}

		// For other document types, show a download link
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpDocIconHTML = tmpIconProvider ? '<span class="retold-remote-icon retold-remote-icon-lg">' + tmpIconProvider.getIcon('document-large', 64) + '</span>' : '&#128196;';
		return '<div style="text-align: center; padding: 40px;">'
			+ '<div style="margin-bottom: 24px;">' + tmpDocIconHTML + '</div>'
			+ '<div style="font-size: 1.1rem; color: var(--retold-text-secondary); margin-bottom: 24px;">' + this._escapeHTML(pFileName) + '</div>'
			+ '<a href="' + pURL + '" target="_blank" style="color: var(--retold-accent); font-size: 0.9rem;">Open in new tab</a>'
			+ '</div>';
	}

	_buildTextHTML(pURL, pFileName, pFilePath)
	{
		return '<div class="retold-remote-code-viewer-container" id="RetoldRemote-CodeViewer-Container">'
			+ '<div class="retold-remote-code-viewer-loading">Loading...</div>'
			+ '</div>';
	}

	/**
	 * Map a file extension to a pict-section-code highlight language.
	 *
	 * @param {string} pExtension - File extension (no dot)
	 * @returns {string} One of: javascript, json, html, css, sql
	 */
	_getHighlightLanguage(pExtension)
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
	}

	/**
	 * Load text content and display it using pict-section-code for
	 * syntax highlighting and line numbers.
	 *
	 * @param {string} pURL       - Content URL to fetch
	 * @param {string} pFilePath  - Full file path (used to derive extension)
	 */
	_loadCodeViewer(pURL, pFilePath)
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

	_buildFallbackHTML(pURL, pFileName)
	{
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpFallbackIconHTML = tmpIconProvider ? '<span class="retold-remote-icon retold-remote-icon-lg">' + tmpIconProvider.getIcon('document-large', 64) + '</span>' : '&#128196;';
		return '<div style="text-align: center; padding: 40px;">'
			+ '<div style="margin-bottom: 24px;">' + tmpFallbackIconHTML + '</div>'
			+ '<div style="font-size: 1.1rem; color: var(--retold-text-secondary); margin-bottom: 24px;">' + this._escapeHTML(pFileName) + '</div>'
			+ '<a href="' + pURL + '" target="_blank" style="color: var(--retold-accent); font-size: 0.9rem;">Download / Open in new tab</a>'
			+ '</div>';
	}

	/**
	 * Fetch file info and populate the overlay.
	 */
	_loadFileInfo(pFilePath)
	{
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		if (!tmpProvider)
		{
			return;
		}

		tmpProvider.fetchMediaProbe(pFilePath,
			(pError, pData) =>
			{
				let tmpOverlay = document.getElementById('RetoldRemote-FileInfo-Overlay');
				if (!tmpOverlay || !pData)
				{
					return;
				}

				let tmpHTML = '';

				if (pData.Size !== undefined)
				{
					tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Size</span><span class="retold-remote-fileinfo-value">' + this._formatFileSize(pData.Size) + '</span></div>';
				}
				if (pData.Width && pData.Height)
				{
					tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Dimensions</span><span class="retold-remote-fileinfo-value">' + pData.Width + ' x ' + pData.Height + '</span></div>';
				}
				if (pData.Duration)
				{
					let tmpMin = Math.floor(pData.Duration / 60);
					let tmpSec = Math.floor(pData.Duration % 60);
					tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Duration</span><span class="retold-remote-fileinfo-value">' + tmpMin + ':' + (tmpSec < 10 ? '0' : '') + tmpSec + '</span></div>';
				}
				if (pData.Codec)
				{
					tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Codec</span><span class="retold-remote-fileinfo-value">' + pData.Codec + '</span></div>';
				}
				if (pData.Format)
				{
					tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Format</span><span class="retold-remote-fileinfo-value">' + pData.Format + '</span></div>';
				}
				if (pData.Modified)
				{
					tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Modified</span><span class="retold-remote-fileinfo-value">' + new Date(pData.Modified).toLocaleString() + '</span></div>';
				}
				if (pData.Path)
				{
					tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Path</span><span class="retold-remote-fileinfo-value">' + pData.Path + '</span></div>';
				}

				tmpOverlay.innerHTML = tmpHTML;
			});
	}

	_formatFileSize(pBytes)
	{
		if (!pBytes || pBytes === 0) return '0 B';
		let tmpUnits = ['B', 'KB', 'MB', 'GB', 'TB'];
		let tmpIndex = Math.floor(Math.log(pBytes) / Math.log(1024));
		if (tmpIndex >= tmpUnits.length) tmpIndex = tmpUnits.length - 1;
		let tmpSize = pBytes / Math.pow(1024, tmpIndex);
		return tmpSize.toFixed(tmpIndex === 0 ? 0 : 1) + ' ' + tmpUnits[tmpIndex];
	}

	_escapeHTML(pText)
	{
		if (!pText) return '';
		return pText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}
}

RetoldRemoteMediaViewerView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteMediaViewerView;
