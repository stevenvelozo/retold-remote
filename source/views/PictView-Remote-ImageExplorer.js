const libPictView = require('pict-view');

const _OSD_CDN_URL = 'https://cdnjs.cloudflare.com/ajax/libs/openseadragon/4.1.1/openseadragon.min.js';

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-ImageExplorer",
	DefaultRenderable: "RetoldRemote-ImageExplorer",
	DefaultDestinationAddress: "#RetoldRemote-Viewer-Container",
	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-iex
		{
			display: flex;
			flex-direction: column;
			height: 100%;
		}
		.retold-remote-iex-header
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
		.retold-remote-iex-nav-btn
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
		.retold-remote-iex-nav-btn:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
		.retold-remote-iex-title
		{
			flex: 1;
			font-size: 0.82rem;
			color: var(--retold-text-secondary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-align: center;
		}
		.retold-remote-iex-info
		{
			display: flex;
			align-items: center;
			gap: 16px;
			padding: 8px 16px;
			background: var(--retold-bg-tertiary);
			border-bottom: 1px solid var(--retold-border);
			flex-shrink: 0;
			font-size: 0.75rem;
			color: var(--retold-text-dim);
		}
		.retold-remote-iex-info-item
		{
			display: inline-flex;
			align-items: center;
			gap: 4px;
		}
		.retold-remote-iex-info-label
		{
			color: var(--retold-text-muted);
		}
		.retold-remote-iex-info-value
		{
			color: var(--retold-text-secondary);
		}
		.retold-remote-iex-body
		{
			flex: 1;
			position: relative;
			overflow: hidden;
			background: var(--retold-bg-primary);
		}
		#RetoldRemote-IEX-Viewer
		{
			width: 100%;
			height: 100%;
		}
		.retold-remote-iex-loading
		{
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			height: 100%;
			color: var(--retold-text-dim);
			font-size: 0.85rem;
			gap: 12px;
		}
		.retold-remote-iex-error
		{
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			height: 100%;
			gap: 16px;
			padding: 20px;
		}
		.retold-remote-iex-error-message
		{
			color: var(--retold-text-muted);
			font-size: 0.85rem;
			text-align: center;
		}
		.retold-remote-iex-controls
		{
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 16px;
			background: var(--retold-bg-secondary);
			border-top: 1px solid var(--retold-border);
			flex-shrink: 0;
			font-size: 0.75rem;
			color: var(--retold-text-dim);
		}
		.retold-remote-iex-controls button
		{
			padding: 3px 8px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.75rem;
			cursor: pointer;
			font-family: inherit;
			transition: color 0.15s, border-color 0.15s;
		}
		.retold-remote-iex-controls button:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
		.retold-remote-iex-zoom-label
		{
			min-width: 40px;
			text-align: center;
			color: var(--retold-text-secondary);
		}
	`
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
		this._currentPath = pFilePath;
		this._dziData = null;

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

		// Update URL hash
		let tmpFragProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpFragId = tmpFragProvider ? tmpFragProvider.getFragmentIdentifier(pFilePath) : pFilePath;
		window.location.hash = '#/explore-image/' + tmpFragId;

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
		this._ensureOSDLoaded(() =>
		{
			this._probeAndShow(pFilePath);
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
					tmpSelf._showSimpleImage(pFilePath);
					return;
				}

				let tmpLongest = Math.max(pResult.OrigWidth || 0, pResult.OrigHeight || 0);

				if (tmpLongest > 4096)
				{
					// Large image — use DZI tiles for efficient pan+zoom
					tmpSelf._generateAndShowTiles(pFilePath, tmpPathParam);
				}
				else
				{
					// Regular image — use simple image source (no tile generation)
					tmpSelf._dziData = { Width: pResult.OrigWidth, Height: pResult.OrigHeight };
					tmpSelf._showSimpleImageInfo(pResult.OrigWidth, pResult.OrigHeight);
					tmpSelf._initSimpleViewer(pFilePath);
				}
			})
			.catch(() =>
			{
				// Probe failed — fall back to simple image source
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
	 * @param {string} pFilePath  - Relative file path
	 * @param {string} pPathParam - URL-encoded path parameter
	 */
	_initSimpleViewer(pFilePath)
	{
		let tmpLoading = document.getElementById('RetoldRemote-IEX-Loading');
		let tmpViewerDiv = document.getElementById('RetoldRemote-IEX-Viewer');
		let tmpControls = document.getElementById('RetoldRemote-IEX-Controls');

		if (tmpLoading) tmpLoading.style.display = 'none';
		if (tmpViewerDiv) tmpViewerDiv.style.display = 'block';
		if (tmpControls) tmpControls.style.display = '';

		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpContentURL = tmpProvider ? tmpProvider.getContentURL(pFilePath) : ('/content/' + encodeURIComponent(pFilePath));

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
	 * Request DZI tile generation from the server, then initialize the viewer.
	 *
	 * @param {string} pFilePath  - Relative file path
	 * @param {string} pPathParam - URL-encoded path parameter
	 */
	_generateAndShowTiles(pFilePath, pPathParam)
	{
		let tmpSelf = this;

		fetch('/api/media/dzi?path=' + pPathParam)
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				if (!pResult || !pResult.Success)
				{
					tmpSelf._showError(pResult ? pResult.Error : 'DZI generation failed.');
					return;
				}

				tmpSelf._dziData = pResult;
				tmpSelf._showInfo(pResult);
				tmpSelf._initViewer(pResult);
			})
			.catch((pError) =>
			{
				tmpSelf._showError('Failed to generate tiles: ' + pError.message);
			});
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

	/**
	 * Navigate back to the image viewer.
	 */
	goBack()
	{
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

		if (this._currentPath)
		{
			let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
			if (tmpViewer)
			{
				tmpViewer.showMedia(this._currentPath, 'image');
			}
		}
		else
		{
			let tmpNav = this.pict.providers['RetoldRemote-GalleryNavigation'];
			if (tmpNav)
			{
				tmpNav.closeViewer();
			}
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
