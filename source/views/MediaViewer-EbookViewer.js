/**
 * MediaViewer — Ebook Viewer Mixin
 *
 * EPUB/MOBI rendering using epub.js, table of contents,
 * page navigation, text selection capture, visual rectangle
 * selection, and MOBI-to-EPUB server-side conversion.
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
			+ '<span style="flex:1;"></span>'
			+ '<button class="retold-remote-ebook-page-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].ebookSaveSelection()">&#128190; Save Selection</button>'
			+ '<button class="retold-remote-ebook-page-btn" id="RetoldRemote-EbookRegionSelectBtn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].ebookToggleRegionSelect()">&#9986; Select Region</button>'
			+ '</div>'
			+ '<div class="retold-remote-ebook-controls" id="RetoldRemote-EbookLabelInput" style="display:none;">'
			+ '<input type="text" id="RetoldRemote-EbookLabelField" placeholder="Label..." '
			+ 'style="flex:1; padding:4px 8px; background:var(--retold-bg-secondary, #2d2d2d); color:var(--retold-text-primary, #d4d4d4); border:1px solid var(--retold-border, #444); border-radius:4px;" '
			+ 'onkeydown="if(event.key===\'Enter\'){pict.views[\'RetoldRemote-MediaViewer\'].ebookSaveLabel();}">'
			+ '<button class="retold-remote-ebook-page-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].ebookSaveLabel()">Save</button>'
			+ '<button class="retold-remote-ebook-page-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].ebookCancelSelection()">Cancel</button>'
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
	},

	/**
	 * Capture the current text selection from the epub.js rendition,
	 * derive a CFI, and show the label input for saving.
	 */
	ebookSaveSelection: function ebookSaveSelection()
	{
		let tmpSelf = this;

		if (!this._activeRendition)
		{
			this.pict.providers['RetoldRemote-ToastNotification'].showToast('No ebook loaded.');
			return;
		}

		let tmpContents = this._activeRendition.getContents();
		if (!tmpContents || tmpContents.length < 1)
		{
			this.pict.providers['RetoldRemote-ToastNotification'].showToast('Unable to access ebook contents.');
			return;
		}

		let tmpDoc = tmpContents[0].document;
		let tmpSelection = tmpDoc.getSelection();
		let tmpSelectedText = tmpSelection ? tmpSelection.toString() : '';

		if (!tmpSelectedText || tmpSelectedText.trim().length === 0)
		{
			this.pict.providers['RetoldRemote-ToastNotification'].showToast('Select text first.');
			return;
		}

		// Derive the CFI from the selection range
		let tmpCFI = '';
		try
		{
			let tmpRange = tmpSelection.getRangeAt(0);
			tmpCFI = tmpContents[0].cfiFromRange(tmpRange);
		}
		catch (pError)
		{
			this.pict.log.warn('Could not derive CFI from selection: ' + pError.message);
		}

		// Get current location for spine index
		let tmpLocation = this._activeRendition.currentLocation();
		let tmpSpineIndex = (tmpLocation && tmpLocation.start) ? tmpLocation.start.index : -1;

		// Try to find the chapter title from the TOC
		let tmpChapterTitle = '';
		try
		{
			let tmpTocItems = document.querySelectorAll('#RetoldRemote-EbookTOCItems .retold-remote-ebook-toc-item');
			if (tmpTocItems.length > 0 && tmpSpineIndex >= 0)
			{
				// Best effort: use the TOC item closest to the spine index
				let tmpTocIndex = Math.min(tmpSpineIndex, tmpTocItems.length - 1);
				tmpChapterTitle = tmpTocItems[tmpTocIndex].textContent.trim();
			}
		}
		catch (pError)
		{
			// Chapter title is best-effort; ignore errors
		}

		// Store pending selection data on the view instance
		this._pendingEbookSelection =
		{
			Type: 'text-selection',
			CFI: tmpCFI,
			SpineIndex: tmpSpineIndex,
			ChapterTitle: tmpChapterTitle,
			SelectedText: tmpSelectedText
		};

		// Show the label input
		let tmpLabelInput = document.getElementById('RetoldRemote-EbookLabelInput');
		if (tmpLabelInput)
		{
			tmpLabelInput.style.display = '';
		}
		let tmpLabelField = document.getElementById('RetoldRemote-EbookLabelField');
		if (tmpLabelField)
		{
			tmpLabelField.value = '';
			tmpLabelField.focus();
		}
	},

	/**
	 * Toggle visual rectangle selection mode over the ebook content area.
	 * When enabled, an overlay captures mouse events to draw a rectangle.
	 */
	ebookToggleRegionSelect: function ebookToggleRegionSelect()
	{
		let tmpSelf = this;
		let tmpContentEl = document.getElementById('RetoldRemote-EbookContent');
		let tmpToggleBtn = document.getElementById('RetoldRemote-EbookRegionSelectBtn');

		if (!tmpContentEl)
		{
			return;
		}

		// If overlay already exists, remove it (toggle off)
		let tmpExistingOverlay = document.getElementById('RetoldRemote-EbookRegionOverlay');
		if (tmpExistingOverlay)
		{
			tmpExistingOverlay.remove();
			if (tmpToggleBtn)
			{
				tmpToggleBtn.style.background = '';
			}
			this._ebookRegionActive = false;
			return;
		}

		this._ebookRegionActive = true;
		if (tmpToggleBtn)
		{
			tmpToggleBtn.style.background = 'var(--retold-accent, #569cd6)';
		}

		// Create a transparent overlay div
		let tmpOverlay = document.createElement('div');
		tmpOverlay.id = 'RetoldRemote-EbookRegionOverlay';
		tmpOverlay.style.cssText = 'position:absolute; top:0; left:0; width:100%; height:100%; '
			+ 'cursor:crosshair; z-index:100; user-select:none;';
		tmpContentEl.style.position = 'relative';
		tmpContentEl.appendChild(tmpOverlay);

		let tmpDrawing = false;
		let tmpStartX = 0;
		let tmpStartY = 0;
		let tmpRectEl = null;

		tmpOverlay.addEventListener('mousedown', function (pEvent)
		{
			pEvent.preventDefault();
			pEvent.stopPropagation();

			// Remove any previous rectangle
			let tmpOldRect = document.getElementById('RetoldRemote-EbookRegionRect');
			if (tmpOldRect)
			{
				tmpOldRect.remove();
			}

			let tmpBounds = tmpOverlay.getBoundingClientRect();
			tmpStartX = pEvent.clientX - tmpBounds.left;
			tmpStartY = pEvent.clientY - tmpBounds.top;
			tmpDrawing = true;

			tmpRectEl = document.createElement('div');
			tmpRectEl.id = 'RetoldRemote-EbookRegionRect';
			tmpRectEl.style.cssText = 'position:absolute; border:2px dashed var(--retold-accent, #569cd6); '
				+ 'background:rgba(86, 156, 214, 0.15); pointer-events:none;';
			tmpRectEl.style.left = tmpStartX + 'px';
			tmpRectEl.style.top = tmpStartY + 'px';
			tmpRectEl.style.width = '0px';
			tmpRectEl.style.height = '0px';
			tmpOverlay.appendChild(tmpRectEl);
		});

		tmpOverlay.addEventListener('mousemove', function (pEvent)
		{
			if (!tmpDrawing || !tmpRectEl)
			{
				return;
			}
			pEvent.preventDefault();

			let tmpBounds = tmpOverlay.getBoundingClientRect();
			let tmpCurrentX = pEvent.clientX - tmpBounds.left;
			let tmpCurrentY = pEvent.clientY - tmpBounds.top;

			let tmpLeft = Math.min(tmpStartX, tmpCurrentX);
			let tmpTop = Math.min(tmpStartY, tmpCurrentY);
			let tmpWidth = Math.abs(tmpCurrentX - tmpStartX);
			let tmpHeight = Math.abs(tmpCurrentY - tmpStartY);

			tmpRectEl.style.left = tmpLeft + 'px';
			tmpRectEl.style.top = tmpTop + 'px';
			tmpRectEl.style.width = tmpWidth + 'px';
			tmpRectEl.style.height = tmpHeight + 'px';
		});

		tmpOverlay.addEventListener('mouseup', function (pEvent)
		{
			if (!tmpDrawing || !tmpRectEl)
			{
				return;
			}
			pEvent.preventDefault();
			tmpDrawing = false;

			let tmpBounds = tmpOverlay.getBoundingClientRect();
			let tmpEndX = pEvent.clientX - tmpBounds.left;
			let tmpEndY = pEvent.clientY - tmpBounds.top;

			let tmpRegionLeft = Math.min(tmpStartX, tmpEndX);
			let tmpRegionTop = Math.min(tmpStartY, tmpEndY);
			let tmpRegionWidth = Math.abs(tmpEndX - tmpStartX);
			let tmpRegionHeight = Math.abs(tmpEndY - tmpStartY);

			// Ignore tiny accidental drags
			if (tmpRegionWidth < 5 || tmpRegionHeight < 5)
			{
				if (tmpRectEl)
				{
					tmpRectEl.remove();
					tmpRectEl = null;
				}
				return;
			}

			let tmpViewportWidth = tmpOverlay.offsetWidth;
			let tmpViewportHeight = tmpOverlay.offsetHeight;

			// Best-effort text extraction from the rectangle area
			let tmpExtractedText = '';
			try
			{
				let tmpContents = tmpSelf._activeRendition.getContents();
				if (tmpContents && tmpContents.length > 0)
				{
					let tmpDoc = tmpContents[0].document;
					let tmpBody = tmpDoc.body;
					if (tmpBody)
					{
						// Walk text nodes and check if any fall within the rectangle
						let tmpTreeWalker = tmpDoc.createTreeWalker(tmpBody, NodeFilter.SHOW_TEXT, null, false);
						let tmpTextParts = [];
						let tmpNode;

						while ((tmpNode = tmpTreeWalker.nextNode()))
						{
							if (!tmpNode.textContent || tmpNode.textContent.trim().length === 0)
							{
								continue;
							}
							let tmpRange = tmpDoc.createRange();
							tmpRange.selectNodeContents(tmpNode);
							let tmpRects = tmpRange.getClientRects();
							for (let i = 0; i < tmpRects.length; i++)
							{
								let tmpR = tmpRects[i];
								// Check overlap with the drawn rectangle
								if (tmpR.right >= tmpRegionLeft && tmpR.left <= (tmpRegionLeft + tmpRegionWidth)
									&& tmpR.bottom >= tmpRegionTop && tmpR.top <= (tmpRegionTop + tmpRegionHeight))
								{
									tmpTextParts.push(tmpNode.textContent.trim());
									break;
								}
							}
						}
						tmpExtractedText = tmpTextParts.join(' ');
					}
				}
			}
			catch (pError)
			{
				// Text extraction from region is best-effort
				tmpSelf.pict.log.warn('Region text extraction failed: ' + pError.message);
			}

			// Get current location for spine index
			let tmpLocation = tmpSelf._activeRendition.currentLocation();
			let tmpSpineIndex = (tmpLocation && tmpLocation.start) ? tmpLocation.start.index : -1;

			// Store pending selection data
			tmpSelf._pendingEbookSelection =
			{
				Type: 'visual-region',
				X: Math.round(tmpRegionLeft),
				Y: Math.round(tmpRegionTop),
				Width: Math.round(tmpRegionWidth),
				Height: Math.round(tmpRegionHeight),
				ViewportWidth: tmpViewportWidth,
				ViewportHeight: tmpViewportHeight,
				SpineIndex: tmpSpineIndex,
				SelectedText: tmpExtractedText
			};

			// Show the label input
			let tmpLabelInput = document.getElementById('RetoldRemote-EbookLabelInput');
			if (tmpLabelInput)
			{
				tmpLabelInput.style.display = '';
			}
			let tmpLabelField = document.getElementById('RetoldRemote-EbookLabelField');
			if (tmpLabelField)
			{
				tmpLabelField.value = '';
				tmpLabelField.focus();
			}
		});
	},

	/**
	 * Cancel any in-progress selection or region, hide the label input,
	 * and remove the region overlay if present.
	 */
	ebookCancelSelection: function ebookCancelSelection()
	{
		// Hide the label input
		let tmpLabelInput = document.getElementById('RetoldRemote-EbookLabelInput');
		if (tmpLabelInput)
		{
			tmpLabelInput.style.display = 'none';
		}

		// Clear the label field
		let tmpLabelField = document.getElementById('RetoldRemote-EbookLabelField');
		if (tmpLabelField)
		{
			tmpLabelField.value = '';
		}

		// Remove region overlay and rectangle if present
		let tmpRect = document.getElementById('RetoldRemote-EbookRegionRect');
		if (tmpRect)
		{
			tmpRect.remove();
		}
		let tmpOverlay = document.getElementById('RetoldRemote-EbookRegionOverlay');
		if (tmpOverlay)
		{
			tmpOverlay.remove();
		}

		// Reset toggle button style
		let tmpToggleBtn = document.getElementById('RetoldRemote-EbookRegionSelectBtn');
		if (tmpToggleBtn)
		{
			tmpToggleBtn.style.background = '';
		}

		this._ebookRegionActive = false;
		this._pendingEbookSelection = null;
	},

	/**
	 * Save the pending selection with the label from the input field.
	 * POSTs to /api/media/subimage-regions and updates the sidebar.
	 */
	ebookSaveLabel: function ebookSaveLabel()
	{
		let tmpSelf = this;

		if (!this._pendingEbookSelection)
		{
			this.pict.providers['RetoldRemote-ToastNotification'].showToast('No selection to save.');
			return;
		}

		let tmpLabelField = document.getElementById('RetoldRemote-EbookLabelField');
		let tmpLabelValue = tmpLabelField ? tmpLabelField.value.trim() : '';

		if (!tmpLabelValue)
		{
			this.pict.providers['RetoldRemote-ToastNotification'].showToast('Enter a label for the selection.');
			return;
		}

		let tmpRegion = this._pendingEbookSelection;
		tmpRegion.Label = tmpLabelValue;

		let tmpPayload =
		{
			Path: this.pict.AppData.RetoldRemote.CurrentViewerFile,
			Region: tmpRegion
		};

		fetch('/api/media/subimage-regions',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(tmpPayload)
		})
			.then((pResponse) =>
			{
				if (!pResponse.ok)
				{
					throw new Error('HTTP ' + pResponse.status);
				}
				return pResponse.json();
			})
			.then((pData) =>
			{
				tmpSelf.pict.providers['RetoldRemote-ToastNotification'].showToast('Selection saved: ' + tmpLabelValue);

				// Clean up the selection state and UI
				tmpSelf.ebookCancelSelection();

				// Refresh the sidebar panel if a regions panel method exists
				if (typeof (tmpSelf.refreshSubimageRegions) === 'function')
				{
					tmpSelf.refreshSubimageRegions();
				}
			})
			.catch((pError) =>
			{
				tmpSelf.pict.providers['RetoldRemote-ToastNotification'].showToast('Failed to save selection: ' + pError.message);
				tmpSelf.pict.log.error('Ebook selection save error: ' + pError.message);
			});
	}
};
