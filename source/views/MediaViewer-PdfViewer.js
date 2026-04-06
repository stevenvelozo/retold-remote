/**
 * MediaViewer — PDF Viewer Mixin
 *
 * Full pdf.js canvas renderer with text layer, page navigation,
 * zoom controls, text selection saving, and visual region selection.
 *
 * Mixed into RetoldRemoteMediaViewerView.prototype via Object.assign().
 * All methods access state through `this` (the view instance).
 *
 * @license MIT
 */

const _PDF_JS_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.min.mjs';
const _PDF_JS_WORKER_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.9.155/pdf.worker.min.mjs';

module.exports =
{
	/**
	 * Build the HTML shell for the PDF viewer.
	 *
	 * @param {string} pURL      - Content URL for the file
	 * @param {string} pFileName - Display file name
	 * @param {string} pFilePath - Relative file path
	 * @returns {string} HTML string
	 */
	_buildPdfHTML: function _buildPdfHTML(pURL, pFileName, pFilePath)
	{
		let tmpViewRef = "pict.views['RetoldRemote-MediaViewer']";

		let tmpHTML = '<div class="retold-remote-pdf-viewer">';

		// Controls bar
		tmpHTML += '<div class="retold-remote-pdf-controls" id="RetoldRemote-PdfControls">';
		tmpHTML += '<button class="retold-remote-pdf-btn" onclick="' + tmpViewRef + '.pdfPrevPage()" title="Previous page">&larr; Prev</button>';
		tmpHTML += '<span class="retold-remote-pdf-page-info">';
		tmpHTML += 'Page <input type="number" id="RetoldRemote-PdfPageInput" class="retold-remote-pdf-page-input" value="1" min="1" '
			+ 'onchange="' + tmpViewRef + '.pdfGoToPage(parseInt(this.value,10))" '
			+ 'onkeydown="if(event.key===\'Enter\'){' + tmpViewRef + '.pdfGoToPage(parseInt(this.value,10));event.preventDefault();}">';
		tmpHTML += ' of <span id="RetoldRemote-PdfPageCount">0</span>';
		tmpHTML += '</span>';
		tmpHTML += '<button class="retold-remote-pdf-btn" onclick="' + tmpViewRef + '.pdfNextPage()" title="Next page">Next &rarr;</button>';
		tmpHTML += '<span class="retold-remote-pdf-separator"></span>';
		tmpHTML += '<button class="retold-remote-pdf-btn" onclick="' + tmpViewRef + '.pdfSaveSelection()" title="Save selected text">&#128190; Save Selection</button>';
		tmpHTML += '<button class="retold-remote-pdf-btn" id="RetoldRemote-PdfRegionBtn" onclick="' + tmpViewRef + '.pdfToggleRegionSelect()" title="Select a visual region">&#9986; Select Region</button>';
		tmpHTML += '<span class="retold-remote-pdf-separator"></span>';
		tmpHTML += '<button class="retold-remote-pdf-btn" onclick="' + tmpViewRef + '.pdfZoomIn()" title="Zoom in (+)">+ Zoom In</button>';
		tmpHTML += '<span class="retold-remote-pdf-zoom-label" id="RetoldRemote-PdfZoomLabel">150%</span>';
		tmpHTML += '<button class="retold-remote-pdf-btn" onclick="' + tmpViewRef + '.pdfZoomOut()" title="Zoom out (-)">- Zoom Out</button>';
		tmpHTML += '<button class="retold-remote-pdf-btn" onclick="' + tmpViewRef + '.pdfZoomFit()" title="Fit to width">Fit</button>';
		tmpHTML += '</div>';

		// Content area
		tmpHTML += '<div class="retold-remote-pdf-content" id="RetoldRemote-PdfContent">';
		tmpHTML += '<div class="retold-remote-pdf-wrap" id="RetoldRemote-PdfWrap">';
		tmpHTML += '<canvas id="RetoldRemote-PdfCanvas"></canvas>';
		tmpHTML += '<div id="RetoldRemote-PdfTextLayer" class="retold-remote-pdf-text-layer"></div>';
		tmpHTML += '<div id="RetoldRemote-PdfSelectionOverlay" class="retold-remote-pdf-selection-overlay" style="display:none;"></div>';
		tmpHTML += '<div id="RetoldRemote-PdfRegionOverlays" class="retold-remote-pdf-region-overlays"></div>';
		tmpHTML += '</div>';
		tmpHTML += '<div class="retold-remote-pdf-loading" id="RetoldRemote-PdfLoading">Loading PDF...</div>';
		tmpHTML += '</div>';

		// Inline label input (hidden until needed)
		tmpHTML += '<div class="retold-remote-pdf-label-bar" id="RetoldRemote-PdfLabelInput" style="display:none;">';
		tmpHTML += '<input type="text" id="RetoldRemote-PdfLabelField" class="retold-remote-pdf-label-field" placeholder="Label this selection\u2026" '
			+ 'onkeydown="if(event.key===\'Enter\'){' + tmpViewRef + '.pdfSaveLabel();event.preventDefault();event.stopPropagation();}'
			+ 'if(event.key===\'Escape\'){' + tmpViewRef + '.pdfCancelSelection();event.preventDefault();event.stopPropagation();}">';
		tmpHTML += '<button class="retold-remote-pdf-btn" onclick="' + tmpViewRef + '.pdfSaveLabel()">Save</button>';
		tmpHTML += '<button class="retold-remote-pdf-btn" onclick="' + tmpViewRef + '.pdfCancelSelection()">Cancel</button>';
		tmpHTML += '</div>';

		tmpHTML += '</div>';

		// Inline styles for the PDF viewer
		tmpHTML += '<style>';
		tmpHTML += '.retold-remote-pdf-viewer { display: flex; flex-direction: column; height: 100%; overflow: hidden; }';
		tmpHTML += '.retold-remote-pdf-controls { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--retold-bg-secondary, #252526); border-bottom: 1px solid var(--retold-border, #3e4451); flex-shrink: 0; flex-wrap: wrap; }';
		tmpHTML += '.retold-remote-pdf-btn { background: var(--retold-bg-tertiary, #2d2d2d); color: var(--retold-text-primary, #abb2bf); border: 1px solid var(--retold-border, #3e4451); border-radius: 4px; padding: 4px 10px; font-size: 0.78rem; cursor: pointer; white-space: nowrap; }';
		tmpHTML += '.retold-remote-pdf-btn:hover { background: var(--retold-bg-hover, #3e4451); }';
		tmpHTML += '.retold-remote-pdf-btn.active { background: var(--retold-accent, #569cd6); color: #fff; }';
		tmpHTML += '.retold-remote-pdf-page-info { font-size: 0.78rem; color: var(--retold-text-secondary, #8b949e); display: flex; align-items: center; gap: 4px; }';
		tmpHTML += '.retold-remote-pdf-page-input { width: 48px; background: var(--retold-bg-input, #1e1e1e); color: var(--retold-text-primary, #abb2bf); border: 1px solid var(--retold-border, #3e4451); border-radius: 4px; padding: 2px 6px; font-size: 0.78rem; text-align: center; }';
		tmpHTML += '.retold-remote-pdf-separator { width: 1px; height: 20px; background: var(--retold-border, #3e4451); margin: 0 4px; }';
		tmpHTML += '.retold-remote-pdf-zoom-label { font-size: 0.78rem; color: var(--retold-text-secondary, #8b949e); min-width: 40px; text-align: center; }';
		tmpHTML += '.retold-remote-pdf-content { flex: 1; overflow: auto; position: relative; background: var(--retold-bg-primary, #1e1e1e); }';
		tmpHTML += '.retold-remote-pdf-wrap { position: relative; display: inline-block; margin: 16px auto; }';
		tmpHTML += '.retold-remote-pdf-content { text-align: center; }';
		tmpHTML += '.retold-remote-pdf-text-layer { position: absolute; top: 0; left: 0; overflow: hidden; opacity: 0.25; line-height: 1.0; }';
		tmpHTML += '.retold-remote-pdf-text-layer > span { position: absolute; white-space: pre; color: transparent; }';
		tmpHTML += '.retold-remote-pdf-text-layer ::selection { background: rgba(86, 156, 214, 0.4); }';
		tmpHTML += '.retold-remote-pdf-selection-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: crosshair; z-index: 5; }';
		tmpHTML += '.retold-remote-pdf-region-overlays { position: absolute; top: 0; left: 0; pointer-events: none; }';
		tmpHTML += '.retold-remote-pdf-region-rect { position: absolute; border: 2px solid rgba(86, 156, 214, 0.8); background: rgba(86, 156, 214, 0.12); pointer-events: none; }';
		tmpHTML += '.retold-remote-pdf-region-label { position: absolute; bottom: -18px; left: 0; font-size: 0.65rem; color: var(--retold-accent, #569cd6); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; pointer-events: none; }';
		tmpHTML += '.retold-remote-pdf-active-rect { position: absolute; border: 2px dashed rgba(214, 156, 86, 0.9); background: rgba(214, 156, 86, 0.15); pointer-events: none; }';
		tmpHTML += '.retold-remote-pdf-loading { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 0.9rem; color: var(--retold-text-secondary, #8b949e); }';
		tmpHTML += '.retold-remote-pdf-label-bar { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--retold-bg-secondary, #252526); border-top: 1px solid var(--retold-border, #3e4451); flex-shrink: 0; }';
		tmpHTML += '.retold-remote-pdf-label-field { flex: 1; background: var(--retold-bg-input, #1e1e1e); color: var(--retold-text-primary, #abb2bf); border: 1px solid var(--retold-border, #3e4451); border-radius: 4px; padding: 4px 10px; font-size: 0.78rem; }';
		tmpHTML += '</style>';

		return tmpHTML;
	},

	/**
	 * Load the pdf.js library from CDN (if needed) and open a PDF document.
	 *
	 * @param {string} pContentURL - URL to fetch the PDF from
	 * @param {string} pFilePath   - Relative file path
	 */
	_loadPdfViewer: function _loadPdfViewer(pContentURL, pFilePath)
	{
		let tmpSelf = this;

		// Initialize instance state
		this._pdfDocument = null;
		this._pdfCurrentPage = 1;
		this._pdfPageCount = 0;
		this._pdfScale = 1.5;
		this._pdfSelectionMode = false;
		this._pdfSavedRegions = [];
		this._pdfPendingRegion = null;
		this._pdfPendingText = null;
		this._pdfLibLoaded = false;
		this._pdfFilePath = pFilePath;

		this._ensurePdfJsLoaded(function ()
		{
			tmpSelf._pdfLibLoaded = true;
			tmpSelf._openPdfDocument(pContentURL);
		});
	},

	/**
	 * Ensure pdf.js is loaded from CDN via dynamic import.
	 *
	 * @param {Function} fCallback - Called when pdf.js is ready
	 */
	_ensurePdfJsLoaded: function _ensurePdfJsLoaded(fCallback)
	{
		if (typeof window !== 'undefined' && window.pdfjsLib)
		{
			return fCallback();
		}

		let tmpSelf = this;
		let tmpLoadingEl = document.getElementById('RetoldRemote-PdfLoading');
		if (tmpLoadingEl)
		{
			tmpLoadingEl.textContent = 'Loading PDF renderer...';
		}

		import(_PDF_JS_CDN_URL)
			.then(function (pModule)
			{
				window.pdfjsLib = pModule;
				window.pdfjsLib.GlobalWorkerOptions.workerSrc = _PDF_JS_WORKER_CDN_URL;
				fCallback();
			})
			.catch(function (pError)
			{
				let tmpEl = document.getElementById('RetoldRemote-PdfLoading');
				if (tmpEl)
				{
					tmpEl.textContent = 'Failed to load PDF renderer: ' + pError.message;
				}
			});
	},

	/**
	 * Open a PDF document from a URL using pdf.js.
	 *
	 * @param {string} pContentURL - URL to fetch the PDF from
	 */
	_openPdfDocument: function _openPdfDocument(pContentURL)
	{
		let tmpSelf = this;
		let tmpLoadingEl = document.getElementById('RetoldRemote-PdfLoading');
		if (tmpLoadingEl)
		{
			tmpLoadingEl.textContent = 'Opening PDF...';
		}

		let tmpLoadingTask = window.pdfjsLib.getDocument(pContentURL);
		tmpLoadingTask.promise
			.then(function (pDocument)
			{
				tmpSelf._pdfDocument = pDocument;
				tmpSelf._pdfPageCount = pDocument.numPages;
				tmpSelf._pdfCurrentPage = 1;

				// Update the page count display
				let tmpCountEl = document.getElementById('RetoldRemote-PdfPageCount');
				if (tmpCountEl)
				{
					tmpCountEl.textContent = pDocument.numPages;
				}

				let tmpPageInput = document.getElementById('RetoldRemote-PdfPageInput');
				if (tmpPageInput)
				{
					tmpPageInput.max = pDocument.numPages;
				}

				// Hide loading indicator
				if (tmpLoadingEl)
				{
					tmpLoadingEl.style.display = 'none';
				}

				// Render the first page
				tmpSelf._renderPdfPage(1);

				// Load saved regions
				tmpSelf._pdfLoadSavedRegions(tmpSelf._pdfFilePath);
			})
			.catch(function (pError)
			{
				if (tmpLoadingEl)
				{
					tmpLoadingEl.textContent = 'Failed to open PDF: ' + pError.message;
				}
			});
	},

	/**
	 * Render a specific page of the PDF onto the canvas.
	 *
	 * @param {number} pPageNumber - 1-based page number
	 */
	_renderPdfPage: function _renderPdfPage(pPageNumber)
	{
		if (!this._pdfDocument)
		{
			return;
		}

		if (pPageNumber < 1 || pPageNumber > this._pdfPageCount)
		{
			return;
		}

		let tmpSelf = this;
		this._pdfCurrentPage = pPageNumber;

		this._pdfDocument.getPage(pPageNumber)
			.then(function (pPage)
			{
				let tmpViewport = pPage.getViewport({ scale: tmpSelf._pdfScale });

				let tmpCanvas = document.getElementById('RetoldRemote-PdfCanvas');
				if (!tmpCanvas)
				{
					return;
				}
				let tmpContext = tmpCanvas.getContext('2d');

				// Set canvas dimensions to match the viewport
				tmpCanvas.width = tmpViewport.width;
				tmpCanvas.height = tmpViewport.height;

				// Set the wrap container dimensions
				let tmpWrap = document.getElementById('RetoldRemote-PdfWrap');
				if (tmpWrap)
				{
					tmpWrap.style.width = tmpViewport.width + 'px';
					tmpWrap.style.height = tmpViewport.height + 'px';
				}

				// Render the page onto the canvas
				let tmpRenderContext =
				{
					canvasContext: tmpContext,
					viewport: tmpViewport
				};

				pPage.render(tmpRenderContext).promise
					.then(function ()
					{
						// After canvas renders, build the text layer
						tmpSelf._renderPdfTextLayer(pPage, tmpViewport);

						// Render saved region overlays for this page
						tmpSelf._pdfRenderRegionOverlays();
					});

				// Update the page number input
				let tmpPageInput = document.getElementById('RetoldRemote-PdfPageInput');
				if (tmpPageInput)
				{
					tmpPageInput.value = pPageNumber;
				}

				// Update the zoom label
				tmpSelf._pdfUpdateZoomLabel();
			})
			.catch(function (pError)
			{
				let tmpLoadingEl = document.getElementById('RetoldRemote-PdfLoading');
				if (tmpLoadingEl)
				{
					tmpLoadingEl.style.display = '';
					tmpLoadingEl.textContent = 'Failed to render page: ' + pError.message;
				}
			});
	},

	/**
	 * Render the text layer on top of the canvas so text can be selected.
	 *
	 * @param {Object} pPage     - pdf.js page object
	 * @param {Object} pViewport - pdf.js viewport for the current scale
	 */
	_renderPdfTextLayer: function _renderPdfTextLayer(pPage, pViewport)
	{
		let tmpTextLayerEl = document.getElementById('RetoldRemote-PdfTextLayer');
		if (!tmpTextLayerEl)
		{
			return;
		}

		// Clear previous text layer content
		tmpTextLayerEl.innerHTML = '';

		// Match text layer dimensions to the canvas
		tmpTextLayerEl.style.width = pViewport.width + 'px';
		tmpTextLayerEl.style.height = pViewport.height + 'px';

		pPage.getTextContent()
			.then(function (pTextContent)
			{
				// Use pdf.js built-in renderTextLayer if available
				if (window.pdfjsLib && window.pdfjsLib.renderTextLayer)
				{
					let tmpTask = window.pdfjsLib.renderTextLayer(
					{
						textContentSource: pTextContent,
						container: tmpTextLayerEl,
						viewport: pViewport
					});
					tmpTask.promise.catch(function ()
					{
						// Silently ignore text layer errors
					});
				}
				else
				{
					// Manual fallback: position spans from the text content items
					let tmpItems = pTextContent.items;
					for (let i = 0; i < tmpItems.length; i++)
					{
						let tmpItem = tmpItems[i];
						if (!tmpItem.str)
						{
							continue;
						}

						let tmpSpan = document.createElement('span');
						tmpSpan.textContent = tmpItem.str;

						// Position from the transform matrix [scaleX, skewX, skewY, scaleY, translateX, translateY]
						let tmpTx = tmpItem.transform;
						let tmpFontSize = Math.sqrt(tmpTx[2] * tmpTx[2] + tmpTx[3] * tmpTx[3]);
						let tmpLeft = tmpTx[4] * (pViewport.width / (pViewport.viewBox[2] - pViewport.viewBox[0]));
						// PDF coordinates have origin at bottom-left; canvas at top-left
						let tmpTop = pViewport.height - (tmpTx[5] * (pViewport.height / (pViewport.viewBox[3] - pViewport.viewBox[1])));

						tmpSpan.style.left = tmpLeft + 'px';
						tmpSpan.style.top = (tmpTop - tmpFontSize) + 'px';
						tmpSpan.style.fontSize = tmpFontSize + 'px';
						tmpSpan.style.fontFamily = tmpItem.fontName || 'sans-serif';

						tmpTextLayerEl.appendChild(tmpSpan);
					}
				}
			});
	},

	/**
	 * Update the zoom percentage label.
	 */
	_pdfUpdateZoomLabel: function _pdfUpdateZoomLabel()
	{
		let tmpLabel = document.getElementById('RetoldRemote-PdfZoomLabel');
		if (tmpLabel)
		{
			tmpLabel.textContent = Math.round(this._pdfScale * 100) + '%';
		}
	},

	// -----------------------------------------------------------------
	// Page navigation
	// -----------------------------------------------------------------

	/**
	 * Go to the next page.
	 */
	pdfNextPage: function pdfNextPage()
	{
		if (this._pdfCurrentPage < this._pdfPageCount)
		{
			this._renderPdfPage(this._pdfCurrentPage + 1);
		}
	},

	/**
	 * Go to the previous page.
	 */
	pdfPrevPage: function pdfPrevPage()
	{
		if (this._pdfCurrentPage > 1)
		{
			this._renderPdfPage(this._pdfCurrentPage - 1);
		}
	},

	/**
	 * Jump to a specific page number.
	 *
	 * @param {number} pPageNumber - 1-based page number
	 */
	pdfGoToPage: function pdfGoToPage(pPageNumber)
	{
		if (isNaN(pPageNumber) || pPageNumber < 1)
		{
			pPageNumber = 1;
		}
		if (pPageNumber > this._pdfPageCount)
		{
			pPageNumber = this._pdfPageCount;
		}
		this._renderPdfPage(pPageNumber);
	},

	// -----------------------------------------------------------------
	// Zoom
	// -----------------------------------------------------------------

	/**
	 * Zoom in by 25%.
	 */
	pdfZoomIn: function pdfZoomIn()
	{
		this._pdfScale = Math.min(this._pdfScale + 0.25, 5.0);
		this._renderPdfPage(this._pdfCurrentPage);
	},

	/**
	 * Zoom out by 25%.
	 */
	pdfZoomOut: function pdfZoomOut()
	{
		this._pdfScale = Math.max(this._pdfScale - 0.25, 0.25);
		this._renderPdfPage(this._pdfCurrentPage);
	},

	/**
	 * Fit the PDF page width to the content area.
	 */
	pdfZoomFit: function pdfZoomFit()
	{
		if (!this._pdfDocument)
		{
			return;
		}

		let tmpSelf = this;
		this._pdfDocument.getPage(this._pdfCurrentPage)
			.then(function (pPage)
			{
				let tmpContentEl = document.getElementById('RetoldRemote-PdfContent');
				if (!tmpContentEl)
				{
					return;
				}

				// Get the page dimensions at scale 1.0
				let tmpBaseViewport = pPage.getViewport({ scale: 1.0 });
				let tmpAvailableWidth = tmpContentEl.clientWidth - 32; // Subtract padding

				let tmpFitScale = tmpAvailableWidth / tmpBaseViewport.width;
				tmpSelf._pdfScale = Math.max(0.25, Math.min(tmpFitScale, 5.0));
				tmpSelf._renderPdfPage(tmpSelf._pdfCurrentPage);
			});
	},

	// -----------------------------------------------------------------
	// Text selection saving
	// -----------------------------------------------------------------

	/**
	 * Save the currently selected text from the text layer.
	 */
	pdfSaveSelection: function pdfSaveSelection()
	{
		let tmpSelectedText = '';
		if (typeof window !== 'undefined' && window.getSelection)
		{
			tmpSelectedText = window.getSelection().toString().trim();
		}

		if (!tmpSelectedText)
		{
			let tmpToast = this.pict.providers['RetoldRemote-ToastNotification'];
			if (tmpToast)
			{
				tmpToast.showToast('Select some text in the PDF first.');
			}
			return;
		}

		this._pdfPendingText = tmpSelectedText;
		this._pdfPendingRegion = null;

		// Show the label input bar
		let tmpLabelBar = document.getElementById('RetoldRemote-PdfLabelInput');
		if (tmpLabelBar)
		{
			tmpLabelBar.style.display = '';
		}

		let tmpField = document.getElementById('RetoldRemote-PdfLabelField');
		if (tmpField)
		{
			tmpField.value = '';
			tmpField.placeholder = 'Label this text selection\u2026';
			tmpField.focus();
		}
	},

	// -----------------------------------------------------------------
	// Visual region selection
	// -----------------------------------------------------------------

	/**
	 * Toggle the visual region selection mode.
	 */
	pdfToggleRegionSelect: function pdfToggleRegionSelect()
	{
		this._pdfSelectionMode = !this._pdfSelectionMode;

		let tmpOverlay = document.getElementById('RetoldRemote-PdfSelectionOverlay');
		let tmpBtn = document.getElementById('RetoldRemote-PdfRegionBtn');

		if (this._pdfSelectionMode)
		{
			if (tmpOverlay)
			{
				tmpOverlay.style.display = '';
			}
			if (tmpBtn)
			{
				tmpBtn.classList.add('active');
			}

			this._pdfSetupRegionDrag();
		}
		else
		{
			if (tmpOverlay)
			{
				tmpOverlay.style.display = 'none';
				tmpOverlay.innerHTML = '';
			}
			if (tmpBtn)
			{
				tmpBtn.classList.remove('active');
			}

			this._pdfCleanupRegionDrag();
		}
	},

	/**
	 * Set up mouse event handlers for dragging a selection rectangle.
	 */
	_pdfSetupRegionDrag: function _pdfSetupRegionDrag()
	{
		let tmpSelf = this;
		let tmpOverlay = document.getElementById('RetoldRemote-PdfSelectionOverlay');
		if (!tmpOverlay)
		{
			return;
		}

		let tmpDragging = false;
		let tmpStartX = 0;
		let tmpStartY = 0;
		let tmpRectEl = null;

		this._pdfRegionMouseDown = function (pEvent)
		{
			pEvent.preventDefault();
			tmpDragging = true;

			let tmpRect = tmpOverlay.getBoundingClientRect();
			tmpStartX = pEvent.clientX - tmpRect.left;
			tmpStartY = pEvent.clientY - tmpRect.top;

			// Create the selection rectangle element
			tmpRectEl = document.createElement('div');
			tmpRectEl.className = 'retold-remote-pdf-active-rect';
			tmpRectEl.style.left = tmpStartX + 'px';
			tmpRectEl.style.top = tmpStartY + 'px';
			tmpRectEl.style.width = '0px';
			tmpRectEl.style.height = '0px';
			tmpOverlay.appendChild(tmpRectEl);
		};

		this._pdfRegionMouseMove = function (pEvent)
		{
			if (!tmpDragging || !tmpRectEl)
			{
				return;
			}

			let tmpRect = tmpOverlay.getBoundingClientRect();
			let tmpCurrentX = pEvent.clientX - tmpRect.left;
			let tmpCurrentY = pEvent.clientY - tmpRect.top;

			let tmpLeft = Math.min(tmpStartX, tmpCurrentX);
			let tmpTop = Math.min(tmpStartY, tmpCurrentY);
			let tmpWidth = Math.abs(tmpCurrentX - tmpStartX);
			let tmpHeight = Math.abs(tmpCurrentY - tmpStartY);

			tmpRectEl.style.left = tmpLeft + 'px';
			tmpRectEl.style.top = tmpTop + 'px';
			tmpRectEl.style.width = tmpWidth + 'px';
			tmpRectEl.style.height = tmpHeight + 'px';
		};

		this._pdfRegionMouseUp = function (pEvent)
		{
			if (!tmpDragging)
			{
				return;
			}
			tmpDragging = false;

			let tmpRect = tmpOverlay.getBoundingClientRect();
			let tmpEndX = pEvent.clientX - tmpRect.left;
			let tmpEndY = pEvent.clientY - tmpRect.top;

			let tmpLeft = Math.min(tmpStartX, tmpEndX);
			let tmpTop = Math.min(tmpStartY, tmpEndY);
			let tmpWidth = Math.abs(tmpEndX - tmpStartX);
			let tmpHeight = Math.abs(tmpEndY - tmpStartY);

			// Ignore tiny drags (likely accidental clicks)
			if (tmpWidth < 5 || tmpHeight < 5)
			{
				if (tmpRectEl && tmpRectEl.parentElement)
				{
					tmpRectEl.parentElement.removeChild(tmpRectEl);
				}
				tmpRectEl = null;
				return;
			}

			// Convert screen pixels to PDF coordinate units
			let tmpCanvas = document.getElementById('RetoldRemote-PdfCanvas');
			if (!tmpCanvas)
			{
				return;
			}

			let tmpCanvasWidth = tmpCanvas.width;
			let tmpCanvasHeight = tmpCanvas.height;
			let tmpDisplayWidth = tmpCanvas.offsetWidth;
			let tmpDisplayHeight = tmpCanvas.offsetHeight;

			// Scale from display pixels to canvas pixels, then to PDF units via scale
			let tmpScaleX = tmpCanvasWidth / tmpDisplayWidth;
			let tmpScaleY = tmpCanvasHeight / tmpDisplayHeight;

			let tmpPdfX = (tmpLeft * tmpScaleX) / tmpSelf._pdfScale;
			let tmpPdfY = (tmpTop * tmpScaleY) / tmpSelf._pdfScale;
			let tmpPdfWidth = (tmpWidth * tmpScaleX) / tmpSelf._pdfScale;
			let tmpPdfHeight = (tmpHeight * tmpScaleY) / tmpSelf._pdfScale;

			tmpSelf._pdfPendingRegion =
			{
				X: Math.round(tmpPdfX * 100) / 100,
				Y: Math.round(tmpPdfY * 100) / 100,
				Width: Math.round(tmpPdfWidth * 100) / 100,
				Height: Math.round(tmpPdfHeight * 100) / 100
			};
			tmpSelf._pdfPendingText = null;

			// Show label input
			let tmpLabelBar = document.getElementById('RetoldRemote-PdfLabelInput');
			if (tmpLabelBar)
			{
				tmpLabelBar.style.display = '';
			}
			let tmpField = document.getElementById('RetoldRemote-PdfLabelField');
			if (tmpField)
			{
				tmpField.value = '';
				tmpField.placeholder = 'Label this region\u2026';
				tmpField.focus();
			}
		};

		tmpOverlay.addEventListener('mousedown', this._pdfRegionMouseDown);
		tmpOverlay.addEventListener('mousemove', this._pdfRegionMouseMove);
		tmpOverlay.addEventListener('mouseup', this._pdfRegionMouseUp);
	},

	/**
	 * Remove mouse event handlers for region dragging.
	 */
	_pdfCleanupRegionDrag: function _pdfCleanupRegionDrag()
	{
		let tmpOverlay = document.getElementById('RetoldRemote-PdfSelectionOverlay');
		if (tmpOverlay)
		{
			if (this._pdfRegionMouseDown)
			{
				tmpOverlay.removeEventListener('mousedown', this._pdfRegionMouseDown);
			}
			if (this._pdfRegionMouseMove)
			{
				tmpOverlay.removeEventListener('mousemove', this._pdfRegionMouseMove);
			}
			if (this._pdfRegionMouseUp)
			{
				tmpOverlay.removeEventListener('mouseup', this._pdfRegionMouseUp);
			}
		}

		this._pdfRegionMouseDown = null;
		this._pdfRegionMouseMove = null;
		this._pdfRegionMouseUp = null;
	},

	// -----------------------------------------------------------------
	// Label save / cancel
	// -----------------------------------------------------------------

	/**
	 * Save the labeled selection (text or visual region) to the server.
	 */
	pdfSaveLabel: function pdfSaveLabel()
	{
		let tmpField = document.getElementById('RetoldRemote-PdfLabelField');
		let tmpLabel = tmpField ? tmpField.value.trim() : '';

		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(this._pdfFilePath) : encodeURIComponent(this._pdfFilePath);

		let tmpBody =
		{
			Path: this._pdfFilePath,
			Region:
			{
				Label: tmpLabel,
				PageNumber: this._pdfCurrentPage
			}
		};

		if (this._pdfPendingText)
		{
			tmpBody.Region.Type = 'text-selection';
			tmpBody.Region.SelectedText = this._pdfPendingText;
		}
		else if (this._pdfPendingRegion)
		{
			tmpBody.Region.Type = 'visual-region';
			tmpBody.Region.X = this._pdfPendingRegion.X;
			tmpBody.Region.Y = this._pdfPendingRegion.Y;
			tmpBody.Region.Width = this._pdfPendingRegion.Width;
			tmpBody.Region.Height = this._pdfPendingRegion.Height;
		}
		else
		{
			// Nothing pending
			this.pdfCancelSelection();
			return;
		}

		fetch('/api/media/subimage-regions',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(tmpBody)
		})
			.then(function (pResponse) { return pResponse.json(); })
			.then(function (pResult)
			{
				if (pResult && pResult.Success)
				{
					tmpSelf._pdfSavedRegions = pResult.Regions || [];
					tmpSelf._pdfRenderRegionOverlays();

					let tmpToast = tmpSelf.pict.providers['RetoldRemote-ToastNotification'];
					if (tmpToast)
					{
						tmpToast.showToast('Selection saved' + (tmpLabel ? ': ' + tmpLabel : ''));
					}

					// Update the subimages panel if visible
					let tmpSubPanel = tmpSelf.pict.views['RetoldRemote-SubimagesPanel'];
					if (tmpSubPanel)
					{
						tmpSubPanel.render();
					}
				}
			})
			.catch(function (pErr)
			{
				let tmpToast = tmpSelf.pict.providers['RetoldRemote-ToastNotification'];
				if (tmpToast)
				{
					tmpToast.showToast('Failed to save selection: ' + pErr.message);
				}
			});

		// Clean up
		this._pdfPendingRegion = null;
		this._pdfPendingText = null;

		// Hide the label bar
		let tmpLabelBar = document.getElementById('RetoldRemote-PdfLabelInput');
		if (tmpLabelBar)
		{
			tmpLabelBar.style.display = 'none';
		}

		// Remove the active drag rectangle if any
		let tmpOverlay = document.getElementById('RetoldRemote-PdfSelectionOverlay');
		if (tmpOverlay)
		{
			tmpOverlay.innerHTML = '';
		}
	},

	/**
	 * Cancel the current selection without saving.
	 */
	pdfCancelSelection: function pdfCancelSelection()
	{
		this._pdfPendingRegion = null;
		this._pdfPendingText = null;

		// Hide the label bar
		let tmpLabelBar = document.getElementById('RetoldRemote-PdfLabelInput');
		if (tmpLabelBar)
		{
			tmpLabelBar.style.display = 'none';
		}

		// Remove any active drag rectangle
		let tmpOverlay = document.getElementById('RetoldRemote-PdfSelectionOverlay');
		if (tmpOverlay)
		{
			tmpOverlay.innerHTML = '';
		}
	},

	// -----------------------------------------------------------------
	// Saved region management
	// -----------------------------------------------------------------

	/**
	 * Load saved subimage regions from the server for this PDF.
	 *
	 * @param {string} pFilePath - Relative file path
	 */
	_pdfLoadSavedRegions: function _pdfLoadSavedRegions(pFilePath)
	{
		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

		fetch('/api/media/subimage-regions?path=' + tmpPathParam)
			.then(function (pResponse) { return pResponse.json(); })
			.then(function (pResult)
			{
				if (pResult && pResult.Success && Array.isArray(pResult.Regions))
				{
					tmpSelf._pdfSavedRegions = pResult.Regions;
					tmpSelf._pdfRenderRegionOverlays();
				}
			})
			.catch(function ()
			{
				// Silently ignore — regions are optional
			});
	},

	/**
	 * Render saved region overlays for the current page as colored rectangles
	 * positioned over the canvas.
	 */
	_pdfRenderRegionOverlays: function _pdfRenderRegionOverlays()
	{
		let tmpOverlaysContainer = document.getElementById('RetoldRemote-PdfRegionOverlays');
		if (!tmpOverlaysContainer)
		{
			return;
		}

		let tmpCanvas = document.getElementById('RetoldRemote-PdfCanvas');
		if (!tmpCanvas)
		{
			return;
		}

		// Match container dimensions to the canvas
		tmpOverlaysContainer.style.width = tmpCanvas.offsetWidth + 'px';
		tmpOverlaysContainer.style.height = tmpCanvas.offsetHeight + 'px';

		// Clear existing overlays
		tmpOverlaysContainer.innerHTML = '';

		let tmpCurrentPage = this._pdfCurrentPage;
		let tmpScale = this._pdfScale;
		let tmpDisplayWidth = tmpCanvas.offsetWidth;
		let tmpCanvasWidth = tmpCanvas.width;
		let tmpDisplayScale = tmpDisplayWidth / tmpCanvasWidth;

		for (let i = 0; i < this._pdfSavedRegions.length; i++)
		{
			let tmpRegion = this._pdfSavedRegions[i];

			// Only show regions for the current page (or regions without a page number)
			if (tmpRegion.PageNumber && tmpRegion.PageNumber !== tmpCurrentPage)
			{
				continue;
			}

			// Only render visual-region types as overlays
			if (tmpRegion.Type !== 'visual-region')
			{
				continue;
			}

			// Convert PDF coordinates to display pixels
			let tmpLeft = tmpRegion.X * tmpScale * tmpDisplayScale;
			let tmpTop = tmpRegion.Y * tmpScale * tmpDisplayScale;
			let tmpWidth = tmpRegion.Width * tmpScale * tmpDisplayScale;
			let tmpHeight = tmpRegion.Height * tmpScale * tmpDisplayScale;

			let tmpRectEl = document.createElement('div');
			tmpRectEl.className = 'retold-remote-pdf-region-rect';
			tmpRectEl.style.left = tmpLeft + 'px';
			tmpRectEl.style.top = tmpTop + 'px';
			tmpRectEl.style.width = tmpWidth + 'px';
			tmpRectEl.style.height = tmpHeight + 'px';

			if (tmpRegion.Label)
			{
				let tmpLabelEl = document.createElement('div');
				tmpLabelEl.className = 'retold-remote-pdf-region-label';
				tmpLabelEl.textContent = tmpRegion.Label;
				tmpRectEl.appendChild(tmpLabelEl);
			}

			tmpOverlaysContainer.appendChild(tmpRectEl);
		}
	}
};
