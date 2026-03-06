const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-AudioExplorer",
	DefaultRenderable: "RetoldRemote-AudioExplorer",
	DefaultDestinationAddress: "#RetoldRemote-Viewer-Container",
	AutoRender: false,

	CSS: ``
};

class RetoldRemoteAudioExplorerView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._currentPath = '';
		this._waveformData = null;
		this._peaks = [];

		// View state
		this._viewStart = 0;    // Start of visible range (0..1)
		this._viewEnd = 1;      // End of visible range (0..1)
		this._minZoom = 0.005;  // Minimum visible range (0.5% of total)

		// Selection state
		this._selectionStart = -1;  // Selection start (0..1), -1 = none
		this._selectionEnd = -1;
		this._isDragging = false;
		this._dragStart = -1;

		// Cursor position
		this._cursorX = -1;

		// Playback
		this._segmentURL = null;

		// Canvas refs
		this._mainCanvas = null;
		this._overviewCanvas = null;
		this._resizeObserver = null;
	}

	/**
	 * Show the audio explorer for a given audio file.
	 *
	 * @param {string} pFilePath - Relative file path
	 */
	/**
	 * Show the audio explorer for a given file.
	 *
	 * @param {string} pFilePath - Relative file path
	 * @param {number} [pSelectionStart] - Optional selection start in seconds
	 * @param {number} [pSelectionEnd] - Optional selection end in seconds
	 */
	showExplorer(pFilePath, pSelectionStart, pSelectionEnd)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ActiveMode = 'audio-explorer';
		this._currentPath = pFilePath;
		this._waveformData = null;
		this._peaks = [];
		this._viewStart = 0;
		this._viewEnd = 1;
		this._segmentURL = null;

		// Store passed-in selection times (in seconds) to apply after waveform loads
		this._pendingSelectionStartSec = (typeof pSelectionStart === 'number' && pSelectionStart >= 0) ? pSelectionStart : -1;
		this._pendingSelectionEndSec = (typeof pSelectionEnd === 'number' && pSelectionEnd >= 0) ? pSelectionEnd : -1;

		this._selectionStart = -1;
		this._selectionEnd = -1;

		// Update the hash.  Replace (not push) when coming from #/view/ to
		// prevent back-button loops when auto-launched from the media viewer.
		let tmpFragProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpFragId = tmpFragProvider ? tmpFragProvider.getFragmentIdentifier(pFilePath) : pFilePath;
		let tmpNewHash = '#/explore-audio/' + tmpFragId;
		let tmpCurrentHash = window.location.hash || '';
		if (tmpCurrentHash.indexOf('#/view/') === 0)
		{
			history.replaceState(null, '', tmpNewHash);
		}
		else
		{
			window.location.hash = tmpNewHash;
		}

		// Show viewer container, hide gallery
		let tmpGalleryContainer = document.getElementById('RetoldRemote-Gallery-Container');
		let tmpViewerContainer = document.getElementById('RetoldRemote-Viewer-Container');

		if (tmpGalleryContainer) tmpGalleryContainer.style.display = 'none';
		if (tmpViewerContainer) tmpViewerContainer.style.display = 'block';

		let tmpFileName = pFilePath.replace(/^.*\//, '');

		// Build initial UI
		let tmpHTML = '<div class="retold-remote-aex">';

		// Header
		tmpHTML += '<div class="retold-remote-aex-header">';
		tmpHTML += '<button class="retold-remote-aex-nav-btn" onclick="pict.views[\'RetoldRemote-AudioExplorer\'].goBack()" title="Back to audio (Esc)">&larr; Back</button>';
		tmpHTML += '<div class="retold-remote-aex-title">Audio Explorer &mdash; ' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpFileName) + '</div>';
		tmpHTML += '</div>';

		// Info bar (populated after waveform loads)
		tmpHTML += '<div class="retold-remote-aex-info" id="RetoldRemote-AEX-Info" style="display:none;"></div>';

		// Controls bar
		tmpHTML += '<div class="retold-remote-aex-controls" id="RetoldRemote-AEX-Controls" style="display:none;">';
		tmpHTML += '<button class="retold-remote-aex-btn" onclick="pict.views[\'RetoldRemote-AudioExplorer\'].zoomIn()" title="Zoom In (+)">+ Zoom In</button>';
		tmpHTML += '<button class="retold-remote-aex-btn" onclick="pict.views[\'RetoldRemote-AudioExplorer\'].zoomOut()" title="Zoom Out (-)">- Zoom Out</button>';
		tmpHTML += '<button class="retold-remote-aex-btn" onclick="pict.views[\'RetoldRemote-AudioExplorer\'].zoomToFit()" title="Zoom to Fit (0)">Fit All</button>';
		tmpHTML += '<button class="retold-remote-aex-btn" id="RetoldRemote-AEX-ZoomSelBtn" onclick="pict.views[\'RetoldRemote-AudioExplorer\'].zoomToSelection()" title="Zoom to Selection (Z)" disabled>Zoom to Selection</button>';
		tmpHTML += '<button class="retold-remote-aex-btn" id="RetoldRemote-AEX-PlaySelBtn" onclick="pict.views[\'RetoldRemote-AudioExplorer\'].playSelection()" title="Play Selection (Space)" disabled>&#9654; Play Selection</button>';
		tmpHTML += '<button class="retold-remote-aex-btn" onclick="pict.views[\'RetoldRemote-AudioExplorer\'].clearSelection()" title="Clear Selection (Esc)">Clear Selection</button>';
		tmpHTML += '<span style="border-left:1px solid var(--retold-border);height:20px;margin:0 4px;"></span>';
		tmpHTML += '<button class="retold-remote-aex-save-btn" id="RetoldRemote-AEX-SaveSelBtn" onclick="pict.views[\'RetoldRemote-AudioExplorer\'].saveSelectionToCollection()" title="Save segment to collection (s)" disabled>Save Segment</button>';
		tmpHTML += '</div>';

		// Body (loading initially)
		tmpHTML += '<div class="retold-remote-aex-body" id="RetoldRemote-AEX-Body">';
		tmpHTML += '<div class="retold-remote-aex-loading">';
		tmpHTML += '<div class="retold-remote-aex-loading-spinner"></div>';
		tmpHTML += 'Analyzing audio waveform...';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		// Time display bar
		tmpHTML += '<div class="retold-remote-aex-time-bar" id="RetoldRemote-AEX-TimeBar" style="display:none;">';
		tmpHTML += '<span class="retold-remote-aex-time-label">View:</span>';
		tmpHTML += '<span class="retold-remote-aex-time-value" id="RetoldRemote-AEX-ViewRange">--</span>';
		tmpHTML += '<span class="retold-remote-aex-time-label" style="margin-left: 12px;">Selection:</span>';
		tmpHTML += '<span class="retold-remote-aex-time-selection" id="RetoldRemote-AEX-SelectionRange">None</span>';
		tmpHTML += '<span class="retold-remote-aex-time-label" style="margin-left: 12px;">Cursor:</span>';
		tmpHTML += '<span class="retold-remote-aex-time-value" id="RetoldRemote-AEX-CursorTime">--</span>';
		tmpHTML += '</div>';

		// Playback bar
		tmpHTML += '<div class="retold-remote-aex-playback" id="RetoldRemote-AEX-Playback" style="display:none;">';
		tmpHTML += '<span class="retold-remote-aex-playback-label">Segment:</span>';
		tmpHTML += '<audio controls id="RetoldRemote-AEX-Audio"></audio>';
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

		// Fetch waveform
		this._fetchWaveform(pFilePath);
	}

	/**
	 * Fetch waveform data from the server.
	 *
	 * @param {string} pFilePath - Relative file path
	 */
	_fetchWaveform(pFilePath)
	{
		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

		let tmpURL = '/api/media/audio-waveform?path=' + tmpPathParam + '&peaks=2000';

		fetch(tmpURL)
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				if (!pData || !pData.Success)
				{
					tmpSelf._showError(pData ? pData.Error : 'Unknown error');
					return;
				}

				tmpSelf._waveformData = pData;
				tmpSelf._peaks = pData.Peaks || [];
				tmpSelf._renderWaveformUI();
			})
			.catch((pError) =>
			{
				tmpSelf._showError(pError.message);
			});
	}

	/**
	 * Render the waveform UI after data is loaded.
	 */
	_renderWaveformUI()
	{
		let tmpData = this._waveformData;
		if (!tmpData)
		{
			return;
		}

		// Populate info bar
		let tmpInfoBar = document.getElementById('RetoldRemote-AEX-Info');
		if (tmpInfoBar)
		{
			let tmpInfoHTML = '';
			tmpInfoHTML += '<span class="retold-remote-aex-info-item"><span class="retold-remote-aex-info-label">Duration</span> <span class="retold-remote-aex-info-value">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpData.DurationFormatted) + '</span></span>';
			if (tmpData.SampleRate)
			{
				tmpInfoHTML += '<span class="retold-remote-aex-info-item"><span class="retold-remote-aex-info-label">Sample Rate</span> <span class="retold-remote-aex-info-value">' + (tmpData.SampleRate / 1000).toFixed(1) + ' kHz</span></span>';
			}
			if (tmpData.Channels)
			{
				tmpInfoHTML += '<span class="retold-remote-aex-info-item"><span class="retold-remote-aex-info-label">Channels</span> <span class="retold-remote-aex-info-value">' + tmpData.Channels + (tmpData.ChannelLayout ? ' (' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpData.ChannelLayout) + ')' : '') + '</span></span>';
			}
			if (tmpData.Codec)
			{
				tmpInfoHTML += '<span class="retold-remote-aex-info-item"><span class="retold-remote-aex-info-label">Codec</span> <span class="retold-remote-aex-info-value">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpData.Codec) + '</span></span>';
			}
			if (tmpData.Bitrate)
			{
				tmpInfoHTML += '<span class="retold-remote-aex-info-item"><span class="retold-remote-aex-info-label">Bitrate</span> <span class="retold-remote-aex-info-value">' + Math.round(tmpData.Bitrate / 1000) + ' kbps</span></span>';
			}
			if (tmpData.FileSize)
			{
				tmpInfoHTML += '<span class="retold-remote-aex-info-item"><span class="retold-remote-aex-info-label">Size</span> <span class="retold-remote-aex-info-value">' + this.pict.providers['RetoldRemote-FormattingUtilities'].formatFileSize(tmpData.FileSize) + '</span></span>';
			}
			tmpInfoHTML += '<span class="retold-remote-aex-info-item"><span class="retold-remote-aex-info-label">Peaks</span> <span class="retold-remote-aex-info-value">' + tmpData.PeakCount + ' (' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpData.Method) + ')</span></span>';

			tmpInfoBar.innerHTML = tmpInfoHTML;
			tmpInfoBar.style.display = '';
		}

		// Show controls
		let tmpControlsBar = document.getElementById('RetoldRemote-AEX-Controls');
		if (tmpControlsBar)
		{
			tmpControlsBar.style.display = '';
		}

		// Show time bar
		let tmpTimeBar = document.getElementById('RetoldRemote-AEX-TimeBar');
		if (tmpTimeBar)
		{
			tmpTimeBar.style.display = '';
		}

		// Build the canvas-based waveform body
		let tmpBody = document.getElementById('RetoldRemote-AEX-Body');
		if (tmpBody)
		{
			let tmpBodyHTML = '';

			// Main waveform canvas
			tmpBodyHTML += '<div class="retold-remote-aex-canvas-wrap" id="RetoldRemote-AEX-CanvasWrap">';
			tmpBodyHTML += '<canvas id="RetoldRemote-AEX-MainCanvas"></canvas>';
			tmpBodyHTML += '</div>';

			// Overview canvas
			tmpBodyHTML += '<div class="retold-remote-aex-overview-wrap" id="RetoldRemote-AEX-OverviewWrap">';
			tmpBodyHTML += '<canvas id="RetoldRemote-AEX-OverviewCanvas"></canvas>';
			tmpBodyHTML += '<div class="retold-remote-aex-overview-viewport" id="RetoldRemote-AEX-OverviewViewport"></div>';
			tmpBodyHTML += '</div>';

			tmpBody.innerHTML = tmpBodyHTML;
		}

		// Set up canvases
		this._mainCanvas = document.getElementById('RetoldRemote-AEX-MainCanvas');
		this._overviewCanvas = document.getElementById('RetoldRemote-AEX-OverviewCanvas');

		// Bind interactions
		this._bindCanvasEvents();

		// Initial draw
		this._resizeCanvases();
		this._drawAll();
		this._updateTimeDisplay();

		// Set up resize observer
		let tmpSelf = this;
		if (typeof ResizeObserver !== 'undefined')
		{
			this._resizeObserver = new ResizeObserver(() =>
			{
				tmpSelf._resizeCanvases();
				tmpSelf._drawAll();
			});
			let tmpWrap = document.getElementById('RetoldRemote-AEX-CanvasWrap');
			if (tmpWrap)
			{
				this._resizeObserver.observe(tmpWrap);
			}
		}

		// Load saved selection/view state
		this._loadSavedState();
	}

	/**
	 * Resize canvases to match their container's pixel dimensions.
	 */
	_resizeCanvases()
	{
		if (this._mainCanvas)
		{
			let tmpWrap = this._mainCanvas.parentElement;
			if (tmpWrap)
			{
				let tmpDPR = window.devicePixelRatio || 1;
				this._mainCanvas.width = tmpWrap.clientWidth * tmpDPR;
				this._mainCanvas.height = tmpWrap.clientHeight * tmpDPR;
			}
		}

		if (this._overviewCanvas)
		{
			let tmpWrap = this._overviewCanvas.parentElement;
			if (tmpWrap)
			{
				let tmpDPR = window.devicePixelRatio || 1;
				this._overviewCanvas.width = tmpWrap.clientWidth * tmpDPR;
				this._overviewCanvas.height = tmpWrap.clientHeight * tmpDPR;
			}
		}
	}

	/**
	 * Draw both main and overview canvases.
	 */
	_drawAll()
	{
		this._drawMainWaveform();
		this._drawOverviewWaveform();
		this._updateOverviewViewport();
	}

	/**
	 * Draw the main (zoomed) waveform canvas.
	 */
	_drawMainWaveform()
	{
		if (!this._mainCanvas || this._peaks.length === 0)
		{
			return;
		}

		let tmpCtx = this._mainCanvas.getContext('2d');
		let tmpW = this._mainCanvas.width;
		let tmpH = this._mainCanvas.height;
		let tmpDPR = window.devicePixelRatio || 1;

		tmpCtx.clearRect(0, 0, tmpW, tmpH);

		// Background
		let tmpBgColor = getComputedStyle(document.documentElement).getPropertyValue('--retold-bg-primary').trim() || '#1e1e2e';
		tmpCtx.fillStyle = tmpBgColor;
		tmpCtx.fillRect(0, 0, tmpW, tmpH);

		let tmpPeaks = this._peaks;
		let tmpTotalPeaks = tmpPeaks.length;
		let tmpStartIdx = Math.floor(this._viewStart * tmpTotalPeaks);
		let tmpEndIdx = Math.ceil(this._viewEnd * tmpTotalPeaks);
		let tmpVisiblePeaks = tmpEndIdx - tmpStartIdx;

		if (tmpVisiblePeaks <= 0)
		{
			return;
		}

		let tmpMidY = tmpH / 2;

		// Draw selection background
		if (this._selectionStart >= 0 && this._selectionEnd >= 0)
		{
			let tmpSelStartNorm = Math.min(this._selectionStart, this._selectionEnd);
			let tmpSelEndNorm = Math.max(this._selectionStart, this._selectionEnd);

			// Convert selection (0..1) to pixel coordinates within the view
			let tmpViewRange = this._viewEnd - this._viewStart;
			let tmpSelStartPx = ((tmpSelStartNorm - this._viewStart) / tmpViewRange) * tmpW;
			let tmpSelEndPx = ((tmpSelEndNorm - this._viewStart) / tmpViewRange) * tmpW;

			tmpSelStartPx = Math.max(0, tmpSelStartPx);
			tmpSelEndPx = Math.min(tmpW, tmpSelEndPx);

			if (tmpSelEndPx > tmpSelStartPx)
			{
				let tmpAccent = getComputedStyle(document.documentElement).getPropertyValue('--retold-accent').trim() || '#89b4fa';
				tmpCtx.fillStyle = tmpAccent + '22';
				tmpCtx.fillRect(tmpSelStartPx, 0, tmpSelEndPx - tmpSelStartPx, tmpH);

				// Selection edges
				tmpCtx.strokeStyle = tmpAccent;
				tmpCtx.lineWidth = 2 * tmpDPR;
				tmpCtx.beginPath();
				tmpCtx.moveTo(tmpSelStartPx, 0);
				tmpCtx.lineTo(tmpSelStartPx, tmpH);
				tmpCtx.stroke();
				tmpCtx.beginPath();
				tmpCtx.moveTo(tmpSelEndPx, 0);
				tmpCtx.lineTo(tmpSelEndPx, tmpH);
				tmpCtx.stroke();
			}
		}

		// Draw center line
		let tmpDimColor = getComputedStyle(document.documentElement).getPropertyValue('--retold-text-dim').trim() || '#585b70';
		tmpCtx.strokeStyle = tmpDimColor;
		tmpCtx.lineWidth = 1;
		tmpCtx.setLineDash([4, 4]);
		tmpCtx.beginPath();
		tmpCtx.moveTo(0, tmpMidY);
		tmpCtx.lineTo(tmpW, tmpMidY);
		tmpCtx.stroke();
		tmpCtx.setLineDash([]);

		// Draw waveform
		let tmpAccentColor = getComputedStyle(document.documentElement).getPropertyValue('--retold-accent').trim() || '#89b4fa';
		let tmpSecondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--retold-text-secondary').trim() || '#cdd6f4';

		// For each pixel column, find the min/max across the peaks that map to it
		for (let x = 0; x < tmpW; x++)
		{
			let tmpPeakStartF = tmpStartIdx + (x / tmpW) * tmpVisiblePeaks;
			let tmpPeakEndF = tmpStartIdx + ((x + 1) / tmpW) * tmpVisiblePeaks;
			let tmpPStart = Math.floor(tmpPeakStartF);
			let tmpPEnd = Math.ceil(tmpPeakEndF);
			tmpPStart = Math.max(0, Math.min(tmpPStart, tmpTotalPeaks - 1));
			tmpPEnd = Math.max(tmpPStart + 1, Math.min(tmpPEnd, tmpTotalPeaks));

			let tmpMin = 0;
			let tmpMax = 0;
			for (let p = tmpPStart; p < tmpPEnd; p++)
			{
				if (tmpPeaks[p].Min < tmpMin) tmpMin = tmpPeaks[p].Min;
				if (tmpPeaks[p].Max > tmpMax) tmpMax = tmpPeaks[p].Max;
			}

			let tmpTopY = tmpMidY - (tmpMax * tmpMidY * 0.9);
			let tmpBottomY = tmpMidY - (tmpMin * tmpMidY * 0.9);
			let tmpBarHeight = Math.max(1, tmpBottomY - tmpTopY);

			// Check if this pixel column is in the selection
			let tmpNormPos = this._viewStart + (x / tmpW) * (this._viewEnd - this._viewStart);
			let tmpInSelection = false;
			if (this._selectionStart >= 0 && this._selectionEnd >= 0)
			{
				let tmpSelMin = Math.min(this._selectionStart, this._selectionEnd);
				let tmpSelMax = Math.max(this._selectionStart, this._selectionEnd);
				tmpInSelection = (tmpNormPos >= tmpSelMin && tmpNormPos <= tmpSelMax);
			}

			tmpCtx.fillStyle = tmpInSelection ? tmpAccentColor : tmpSecondaryColor;
			tmpCtx.fillRect(x, tmpTopY, 1, tmpBarHeight);
		}

		// Draw cursor
		if (this._cursorX >= 0 && this._cursorX < tmpW)
		{
			tmpCtx.strokeStyle = '#ffffff44';
			tmpCtx.lineWidth = 1;
			tmpCtx.beginPath();
			tmpCtx.moveTo(this._cursorX * tmpDPR, 0);
			tmpCtx.lineTo(this._cursorX * tmpDPR, tmpH);
			tmpCtx.stroke();
		}
	}

	/**
	 * Draw the overview (full waveform) canvas.
	 */
	_drawOverviewWaveform()
	{
		if (!this._overviewCanvas || this._peaks.length === 0)
		{
			return;
		}

		let tmpCtx = this._overviewCanvas.getContext('2d');
		let tmpW = this._overviewCanvas.width;
		let tmpH = this._overviewCanvas.height;

		tmpCtx.clearRect(0, 0, tmpW, tmpH);

		let tmpBgColor = getComputedStyle(document.documentElement).getPropertyValue('--retold-bg-tertiary').trim() || '#313244';
		tmpCtx.fillStyle = tmpBgColor;
		tmpCtx.fillRect(0, 0, tmpW, tmpH);

		let tmpPeaks = this._peaks;
		let tmpTotalPeaks = tmpPeaks.length;
		let tmpMidY = tmpH / 2;
		let tmpSecondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--retold-text-muted').trim() || '#a6adc8';

		// Draw selection in overview
		if (this._selectionStart >= 0 && this._selectionEnd >= 0)
		{
			let tmpSelStartNorm = Math.min(this._selectionStart, this._selectionEnd);
			let tmpSelEndNorm = Math.max(this._selectionStart, this._selectionEnd);
			let tmpAccent = getComputedStyle(document.documentElement).getPropertyValue('--retold-accent').trim() || '#89b4fa';

			tmpCtx.fillStyle = tmpAccent + '33';
			tmpCtx.fillRect(tmpSelStartNorm * tmpW, 0, (tmpSelEndNorm - tmpSelStartNorm) * tmpW, tmpH);
		}

		for (let x = 0; x < tmpW; x++)
		{
			let tmpPeakStartF = (x / tmpW) * tmpTotalPeaks;
			let tmpPeakEndF = ((x + 1) / tmpW) * tmpTotalPeaks;
			let tmpPStart = Math.floor(tmpPeakStartF);
			let tmpPEnd = Math.ceil(tmpPeakEndF);
			tmpPStart = Math.max(0, Math.min(tmpPStart, tmpTotalPeaks - 1));
			tmpPEnd = Math.max(tmpPStart + 1, Math.min(tmpPEnd, tmpTotalPeaks));

			let tmpMin = 0;
			let tmpMax = 0;
			for (let p = tmpPStart; p < tmpPEnd; p++)
			{
				if (tmpPeaks[p].Min < tmpMin) tmpMin = tmpPeaks[p].Min;
				if (tmpPeaks[p].Max > tmpMax) tmpMax = tmpPeaks[p].Max;
			}

			let tmpTopY = tmpMidY - (tmpMax * tmpMidY * 0.85);
			let tmpBottomY = tmpMidY - (tmpMin * tmpMidY * 0.85);
			let tmpBarHeight = Math.max(1, tmpBottomY - tmpTopY);

			tmpCtx.fillStyle = tmpSecondaryColor;
			tmpCtx.fillRect(x, tmpTopY, 1, tmpBarHeight);
		}
	}

	/**
	 * Update the overview viewport indicator position.
	 */
	_updateOverviewViewport()
	{
		let tmpViewport = document.getElementById('RetoldRemote-AEX-OverviewViewport');
		if (!tmpViewport)
		{
			return;
		}

		let tmpWrap = document.getElementById('RetoldRemote-AEX-OverviewWrap');
		if (!tmpWrap)
		{
			return;
		}

		let tmpWidth = tmpWrap.clientWidth;
		let tmpLeft = this._viewStart * tmpWidth;
		let tmpRight = this._viewEnd * tmpWidth;

		tmpViewport.style.left = tmpLeft + 'px';
		tmpViewport.style.width = (tmpRight - tmpLeft) + 'px';
	}

	/**
	 * Bind mouse/touch events to the main canvas for interaction.
	 */
	_bindCanvasEvents()
	{
		let tmpSelf = this;
		let tmpWrap = document.getElementById('RetoldRemote-AEX-CanvasWrap');
		if (!tmpWrap)
		{
			return;
		}

		// Mouse move for cursor display
		tmpWrap.addEventListener('mousemove', (pEvent) =>
		{
			let tmpRect = tmpWrap.getBoundingClientRect();
			tmpSelf._cursorX = pEvent.clientX - tmpRect.left;

			if (tmpSelf._isDragging)
			{
				let tmpNorm = tmpSelf._viewStart + (tmpSelf._cursorX / tmpRect.width) * (tmpSelf._viewEnd - tmpSelf._viewStart);
				tmpNorm = Math.max(0, Math.min(1, tmpNorm));
				tmpSelf._selectionEnd = tmpNorm;
				tmpSelf._drawMainWaveform();
				tmpSelf._drawOverviewWaveform();
				tmpSelf._updateSelectionButtons();
			}

			tmpSelf._updateTimeDisplay();
			// Lightweight cursor redraw
			tmpSelf._drawMainWaveform();
		});

		tmpWrap.addEventListener('mouseleave', () =>
		{
			tmpSelf._cursorX = -1;
			tmpSelf._drawMainWaveform();
		});

		// Mouse down: start selection drag
		tmpWrap.addEventListener('mousedown', (pEvent) =>
		{
			if (pEvent.button !== 0)
			{
				return;
			}
			let tmpRect = tmpWrap.getBoundingClientRect();
			let tmpNorm = tmpSelf._viewStart + ((pEvent.clientX - tmpRect.left) / tmpRect.width) * (tmpSelf._viewEnd - tmpSelf._viewStart);
			tmpNorm = Math.max(0, Math.min(1, tmpNorm));

			tmpSelf._isDragging = true;
			tmpSelf._selectionStart = tmpNorm;
			tmpSelf._selectionEnd = tmpNorm;
			tmpSelf._dragStart = tmpNorm;
			tmpSelf._segmentURL = null;
			let tmpPlaybackBar = document.getElementById('RetoldRemote-AEX-Playback');
			if (tmpPlaybackBar)
			{
				tmpPlaybackBar.style.display = 'none';
			}
		});

		// Mouse up: end selection drag
		window.addEventListener('mouseup', () =>
		{
			if (tmpSelf._isDragging)
			{
				tmpSelf._isDragging = false;
				// If selection is too small, clear it
				if (Math.abs(tmpSelf._selectionEnd - tmpSelf._selectionStart) < 0.001)
				{
					tmpSelf._selectionStart = -1;
					tmpSelf._selectionEnd = -1;
				}
				tmpSelf._updateSelectionButtons();
				tmpSelf._drawAll();
				tmpSelf._updateTimeDisplay();
				// Persist selection state
				tmpSelf._saveState();
			}
		});

		// Mouse wheel: zoom
		tmpWrap.addEventListener('wheel', (pEvent) =>
		{
			pEvent.preventDefault();
			let tmpRect = tmpWrap.getBoundingClientRect();
			let tmpMouseNorm = (pEvent.clientX - tmpRect.left) / tmpRect.width;

			let tmpZoomFactor = pEvent.deltaY > 0 ? 1.2 : 0.8;
			tmpSelf._zoomAtPoint(tmpMouseNorm, tmpZoomFactor);
		}, { passive: false });

		// Overview click: pan to position
		let tmpOverviewWrap = document.getElementById('RetoldRemote-AEX-OverviewWrap');
		if (tmpOverviewWrap)
		{
			tmpOverviewWrap.addEventListener('click', (pEvent) =>
			{
				let tmpRect = tmpOverviewWrap.getBoundingClientRect();
				let tmpClickNorm = (pEvent.clientX - tmpRect.left) / tmpRect.width;
				tmpClickNorm = Math.max(0, Math.min(1, tmpClickNorm));

				let tmpViewRange = tmpSelf._viewEnd - tmpSelf._viewStart;
				let tmpNewStart = tmpClickNorm - tmpViewRange / 2;
				tmpNewStart = Math.max(0, Math.min(1 - tmpViewRange, tmpNewStart));

				tmpSelf._viewStart = tmpNewStart;
				tmpSelf._viewEnd = tmpNewStart + tmpViewRange;

				tmpSelf._drawAll();
				tmpSelf._updateTimeDisplay();
			});
		}
	}

	/**
	 * Zoom in/out centered on a normalized position within the current view.
	 *
	 * @param {number} pCenterNorm - Position within current view (0..1)
	 * @param {number} pFactor - Zoom factor (< 1 = zoom in, > 1 = zoom out)
	 */
	_zoomAtPoint(pCenterNorm, pFactor)
	{
		let tmpViewRange = this._viewEnd - this._viewStart;
		let tmpCenter = this._viewStart + pCenterNorm * tmpViewRange;

		let tmpNewRange = tmpViewRange * pFactor;
		tmpNewRange = Math.max(this._minZoom, Math.min(1, tmpNewRange));

		let tmpNewStart = tmpCenter - pCenterNorm * tmpNewRange;
		let tmpNewEnd = tmpNewStart + tmpNewRange;

		// Clamp to 0..1
		if (tmpNewStart < 0)
		{
			tmpNewStart = 0;
			tmpNewEnd = tmpNewRange;
		}
		if (tmpNewEnd > 1)
		{
			tmpNewEnd = 1;
			tmpNewStart = 1 - tmpNewRange;
		}

		this._viewStart = Math.max(0, tmpNewStart);
		this._viewEnd = Math.min(1, tmpNewEnd);

		this._drawAll();
		this._updateTimeDisplay();
	}

	/**
	 * Update the time display bar with current view/selection/cursor info.
	 */
	_updateTimeDisplay()
	{
		if (!this._waveformData)
		{
			return;
		}

		let tmpDuration = this._waveformData.Duration;

		// View range
		let tmpViewRangeEl = document.getElementById('RetoldRemote-AEX-ViewRange');
		if (tmpViewRangeEl)
		{
			let tmpViewStartTime = this._viewStart * tmpDuration;
			let tmpViewEndTime = this._viewEnd * tmpDuration;
			tmpViewRangeEl.textContent = this.pict.providers['RetoldRemote-FormattingUtilities'].formatTimestamp(tmpViewStartTime, true) + ' - ' + this.pict.providers['RetoldRemote-FormattingUtilities'].formatTimestamp(tmpViewEndTime, true);
		}

		// Selection
		let tmpSelRangeEl = document.getElementById('RetoldRemote-AEX-SelectionRange');
		if (tmpSelRangeEl)
		{
			if (this._selectionStart >= 0 && this._selectionEnd >= 0)
			{
				let tmpSelMin = Math.min(this._selectionStart, this._selectionEnd) * tmpDuration;
				let tmpSelMax = Math.max(this._selectionStart, this._selectionEnd) * tmpDuration;
				let tmpSelDur = tmpSelMax - tmpSelMin;
				tmpSelRangeEl.textContent = this.pict.providers['RetoldRemote-FormattingUtilities'].formatTimestamp(tmpSelMin, true) + ' - ' + this.pict.providers['RetoldRemote-FormattingUtilities'].formatTimestamp(tmpSelMax, true) + ' (' + this.pict.providers['RetoldRemote-FormattingUtilities'].formatTimestamp(tmpSelDur, true) + ')';
			}
			else
			{
				tmpSelRangeEl.textContent = 'None';
			}
		}

		// Cursor
		let tmpCursorEl = document.getElementById('RetoldRemote-AEX-CursorTime');
		if (tmpCursorEl)
		{
			if (this._cursorX >= 0 && this._mainCanvas)
			{
				let tmpWrap = this._mainCanvas.parentElement;
				if (tmpWrap)
				{
					let tmpNorm = this._viewStart + (this._cursorX / tmpWrap.clientWidth) * (this._viewEnd - this._viewStart);
					tmpCursorEl.textContent = this.pict.providers['RetoldRemote-FormattingUtilities'].formatTimestamp(tmpNorm * tmpDuration, true);
				}
			}
			else
			{
				tmpCursorEl.textContent = '--';
			}
		}
	}

	/**
	 * Update selection-dependent button states.
	 */
	_updateSelectionButtons()
	{
		let tmpHasSelection = (this._selectionStart >= 0 && this._selectionEnd >= 0
			&& Math.abs(this._selectionEnd - this._selectionStart) >= 0.001);

		let tmpZoomSelBtn = document.getElementById('RetoldRemote-AEX-ZoomSelBtn');
		if (tmpZoomSelBtn)
		{
			tmpZoomSelBtn.disabled = !tmpHasSelection;
		}

		let tmpPlaySelBtn = document.getElementById('RetoldRemote-AEX-PlaySelBtn');
		if (tmpPlaySelBtn)
		{
			tmpPlaySelBtn.disabled = !tmpHasSelection;
		}

		let tmpSaveSelBtn = document.getElementById('RetoldRemote-AEX-SaveSelBtn');
		if (tmpSaveSelBtn)
		{
			tmpSaveSelBtn.disabled = !tmpHasSelection;
		}
	}

	// --- User actions ---

	zoomIn()
	{
		this._zoomAtPoint(0.5, 0.5);
	}

	zoomOut()
	{
		this._zoomAtPoint(0.5, 2);
	}

	zoomToFit()
	{
		this._viewStart = 0;
		this._viewEnd = 1;
		this._drawAll();
		this._updateTimeDisplay();
	}

	zoomToSelection()
	{
		if (this._selectionStart < 0 || this._selectionEnd < 0)
		{
			return;
		}

		let tmpMin = Math.min(this._selectionStart, this._selectionEnd);
		let tmpMax = Math.max(this._selectionStart, this._selectionEnd);

		// Add a small margin (5%)
		let tmpRange = tmpMax - tmpMin;
		let tmpMargin = tmpRange * 0.05;
		this._viewStart = Math.max(0, tmpMin - tmpMargin);
		this._viewEnd = Math.min(1, tmpMax + tmpMargin);

		this._drawAll();
		this._updateTimeDisplay();
	}

	clearSelection()
	{
		this._selectionStart = -1;
		this._selectionEnd = -1;
		this._segmentURL = null;

		let tmpPlaybackBar = document.getElementById('RetoldRemote-AEX-Playback');
		if (tmpPlaybackBar)
		{
			tmpPlaybackBar.style.display = 'none';
		}

		this._updateSelectionButtons();
		this._drawAll();
		this._updateTimeDisplay();
		// Persist cleared state
		this._saveState();
	}

	/**
	 * Apply a pending selection that was passed in via showExplorer()
	 * parameters (e.g. when navigating from a collection audio-clip item).
	 * Converts seconds to normalized 0..1 values.
	 */
	_applyPendingSelection()
	{
		if (this._pendingSelectionStartSec < 0 || this._pendingSelectionEndSec < 0)
		{
			return;
		}

		if (!this._waveformData || !this._waveformData.Duration || this._waveformData.Duration <= 0)
		{
			return;
		}

		let tmpDuration = this._waveformData.Duration;
		this._selectionStart = Math.min(this._pendingSelectionStartSec, this._pendingSelectionEndSec) / tmpDuration;
		this._selectionEnd = Math.max(this._pendingSelectionStartSec, this._pendingSelectionEndSec) / tmpDuration;

		// Clamp to 0..1
		this._selectionStart = Math.max(0, Math.min(1, this._selectionStart));
		this._selectionEnd = Math.max(0, Math.min(1, this._selectionEnd));

		// Clear pending values
		this._pendingSelectionStartSec = -1;
		this._pendingSelectionEndSec = -1;
	}

	/**
	 * Save the current selection range as an audio clip to the last-used
	 * collection.  Mirrors the keyboard shortcut (s) behaviour.
	 * If no last-used collection exists, opens the collection picker.
	 */
	saveSelectionToCollection()
	{
		if (this._selectionStart < 0 || this._selectionEnd < 0)
		{
			return;
		}

		let tmpCollMgr = this.pict.providers['RetoldRemote-CollectionManager'];
		if (!tmpCollMgr)
		{
			return;
		}

		let tmpQuickGUID = tmpCollMgr.getQuickAddTargetGUID();
		if (tmpQuickGUID)
		{
			tmpCollMgr.addAudioSnippetToCollection(tmpQuickGUID);
		}
		else
		{
			// Convert normalized selection (0..1) to seconds for the pending context
			let tmpDuration = (this._waveformData && this._waveformData.Duration) ? this._waveformData.Duration : 0;
			let tmpStartSec = Math.round(this._selectionStart * tmpDuration * 100) / 100;
			let tmpEndSec = Math.round(this._selectionEnd * tmpDuration * 100) / 100;
			tmpCollMgr.setPendingClipContext({ Type: 'audio-clip', Start: tmpStartSec, End: tmpEndSec });
			let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
			if (tmpTopBar && typeof tmpTopBar.showAddToCollectionDropdown === 'function')
			{
				tmpTopBar.showAddToCollectionDropdown();
			}
		}
	}

	/**
	 * Request the server to extract and serve the selected audio segment.
	 */
	playSelection()
	{
		if (this._selectionStart < 0 || this._selectionEnd < 0 || !this._waveformData)
		{
			return;
		}

		let tmpSelf = this;
		let tmpDuration = this._waveformData.Duration;
		let tmpStart = Math.min(this._selectionStart, this._selectionEnd) * tmpDuration;
		let tmpEnd = Math.max(this._selectionStart, this._selectionEnd) * tmpDuration;

		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(this._currentPath) : encodeURIComponent(this._currentPath);

		let tmpURL = '/api/media/audio-segment?path=' + tmpPathParam
			+ '&start=' + tmpStart.toFixed(3)
			+ '&end=' + tmpEnd.toFixed(3)
			+ '&format=mp3';

		// Show playback bar with loading state
		let tmpPlaybackBar = document.getElementById('RetoldRemote-AEX-Playback');
		if (tmpPlaybackBar)
		{
			tmpPlaybackBar.style.display = '';
		}

		let tmpAudioEl = document.getElementById('RetoldRemote-AEX-Audio');
		if (tmpAudioEl)
		{
			tmpAudioEl.src = tmpURL;
			tmpAudioEl.load();
			tmpAudioEl.play().catch(() =>
			{
				// Autoplay may be blocked; user can click play
			});
		}

		this._segmentURL = tmpURL;
	}

	/**
	 * Navigate back to the audio player viewer.
	 */
	goBack()
	{
		// Clean up resize observer
		if (this._resizeObserver)
		{
			this._resizeObserver.disconnect();
			this._resizeObserver = null;
		}

		if (this._currentPath)
		{
			let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
			if (tmpViewer)
			{
				tmpViewer.showMedia(this._currentPath, 'audio');
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

	// --- Explorer State Persistence ---

	/**
	 * Fire-and-forget save of the current selection and view state.
	 */
	_saveState()
	{
		if (!this._currentPath || !this._waveformData)
		{
			return;
		}

		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpSelections = [];

		if (this._selectionStart >= 0 && this._selectionEnd >= 0
			&& Math.abs(this._selectionEnd - this._selectionStart) >= 0.001)
		{
			let tmpDuration = this._waveformData.Duration || 0;
			let tmpStartNorm = Math.min(this._selectionStart, this._selectionEnd);
			let tmpEndNorm = Math.max(this._selectionStart, this._selectionEnd);
			let tmpStartSec = Math.round(tmpStartNorm * tmpDuration * 100) / 100;
			let tmpEndSec = Math.round(tmpEndNorm * tmpDuration * 100) / 100;
			let tmpFmt = this.pict.providers['RetoldRemote-FormattingUtilities'];

			tmpSelections.push(
			{
				Start: tmpStartNorm,
				End: tmpEndNorm,
				StartSeconds: tmpStartSec,
				EndSeconds: tmpEndSec,
				Label: tmpFmt.formatTimestamp(tmpStartSec, true) + ' - ' + tmpFmt.formatTimestamp(tmpEndSec, true)
			});
		}

		let tmpBody =
		{
			Path: this._currentPath,
			Selections: tmpSelections,
			ViewStart: this._viewStart,
			ViewEnd: this._viewEnd
		};

		fetch('/api/media/audio-explorer-state',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(tmpBody)
		}).catch(() =>
		{
			// Non-critical — explorer works without persistence
		});
	}

	/**
	 * Load saved state after waveform renders.
	 * Restores selection and view state if available.
	 */
	_loadSavedState()
	{
		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(this._currentPath) : encodeURIComponent(this._currentPath);

		let tmpURL = '/api/media/audio-explorer-state?path=' + tmpPathParam;

		fetch(tmpURL)
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				if (pData && pData.Success && pData.State)
				{
					let tmpState = pData.State;

					// Restore view state
					if (typeof tmpState.ViewStart === 'number' && typeof tmpState.ViewEnd === 'number')
					{
						tmpSelf._viewStart = tmpState.ViewStart;
						tmpSelf._viewEnd = tmpState.ViewEnd;
					}

					// Restore selection (first selection if array)
					if (Array.isArray(tmpState.Selections) && tmpState.Selections.length > 0)
					{
						let tmpSel = tmpState.Selections[0];
						tmpSelf._selectionStart = tmpSel.Start;
						tmpSelf._selectionEnd = tmpSel.End;
					}
				}

				// If we were opened from a collection item with explicit times, apply those
				tmpSelf._applyPendingSelection();

				// Redraw with restored state
				tmpSelf._updateSelectionButtons();
				tmpSelf._drawAll();
				tmpSelf._updateTimeDisplay();
			})
			.catch(() =>
			{
				// Still apply pending selection on network failure
				tmpSelf._applyPendingSelection();
				tmpSelf._updateSelectionButtons();
				tmpSelf._drawAll();
				tmpSelf._updateTimeDisplay();
			});
	}

	/**
	 * Show an error message.
	 *
	 * @param {string} pMessage - Error message
	 */
	_showError(pMessage)
	{
		let tmpBody = document.getElementById('RetoldRemote-AEX-Body');
		if (tmpBody)
		{
			tmpBody.innerHTML = '<div class="retold-remote-aex-error">'
				+ '<div class="retold-remote-aex-error-message">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pMessage || 'An error occurred.') + '</div>'
				+ '<button class="retold-remote-aex-nav-btn" onclick="pict.views[\'RetoldRemote-AudioExplorer\'].goBack()">Back to Audio</button>'
				+ '</div>';
		}
	}

}

RetoldRemoteAudioExplorerView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteAudioExplorerView;
