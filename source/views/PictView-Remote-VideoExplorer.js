const libPictView = require('pict-view');

const _VideoExplorerSelection = require('./VideoExplorer-Selection');
const _VideoExplorerCustomFrames = require('./VideoExplorer-CustomFrames');
const _VideoExplorerPreview = require('./VideoExplorer-Preview');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-VideoExplorer",
	DefaultRenderable: "RetoldRemote-VideoExplorer",
	DefaultDestinationAddress: "#RetoldRemote-Viewer-Container",
	AutoRender: false,

	CSS: ``
};

class RetoldRemoteVideoExplorerView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._currentPath = '';
		this._frameData = null;
		this._selectedFrameIndex = -1;
		this._frameCount = 20;
		this._fullResFrames = true;
		this._customFrames = [];

		// Selection mode and state for timeline range selection
		this._selectionModeActive = false;
		this._selectionStartTime = -1;
		this._selectionEndTime = -1;
		this._isSelectingRange = false;
		this._isDraggingTimeline = false;
		this._draggingHandle = null; // 'start', 'end', or null

		// Cached provider references (resolved lazily)
		this._fmt = null;
		this._provider = null;
	}

	// -----------------------------------------------------------------
	//  Provider / utility accessors
	// -----------------------------------------------------------------

	/**
	 * Get the FormattingUtilities provider (lazy-cached).
	 * @returns {Object} FormattingUtilities provider
	 */
	_getFmt()
	{
		if (!this._fmt)
		{
			this._fmt = this.pict.providers['RetoldRemote-FormattingUtilities'];
		}
		return this._fmt;
	}

	/**
	 * Get the RetoldRemote-Provider (lazy-cached).
	 * @returns {Object} Provider
	 */
	_getProvider()
	{
		if (!this._provider)
		{
			this._provider = this.pict.providers['RetoldRemote-Provider'];
		}
		return this._provider;
	}

	/**
	 * Build a frame image URL from a cache key and filename.
	 *
	 * @param {string} pCacheKey - Cache directory key
	 * @param {string} pFilename - Frame filename
	 * @returns {string} URL path
	 */
	_buildFrameURL(pCacheKey, pFilename)
	{
		return '/api/media/video-frame/' + encodeURIComponent(pCacheKey) + '/' + encodeURIComponent(pFilename);
	}

	/**
	 * Get the encoded path parameter for API calls.
	 *
	 * @param {string} pPath - File path
	 * @returns {string} Encoded path parameter
	 */
	_getPathParam(pPath)
	{
		let tmpProvider = this._getProvider();
		return tmpProvider ? tmpProvider._getPathParam(pPath) : encodeURIComponent(pPath);
	}

	/**
	 * Extract clientX from a mouse or touch event.
	 *
	 * @param {Event} pEvent - MouseEvent or TouchEvent
	 * @returns {number|null} clientX, or null if unavailable
	 */
	_getClientX(pEvent)
	{
		if (pEvent.touches && pEvent.touches.length > 0)
		{
			return pEvent.touches[0].clientX;
		}
		if (pEvent.changedTouches && pEvent.changedTouches.length > 0)
		{
			return pEvent.changedTouches[0].clientX;
		}
		if (typeof pEvent.clientX === 'number')
		{
			return pEvent.clientX;
		}
		return null;
	}

	/**
	 * Convert a mouse/touch event on the timeline bar to a timestamp.
	 *
	 * @param {Event} pEvent - MouseEvent or TouchEvent
	 * @returns {number} Timestamp in seconds, clamped to [0, Duration]
	 */
	_getTimelineTimestamp(pEvent)
	{
		let tmpBar = document.getElementById('RetoldRemote-VEX-TimelineBar');
		if (!tmpBar || !this._frameData || !this._frameData.Duration)
		{
			return 0;
		}

		let tmpRect = tmpBar.getBoundingClientRect();
		let tmpClientX = this._getClientX(pEvent);
		if (tmpClientX === null)
		{
			return 0;
		}

		let tmpPercent = Math.max(0, Math.min(1, (tmpClientX - tmpRect.left) / tmpRect.width));
		return tmpPercent * this._frameData.Duration;
	}

	// -----------------------------------------------------------------
	//  Collection integration
	// -----------------------------------------------------------------

	/**
	 * Save the current selection range as a video clip to the last-used
	 * collection.  Mirrors the keyboard shortcut (s) behaviour.
	 * If no last-used collection exists, opens the collection picker.
	 */
	saveSelectionToCollection()
	{
		if (this._selectionStartTime < 0 || this._selectionEndTime < 0)
		{
			return;
		}

		let tmpStart = Math.min(this._selectionStartTime, this._selectionEndTime);
		let tmpEnd = Math.max(this._selectionStartTime, this._selectionEndTime);

		let tmpCollMgr = this.pict.providers['RetoldRemote-CollectionManager'];
		if (!tmpCollMgr)
		{
			return;
		}

		let tmpQuickGUID = tmpCollMgr.getQuickAddTargetGUID();
		if (tmpQuickGUID)
		{
			tmpCollMgr.addVideoClipToCollection(tmpQuickGUID, tmpStart, tmpEnd);
		}
		else
		{
			// Store the segment data so the dropdown callback can use it
			// instead of falling back to addCurrentFileToCollection
			tmpCollMgr.setPendingClipContext({ Type: 'video-clip', Start: tmpStart, End: tmpEnd });
			let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
			if (tmpTopBar && typeof tmpTopBar.showAddToCollectionDropdown === 'function')
			{
				tmpTopBar.showAddToCollectionDropdown();
			}
		}
	}

	// -----------------------------------------------------------------
	//  Show explorer (main entry point)
	// -----------------------------------------------------------------

	/**
	 * Show the video explorer for a given video file.
	 *
	 * @param {string} pFilePath - Relative file path
	 * @param {number} [pSelectionStart] - Optional selection start time (seconds)
	 * @param {number} [pSelectionEnd] - Optional selection end time (seconds)
	 */
	showExplorer(pFilePath, pSelectionStart, pSelectionEnd)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ActiveMode = 'video-explorer';
		tmpRemote.CurrentViewerFile = pFilePath;
		tmpRemote.CurrentViewerMediaType = 'video';
		this._currentPath = pFilePath;
		this._frameData = null;
		this._selectedFrameIndex = -1;
		this._customFrames = [];
		this._selectionModeActive = false;
		this._isSelectingRange = false;
		this._isDraggingTimeline = false;
		this._draggingHandle = null;

		// Apply passed-in selection range, or reset
		// _selectionFromCaller prevents _loadSavedCustomFrames from
		// overwriting an explicit selection (e.g. when opening a saved clip)
		if (typeof pSelectionStart === 'number' && pSelectionStart >= 0
			&& typeof pSelectionEnd === 'number' && pSelectionEnd >= 0)
		{
			this._selectionStartTime = pSelectionStart;
			this._selectionEndTime = pSelectionEnd;
			this._selectionFromCaller = true;
		}
		else
		{
			this._selectionStartTime = -1;
			this._selectionEndTime = -1;
			this._selectionFromCaller = false;
		}

		// Clean up any window-level event listeners from previous session
		this._cleanupWindowListeners();

		// Update the hash.  Replace (not push) when coming from #/view/ to
		// prevent back-button loops when auto-launched from the media viewer.
		let tmpFragProvider = this._getProvider();
		let tmpFragId = tmpFragProvider ? tmpFragProvider.getFragmentIdentifier(pFilePath) : pFilePath;
		let tmpNewHash = '#/explore/' + tmpFragId;
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

		// Build initial UI with loading state
		let tmpHTML = '<div class="retold-remote-vex">';

		// Header
		let tmpCapabilities = tmpRemote.ServerCapabilities || {};
		tmpHTML += '<div class="retold-remote-vex-header">';
		tmpHTML += '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].goBack()" title="Back (Esc)">&larr; Back</button>';
		tmpHTML += '<div class="retold-remote-vex-title">Video Explorer &mdash; ' + this._getFmt().escapeHTML(tmpFileName) + '</div>';
		tmpHTML += '<div class="retold-remote-vex-actions">';
		tmpHTML += '<button class="retold-remote-vex-action-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].playInBrowser()" title="Play in browser (Space)">&#9654; Play</button>';
		tmpHTML += '<button class="retold-remote-vex-action-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._streamWithVLC()" title="Stream with VLC (v)">&#9654; VLC</button>';
		if (tmpCapabilities.ffmpeg || tmpCapabilities.ffprobe)
		{
			tmpHTML += '<button class="retold-remote-vex-action-btn" onclick="pict.views[\'RetoldRemote-AudioExplorer\'].showExplorer(pict.views[\'RetoldRemote-VideoExplorer\']._currentPath)" title="Explore audio track">&#9835; Audio</button>';
		}
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		// Info bar (populated after frames load)
		tmpHTML += '<div class="retold-remote-vex-info" id="RetoldRemote-VEX-Info" style="display:none;"></div>';

		// Controls bar
		tmpHTML += '<div class="retold-remote-vex-controls" id="RetoldRemote-VEX-Controls" style="display:none;">';
		tmpHTML += '<label>Frames:</label>';
		tmpHTML += '<select id="RetoldRemote-VEX-FrameCount" onchange="pict.views[\'RetoldRemote-VideoExplorer\'].onFrameCountChange(this.value)">';
		tmpHTML += '<option value="10"' + (this._frameCount === 10 ? ' selected' : '') + '>10</option>';
		tmpHTML += '<option value="20"' + (this._frameCount === 20 ? ' selected' : '') + '>20</option>';
		tmpHTML += '<option value="40"' + (this._frameCount === 40 ? ' selected' : '') + '>40</option>';
		tmpHTML += '<option value="60"' + (this._frameCount === 60 ? ' selected' : '') + '>60</option>';
		tmpHTML += '<option value="100"' + (this._frameCount === 100 ? ' selected' : '') + '>100</option>';
		tmpHTML += '</select>';
		tmpHTML += '<label style="display:inline-flex;align-items:center;gap:4px;cursor:pointer;">';
		tmpHTML += '<input type="checkbox" id="RetoldRemote-VEX-FullRes"' + (this._fullResFrames ? ' checked' : '') + ' onchange="pict.views[\'RetoldRemote-VideoExplorer\'].onFullResChange(this.checked)">';
		tmpHTML += 'Full Res Frames</label>';
		tmpHTML += '<button class="retold-remote-vex-refresh-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].refresh()">Refresh</button>';
		tmpHTML += '<span style="border-left:1px solid var(--retold-border);height:20px;margin:0 4px;"></span>';
		tmpHTML += '<button class="retold-remote-vex-select-btn" id="RetoldRemote-VEX-SelectBtn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].toggleSelectionMode()">Select Range</button>';
		tmpHTML += '<span class="retold-remote-vex-selection-info" id="RetoldRemote-VEX-SelectionInfo" style="display:none;"></span>';
		tmpHTML += '<button class="retold-remote-vex-clear-btn" id="RetoldRemote-VEX-ClearBtn" style="display:none;" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].clearSelection()">Clear</button>';
		tmpHTML += '<span id="RetoldRemote-VEX-GenerateControls" style="display:none;">';
		tmpHTML += '<span style="border-left:1px solid var(--retold-border);height:20px;margin:0 2px;"></span>';
		tmpHTML += '<select class="retold-remote-vex-range-frame-select" id="RetoldRemote-VEX-RangeFrameCount">';
		tmpHTML += '<option value="3">3</option>';
		tmpHTML += '<option value="5" selected>5</option>';
		tmpHTML += '<option value="10">10</option>';
		tmpHTML += '<option value="20">20</option>';
		tmpHTML += '</select>';
		tmpHTML += '<button class="retold-remote-vex-generate-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].generateSelectionFrames()">Generate Frames</button>';
		tmpHTML += '<span style="border-left:1px solid var(--retold-border);height:20px;margin:0 2px;"></span>';
		tmpHTML += '<button class="retold-remote-vex-save-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].saveSelectionToCollection()" title="Save segment to collection (s)">Save Segment</button>';
		tmpHTML += '</span>';
		tmpHTML += '</div>';

		// Body (loading initially)
		tmpHTML += '<div class="retold-remote-vex-body" id="RetoldRemote-VEX-Body">';
		tmpHTML += '<div class="retold-remote-vex-loading">';
		tmpHTML += '<div class="retold-remote-vex-loading-spinner"></div>';
		tmpHTML += 'Extracting frames from video...';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		// Timeline bar (populated after frames load)
		tmpHTML += '<div class="retold-remote-vex-timeline" id="RetoldRemote-VEX-Timeline" style="display:none;"></div>';

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

		// Fetch frames
		this._fetchFrames(pFilePath);
	}

	// -----------------------------------------------------------------
	//  Frame data fetching & rendering
	// -----------------------------------------------------------------

	/**
	 * Fetch video frames from the server.
	 *
	 * @param {string} pFilePath - Relative file path
	 */
	_fetchFrames(pFilePath)
	{
		let tmpSelf = this;
		let tmpPathParam = this._getPathParam(pFilePath);

		let tmpURL = '/api/media/video-frames?path=' + tmpPathParam + '&count=' + this._frameCount;
		if (this._fullResFrames)
		{
			tmpURL += '&width=1920&height=1080';
		}

		// Cancel any previous in-flight frame fetch (e.g. switching videos fast)
		this._cancelActiveOperation();

		// Start a new operation entry for this extraction
		let tmpStatus = this.pict.providers['RetoldRemote-OperationStatus'];
		let tmpOp = tmpStatus ? tmpStatus.startOperation(
		{
			Label: 'Extracting video frames',
			Phase: 'Starting…',
			Cancelable: true
		}) : null;
		if (tmpOp)
		{
			this._activeOperationId = tmpOp.OperationId;
			this._activeAbortController = tmpOp.AbortController;
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

		fetch(tmpURL, tmpFetchOptions)
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				if (!pData || !pData.Success)
				{
					if (tmpOp && tmpStatus)
					{
						tmpStatus.errorOperation(tmpOp.OperationId, { message: pData ? pData.Error : 'Unknown error' });
					}
					tmpSelf._showError(pData ? pData.Error : 'Unknown error');
					return;
				}

				if (tmpOp && tmpStatus)
				{
					tmpStatus.completeOperation(tmpOp.OperationId);
				}
				tmpSelf._activeOperationId = null;
				tmpSelf._activeAbortController = null;

				tmpSelf._frameData = pData;
				tmpSelf._renderFrames();

				// Load any previously saved custom frames
				tmpSelf._loadSavedCustomFrames();
			})
			.catch((pError) =>
			{
				// Silent abort — user navigated away or switched videos
				if (pError && pError.name === 'AbortError')
				{
					return;
				}
				if (tmpOp && tmpStatus)
				{
					tmpStatus.errorOperation(tmpOp.OperationId, pError);
				}
				tmpSelf._showError(pError.message);
			});
	}

	/**
	 * Cancel any in-flight frame extraction for this explorer. Used on
	 * navigate-away and when starting a fresh extraction.
	 */
	_cancelActiveOperation()
	{
		if (this._activeAbortController)
		{
			try { this._activeAbortController.abort(); } catch (pErr) { /* ignore */ }
		}
		let tmpStatus = this.pict.providers['RetoldRemote-OperationStatus'];
		if (this._activeOperationId && tmpStatus)
		{
			tmpStatus.cancelOperation(this._activeOperationId);
		}
		this._activeOperationId = null;
		this._activeAbortController = null;
	}

	/**
	 * Render the extracted frames into the grid.
	 */
	_renderFrames()
	{
		let tmpData = this._frameData;
		if (!tmpData)
		{
			return;
		}

		// Populate info bar
		let tmpInfoBar = document.getElementById('RetoldRemote-VEX-Info');
		if (tmpInfoBar)
		{
			let tmpInfoHTML = '';
			tmpInfoHTML += '<span class="retold-remote-vex-info-item"><span class="retold-remote-vex-info-label">Duration</span> <span class="retold-remote-vex-info-value">' + this._getFmt().escapeHTML(tmpData.DurationFormatted) + '</span></span>';
			if (tmpData.VideoWidth && tmpData.VideoHeight)
			{
				tmpInfoHTML += '<span class="retold-remote-vex-info-item"><span class="retold-remote-vex-info-label">Resolution</span> <span class="retold-remote-vex-info-value">' + tmpData.VideoWidth + '&times;' + tmpData.VideoHeight + '</span></span>';
			}
			if (tmpData.Codec)
			{
				tmpInfoHTML += '<span class="retold-remote-vex-info-item"><span class="retold-remote-vex-info-label">Codec</span> <span class="retold-remote-vex-info-value">' + this._getFmt().escapeHTML(tmpData.Codec) + '</span></span>';
			}
			if (tmpData.FileSize)
			{
				tmpInfoHTML += '<span class="retold-remote-vex-info-item"><span class="retold-remote-vex-info-label">Size</span> <span class="retold-remote-vex-info-value">' + this._getFmt().formatFileSize(tmpData.FileSize) + '</span></span>';
			}
			tmpInfoHTML += '<span class="retold-remote-vex-info-item"><span class="retold-remote-vex-info-label">Frames</span> <span class="retold-remote-vex-info-value">' + tmpData.FrameCount + '</span></span>';

			tmpInfoBar.innerHTML = tmpInfoHTML;
			tmpInfoBar.style.display = '';
		}

		// Show controls
		let tmpControlsBar = document.getElementById('RetoldRemote-VEX-Controls');
		if (tmpControlsBar)
		{
			tmpControlsBar.style.display = '';
		}

		// Render the frame grid
		let tmpBody = document.getElementById('RetoldRemote-VEX-Body');
		if (tmpBody)
		{
			let tmpGridHTML = '<div class="retold-remote-vex-grid">';

			for (let i = 0; i < tmpData.Frames.length; i++)
			{
				let tmpFrame = tmpData.Frames[i];
				let tmpFrameURL = this._buildFrameURL(tmpData.CacheKey, tmpFrame.Filename);

				tmpGridHTML += '<div class="retold-remote-vex-frame" id="retold-vex-frame-' + i + '" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].selectFrame(' + i + ')" ondblclick="pict.views[\'RetoldRemote-VideoExplorer\'].openFrameFullsize(' + i + ')">';
				tmpGridHTML += '<img src="' + tmpFrameURL + '" alt="Frame at ' + this._getFmt().escapeHTML(tmpFrame.TimestampFormatted) + '" loading="lazy">';
				tmpGridHTML += '<div class="retold-remote-vex-frame-info">';
				tmpGridHTML += '<span class="retold-remote-vex-frame-timestamp">' + this._getFmt().escapeHTML(tmpFrame.TimestampFormatted) + '</span>';
				tmpGridHTML += '<span class="retold-remote-vex-frame-index">#' + (tmpFrame.Index + 1) + '</span>';
				tmpGridHTML += '</div>';
				tmpGridHTML += '</div>';
			}

			tmpGridHTML += '</div>';
			tmpBody.innerHTML = tmpGridHTML;
		}

		// Render the timeline
		this._renderTimeline();
	}

	/**
	 * Render the timeline bar at the bottom.
	 */
	_renderTimeline()
	{
		let tmpData = this._frameData;
		if (!tmpData || !tmpData.Duration)
		{
			return;
		}

		let tmpTimeline = document.getElementById('RetoldRemote-VEX-Timeline');
		if (!tmpTimeline)
		{
			return;
		}

		let tmpHTML = '';
		tmpHTML += '<span class="retold-remote-vex-timeline-label">0:00</span>';
		tmpHTML += '<div class="retold-remote-vex-timeline-column">';
		tmpHTML += '<div class="retold-remote-vex-slider-track" id="RetoldRemote-VEX-SliderTrack"></div>';
		tmpHTML += '<div class="retold-remote-vex-timeline-bar" id="RetoldRemote-VEX-TimelineBar">';

		for (let i = 0; i < tmpData.Frames.length; i++)
		{
			let tmpFrame = tmpData.Frames[i];
			let tmpPercent = (tmpFrame.Timestamp / tmpData.Duration) * 100;
			let tmpSelectedClass = (i === this._selectedFrameIndex) ? ' selected' : '';
			tmpHTML += '<div class="retold-remote-vex-timeline-marker' + tmpSelectedClass + '" '
				+ 'style="left:' + tmpPercent.toFixed(2) + '%;" '
				+ 'data-frame-index="' + i + '" '
				+ 'title="' + this._getFmt().escapeHTML(tmpFrame.TimestampFormatted) + '">'
				+ '</div>';
		}

		// Also render markers for custom frames
		if (this._customFrames)
		{
			for (let i = 0; i < this._customFrames.length; i++)
			{
				let tmpCustom = this._customFrames[i];
				let tmpPercent = (tmpCustom.Timestamp / tmpData.Duration) * 100;
				tmpHTML += '<div class="retold-remote-vex-timeline-marker custom" '
					+ 'style="left:' + tmpPercent.toFixed(2) + '%;" '
					+ 'title="' + this._getFmt().escapeHTML(tmpCustom.TimestampFormatted) + '">'
					+ '</div>';
			}
		}

		tmpHTML += '</div>'; // close timeline-bar
		tmpHTML += '</div>'; // close timeline-column
		tmpHTML += '<span class="retold-remote-vex-timeline-label">' + this._getFmt().escapeHTML(tmpData.DurationFormatted) + '</span>';

		tmpTimeline.innerHTML = tmpHTML;
		tmpTimeline.style.display = '';

		// Bind event listeners (proper listeners instead of inline onclick)
		let tmpSelf = this;
		let tmpBar = document.getElementById('RetoldRemote-VEX-TimelineBar');
		if (tmpBar)
		{
			// Click handler: extract frame (only when NOT in selection mode)
			tmpBar.addEventListener('click', (pEvent) =>
			{
				// If clicking on a marker, select that frame
				let tmpMarker = pEvent.target.closest('.retold-remote-vex-timeline-marker');
				if (tmpMarker && tmpMarker.dataset.frameIndex !== undefined)
				{
					pEvent.stopPropagation();
					tmpSelf.selectFrame(parseInt(tmpMarker.dataset.frameIndex, 10));
					return;
				}

				// In selection mode, drag handles it — don't extract a frame
				if (tmpSelf._selectionModeActive)
				{
					return;
				}

				tmpSelf.onTimelineClick(pEvent);
			});

			// Selection drag handlers (mouse)
			tmpBar.addEventListener('mousedown', (pEvent) =>
			{
				if (pEvent.button !== 0) { return; }
				tmpSelf._onSelectionDragStart(pEvent);
			});
			tmpBar.addEventListener('mousemove', (pEvent) =>
			{
				tmpSelf._onSelectionDragMove(pEvent);
			});

			// Selection drag handlers (touch)
			tmpBar.addEventListener('touchstart', (pEvent) =>
			{
				tmpSelf._onSelectionDragStart(pEvent);
			}, { passive: false });
			tmpBar.addEventListener('touchmove', (pEvent) =>
			{
				tmpSelf._onSelectionDragMove(pEvent);
			}, { passive: false });

			// Clean up previous window listeners before attaching new ones
			tmpSelf._cleanupWindowListeners();

			// Window-level end handlers (so drag works even if cursor leaves the bar)
			tmpSelf._boundDragEnd = (pEvent) => { tmpSelf._onSelectionDragEnd(pEvent); };
			window.addEventListener('mouseup', tmpSelf._boundDragEnd);
			window.addEventListener('touchend', tmpSelf._boundDragEnd);

			// Apply selection mode cursor if active
			if (tmpSelf._selectionModeActive)
			{
				tmpBar.classList.add('selecting');
			}
		}

		// Render any existing selection overlay and slider handles
		this._renderSelectionOverlay();
		this._renderSliderHandles();
		this._updateSelectionInfo();

		// Bind slider handle drag events
		this._bindSliderHandleDrag();
	}

	// -----------------------------------------------------------------
	//  Frame selection (grid highlight + timeline)
	// -----------------------------------------------------------------

	/**
	 * Select a frame by index (highlight it in grid and timeline).
	 *
	 * @param {number} pIndex - Frame index
	 */
	selectFrame(pIndex)
	{
		// Deselect previous
		if (this._selectedFrameIndex >= 0)
		{
			let tmpPrevFrame = document.getElementById('retold-vex-frame-' + this._selectedFrameIndex);
			if (tmpPrevFrame)
			{
				tmpPrevFrame.classList.remove('selected');
			}
		}

		this._selectedFrameIndex = pIndex;

		// Select new
		let tmpFrame = document.getElementById('retold-vex-frame-' + pIndex);
		if (tmpFrame)
		{
			tmpFrame.classList.add('selected');
			tmpFrame.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
		}

		// Update timeline markers
		this._updateTimelineSelection();
	}

	/**
	 * Update the timeline marker selection state.
	 */
	_updateTimelineSelection()
	{
		let tmpBar = document.getElementById('RetoldRemote-VEX-TimelineBar');
		if (!tmpBar)
		{
			return;
		}

		let tmpMarkers = tmpBar.querySelectorAll('.retold-remote-vex-timeline-marker');
		for (let i = 0; i < tmpMarkers.length; i++)
		{
			if (i === this._selectedFrameIndex)
			{
				tmpMarkers[i].classList.add('selected');
			}
			else
			{
				tmpMarkers[i].classList.remove('selected');
			}
		}
	}

	// -----------------------------------------------------------------
	//  Controls
	// -----------------------------------------------------------------

	/**
	 * Handle frame count dropdown change.
	 *
	 * @param {string} pValue - New frame count
	 */
	onFrameCountChange(pValue)
	{
		this._frameCount = parseInt(pValue, 10) || 20;
		this.refresh();
	}

	/**
	 * Handle full-res checkbox change.
	 *
	 * @param {boolean} pChecked - Whether full res is enabled
	 */
	onFullResChange(pChecked)
	{
		this._fullResFrames = pChecked;
		this.refresh();
	}

	/**
	 * Refresh (re-extract) frames with current settings.
	 */
	refresh()
	{
		// Show loading state
		let tmpBody = document.getElementById('RetoldRemote-VEX-Body');
		if (tmpBody)
		{
			tmpBody.innerHTML = '<div class="retold-remote-vex-loading">'
				+ '<div class="retold-remote-vex-loading-spinner"></div>'
				+ 'Extracting frames from video...'
				+ '</div>';
		}

		// Hide timeline during loading
		let tmpTimeline = document.getElementById('RetoldRemote-VEX-Timeline');
		if (tmpTimeline)
		{
			tmpTimeline.style.display = 'none';
		}

		this._selectedFrameIndex = -1;
		this._customFrames = [];
		this._fetchFrames(this._currentPath);
	}

	// -----------------------------------------------------------------
	//  Navigation
	// -----------------------------------------------------------------

	/**
	 * Navigate back to the gallery / file listing.
	 */
	goBack()
	{
		this._cancelActiveOperation();
		this._cleanupWindowListeners();

		let tmpNav = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNav)
		{
			tmpNav.closeViewer();
		}
	}

	/**
	 * Leave the video explorer and play the video in the browser viewer.
	 */
	playInBrowser()
	{
		this._cancelActiveOperation();
		this._cleanupWindowListeners();

		let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
		if (tmpViewer)
		{
			tmpViewer.showMedia(this._currentPath, 'video');
			tmpViewer.playVideo();
		}
	}

	/**
	 * Show an error message.
	 *
	 * @param {string} pMessage - Error message
	 */
	_showError(pMessage)
	{
		let tmpBody = document.getElementById('RetoldRemote-VEX-Body');
		if (tmpBody)
		{
			tmpBody.innerHTML = '<div class="retold-remote-vex-error">'
				+ '<div class="retold-remote-vex-error-message">' + this._getFmt().escapeHTML(pMessage || 'An error occurred.') + '</div>'
				+ '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].goBack()">Back to Video</button>'
				+ '</div>';
		}
	}

}

// -- Mix in method groups from sub-modules --------------------------------
Object.assign(RetoldRemoteVideoExplorerView.prototype, _VideoExplorerSelection);
Object.assign(RetoldRemoteVideoExplorerView.prototype, _VideoExplorerCustomFrames);
Object.assign(RetoldRemoteVideoExplorerView.prototype, _VideoExplorerPreview);

RetoldRemoteVideoExplorerView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteVideoExplorerView;
