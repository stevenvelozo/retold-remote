const libPictView = require('pict-view');

const _OSD_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.1/openseadragon.min.js';

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-ImageExplorer",
	DefaultRenderable: "RetoldRemote-ImageExplorer",
	DefaultDestinationAddress: "#RetoldRemote-Viewer-Container",
	AutoRender: false,

	CSS: ``
};

class RetoldRemoteImageExplorerView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._currentPath = '';
		this._osdViewer = null;
		this._dziData = null;
		this._osdLoaded = false;
		this._loading = false;

		// Selection mode state
		this._selectionMode = false;
		this._selectionTracker = null;
		this._selectionOverlay = null;
		this._selectionRegion = null;        // { X, Y, Width, Height } in image coords
		this._selectionStart = null;         // viewport point where drag began
		this._selectionStartScreenPos = null; // screen-pixel position of press (for click-vs-drag filter)
		this._savedRegions = [];             // loaded from server

		// Viewer-ready flag — set to true when the OSD viewer's 'open' event
		// fires and the viewport coordinate math is safe to run. This MUST
		// reset on every viewer destroy (including the DZI preview→tile swap)
		// so the saved-region overlays get re-rendered against the new viewer.
		this._viewerReady = false;

		// Edit mode state (Part B)
		this._editingRegionID = null;
		this._editDragMode = null;   // 'tl'|'tr'|'bl'|'br'|'t'|'r'|'b'|'l'|'body'|null
		this._editDragStart = null;  // viewport point where edit drag began
		this._editOriginalRect = null; // OSD Rect captured at press time for delta math
		this._editTracker = null;
	}

	/**
	 * Show the image explorer for a given image file.
	 *
	 * @param {string} pFilePath - Relative file path
	 */
	showExplorer(pFilePath)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ActiveMode = 'image-explorer';
		tmpRemote.CurrentViewerFile = pFilePath;
		tmpRemote.CurrentViewerMediaType = 'image';
		this._currentPath = pFilePath;
		this._dziData = null;
		this._loading = false;

		// Notify the layout so any active sidebar tab (Info, Regions, etc.)
		// refreshes to this file instead of showing stale content from the
		// previous file. See PictView-Remote-Layout.js#notifyCurrentFileChanged.
		let tmpLayout = this.pict.views['ContentEditor-Layout'];
		if (tmpLayout && typeof tmpLayout.notifyCurrentFileChanged === 'function')
		{
			tmpLayout.notifyCurrentFileChanged(pFilePath);
		}

		// Reset selection state
		this._selectionMode = false;
		this._selectionTracker = null;
		this._selectionOverlay = null;
		this._selectionRegion = null;
		this._selectionStart = null;
		this._selectionStartScreenPos = null;
		this._savedRegions = [];
		this._viewerReady = false;

		// Reset any in-progress edit mode (Part B)
		this._editingRegionID = null;
		this._editDragMode = null;
		this._editDragStart = null;
		this._editOriginalRect = null;
		if (this._editTracker)
		{
			try { this._editTracker.destroy(); } catch (pErr) { /* ignore */ }
			this._editTracker = null;
		}

		// Clean up existing viewer
		if (this._osdViewer)
		{
			try
			{
				this._osdViewer.destroy();
			}
			catch (pErr)
			{
				// ignore
			}
			this._osdViewer = null;
		}

		// Update URL hash.
		// When the current hash is #/view/ for the same file (i.e. the media
		// viewer auto-launched us), REPLACE the history entry so the back
		// button goes to the gallery instead of bouncing back through #/view/.
		let tmpFragProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpFragId = tmpFragProvider ? tmpFragProvider.getFragmentIdentifier(pFilePath) : pFilePath;
		let tmpNewHash = '#/explore-image/' + tmpFragId;
		let tmpCurrentHash = window.location.hash || '';
		if (tmpCurrentHash.indexOf('#/view/') === 0)
		{
			history.replaceState(null, '', tmpNewHash);
		}
		else
		{
			window.location.hash = tmpNewHash;
		}

		// Show viewer, hide gallery
		let tmpGalleryContainer = document.getElementById('RetoldRemote-Gallery-Container');
		let tmpViewerContainer = document.getElementById('RetoldRemote-Viewer-Container');

		if (tmpGalleryContainer) tmpGalleryContainer.style.display = 'none';
		if (tmpViewerContainer) tmpViewerContainer.style.display = 'block';

		let tmpFileName = pFilePath.replace(/^.*\//, '');
		let tmpFmt = this.pict.providers['RetoldRemote-FormattingUtilities'];

		// Build the explorer UI
		let tmpHTML = '<div class="retold-remote-iex">';

		// Header
		tmpHTML += '<div class="retold-remote-iex-header">';
		tmpHTML += '<button class="retold-remote-iex-nav-btn" onclick="pict.views[\'RetoldRemote-ImageExplorer\'].goBack()" title="Back (Esc)">&larr; Back</button>';
		tmpHTML += '<div class="retold-remote-iex-title">Image Explorer &mdash; ' + tmpFmt.escapeHTML(tmpFileName) + '</div>';
		tmpHTML += '<div class="retold-remote-iex-actions">';
		tmpHTML += '<button class="retold-remote-iex-action-btn" id="RetoldRemote-IEX-SelectBtn" onclick="pict.views[\'RetoldRemote-ImageExplorer\'].toggleSelectionMode()" title="Select a region (s)">&#9986; Select</button>';
		tmpHTML += '<button class="retold-remote-iex-action-btn" onclick="pict.views[\'RetoldRemote-ImageExplorer\'].viewInBrowser()" title="View in standard viewer">&#128444; View</button>';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		// Info bar
		tmpHTML += '<div class="retold-remote-iex-info" id="RetoldRemote-IEX-Info" style="display:none;"></div>';

		// Body
		tmpHTML += '<div class="retold-remote-iex-body" id="RetoldRemote-IEX-Body">';
		tmpHTML += '<div class="retold-remote-iex-loading" id="RetoldRemote-IEX-Loading">';
		tmpHTML += '<div>Loading image\u2026</div>';
		tmpHTML += '</div>';
		tmpHTML += '<div id="RetoldRemote-IEX-Viewer" style="display:none;"></div>';
		tmpHTML += '</div>';

		// Controls bar
		tmpHTML += '<div class="retold-remote-iex-controls" id="RetoldRemote-IEX-Controls" style="display:none;">';
		tmpHTML += '<button onclick="pict.views[\'RetoldRemote-ImageExplorer\'].zoomIn()" title="Zoom In (+)">+ Zoom In</button>';
		tmpHTML += '<span class="retold-remote-iex-zoom-label" id="RetoldRemote-IEX-ZoomLabel">100%</span>';
		tmpHTML += '<button onclick="pict.views[\'RetoldRemote-ImageExplorer\'].zoomOut()" title="Zoom Out (-)">- Zoom Out</button>';
		tmpHTML += '<button onclick="pict.views[\'RetoldRemote-ImageExplorer\'].zoomHome()" title="Fit to view (0)">Fit</button>';
		tmpHTML += '<span style="flex:1;"></span>';
		tmpHTML += '<span id="RetoldRemote-IEX-LabelInput" style="display:none;">';
		tmpHTML += '<input type="text" id="RetoldRemote-IEX-LabelField" placeholder="Label this region\u2026" style="background:var(--retold-bg-input,#1e1e1e);color:var(--retold-text,#abb2bf);border:1px solid var(--retold-border,#3e4451);border-radius:4px;padding:2px 8px;font-size:0.78rem;width:180px;margin-right:4px;" onkeydown="if(event.key===\'Enter\'){pict.views[\'RetoldRemote-ImageExplorer\'].saveSelectionLabel();event.preventDefault();event.stopPropagation();}if(event.key===\'Escape\'){pict.views[\'RetoldRemote-ImageExplorer\'].cancelSelection();event.preventDefault();event.stopPropagation();}">';
		tmpHTML += '<button onclick="pict.views[\'RetoldRemote-ImageExplorer\'].saveSelectionLabel()" style="font-size:0.75rem;padding:2px 8px;">Save</button>';
		tmpHTML += '<button onclick="pict.views[\'RetoldRemote-ImageExplorer\'].cancelSelection()" style="font-size:0.75rem;padding:2px 8px;margin-left:2px;">Cancel</button>';
		tmpHTML += '</span>';
		tmpHTML += '<span id="RetoldRemote-IEX-Coords" style="color:var(--retold-text-dim);font-size:0.72rem;"></span>';
		tmpHTML += '</div>';

		tmpHTML += '</div>';

		if (tmpViewerContainer)
		{
			tmpViewerContainer.innerHTML = tmpHTML;
		}

		// Update topbar
		let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBar)
		{
			tmpTopBar.updateInfo();
		}

		// Load OpenSeadragon, then decide whether to use simple image or DZI tiles
		let tmpSelfShow = this;
		this._ensureOSDLoaded(() =>
		{
			tmpSelfShow._probeAndShow(pFilePath);
			tmpSelfShow._loadSavedRegions(pFilePath);
		});
	}

	/**
	 * Ensure OpenSeadragon library is loaded (from CDN on first use).
	 *
	 * @param {Function} fCallback - Called when OSD is ready
	 */
	_ensureOSDLoaded(fCallback)
	{
		if (typeof OpenSeadragon !== 'undefined')
		{
			this._osdLoaded = true;
			return fCallback();
		}

		let tmpSelf = this;
		let tmpScript = document.createElement('script');
		tmpScript.src = _OSD_CDN_URL;
		tmpScript.onload = function ()
		{
			tmpSelf._osdLoaded = true;
			fCallback();
		};
		tmpScript.onerror = function ()
		{
			tmpSelf._showError('Failed to load OpenSeadragon library.');
		};
		document.head.appendChild(tmpScript);
	}

	/**
	 * Probe image dimensions then open with the appropriate tile source.
	 *
	 * Regular images (<=4096px longest side) are opened directly via
	 * OpenSeadragon's simple image source — no server-side tile generation.
	 * Large images (>4096px) use DZI tiles for efficient deep-zoom.
	 *
	 * @param {string} pFilePath - Relative file path
	 */
	_probeAndShow(pFilePath)
	{
		// Guard against duplicate requests (e.g. rapid re-renders)
		if (this._loading)
		{
			return;
		}
		this._loading = true;

		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

		// Probe dimensions via the image-preview endpoint
		fetch('/api/media/image-preview?path=' + tmpPathParam)
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				if (!pResult || !pResult.Success)
				{
					// sharp might not be available — fall back to simple image source
					// But raw files can't be displayed directly by the browser
					tmpSelf._loading = false;
					if (tmpSelf._isRawExtension(pFilePath))
					{
						tmpSelf._showRawUnsupported();
					}
					else
					{
						tmpSelf._showSimpleImage(pFilePath);
					}
					return;
				}

				let tmpLongest = Math.max(pResult.OrigWidth || 0, pResult.OrigHeight || 0);

				if (tmpLongest > 4096)
				{
					// Large image — show the preview immediately, then generate DZI tiles
					tmpSelf._generateAndShowTiles(pFilePath, tmpPathParam, pResult);
				}
				else
				{
					// Regular image — use simple image source (no tile generation)
					tmpSelf._loading = false;
					tmpSelf._dziData = { Width: pResult.OrigWidth, Height: pResult.OrigHeight };
					tmpSelf._showSimpleImageInfo(pResult.OrigWidth, pResult.OrigHeight);

					// Raw files need to use the preview JPEG — browsers can't display raw formats
					if (pResult.IsRawFormat && pResult.CacheKey)
					{
						let tmpPreviewURL = '/api/media/image-preview-file/' +
							encodeURIComponent(pResult.CacheKey) + '/' +
							encodeURIComponent(pResult.OutputFilename);
						tmpSelf._initSimpleViewer(null, tmpPreviewURL);
					}
					else
					{
						tmpSelf._initSimpleViewer(pFilePath);
					}
				}
			})
			.catch(() =>
			{
				// Probe failed — fall back to simple image source
				tmpSelf._loading = false;
				tmpSelf._showSimpleImage(pFilePath);
			});
	}

	/**
	 * Open a regular-sized image directly with OpenSeadragon's simple
	 * image source — no server-side tile generation needed.
	 *
	 * @param {string} pFilePath  - Relative file path
	 * @param {string} pPathParam - URL-encoded path parameter
	 */
	_showSimpleImage(pFilePath)
	{
		this._dziData = { Width: 0, Height: 0 };
		this._initSimpleViewer(pFilePath);
	}

	/**
	 * Check if a file path has a raw camera image extension.
	 *
	 * @param {string} pFilePath - File path to check
	 * @returns {boolean}
	 */
	_isRawExtension(pFilePath)
	{
		let tmpExt = (pFilePath || '').replace(/^.*\./, '').toLowerCase();
		// Formats requiring server-side conversion (raw camera + HEIC)
		let tmpRawExts = { 'nef': true, 'nrw': true, 'cr2': true, 'cr3': true, 'crw': true, 'arw': true, 'srf': true, 'sr2': true, 'raf': true, 'orf': true, 'rw2': true, 'rwl': true, 'pef': true, 'srw': true, 'x3f': true, '3fr': true, 'fff': true, 'iiq': true, 'dcr': true, 'kdc': true, 'mrw': true, 'erf': true, 'raw': true, 'dng': true, 'heic': true, 'heif': true };
		return !!tmpRawExts[tmpExt];
	}

	/**
	 * Show a message when a raw image cannot be displayed.
	 */
	_showRawUnsupported()
	{
		let tmpLoading = document.getElementById('RetoldRemote-IEX-Loading');
		if (tmpLoading)
		{
			tmpLoading.innerHTML = '<div style="padding: 2em; text-align: center; color: #999;">Raw image preview not available.<br>Install dcraw on the server for raw camera format support.</div>';
		}
	}

	/**
	 * Show the info bar for a simple-image viewer (without tile details).
	 *
	 * @param {number} pWidth  - Image width
	 * @param {number} pHeight - Image height
	 */
	_showSimpleImageInfo(pWidth, pHeight)
	{
		let tmpInfoBar = document.getElementById('RetoldRemote-IEX-Info');
		if (!tmpInfoBar)
		{
			return;
		}

		let tmpHTML = '';
		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Dimensions:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value">' + pWidth + ' \u00d7 ' + pHeight + ' px</span></span>';

		let tmpMegapixels = ((pWidth * pHeight) / 1000000).toFixed(1);
		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Size:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value">' + tmpMegapixels + ' MP</span></span>';

		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Mode:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value">Direct</span></span>';

		tmpInfoBar.innerHTML = tmpHTML;
		tmpInfoBar.style.display = '';
	}

	/**
	 * Initialize OpenSeadragon with a simple image tile source (no DZI).
	 *
	 * @param {string} pFilePath    - Relative file path (used to build content URL)
	 * @param {string} pExplicitURL - Optional explicit URL to use instead of content URL
	 *                                (used for raw camera formats that need a converted preview)
	 */
	_initSimpleViewer(pFilePath, pExplicitURL)
	{
		let tmpLoading = document.getElementById('RetoldRemote-IEX-Loading');
		let tmpViewerDiv = document.getElementById('RetoldRemote-IEX-Viewer');
		let tmpControls = document.getElementById('RetoldRemote-IEX-Controls');

		if (tmpLoading) tmpLoading.style.display = 'none';
		if (tmpViewerDiv) tmpViewerDiv.style.display = 'block';
		if (tmpControls) tmpControls.style.display = '';

		let tmpSelf = this;
		let tmpContentURL;
		if (pExplicitURL)
		{
			tmpContentURL = pExplicitURL;
		}
		else
		{
			let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
			tmpContentURL = tmpProvider ? tmpProvider.getContentURL(pFilePath) : ('/content/' + encodeURIComponent(pFilePath));
		}

		this._osdViewer = OpenSeadragon(
		{
			id: 'RetoldRemote-IEX-Viewer',
			tileSources:
			{
				type: 'image',
				url: tmpContentURL
			},
			prefixUrl: '',
			showNavigationControl: false,
			showNavigator: true,
			navigatorPosition: 'BOTTOM_RIGHT',
			navigatorSizeRatio: 0.15,
			animationTime: 0.3,
			blendTime: 0.1,
			minZoomLevel: 0.1,
			maxZoomLevel: 20,
			visibilityRatio: 0.5,
			constrainDuringPan: false,
			gestureSettingsMouse:
			{
				scrollToZoom: true,
				clickToZoom: true,
				dblClickToZoom: true,
				flickEnabled: false
			},
			gestureSettingsTouch:
			{
				pinchToZoom: true,
				flickEnabled: true,
				flickMinSpeed: 120,
				flickMomentum: 0.25
			}
		});

		this._osdViewer.addHandler('zoom', function ()
		{
			tmpSelf._updateZoomLabel();
		});

		this._osdViewer.addHandler('open', function ()
		{
			// Capture actual image dimensions from the loaded source
			let tmpTiledImage = tmpSelf._osdViewer.world.getItemAt(0);
			if (tmpTiledImage)
			{
				let tmpContentSize = tmpTiledImage.getContentSize();
				if (tmpContentSize)
				{
					tmpSelf._dziData = { Width: tmpContentSize.x, Height: tmpContentSize.y };
				}
			}
			tmpSelf._updateZoomLabel();

			// Viewer is ready — mark the flag and re-render any saved regions
			// that were loaded before the viewer was open. This is the single
			// source of truth for "overlays render when ready" (see Part A).
			tmpSelf._viewerReady = true;
			if (tmpSelf._savedRegions && tmpSelf._savedRegions.length > 0)
			{
				tmpSelf._renderSavedRegionOverlays();
			}
		});

		if (typeof OpenSeadragon.MouseTracker !== 'undefined')
		{
			new OpenSeadragon.MouseTracker(
			{
				element: tmpViewerDiv,
				moveHandler: function (pEvent)
				{
					tmpSelf._updateCoords(pEvent.position);
				}
			});
		}
	}

	/**
	 * Show the preview image immediately, then generate DZI tiles and swap.
	 *
	 * @param {string} pFilePath    - Relative file path
	 * @param {string} pPathParam   - URL-encoded path parameter
	 * @param {object} pProbeResult - Result from the image-preview probe
	 */
	_generateAndShowTiles(pFilePath, pPathParam, pProbeResult)
	{
		let tmpSelf = this;

		// 1. Show the preview image right away so the user sees something
		let tmpPreviewURL = null;
		if (pProbeResult && pProbeResult.CacheKey && pProbeResult.OutputFilename)
		{
			tmpPreviewURL = '/api/media/image-preview-file/' +
				encodeURIComponent(pProbeResult.CacheKey) + '/' +
				encodeURIComponent(pProbeResult.OutputFilename);
		}

		if (tmpPreviewURL)
		{
			// Show dimensions info immediately (from probe data)
			this._dziData = { Width: pProbeResult.OrigWidth, Height: pProbeResult.OrigHeight };
			this._showPreviewInfo(pProbeResult.OrigWidth, pProbeResult.OrigHeight);
			this._initSimpleViewer(null, tmpPreviewURL);
		}

		// Cancel any previous DZI fetch (fast navigation between big images)
		this._cancelActiveDziOperation();

		// Start operation tracking for the DZI generation
		let tmpStatus = this.pict.providers['RetoldRemote-OperationStatus'];
		let tmpOp = tmpStatus ? tmpStatus.startOperation(
		{
			Label: 'Generating deep-zoom tiles',
			Phase: 'Reading image…',
			Cancelable: true
		}) : null;
		if (tmpOp)
		{
			this._activeDziOperationId = tmpOp.OperationId;
			this._activeDziAbortController = tmpOp.AbortController;
		}

		let tmpFetchOptions = {};
		if (tmpOp && tmpOp.AbortController)
		{
			tmpFetchOptions.signal = tmpOp.AbortController.signal;
		}
		if (tmpOp)
		{
			tmpFetchOptions.headers = { 'X-Op-Id': tmpOp.OperationId };
		}

		// 2. Generate DZI tiles in the background
		fetch('/api/media/dzi?path=' + pPathParam, tmpFetchOptions)
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				tmpSelf._loading = false;

				if (!pResult || !pResult.Success)
				{
					if (tmpOp && tmpStatus)
					{
						tmpStatus.errorOperation(tmpOp.OperationId, { message: (pResult && pResult.Error) || 'DZI generation failed' });
					}
					// DZI generation failed — the preview is already showing
					if (!tmpPreviewURL)
					{
						tmpSelf._showSimpleImage(pFilePath);
					}
					return;
				}

				if (tmpOp && tmpStatus)
				{
					tmpStatus.completeOperation(tmpOp.OperationId);
				}
				tmpSelf._activeDziOperationId = null;
				tmpSelf._activeDziAbortController = null;

				// 3. Swap the preview for the full DZI tile viewer
				tmpSelf._dziData = pResult;
				tmpSelf._showInfo(pResult);

				// Destroy the preview viewer and replace with tile viewer.
				// Reset _viewerReady so the new viewer's open handler
				// re-renders saved overlays against the new viewer instance.
				// Any overlays attached to the preview viewer are gone once
				// it's destroyed, so we MUST re-render from _savedRegions
				// against the new viewer.
				if (tmpSelf._osdViewer)
				{
					try { tmpSelf._osdViewer.destroy(); } catch (e) { /* ignore */ }
					tmpSelf._osdViewer = null;
				}
				tmpSelf._viewerReady = false;

				// Clear the viewer div for fresh OSD init
				let tmpViewerDiv = document.getElementById('RetoldRemote-IEX-Viewer');
				if (tmpViewerDiv)
				{
					tmpViewerDiv.innerHTML = '';
				}

				tmpSelf._initViewer(pResult);
			})
			.catch((pError) =>
			{
				tmpSelf._loading = false;
				if (pError && pError.name === 'AbortError')
				{
					return;
				}
				if (tmpOp && tmpStatus)
				{
					tmpStatus.errorOperation(tmpOp.OperationId, pError);
				}
				// Tiles failed — the preview is already showing, leave it
				if (!tmpPreviewURL)
				{
					tmpSelf._showSimpleImage(pFilePath);
				}
			});
	}

	/**
	 * Cancel any in-flight DZI generation. Called on navigate-away and
	 * when launching a new explorer session.
	 */
	_cancelActiveDziOperation()
	{
		if (this._activeDziAbortController)
		{
			try { this._activeDziAbortController.abort(); } catch (pErr) { /* ignore */ }
		}
		let tmpStatus = this.pict.providers['RetoldRemote-OperationStatus'];
		if (this._activeDziOperationId && tmpStatus)
		{
			tmpStatus.cancelOperation(this._activeDziOperationId);
		}
		this._activeDziOperationId = null;
		this._activeDziAbortController = null;
	}

	/**
	 * Show the info bar while the preview is displayed and tiles are generating.
	 *
	 * @param {number} pWidth  - Original image width
	 * @param {number} pHeight - Original image height
	 */
	_showPreviewInfo(pWidth, pHeight)
	{
		let tmpInfoBar = document.getElementById('RetoldRemote-IEX-Info');
		if (!tmpInfoBar)
		{
			return;
		}

		let tmpHTML = '';
		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Dimensions:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value">' + pWidth + ' \u00d7 ' + pHeight + ' px</span></span>';

		let tmpMegapixels = ((pWidth * pHeight) / 1000000).toFixed(1);
		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Size:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value">' + tmpMegapixels + ' MP</span></span>';

		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Mode:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value retold-remote-iex-tiling-status">Preview \u2014 generating tiles\u2026</span></span>';

		tmpInfoBar.innerHTML = tmpHTML;
		tmpInfoBar.style.display = '';
	}

	/**
	 * Show the info bar with image dimensions and tile info.
	 *
	 * @param {object} pDziData - DZI generation result
	 */
	_showInfo(pDziData)
	{
		let tmpInfoBar = document.getElementById('RetoldRemote-IEX-Info');
		if (!tmpInfoBar)
		{
			return;
		}

		let tmpHTML = '';
		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Dimensions:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value">' + pDziData.Width + ' \u00d7 ' + pDziData.Height + ' px</span></span>';
		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Tile size:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value">' + pDziData.TileSize + ' px</span></span>';
		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Format:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value">' + pDziData.Format + '</span></span>';

		let tmpMegapixels = ((pDziData.Width * pDziData.Height) / 1000000).toFixed(1);
		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Size:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value">' + tmpMegapixels + ' MP</span></span>';

		tmpHTML += '<span class="retold-remote-iex-info-item"><span class="retold-remote-iex-info-label">Mode:</span> ';
		tmpHTML += '<span class="retold-remote-iex-info-value">Tiled</span></span>';

		tmpInfoBar.innerHTML = tmpHTML;
		tmpInfoBar.style.display = '';
	}

	/**
	 * Initialize the OpenSeadragon viewer with the generated DZI tiles.
	 *
	 * @param {object} pDziData - DZI generation result with CacheKey, Format, etc.
	 */
	_initViewer(pDziData)
	{
		// Hide loading, show viewer container
		let tmpLoading = document.getElementById('RetoldRemote-IEX-Loading');
		let tmpViewerDiv = document.getElementById('RetoldRemote-IEX-Viewer');
		let tmpControls = document.getElementById('RetoldRemote-IEX-Controls');

		if (tmpLoading) tmpLoading.style.display = 'none';
		if (tmpViewerDiv) tmpViewerDiv.style.display = 'block';
		if (tmpControls) tmpControls.style.display = '';

		let tmpSelf = this;

		// Build the DZI tile source URL pattern
		// sharp generates tiles at: {cacheDir}/image_files/{level}/{col}_{row}.{format}
		// We serve them at: /api/media/dzi-tile/{cacheKey}/{level}/{col}_{row}.{format}
		let tmpTileSource =
		{
			Image:
			{
				xmlns: 'http://schemas.microsoft.com/deepzoom/2008',
				Url: '/api/media/dzi-tile/' + encodeURIComponent(pDziData.CacheKey) + '/',
				Format: pDziData.Format,
				Overlap: String(pDziData.Overlap),
				TileSize: String(pDziData.TileSize),
				Size:
				{
					Width: String(pDziData.Width),
					Height: String(pDziData.Height)
				}
			}
		};

		this._osdViewer = OpenSeadragon(
		{
			id: 'RetoldRemote-IEX-Viewer',
			tileSources: tmpTileSource,
			prefixUrl: '',
			showNavigationControl: false,
			showNavigator: true,
			navigatorPosition: 'BOTTOM_RIGHT',
			navigatorSizeRatio: 0.15,
			animationTime: 0.3,
			blendTime: 0.1,
			minZoomLevel: 0.1,
			maxZoomLevel: 20,
			visibilityRatio: 0.5,
			constrainDuringPan: false,
			gestureSettingsMouse:
			{
				scrollToZoom: true,
				clickToZoom: true,
				dblClickToZoom: true,
				flickEnabled: false
			},
			gestureSettingsTouch:
			{
				pinchToZoom: true,
				flickEnabled: true,
				flickMinSpeed: 120,
				flickMomentum: 0.25
			}
		});

		// Track zoom level changes
		this._osdViewer.addHandler('zoom', function (pEvent)
		{
			tmpSelf._updateZoomLabel();
		});

		// Track mouse position for coordinate display
		this._osdViewer.addHandler('open', function ()
		{
			tmpSelf._updateZoomLabel();

			// Viewer is ready — mark the flag and re-render any saved regions
			// that may have loaded before the tile viewer finished opening
			// (or before the preview→tile swap completed). See Part A notes.
			tmpSelf._viewerReady = true;
			if (tmpSelf._savedRegions && tmpSelf._savedRegions.length > 0)
			{
				tmpSelf._renderSavedRegionOverlays();
			}
		});

		// Mouse tracker for coordinates
		if (typeof OpenSeadragon.MouseTracker !== 'undefined')
		{
			new OpenSeadragon.MouseTracker(
			{
				element: tmpViewerDiv,
				moveHandler: function (pEvent)
				{
					tmpSelf._updateCoords(pEvent.position);
				}
			});
		}
	}

	/**
	 * Update the zoom level display.
	 */
	_updateZoomLabel()
	{
		if (!this._osdViewer)
		{
			return;
		}

		let tmpZoomLabel = document.getElementById('RetoldRemote-IEX-ZoomLabel');
		if (tmpZoomLabel)
		{
			let tmpZoom = this._osdViewer.viewport.getZoom(true);
			// Convert viewport zoom to percentage of "home" zoom
			let tmpHomeZoom = this._osdViewer.viewport.getHomeZoom();
			let tmpPercent = Math.round((tmpZoom / tmpHomeZoom) * 100);
			tmpZoomLabel.textContent = tmpPercent + '%';
		}
	}

	/**
	 * Update the coordinate display based on mouse position.
	 *
	 * @param {object} pPosition - { x, y } pixel position in the viewer
	 */
	_updateCoords(pPosition)
	{
		if (!this._osdViewer || !this._dziData)
		{
			return;
		}

		let tmpCoordsEl = document.getElementById('RetoldRemote-IEX-Coords');
		if (!tmpCoordsEl)
		{
			return;
		}

		try
		{
			let tmpViewportPoint = this._osdViewer.viewport.pointFromPixel(pPosition);
			let tmpImagePoint = this._osdViewer.viewport.viewportToImageCoordinates(tmpViewportPoint);

			let tmpX = Math.round(tmpImagePoint.x);
			let tmpY = Math.round(tmpImagePoint.y);

			if (tmpX >= 0 && tmpX <= this._dziData.Width && tmpY >= 0 && tmpY <= this._dziData.Height)
			{
				tmpCoordsEl.textContent = tmpX + ', ' + tmpY;
			}
			else
			{
				tmpCoordsEl.textContent = '';
			}
		}
		catch (pErr)
		{
			// ignore viewport calculation errors during transitions
		}
	}

	/**
	 * Zoom in by a step.
	 */
	zoomIn()
	{
		if (this._osdViewer)
		{
			let tmpCurrentZoom = this._osdViewer.viewport.getZoom();
			this._osdViewer.viewport.zoomTo(tmpCurrentZoom * 1.5);
		}
	}

	/**
	 * Zoom out by a step.
	 */
	zoomOut()
	{
		if (this._osdViewer)
		{
			let tmpCurrentZoom = this._osdViewer.viewport.getZoom();
			this._osdViewer.viewport.zoomTo(tmpCurrentZoom / 1.5);
		}
	}

	/**
	 * Reset to home (fit to view).
	 */
	zoomHome()
	{
		if (this._osdViewer)
		{
			this._osdViewer.viewport.goHome();
		}
	}

	// -----------------------------------------------------------------
	// Selection mode — draw rectangles to create labeled subimage regions
	// -----------------------------------------------------------------

	/**
	 * Toggle selection mode on/off.
	 */
	toggleSelectionMode()
	{
		if (this._selectionMode)
		{
			this._exitSelectionMode();
		}
		else
		{
			this._enterSelectionMode();
		}
	}

	/**
	 * Enter selection mode: disable panning, install drag tracker.
	 */
	_enterSelectionMode()
	{
		if (!this._osdViewer)
		{
			return;
		}

		this._selectionMode = true;

		// Highlight the Select button
		let tmpBtn = document.getElementById('RetoldRemote-IEX-SelectBtn');
		if (tmpBtn)
		{
			tmpBtn.style.background = 'rgba(97, 175, 239, 0.4)';
			tmpBtn.style.color = '#fff';
		}

		// Disable OSD panning so drag draws a selection instead
		this._osdViewer.setMouseNavEnabled(false);

		let tmpSelf = this;
		let tmpViewerDiv = document.getElementById('RetoldRemote-IEX-Viewer');
		if (!tmpViewerDiv)
		{
			return;
		}
		tmpViewerDiv.style.cursor = 'crosshair';

		this._selectionTracker = new OpenSeadragon.MouseTracker(
		{
			element: tmpViewerDiv,
			pressHandler: function (pEvent)
			{
				tmpSelf._onSelectionPress(pEvent);
			},
			dragHandler: function (pEvent)
			{
				tmpSelf._onSelectionDrag(pEvent);
			},
			releaseHandler: function (pEvent)
			{
				tmpSelf._onSelectionRelease(pEvent);
			}
		});
	}

	/**
	 * Exit selection mode: re-enable panning, remove drag tracker.
	 */
	_exitSelectionMode()
	{
		this._selectionMode = false;

		let tmpBtn = document.getElementById('RetoldRemote-IEX-SelectBtn');
		if (tmpBtn)
		{
			tmpBtn.style.background = '';
			tmpBtn.style.color = '';
		}

		if (this._osdViewer)
		{
			this._osdViewer.setMouseNavEnabled(true);
		}

		if (this._selectionTracker)
		{
			this._selectionTracker.destroy();
			this._selectionTracker = null;
		}

		let tmpViewerDiv = document.getElementById('RetoldRemote-IEX-Viewer');
		if (tmpViewerDiv)
		{
			tmpViewerDiv.style.cursor = '';
		}

		// Remove in-progress selection overlay (keep saved ones)
		this._removeActiveSelectionOverlay();
		this._selectionRegion = null;
		this._selectionStart = null;
		this._selectionStartScreenPos = null;

		// Hide label input
		let tmpLabelWrap = document.getElementById('RetoldRemote-IEX-LabelInput');
		if (tmpLabelWrap)
		{
			tmpLabelWrap.style.display = 'none';
		}
		let tmpCoords = document.getElementById('RetoldRemote-IEX-Coords');
		if (tmpCoords)
		{
			tmpCoords.style.display = '';
		}
	}

	/**
	 * Handle the start of a selection drag.
	 */
	_onSelectionPress(pEvent)
	{
		if (!this._osdViewer)
		{
			return;
		}

		// Remove any previous in-progress selection overlay
		this._removeActiveSelectionOverlay();

		// Capture BOTH the screen-pixel position (for the click-vs-drag
		// test on release) and the viewport-space point (for the overlay
		// math during the drag). We need the screen-pixel reference to
		// filter out accidental clicks — on a high-res image the viewport
		// pixel math would mis-classify sensor-jitter as a real drag.
		this._selectionStartScreenPos = { x: pEvent.position.x, y: pEvent.position.y };
		this._selectionStart = this._osdViewer.viewport.pointFromPixel(pEvent.position);

		// Create the selection rectangle overlay element
		let tmpOverlay = document.createElement('div');
		tmpOverlay.id = 'RetoldRemote-IEX-ActiveSelection';
		tmpOverlay.style.cssText = 'border: 2px solid rgba(97, 175, 239, 0.9); background: rgba(97, 175, 239, 0.15); pointer-events: none;';
		this._selectionOverlay = tmpOverlay;

		// Add the overlay at zero size, will expand during drag
		this._osdViewer.addOverlay(
		{
			element: tmpOverlay,
			location: new OpenSeadragon.Rect(
				this._selectionStart.x, this._selectionStart.y, 0, 0)
		});
	}

	/**
	 * Handle selection dragging — update the rectangle size.
	 */
	_onSelectionDrag(pEvent)
	{
		if (!this._osdViewer || !this._selectionStart || !this._selectionOverlay)
		{
			return;
		}

		let tmpCurrent = this._osdViewer.viewport.pointFromPixel(pEvent.position);
		let tmpX = Math.min(this._selectionStart.x, tmpCurrent.x);
		let tmpY = Math.min(this._selectionStart.y, tmpCurrent.y);
		let tmpW = Math.abs(tmpCurrent.x - this._selectionStart.x);
		let tmpH = Math.abs(tmpCurrent.y - this._selectionStart.y);

		this._osdViewer.updateOverlay(
			this._selectionOverlay,
			new OpenSeadragon.Rect(tmpX, tmpY, tmpW, tmpH));
	}

	/**
	 * Handle selection release — compute image-coordinate region and show label input.
	 */
	_onSelectionRelease(pEvent)
	{
		if (!this._osdViewer || !this._selectionStart)
		{
			return;
		}

		// Screen-pixel click-vs-drag filter. If the mouse moved less than
		// CLICK_THRESHOLD screen pixels between press and release, treat
		// this as a click (not a selection) and bail. This MUST be checked
		// in screen pixels, not image pixels, because on a high-resolution
		// image a 1-screen-pixel jitter can translate to 6+ image pixels,
		// which would otherwise slip past the image-pixel min-size guard
		// below and pop the label dialog on a single click.
		const CLICK_THRESHOLD = 5;
		if (this._selectionStartScreenPos)
		{
			let tmpDx = Math.abs(pEvent.position.x - this._selectionStartScreenPos.x);
			let tmpDy = Math.abs(pEvent.position.y - this._selectionStartScreenPos.y);
			if (tmpDx < CLICK_THRESHOLD && tmpDy < CLICK_THRESHOLD)
			{
				this._removeActiveSelectionOverlay();
				this._selectionStart = null;
				this._selectionStartScreenPos = null;
				return;
			}
		}

		let tmpEnd = this._osdViewer.viewport.pointFromPixel(pEvent.position);

		// Convert viewport rectangle to image pixel coordinates
		let tmpVpX = Math.min(this._selectionStart.x, tmpEnd.x);
		let tmpVpY = Math.min(this._selectionStart.y, tmpEnd.y);
		let tmpVpW = Math.abs(tmpEnd.x - this._selectionStart.x);
		let tmpVpH = Math.abs(tmpEnd.y - this._selectionStart.y);

		let tmpTopLeft = this._osdViewer.viewport.viewportToImageCoordinates(
			new OpenSeadragon.Point(tmpVpX, tmpVpY));
		let tmpBottomRight = this._osdViewer.viewport.viewportToImageCoordinates(
			new OpenSeadragon.Point(tmpVpX + tmpVpW, tmpVpY + tmpVpH));

		let tmpRegion =
		{
			X: Math.max(0, Math.round(tmpTopLeft.x)),
			Y: Math.max(0, Math.round(tmpTopLeft.y)),
			Width: Math.round(tmpBottomRight.x - tmpTopLeft.x),
			Height: Math.round(tmpBottomRight.y - tmpTopLeft.y)
		};

		// Clamp to image dimensions
		this._clampRegionToImage(tmpRegion);

		// Defensive net: ignore tiny selections in image pixels. The
		// screen-pixel CLICK_THRESHOLD guard above catches accidental
		// clicks; this check covers the remaining case of a drag that's
		// large in screen pixels but degenerate in image pixels (e.g.
		// the user somehow ended up dragging entirely outside the image
		// bounds so everything got clamped away).
		if (tmpRegion.Width < 5 || tmpRegion.Height < 5)
		{
			this._removeActiveSelectionOverlay();
			this._selectionStart = null;
			this._selectionStartScreenPos = null;
			return;
		}

		this._selectionRegion = tmpRegion;

		// Show the inline label input in the controls bar
		let tmpLabelWrap = document.getElementById('RetoldRemote-IEX-LabelInput');
		let tmpCoords = document.getElementById('RetoldRemote-IEX-Coords');
		if (tmpLabelWrap)
		{
			tmpLabelWrap.style.display = '';
		}
		if (tmpCoords)
		{
			tmpCoords.style.display = 'none';
		}

		// Focus the label field
		let tmpField = document.getElementById('RetoldRemote-IEX-LabelField');
		if (tmpField)
		{
			tmpField.value = '';
			tmpField.focus();
		}
	}

	/**
	 * Save a NEW selection (drawn by the user) with the entered label.
	 * Renamed from saveSelectionLabel so the public saveSelectionLabel()
	 * can dispatch to either this or the edit-mode PUT helper based on
	 * whether _editingRegionID is set.
	 */
	_saveNewRegionLabel()
	{
		if (!this._selectionRegion)
		{
			return;
		}

		let tmpField = document.getElementById('RetoldRemote-IEX-LabelField');
		let tmpLabel = tmpField ? tmpField.value.trim() : '';

		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(this._currentPath) : encodeURIComponent(this._currentPath);

		fetch('/api/media/subimage-regions',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(
			{
				Path: this._currentPath,
				Region:
				{
					Label: tmpLabel,
					X: this._selectionRegion.X,
					Y: this._selectionRegion.Y,
					Width: this._selectionRegion.Width,
					Height: this._selectionRegion.Height
				}
			})
		})
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				if (pResult && pResult.Success)
				{
					tmpSelf._savedRegions = pResult.Regions || [];

					// Remove the active selection overlay and render persistent ones
					tmpSelf._removeActiveSelectionOverlay();
					tmpSelf._renderSavedRegionOverlays();

					// Notify the user
					let tmpToast = tmpSelf.pict.providers['RetoldRemote-ToastNotification'];
					if (tmpToast)
					{
						tmpToast.showToast('Subimage region saved' + (tmpLabel ? ': ' + tmpLabel : ''));
					}

					// Update the sidebar panel if visible
					let tmpSubPanel = tmpSelf.pict.views['RetoldRemote-SubimagesPanel'];
					if (tmpSubPanel)
					{
						tmpSubPanel.render();
					}
				}
			})
			.catch((pErr) =>
			{
				let tmpToast = tmpSelf.pict.providers['RetoldRemote-ToastNotification'];
				if (tmpToast)
				{
					tmpToast.showToast('Failed to save region: ' + pErr.message);
				}
			});

		// Hide label input, show coords
		this._selectionRegion = null;
		this._selectionStart = null;
		this._selectionStartScreenPos = null;

		let tmpLabelWrap = document.getElementById('RetoldRemote-IEX-LabelInput');
		if (tmpLabelWrap)
		{
			tmpLabelWrap.style.display = 'none';
		}
		let tmpCoords = document.getElementById('RetoldRemote-IEX-Coords');
		if (tmpCoords)
		{
			tmpCoords.style.display = '';
		}
	}

	/**
	 * Cancel a new in-progress selection. Renamed from cancelSelection
	 * so the public cancelSelection() can dispatch to either this or
	 * _exitRegionEditMode based on state.
	 */
	_cancelNewSelection()
	{
		this._removeActiveSelectionOverlay();
		this._selectionRegion = null;
		this._selectionStart = null;
		this._selectionStartScreenPos = null;

		let tmpLabelWrap = document.getElementById('RetoldRemote-IEX-LabelInput');
		if (tmpLabelWrap)
		{
			tmpLabelWrap.style.display = 'none';
		}
		let tmpCoords = document.getElementById('RetoldRemote-IEX-Coords');
		if (tmpCoords)
		{
			tmpCoords.style.display = '';
		}
	}

	/**
	 * Remove the active (in-progress) selection overlay.
	 */
	_removeActiveSelectionOverlay()
	{
		let tmpActive = document.getElementById('RetoldRemote-IEX-ActiveSelection');
		if (tmpActive && this._osdViewer)
		{
			try
			{
				this._osdViewer.removeOverlay(tmpActive);
			}
			catch (pErr)
			{
				// May not be an overlay; just remove from DOM
				if (tmpActive.parentElement)
				{
					tmpActive.parentElement.removeChild(tmpActive);
				}
			}
		}
		this._selectionOverlay = null;
	}

	// -----------------------------------------------------------------
	// Saved region overlays
	// -----------------------------------------------------------------

	/**
	 * Load saved subimage regions from the server.
	 *
	 * Stores the regions in `_savedRegions` and triggers a render IF the
	 * viewer is already open. Otherwise the open handler will call the
	 * render once it fires — this is the single source of truth for
	 * "render when ready", avoiding the race between the regions fetch
	 * and the OSD 'open' event.
	 *
	 * Captures pFilePath in closure so a stale async response from an
	 * earlier file doesn't overwrite the regions of a later-opened file
	 * during rapid navigation.
	 *
	 * @param {string} pFilePath - Relative file path
	 */
	_loadSavedRegions(pFilePath)
	{
		let tmpSelf = this;
		let tmpRequestedPath = pFilePath;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

		fetch('/api/media/subimage-regions?path=' + tmpPathParam)
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				// Abort if the user has already navigated to a different file.
				if (tmpSelf._currentPath !== tmpRequestedPath)
				{
					return;
				}
				if (pResult && pResult.Success && Array.isArray(pResult.Regions))
				{
					tmpSelf._savedRegions = pResult.Regions;
					if (tmpSelf._viewerReady)
					{
						tmpSelf._renderSavedRegionOverlays();
					}
					// If not ready yet, the viewer's 'open' handler will
					// detect _savedRegions.length > 0 and render.
				}
			})
			.catch(() =>
			{
				// Silently ignore — regions are optional
			});
	}

	/**
	 * Render all saved regions as OSD overlays with colored borders and labels.
	 *
	 * Idempotent: safely removes any existing saved-region overlays (scoped
	 * to the current viewer's container to avoid clobbering overlays in
	 * other viewer instances during rapid swaps) before re-adding each
	 * region. Can be called any number of times after the viewer's 'open'
	 * event has fired.
	 */
	_renderSavedRegionOverlays()
	{
		if (!this._osdViewer)
		{
			return;
		}

		// Remove existing saved-region overlays scoped to this viewer's
		// container (NOT the whole document — during the DZI preview→tile
		// swap two viewer instances may briefly coexist).
		let tmpViewerDiv = document.getElementById('RetoldRemote-IEX-Viewer');
		if (tmpViewerDiv)
		{
			let tmpExisting = tmpViewerDiv.querySelectorAll('.retold-remote-iex-region-overlay');
			for (let i = 0; i < tmpExisting.length; i++)
			{
				try
				{
					this._osdViewer.removeOverlay(tmpExisting[i]);
				}
				catch (pErr)
				{
					if (tmpExisting[i].parentElement)
					{
						tmpExisting[i].parentElement.removeChild(tmpExisting[i]);
					}
				}
			}
		}

		// Render each saved region
		for (let i = 0; i < this._savedRegions.length; i++)
		{
			let tmpRegion = this._savedRegions[i];
			this._addRegionOverlay(tmpRegion);
		}

		// If an edit is in progress, re-append drag handles to the
		// freshly-rendered overlay element. (The old overlay element was
		// destroyed above, so the handles went with it.)
		if (this._editingRegionID && tmpViewerDiv)
		{
			let tmpEditingEl = tmpViewerDiv.querySelector(
				'.retold-remote-iex-region-overlay[data-region-id="' + this._editingRegionID + '"]');
			if (tmpEditingEl)
			{
				this._appendEditHandles(tmpEditingEl);
			}
		}
	}

	/**
	 * Add a single region overlay to the OSD viewer.
	 *
	 * Saved overlays use `pointer-events: auto` so the double-click edit
	 * handler can fire; a `mousedown` listener calls `stopPropagation()`
	 * so single-click pan still works outside the overlay rectangles.
	 * See Part B (edit mode) for the full interaction model.
	 *
	 * @param {object} pRegion - { ID, Label, X, Y, Width, Height }
	 */
	_addRegionOverlay(pRegion)
	{
		if (!this._osdViewer)
		{
			return;
		}

		let tmpSelf = this;
		let tmpEl = document.createElement('div');
		tmpEl.className = 'retold-remote-iex-region-overlay';
		tmpEl.setAttribute('data-region-id', pRegion.ID);
		tmpEl.style.cssText = 'border: 2px solid rgba(229, 192, 123, 0.85); background: rgba(229, 192, 123, 0.08); pointer-events: auto; position: relative; cursor: pointer;';

		// Label badge
		if (pRegion.Label)
		{
			let tmpLabelEl = document.createElement('span');
			tmpLabelEl.className = 'retold-remote-iex-region-label';
			tmpLabelEl.style.cssText = 'position:absolute;top:-1px;left:-1px;background:rgba(229,192,123,0.9);color:#282c34;font-size:0.65rem;padding:1px 5px;border-radius:0 0 3px 0;white-space:nowrap;pointer-events:none;';
			tmpLabelEl.textContent = pRegion.Label;
			tmpEl.appendChild(tmpLabelEl);
		}

		// Highlight the currently-edited region and dim others.
		if (this._editingRegionID && this._editingRegionID === pRegion.ID)
		{
			tmpEl.style.border = '2px solid rgba(97, 175, 239, 0.95)';
			tmpEl.style.background = 'rgba(97, 175, 239, 0.15)';
			tmpEl.style.opacity = '1';
		}
		else if (this._editingRegionID)
		{
			tmpEl.style.opacity = '0.35';
		}

		// Single mousedown on a saved overlay does NOT enter edit mode
		// (that would steal pan). Just stop propagation so OSD's click-to-
		// zoom / pan-drag doesn't happen inside the rectangle. Actual edit-
		// mode entry happens on double-click (see below).
		tmpEl.addEventListener('mousedown', function (pEvent)
		{
			// Only block propagation when NOT already in edit mode on this region.
			// When editing this region, the viewer-level edit tracker handles
			// press/drag/release on the overlay and its handles.
			if (tmpSelf._editingRegionID !== pRegion.ID)
			{
				pEvent.stopPropagation();
			}
		});
		tmpEl.addEventListener('dblclick', function (pEvent)
		{
			pEvent.stopPropagation();
			pEvent.preventDefault();
			tmpSelf._enterRegionEditMode(pRegion.ID);
		});

		// Convert image coordinates to viewport coordinates
		let tmpImageRect = new OpenSeadragon.Rect(pRegion.X, pRegion.Y, pRegion.Width, pRegion.Height);
		let tmpViewportRect = this._osdViewer.viewport.imageToViewportRectangle(tmpImageRect);

		this._osdViewer.addOverlay(
		{
			element: tmpEl,
			location: tmpViewportRect
		});
	}

	/**
	 * Navigate to (zoom into) a specific saved region by ID.
	 *
	 * @param {string} pRegionID - The region ID to navigate to
	 */
	zoomToRegion(pRegionID)
	{
		if (!this._osdViewer || !this._dziData)
		{
			return;
		}

		let tmpRegion = null;
		for (let i = 0; i < this._savedRegions.length; i++)
		{
			if (this._savedRegions[i].ID === pRegionID)
			{
				tmpRegion = this._savedRegions[i];
				break;
			}
		}

		if (!tmpRegion)
		{
			return;
		}

		// Convert image rect to viewport rect and fit to it
		let tmpImageRect = new OpenSeadragon.Rect(tmpRegion.X, tmpRegion.Y, tmpRegion.Width, tmpRegion.Height);
		let tmpViewportRect = this._osdViewer.viewport.imageToViewportRectangle(tmpImageRect);
		this._osdViewer.viewport.fitBounds(tmpViewportRect);
	}

	/**
	 * Delete a saved region by ID.
	 *
	 * @param {string} pRegionID - The region ID to delete
	 */
	deleteRegion(pRegionID)
	{
		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(this._currentPath) : encodeURIComponent(this._currentPath);

		fetch('/api/media/subimage-regions/' + encodeURIComponent(pRegionID) + '?path=' + tmpPathParam,
		{
			method: 'DELETE'
		})
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				if (pResult && pResult.Success)
				{
					tmpSelf._savedRegions = pResult.Regions || [];
					tmpSelf._renderSavedRegionOverlays();

					let tmpToast = tmpSelf.pict.providers['RetoldRemote-ToastNotification'];
					if (tmpToast)
					{
						tmpToast.showToast('Region deleted');
					}

					// Update sidebar
					let tmpSubPanel = tmpSelf.pict.views['RetoldRemote-SubimagesPanel'];
					if (tmpSubPanel)
					{
						tmpSubPanel.render();
					}
				}
			})
			.catch(() =>
			{
				// ignore
			});
	}

	/**
	 * Get the current selection region (for use by collection add).
	 *
	 * @returns {object|null} The current selection or null
	 */
	getActiveSelection()
	{
		return this._selectionRegion;
	}

	/**
	 * Get the saved regions array.
	 *
	 * @returns {Array}
	 */
	getSavedRegions()
	{
		return this._savedRegions;
	}

	// -----------------------------------------------------------------
	// Navigation
	// -----------------------------------------------------------------

	/**
	 * Navigate back to the gallery / file listing.
	 */
	goBack()
	{
		// Cancel any in-flight DZI generation
		this._cancelActiveDziOperation();

		// Clean up selection mode
		if (this._selectionMode)
		{
			this._exitSelectionMode();
		}

		// Destroy the OSD viewer
		if (this._osdViewer)
		{
			try
			{
				this._osdViewer.destroy();
			}
			catch (pErr)
			{
				// ignore
			}
			this._osdViewer = null;
		}

		let tmpNav = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNav)
		{
			tmpNav.closeViewer();
		}
	}

	/**
	 * Leave the image explorer and view the image in the standard viewer.
	 */
	viewInBrowser()
	{
		// Cancel any in-flight DZI generation
		this._cancelActiveDziOperation();

		// Destroy the OSD viewer
		if (this._osdViewer)
		{
			try
			{
				this._osdViewer.destroy();
			}
			catch (pErr)
			{
				// ignore
			}
			this._osdViewer = null;
		}

		let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
		if (tmpViewer)
		{
			tmpViewer.showMedia(this._currentPath, 'image');
		}
	}

	/**
	 * Show an error message.
	 *
	 * @param {string} pMessage - Error message
	 */
	_showError(pMessage)
	{
		let tmpLoading = document.getElementById('RetoldRemote-IEX-Loading');
		if (tmpLoading)
		{
			tmpLoading.style.display = 'none';
		}

		let tmpBody = document.getElementById('RetoldRemote-IEX-Body');
		if (tmpBody)
		{
			let tmpFmt = this.pict.providers['RetoldRemote-FormattingUtilities'];
			tmpBody.innerHTML = '<div class="retold-remote-iex-error">'
				+ '<div class="retold-remote-iex-error-message">' + tmpFmt.escapeHTML(pMessage || 'An error occurred.') + '</div>'
				+ '<button class="retold-remote-iex-nav-btn" onclick="pict.views[\'RetoldRemote-ImageExplorer\'].goBack()">Back to Image</button>'
				+ '</div>';
		}
	}

	// -----------------------------------------------------------------
	// Shared helpers
	// -----------------------------------------------------------------

	/**
	 * Clamp a region's X/Y/Width/Height to the image dimensions,
	 * mutating the passed object in place. No-op if the image dimensions
	 * aren't known yet.
	 *
	 * Reused by both the new-region release handler and the edit-mode
	 * drag/resize logic so bounds-checking stays consistent.
	 *
	 * @param {object} pRegion - { X, Y, Width, Height } mutated in place
	 */
	_clampRegionToImage(pRegion)
	{
		if (!pRegion) return;

		// Non-negative origin
		if (pRegion.X < 0)
		{
			pRegion.Width += pRegion.X;
			pRegion.X = 0;
		}
		if (pRegion.Y < 0)
		{
			pRegion.Height += pRegion.Y;
			pRegion.Y = 0;
		}

		// Fit within image width/height
		if (this._dziData)
		{
			if (pRegion.X + pRegion.Width > this._dziData.Width)
			{
				pRegion.Width = this._dziData.Width - pRegion.X;
			}
			if (pRegion.Y + pRegion.Height > this._dziData.Height)
			{
				pRegion.Height = this._dziData.Height - pRegion.Y;
			}
		}

		// Note: do NOT enforce a minimum size here. Callers must do their
		// own "ignore accidental click" check in SCREEN pixels before
		// calling this helper. Enforcing a minimum here would bump a
		// zero-size selection up to the minimum and cause the caller's
		// image-pixel min-size guard to silently pass, which created the
		// bug where a single click on a high-res image popped up the
		// label dialog as if the user had dragged.
	}

	// -----------------------------------------------------------------
	// Edit mode for saved regions (Part B)
	// -----------------------------------------------------------------

	/**
	 * Enter edit mode for a specific saved region. Highlights the region,
	 * dims the others, appends drag handles, and installs drag listeners
	 * for move/resize. Also populates the inline label input with the
	 * region's current label so the user can edit it in place.
	 *
	 * Entering edit mode automatically exits new-region selection mode
	 * (they're mutually exclusive).
	 *
	 * @param {string} pRegionID - ID of the region to edit
	 */
	_enterRegionEditMode(pRegionID)
	{
		// Find the region
		let tmpRegion = null;
		for (let i = 0; i < this._savedRegions.length; i++)
		{
			if (this._savedRegions[i].ID === pRegionID)
			{
				tmpRegion = this._savedRegions[i];
				break;
			}
		}
		if (!tmpRegion)
		{
			return;
		}

		// Mutually exclusive with new-region selection mode
		if (this._selectionMode)
		{
			this._exitSelectionMode();
		}

		// If already editing a different region, exit that first
		if (this._editingRegionID && this._editingRegionID !== pRegionID)
		{
			this._exitRegionEditMode();
		}

		this._editingRegionID = pRegionID;
		this._editDragMode = null;
		this._editDragStart = null;
		this._editOriginalRect = null;

		// Disable OSD panning while in edit mode so drags on the handles
		// don't also pan the viewer.
		if (this._osdViewer)
		{
			this._osdViewer.setMouseNavEnabled(false);
		}

		// Re-render overlays so the selected one gets highlight/other dimmed.
		// _addRegionOverlay checks this._editingRegionID for styling, and
		// _renderSavedRegionOverlays re-appends the drag handles via
		// _appendEditHandles now that this._editingRegionID is set.
		this._renderSavedRegionOverlays();

		// Show the inline label input with the current label pre-filled
		let tmpLabelWrap = document.getElementById('RetoldRemote-IEX-LabelInput');
		let tmpCoords = document.getElementById('RetoldRemote-IEX-Coords');
		let tmpField = document.getElementById('RetoldRemote-IEX-LabelField');
		if (tmpLabelWrap) tmpLabelWrap.style.display = '';
		if (tmpCoords) tmpCoords.style.display = 'none';
		if (tmpField)
		{
			tmpField.value = tmpRegion.Label || '';
			// Repurpose the Save button to save the edited region rather
			// than create a new one. We swap the onclick via a flag.
			tmpField.setAttribute('data-edit-mode', '1');
			tmpField.focus();
			tmpField.select();
		}
	}

	/**
	 * Exit edit mode, cleaning up handles, restoring overlay styles,
	 * and re-enabling OSD panning.
	 */
	_exitRegionEditMode()
	{
		this._editingRegionID = null;
		this._editDragMode = null;
		this._editDragStart = null;
		this._editOriginalRect = null;

		// Remove any lingering document-level drag listeners (should be
		// gone already, but be defensive)
		if (this._editDocMoveHandler)
		{
			document.removeEventListener('mousemove', this._editDocMoveHandler);
			this._editDocMoveHandler = null;
		}
		if (this._editDocUpHandler)
		{
			document.removeEventListener('mouseup', this._editDocUpHandler);
			this._editDocUpHandler = null;
		}

		// Re-enable OSD panning
		if (this._osdViewer)
		{
			this._osdViewer.setMouseNavEnabled(true);
		}

		// Re-render overlays to restore normal styling (no highlight/dim)
		this._renderSavedRegionOverlays();

		// Hide the label input
		let tmpLabelWrap = document.getElementById('RetoldRemote-IEX-LabelInput');
		let tmpCoords = document.getElementById('RetoldRemote-IEX-Coords');
		let tmpField = document.getElementById('RetoldRemote-IEX-LabelField');
		if (tmpLabelWrap) tmpLabelWrap.style.display = 'none';
		if (tmpCoords) tmpCoords.style.display = '';
		if (tmpField)
		{
			tmpField.removeAttribute('data-edit-mode');
			tmpField.value = '';
		}
	}

	/**
	 * Append 8 drag handles (4 corners + 4 edges) to a region overlay.
	 * Each handle has a 16×16 invisible hit area over a 6×6 visual dot
	 * so they're easy to grab on both mouse and touch.
	 *
	 * @param {HTMLElement} pOverlayEl - The overlay element to decorate
	 */
	_appendEditHandles(pOverlayEl)
	{
		let tmpSelf = this;
		let tmpHandles =
		[
			{ key: 'tl', css: 'top:-8px;left:-8px;cursor:nwse-resize;' },
			{ key: 'tr', css: 'top:-8px;right:-8px;cursor:nesw-resize;' },
			{ key: 'bl', css: 'bottom:-8px;left:-8px;cursor:nesw-resize;' },
			{ key: 'br', css: 'bottom:-8px;right:-8px;cursor:nwse-resize;' },
			{ key: 't',  css: 'top:-8px;left:50%;transform:translateX(-50%);cursor:ns-resize;' },
			{ key: 'b',  css: 'bottom:-8px;left:50%;transform:translateX(-50%);cursor:ns-resize;' },
			{ key: 'l',  css: 'top:50%;left:-8px;transform:translateY(-50%);cursor:ew-resize;' },
			{ key: 'r',  css: 'top:50%;right:-8px;transform:translateY(-50%);cursor:ew-resize;' }
		];

		for (let i = 0; i < tmpHandles.length; i++)
		{
			let tmpHandleInfo = tmpHandles[i];
			let tmpH = document.createElement('div');
			tmpH.className = 'retold-remote-iex-edit-handle';
			tmpH.setAttribute('data-handle', tmpHandleInfo.key);
			tmpH.style.cssText = 'position:absolute;width:16px;height:16px;pointer-events:auto;z-index:10;' + tmpHandleInfo.css;

			// Visible dot inside the hit area
			let tmpDot = document.createElement('div');
			tmpDot.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:8px;height:8px;background:#61afef;border:1.5px solid #fff;border-radius:50%;box-shadow:0 1px 3px rgba(0,0,0,0.5);';
			tmpH.appendChild(tmpDot);

			tmpH.addEventListener('mousedown', function (pEvent)
			{
				pEvent.stopPropagation();
				pEvent.preventDefault();
				tmpSelf._onEditHandlePress(tmpHandleInfo.key, pEvent);
			});

			pOverlayEl.appendChild(tmpH);
		}

		// Body drag (move) — the overlay element itself
		pOverlayEl.addEventListener('mousedown', function (pEvent)
		{
			// Only handle body clicks when clicking the overlay itself (not a child handle)
			if (pEvent.target !== pOverlayEl)
			{
				return;
			}
			if (tmpSelf._editingRegionID !== pOverlayEl.getAttribute('data-region-id'))
			{
				return;
			}
			pEvent.stopPropagation();
			pEvent.preventDefault();
			tmpSelf._onEditHandlePress('body', pEvent);
		});

		// Make the overlay element display cursor:move while in edit mode
		pOverlayEl.style.cursor = 'move';
	}

	/**
	 * Start an edit-mode drag. Captures the starting point and the
	 * overlay's current rect, installs document-level move/up listeners,
	 * and tracks which handle (or body) the drag is operating on.
	 *
	 * @param {string} pHandleKey - 'tl'|'tr'|'bl'|'br'|'t'|'r'|'b'|'l'|'body'
	 * @param {MouseEvent} pEvent
	 */
	_onEditHandlePress(pHandleKey, pEvent)
	{
		if (!this._osdViewer) return;
		if (!this._editingRegionID) return;

		let tmpViewerDiv = document.getElementById('RetoldRemote-IEX-Viewer');
		if (!tmpViewerDiv) return;

		this._editDragMode = pHandleKey;

		// Capture starting viewport point (converted from client coords)
		let tmpRect = tmpViewerDiv.getBoundingClientRect();
		let tmpLocalX = pEvent.clientX - tmpRect.left;
		let tmpLocalY = pEvent.clientY - tmpRect.top;
		this._editDragStart = this._osdViewer.viewport.pointFromPixel(
			new OpenSeadragon.Point(tmpLocalX, tmpLocalY));

		// Capture the overlay's current viewport rect (from the saved region)
		let tmpRegion = this._findSavedRegion(this._editingRegionID);
		if (!tmpRegion)
		{
			this._editDragMode = null;
			return;
		}
		let tmpImageRect = new OpenSeadragon.Rect(
			tmpRegion.X, tmpRegion.Y, tmpRegion.Width, tmpRegion.Height);
		this._editOriginalRect = this._osdViewer.viewport.imageToViewportRectangle(tmpImageRect);

		// Install document-level move + up listeners. Using native DOM
		// listeners rather than OSD MouseTracker so the drag isn't
		// constrained to the viewer div — the user can drag past the edge.
		let tmpSelf = this;
		this._editDocMoveHandler = function (pMoveEvent)
		{
			tmpSelf._onEditHandleMove(pMoveEvent);
		};
		this._editDocUpHandler = function (pUpEvent)
		{
			tmpSelf._onEditHandleRelease(pUpEvent);
		};
		document.addEventListener('mousemove', this._editDocMoveHandler);
		document.addEventListener('mouseup', this._editDocUpHandler);
	}

	/**
	 * Update the overlay rect during an edit drag.
	 *
	 * @param {MouseEvent} pEvent
	 */
	_onEditHandleMove(pEvent)
	{
		if (!this._osdViewer || !this._editDragStart || !this._editOriginalRect || !this._editDragMode)
		{
			return;
		}

		let tmpViewerDiv = document.getElementById('RetoldRemote-IEX-Viewer');
		if (!tmpViewerDiv) return;

		let tmpRect = tmpViewerDiv.getBoundingClientRect();
		let tmpLocalX = pEvent.clientX - tmpRect.left;
		let tmpLocalY = pEvent.clientY - tmpRect.top;
		let tmpCurrent = this._osdViewer.viewport.pointFromPixel(
			new OpenSeadragon.Point(tmpLocalX, tmpLocalY));

		let tmpDx = tmpCurrent.x - this._editDragStart.x;
		let tmpDy = tmpCurrent.y - this._editDragStart.y;

		// Apply the delta to the original rect based on drag mode
		let tmpX = this._editOriginalRect.x;
		let tmpY = this._editOriginalRect.y;
		let tmpW = this._editOriginalRect.width;
		let tmpH = this._editOriginalRect.height;

		switch (this._editDragMode)
		{
			case 'body':
				tmpX += tmpDx;
				tmpY += tmpDy;
				break;
			case 'tl':
				tmpX += tmpDx; tmpY += tmpDy; tmpW -= tmpDx; tmpH -= tmpDy;
				break;
			case 'tr':
				tmpY += tmpDy; tmpW += tmpDx; tmpH -= tmpDy;
				break;
			case 'bl':
				tmpX += tmpDx; tmpW -= tmpDx; tmpH += tmpDy;
				break;
			case 'br':
				tmpW += tmpDx; tmpH += tmpDy;
				break;
			case 't':
				tmpY += tmpDy; tmpH -= tmpDy;
				break;
			case 'b':
				tmpH += tmpDy;
				break;
			case 'l':
				tmpX += tmpDx; tmpW -= tmpDx;
				break;
			case 'r':
				tmpW += tmpDx;
				break;
		}

		// Handle inversion: if width or height went negative, flip
		if (tmpW < 0)
		{
			tmpX += tmpW;
			tmpW = -tmpW;
		}
		if (tmpH < 0)
		{
			tmpY += tmpH;
			tmpH = -tmpH;
		}

		// Get the overlay element and update its position
		let tmpOverlayEl = tmpViewerDiv.querySelector(
			'.retold-remote-iex-region-overlay[data-region-id="' + this._editingRegionID + '"]');
		if (tmpOverlayEl)
		{
			this._osdViewer.updateOverlay(
				tmpOverlayEl,
				new OpenSeadragon.Rect(tmpX, tmpY, tmpW, tmpH));
		}
	}

	/**
	 * Finalize an edit drag: convert viewport rect back to image coords,
	 * clamp, mutate the saved region optimistically, and PUT to the server.
	 */
	_onEditHandleRelease(pEvent)
	{
		// Remove document-level listeners
		if (this._editDocMoveHandler)
		{
			document.removeEventListener('mousemove', this._editDocMoveHandler);
			this._editDocMoveHandler = null;
		}
		if (this._editDocUpHandler)
		{
			document.removeEventListener('mouseup', this._editDocUpHandler);
			this._editDocUpHandler = null;
		}

		if (!this._osdViewer || !this._editingRegionID || !this._editDragMode)
		{
			this._editDragMode = null;
			return;
		}

		let tmpViewerDiv = document.getElementById('RetoldRemote-IEX-Viewer');
		if (!tmpViewerDiv)
		{
			this._editDragMode = null;
			return;
		}

		let tmpOverlayEl = tmpViewerDiv.querySelector(
			'.retold-remote-iex-region-overlay[data-region-id="' + this._editingRegionID + '"]');
		if (!tmpOverlayEl)
		{
			this._editDragMode = null;
			return;
		}

		// Get the current viewport rect from the overlay registry
		let tmpOverlayRec = this._osdViewer.getOverlayById(tmpOverlayEl);
		if (!tmpOverlayRec || !tmpOverlayRec.location)
		{
			this._editDragMode = null;
			return;
		}

		let tmpVpRect = tmpOverlayRec.location;
		let tmpTopLeft = this._osdViewer.viewport.viewportToImageCoordinates(
			new OpenSeadragon.Point(tmpVpRect.x, tmpVpRect.y));
		let tmpBottomRight = this._osdViewer.viewport.viewportToImageCoordinates(
			new OpenSeadragon.Point(tmpVpRect.x + tmpVpRect.width, tmpVpRect.y + tmpVpRect.height));

		let tmpNewRegion =
		{
			X: Math.round(tmpTopLeft.x),
			Y: Math.round(tmpTopLeft.y),
			Width: Math.round(tmpBottomRight.x - tmpTopLeft.x),
			Height: Math.round(tmpBottomRight.y - tmpTopLeft.y)
		};
		this._clampRegionToImage(tmpNewRegion);

		// Find the saved region and store the previous rect for revert-on-fail
		let tmpRegion = this._findSavedRegion(this._editingRegionID);
		if (!tmpRegion)
		{
			this._editDragMode = null;
			return;
		}
		let tmpPrevious =
		{
			X: tmpRegion.X, Y: tmpRegion.Y, Width: tmpRegion.Width, Height: tmpRegion.Height
		};

		// Only PUT if something actually changed
		if (tmpPrevious.X === tmpNewRegion.X && tmpPrevious.Y === tmpNewRegion.Y
			&& tmpPrevious.Width === tmpNewRegion.Width && tmpPrevious.Height === tmpNewRegion.Height)
		{
			this._editDragMode = null;
			return;
		}

		// Optimistic update: mutate local state and PUT in background
		tmpRegion.X = tmpNewRegion.X;
		tmpRegion.Y = tmpNewRegion.Y;
		tmpRegion.Width = tmpNewRegion.Width;
		tmpRegion.Height = tmpNewRegion.Height;

		this._editDragMode = null;
		this._putRegionUpdate(tmpRegion.ID, {
			X: tmpNewRegion.X,
			Y: tmpNewRegion.Y,
			Width: tmpNewRegion.Width,
			Height: tmpNewRegion.Height
		}, tmpPrevious);
	}

	/**
	 * Save the label being edited (called from the Save button and Enter key
	 * when data-edit-mode is set on the label field). Dispatches to either
	 * the new-region saver or the edit-mode PUT based on state.
	 */
	saveSelectionLabel()
	{
		// If we're in edit mode, save the label via PUT instead of creating
		// a new region.
		if (this._editingRegionID)
		{
			let tmpField = document.getElementById('RetoldRemote-IEX-LabelField');
			let tmpNewLabel = tmpField ? tmpField.value.trim() : '';

			let tmpRegion = this._findSavedRegion(this._editingRegionID);
			if (!tmpRegion)
			{
				this._exitRegionEditMode();
				return;
			}
			let tmpPreviousLabel = tmpRegion.Label || '';
			if (tmpNewLabel === tmpPreviousLabel)
			{
				// No change — just exit edit mode
				this._exitRegionEditMode();
				return;
			}

			// Optimistic update
			tmpRegion.Label = tmpNewLabel;
			let tmpRegionID = this._editingRegionID;
			this._exitRegionEditMode();
			this._putRegionUpdate(tmpRegionID, { Label: tmpNewLabel }, { Label: tmpPreviousLabel });
			return;
		}

		// Not in edit mode — fall through to the original new-region save
		return this._saveNewRegionLabel();
	}

	/**
	 * PUT a partial update for a region (label or geometry). Reverts the
	 * passed `pPrevious` fields on failure and shows a toast.
	 *
	 * @param {string} pRegionID - Region ID
	 * @param {object} pFields   - Fields to update (subset of Label/X/Y/Width/Height)
	 * @param {object} pPrevious - Previous values for revert-on-failure
	 */
	_putRegionUpdate(pRegionID, pFields, pPrevious)
	{
		let tmpSelf = this;
		let tmpBody = Object.assign({ Path: this._currentPath }, pFields);

		fetch('/api/media/subimage-regions/' + encodeURIComponent(pRegionID),
		{
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(tmpBody)
		})
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				if (!pResult || !pResult.Success)
				{
					// Revert optimistic changes
					tmpSelf._revertRegion(pRegionID, pPrevious);
					tmpSelf._renderSavedRegionOverlays();
					let tmpToast = tmpSelf.pict.providers['RetoldRemote-ToastNotification'];
					if (tmpToast)
					{
						let tmpMsg = pResult && pResult.Error
							? ('Failed to save: ' + pResult.Error)
							: 'Failed to save region update (file may have been modified).';
						tmpToast.showToast(tmpMsg);
					}
					return;
				}
				// Success — the server response contains the authoritative list
				if (Array.isArray(pResult.Regions))
				{
					tmpSelf._savedRegions = pResult.Regions;
				}
				tmpSelf._renderSavedRegionOverlays();

				// Update sidebar — use refresh() to force a re-fetch so the
				// panel picks up the updated geometry/label instead of using
				// its stale cached _regions array.
				let tmpSubPanel = tmpSelf.pict.views['RetoldRemote-SubimagesPanel'];
				if (tmpSubPanel && typeof tmpSubPanel.refresh === 'function')
				{
					tmpSubPanel.refresh();
				}

				let tmpToast = tmpSelf.pict.providers['RetoldRemote-ToastNotification'];
				if (tmpToast)
				{
					tmpToast.showToast('Region updated');
				}
			})
			.catch((pError) =>
			{
				// Revert optimistic changes
				tmpSelf._revertRegion(pRegionID, pPrevious);
				tmpSelf._renderSavedRegionOverlays();
				let tmpToast = tmpSelf.pict.providers['RetoldRemote-ToastNotification'];
				if (tmpToast)
				{
					tmpToast.showToast('Network error saving region: ' + pError.message);
				}
			});
	}

	/**
	 * Revert in-memory region fields to a previous snapshot.
	 */
	_revertRegion(pRegionID, pPrevious)
	{
		if (!pPrevious) return;
		let tmpRegion = this._findSavedRegion(pRegionID);
		if (!tmpRegion) return;
		for (let tmpKey in pPrevious)
		{
			tmpRegion[tmpKey] = pPrevious[tmpKey];
		}
	}

	/**
	 * Look up a saved region by ID.
	 */
	_findSavedRegion(pRegionID)
	{
		for (let i = 0; i < this._savedRegions.length; i++)
		{
			if (this._savedRegions[i].ID === pRegionID)
			{
				return this._savedRegions[i];
			}
		}
		return null;
	}

	/**
	 * Cancel handler — also exits edit mode if active.
	 */
	cancelSelection()
	{
		if (this._editingRegionID)
		{
			this._exitRegionEditMode();
			return;
		}
		return this._cancelNewSelection();
	}
}

RetoldRemoteImageExplorerView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteImageExplorerView;
