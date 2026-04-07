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
		this._selectionRegion = null; // { X, Y, Width, Height } in image coords
		this._selectionStart = null;  // viewport point where drag began
		this._savedRegions = [];      // loaded from server
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

		// Reset selection state
		this._selectionMode = false;
		this._selectionTracker = null;
		this._selectionOverlay = null;
		this._selectionRegion = null;
		this._selectionStart = null;
		this._savedRegions = [];

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

				// Destroy the preview viewer and replace with tile viewer
				if (tmpSelf._osdViewer)
				{
					try { tmpSelf._osdViewer.destroy(); } catch (e) { /* ignore */ }
					tmpSelf._osdViewer = null;
				}

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
		if (this._dziData)
		{
			if (tmpRegion.X + tmpRegion.Width > this._dziData.Width)
			{
				tmpRegion.Width = this._dziData.Width - tmpRegion.X;
			}
			if (tmpRegion.Y + tmpRegion.Height > this._dziData.Height)
			{
				tmpRegion.Height = this._dziData.Height - tmpRegion.Y;
			}
		}

		// Ignore tiny selections (likely accidental clicks)
		if (tmpRegion.Width < 5 || tmpRegion.Height < 5)
		{
			this._removeActiveSelectionOverlay();
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
	 * Save the current selection with the entered label.
	 */
	saveSelectionLabel()
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
	 * Cancel the current in-progress selection.
	 */
	cancelSelection()
	{
		this._removeActiveSelectionOverlay();
		this._selectionRegion = null;
		this._selectionStart = null;

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
	 * @param {string} pFilePath - Relative file path
	 */
	_loadSavedRegions(pFilePath)
	{
		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

		fetch('/api/media/subimage-regions?path=' + tmpPathParam)
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				if (pResult && pResult.Success && Array.isArray(pResult.Regions))
				{
					tmpSelf._savedRegions = pResult.Regions;
					tmpSelf._renderSavedRegionOverlays();
				}
			})
			.catch(() =>
			{
				// Silently ignore — regions are optional
			});
	}

	/**
	 * Render all saved regions as OSD overlays with colored borders and labels.
	 */
	_renderSavedRegionOverlays()
	{
		if (!this._osdViewer)
		{
			return;
		}

		// Remove existing saved-region overlays
		let tmpExisting = document.querySelectorAll('.retold-remote-iex-region-overlay');
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

		// Render each saved region
		for (let i = 0; i < this._savedRegions.length; i++)
		{
			let tmpRegion = this._savedRegions[i];
			this._addRegionOverlay(tmpRegion);
		}
	}

	/**
	 * Add a single region overlay to the OSD viewer.
	 *
	 * @param {object} pRegion - { ID, Label, X, Y, Width, Height }
	 */
	_addRegionOverlay(pRegion)
	{
		if (!this._osdViewer || !this._dziData)
		{
			return;
		}

		let tmpEl = document.createElement('div');
		tmpEl.className = 'retold-remote-iex-region-overlay';
		tmpEl.setAttribute('data-region-id', pRegion.ID);
		tmpEl.style.cssText = 'border: 2px solid rgba(229, 192, 123, 0.85); background: rgba(229, 192, 123, 0.08); pointer-events: none; position: relative;';

		// Label badge
		if (pRegion.Label)
		{
			let tmpLabelEl = document.createElement('span');
			tmpLabelEl.style.cssText = 'position:absolute;top:-1px;left:-1px;background:rgba(229,192,123,0.9);color:#282c34;font-size:0.65rem;padding:1px 5px;border-radius:0 0 3px 0;white-space:nowrap;pointer-events:none;';
			tmpLabelEl.textContent = pRegion.Label;
			tmpEl.appendChild(tmpLabelEl);
		}

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
}

RetoldRemoteImageExplorerView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteImageExplorerView;
