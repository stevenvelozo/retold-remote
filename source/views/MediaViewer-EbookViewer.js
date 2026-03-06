/**
 * MediaViewer — Ebook Viewer Mixin
 *
 * EPUB/MOBI rendering using epub.js, table of contents,
 * page navigation, and MOBI-to-EPUB server-side conversion.
 *
 * Mixed into RetoldRemoteMediaViewerView.prototype via Object.assign().
 * All methods access state through `this` (the view instance).
 *
 * @license MIT
 */

module.exports =
{
	/**
	 * Build the HTML shell for the ebook reader.
	 */
	_buildEbookHTML: function _buildEbookHTML(pURL, pFileName, pFilePath)
	{
		return '<div class="retold-remote-ebook-wrap">'
			+ '<div class="retold-remote-ebook-toc collapsed" id="RetoldRemote-EbookTOC">'
			+ '<div class="retold-remote-ebook-toc-header">'
			+ '<span>Contents</span>'
			+ '<button class="retold-remote-ebook-toc-close" onclick="pict.views[\'RetoldRemote-MediaViewer\'].toggleEbookTOC()" title="Close">&times;</button>'
			+ '</div>'
			+ '<div class="retold-remote-ebook-toc-items" id="RetoldRemote-EbookTOCItems"></div>'
			+ '</div>'
			+ '<div class="retold-remote-ebook-reader">'
			+ '<div class="retold-remote-ebook-content" id="RetoldRemote-EbookContent">'
			+ '<div class="retold-remote-ebook-loading">Loading ebook...</div>'
			+ '</div>'
			+ '<div class="retold-remote-ebook-controls">'
			+ '<button class="retold-remote-ebook-toc-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].toggleEbookTOC()">&#9776; TOC</button>'
			+ '<button class="retold-remote-ebook-page-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].ebookPrevPage()">&larr; Prev</button>'
			+ '<button class="retold-remote-ebook-page-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].ebookNextPage()">Next &rarr;</button>'
			+ '</div>'
			+ '</div>'
			+ '</div>';
	},

	/**
	 * Load and render an ebook using epub.js.
	 * For EPUB files, fetch directly. For MOBI files, convert server-side first.
	 *
	 * @param {string} pContentURL - Content URL for the file
	 * @param {string} pFilePath   - Relative file path
	 */
	_loadEbookViewer: function _loadEbookViewer(pContentURL, pFilePath)
	{
		let tmpSelf = this;
		let tmpExtension = pFilePath.replace(/^.*\./, '').toLowerCase();

		if (tmpExtension === 'mobi')
		{
			// Convert MOBI to EPUB server-side first
			let tmpCapabilities = this.pict.AppData.RetoldRemote.ServerCapabilities || {};
			if (!tmpCapabilities.ebook_convert)
			{
				let tmpContent = document.getElementById('RetoldRemote-EbookContent');
				if (tmpContent)
				{
					tmpContent.innerHTML = '<div class="retold-remote-ebook-loading">'
						+ 'MOBI viewing requires Calibre (ebook-convert) on the server.<br>'
						+ '<a href="' + pContentURL + '" target="_blank" style="color: var(--retold-accent); margin-top: 12px; display: inline-block;">Download file</a>'
						+ '</div>';
				}
				return;
			}

			let tmpContent = document.getElementById('RetoldRemote-EbookContent');
			if (tmpContent)
			{
				tmpContent.innerHTML = '<div class="retold-remote-ebook-loading">Converting MOBI to EPUB...</div>';
			}

			let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
			let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

			fetch('/api/media/ebook-convert?path=' + tmpPathParam)
				.then((pResponse) => pResponse.json())
				.then((pData) =>
				{
					if (!pData || !pData.Success)
					{
						throw new Error(pData ? pData.Error : 'Conversion failed.');
					}

					// Fetch the converted EPUB and render
					let tmpEpubURL = '/api/media/ebook/' + pData.CacheKey + '/' + pData.OutputFilename;
					tmpSelf._renderEpub(tmpEpubURL);
				})
				.catch((pError) =>
				{
					let tmpEl = document.getElementById('RetoldRemote-EbookContent');
					if (tmpEl)
					{
						tmpEl.innerHTML = '<div class="retold-remote-ebook-loading">Failed to convert: '
							+ tmpSelf.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pError.message)
							+ '<br><a href="' + pContentURL + '" target="_blank" style="color: var(--retold-accent); margin-top: 12px; display: inline-block;">Download file</a>'
							+ '</div>';
					}
				});
		}
		else
		{
			// EPUB — render directly
			this._renderEpub(pContentURL);
		}
	},

	/**
	 * Initialize epub.js and render an EPUB into the viewer container.
	 *
	 * @param {string} pEpubURL - URL to fetch the EPUB from
	 */
	_renderEpub: function _renderEpub(pEpubURL)
	{
		let tmpSelf = this;

		// Check that epub.js is available
		if (typeof (window) === 'undefined' || typeof (window.ePub) !== 'function')
		{
			let tmpEl = document.getElementById('RetoldRemote-EbookContent');
			if (tmpEl)
			{
				tmpEl.innerHTML = '<div class="retold-remote-ebook-loading">epub.js library not loaded.</div>';
			}
			return;
		}

		// Destroy any previous book instance
		if (this._activeBook)
		{
			try { this._activeBook.destroy(); } catch (e) { /* ignore */ }
			this._activeBook = null;
			this._activeRendition = null;
		}

		let tmpContentEl = document.getElementById('RetoldRemote-EbookContent');
		if (!tmpContentEl)
		{
			return;
		}

		// Clear loading message
		tmpContentEl.innerHTML = '';

		// Fetch the EPUB as an ArrayBuffer and open with epub.js
		fetch(pEpubURL)
			.then((pResponse) =>
			{
				if (!pResponse.ok)
				{
					throw new Error('HTTP ' + pResponse.status);
				}
				return pResponse.arrayBuffer();
			})
			.then((pBuffer) =>
			{
				let tmpBook = window.ePub(pBuffer);
				tmpSelf._activeBook = tmpBook;

				let tmpRendition = tmpBook.renderTo(tmpContentEl,
				{
					width: '100%',
					height: '100%',
					spread: 'none'
				});

				tmpSelf._activeRendition = tmpRendition;

				tmpRendition.display();

				// Apply theme for dark backgrounds
				tmpRendition.themes.default(
				{
					'body':
					{
						'color': 'var(--retold-text-primary, #d4d4d4)',
						'background': 'var(--retold-bg-primary, #1e1e1e)',
						'font-family': 'Georgia, "Times New Roman", serif',
						'line-height': '1.6',
						'padding': '20px 40px'
					},
					'a':
					{
						'color': 'var(--retold-accent, #569cd6)'
					}
				});

				// Load table of contents
				tmpBook.loaded.navigation.then((pNav) =>
				{
					tmpSelf._renderEbookTOC(pNav.toc);
				});
			})
			.catch((pError) =>
			{
				if (tmpContentEl)
				{
					tmpContentEl.innerHTML = '<div class="retold-remote-ebook-loading">Failed to load ebook: '
						+ tmpSelf.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pError.message) + '</div>';
				}
			});
	},

	/**
	 * Render the table of contents for the ebook.
	 *
	 * @param {Array} pToc - epub.js navigation TOC array
	 */
	_renderEbookTOC: function _renderEbookTOC(pToc)
	{
		let tmpTocItemsEl = document.getElementById('RetoldRemote-EbookTOCItems');
		if (!tmpTocItemsEl || !pToc)
		{
			return;
		}

		let tmpSelf = this;
		let tmpHTML = '';

		let tmpBuildItems = function (pItems, pDepth)
		{
			for (let i = 0; i < pItems.length; i++)
			{
				let tmpItem = pItems[i];
				let tmpIndentClass = pDepth > 0 ? ' indent-' + Math.min(pDepth, 2) : '';
				tmpHTML += '<button class="retold-remote-ebook-toc-item' + tmpIndentClass + '" '
					+ 'data-href="' + tmpSelf.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpItem.href) + '" '
					+ 'onclick="pict.views[\'RetoldRemote-MediaViewer\'].ebookGoToChapter(this.getAttribute(\'data-href\'))">'
					+ tmpSelf.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpItem.label.trim())
					+ '</button>';

				if (tmpItem.subitems && tmpItem.subitems.length > 0)
				{
					tmpBuildItems(tmpItem.subitems, pDepth + 1);
				}
			}
		};

		tmpBuildItems(pToc, 0);
		tmpTocItemsEl.innerHTML = tmpHTML;
	},

	/**
	 * Navigate to a chapter in the ebook by href.
	 *
	 * @param {string} pHref - Chapter href from the TOC
	 */
	ebookGoToChapter: function ebookGoToChapter(pHref)
	{
		if (this._activeRendition && pHref)
		{
			this._activeRendition.display(pHref);
		}
	},

	/**
	 * Go to the previous page in the ebook.
	 */
	ebookPrevPage: function ebookPrevPage()
	{
		if (this._activeRendition)
		{
			this._activeRendition.prev();
		}
	},

	/**
	 * Go to the next page in the ebook.
	 */
	ebookNextPage: function ebookNextPage()
	{
		if (this._activeRendition)
		{
			this._activeRendition.next();
		}
	},

	/**
	 * Toggle the table of contents sidebar.
	 */
	toggleEbookTOC: function toggleEbookTOC()
	{
		let tmpTocEl = document.getElementById('RetoldRemote-EbookTOC');
		if (tmpTocEl)
		{
			tmpTocEl.classList.toggle('collapsed');
		}
	}
};
