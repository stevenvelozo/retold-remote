const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-VideoExplorer",
	DefaultRenderable: "RetoldRemote-VideoExplorer",
	DefaultDestinationAddress: "#RetoldRemote-Viewer-Container",
	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-vex
		{
			display: flex;
			flex-direction: column;
			height: 100%;
		}
		.retold-remote-vex-header
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
		.retold-remote-vex-nav-btn
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
		.retold-remote-vex-nav-btn:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
		.retold-remote-vex-title
		{
			flex: 1;
			font-size: 0.82rem;
			color: var(--retold-text-secondary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-align: center;
		}
		.retold-remote-vex-info
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
		.retold-remote-vex-info-item
		{
			display: inline-flex;
			align-items: center;
			gap: 4px;
		}
		.retold-remote-vex-info-label
		{
			color: var(--retold-text-muted);
		}
		.retold-remote-vex-info-value
		{
			color: var(--retold-text-secondary);
		}
		.retold-remote-vex-controls
		{
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 8px 16px;
			background: var(--retold-bg-secondary);
			border-bottom: 1px solid var(--retold-border);
			flex-shrink: 0;
		}
		.retold-remote-vex-controls label
		{
			font-size: 0.75rem;
			color: var(--retold-text-muted);
		}
		.retold-remote-vex-controls select,
		.retold-remote-vex-controls input[type="range"]
		{
			font-size: 0.75rem;
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-primary);
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			padding: 2px 6px;
			font-family: inherit;
		}
		.retold-remote-vex-controls .retold-remote-vex-refresh-btn
		{
			padding: 3px 12px;
			border: 1px solid var(--retold-accent);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-accent);
			font-size: 0.75rem;
			cursor: pointer;
			transition: background 0.15s, color 0.15s;
			font-family: inherit;
		}
		.retold-remote-vex-controls .retold-remote-vex-refresh-btn:hover
		{
			background: var(--retold-accent);
			color: var(--retold-bg-primary);
		}
		.retold-remote-vex-body
		{
			flex: 1;
			overflow-y: auto;
			padding: 16px;
		}
		.retold-remote-vex-loading
		{
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			height: 100%;
			color: var(--retold-text-dim);
			font-size: 0.9rem;
		}
		.retold-remote-vex-loading-spinner
		{
			width: 32px;
			height: 32px;
			border: 3px solid var(--retold-border);
			border-top-color: var(--retold-accent);
			border-radius: 50%;
			animation: retold-vex-spin 0.8s linear infinite;
			margin-bottom: 16px;
		}
		@keyframes retold-vex-spin
		{
			to { transform: rotate(360deg); }
		}
		.retold-remote-vex-grid
		{
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
			gap: 12px;
		}
		.retold-remote-vex-frame
		{
			position: relative;
			border-radius: 6px;
			overflow: hidden;
			background: var(--retold-bg-tertiary);
			border: 2px solid transparent;
			cursor: pointer;
			transition: border-color 0.15s, transform 0.1s;
		}
		.retold-remote-vex-frame:hover
		{
			border-color: var(--retold-accent);
			transform: translateY(-1px);
		}
		.retold-remote-vex-frame.selected
		{
			border-color: var(--retold-accent);
		}
		.retold-remote-vex-frame img
		{
			width: 100%;
			display: block;
			aspect-ratio: 16 / 9;
			object-fit: contain;
			background: #000;
		}
		.retold-remote-vex-frame-info
		{
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 6px 10px;
			background: var(--retold-bg-secondary);
		}
		.retold-remote-vex-frame-timestamp
		{
			font-size: 0.78rem;
			color: var(--retold-text-secondary);
			font-family: var(--retold-font-mono, monospace);
		}
		.retold-remote-vex-frame-index
		{
			font-size: 0.7rem;
			color: var(--retold-text-dim);
		}
		.retold-remote-vex-frame.custom-frame
		{
			border-color: var(--retold-accent);
			border-style: dashed;
		}
		.retold-remote-vex-frame.custom-frame .retold-remote-vex-frame-info
		{
			background: color-mix(in srgb, var(--retold-accent) 12%, var(--retold-bg-secondary));
		}
		.retold-remote-vex-frame-loading
		{
			width: 100%;
			aspect-ratio: 16 / 9;
			display: flex;
			align-items: center;
			justify-content: center;
			background: #000;
			color: var(--retold-text-dim);
			font-size: 0.8rem;
		}
		.retold-remote-vex-timeline-marker.custom
		{
			background: var(--retold-text-primary);
			opacity: 0.9;
			width: 2px;
			border: 1px dashed var(--retold-accent);
		}
		/* Timeline bar at bottom */
		.retold-remote-vex-timeline
		{
			display: flex;
			align-items: flex-end;
			gap: 8px;
			padding: 8px 16px;
			background: var(--retold-bg-secondary);
			border-top: 1px solid var(--retold-border);
			flex-shrink: 0;
		}
		.retold-remote-vex-timeline-column
		{
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 0;
			min-width: 0;
		}
		.retold-remote-vex-slider-track
		{
			position: relative;
			height: 18px;
			user-select: none;
			-webkit-user-select: none;
		}
		.retold-remote-vex-slider-handle
		{
			position: absolute;
			bottom: 0;
			width: 14px;
			height: 18px;
			background: var(--retold-accent);
			border-radius: 3px 3px 0 0;
			cursor: ew-resize;
			transform: translateX(-50%);
			z-index: 2;
			transition: background 0.15s;
			touch-action: none;
		}
		.retold-remote-vex-slider-handle:hover,
		.retold-remote-vex-slider-handle.dragging
		{
			background: var(--retold-text-primary);
		}
		.retold-remote-vex-slider-handle::after
		{
			content: '';
			position: absolute;
			top: 5px;
			left: 4px;
			width: 6px;
			height: 8px;
			border-left: 2px solid rgba(0, 0, 0, 0.3);
			border-right: 2px solid rgba(0, 0, 0, 0.3);
		}
		.retold-remote-vex-timeline-bar
		{
			height: 24px;
			background: var(--retold-bg-tertiary);
			border-radius: 4px;
			position: relative;
			overflow: hidden;
			cursor: pointer;
		}
		.retold-remote-vex-timeline-marker
		{
			position: absolute;
			top: 0;
			width: 3px;
			height: 100%;
			background: var(--retold-accent);
			opacity: 0.7;
			transition: opacity 0.15s;
		}
		.retold-remote-vex-timeline-marker:hover
		{
			opacity: 1;
		}
		.retold-remote-vex-timeline-marker.selected
		{
			opacity: 1;
			background: var(--retold-text-primary);
		}
		.retold-remote-vex-timeline-label
		{
			font-size: 0.7rem;
			color: var(--retold-text-dim);
			white-space: nowrap;
		}
		/* Selection mode toggle button */
		.retold-remote-vex-select-btn
		{
			padding: 3px 12px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.75rem;
			cursor: pointer;
			transition: background 0.15s, color 0.15s, border-color 0.15s;
			font-family: inherit;
		}
		.retold-remote-vex-select-btn:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
		.retold-remote-vex-select-btn.active
		{
			background: var(--retold-accent);
			color: var(--retold-bg-primary);
			border-color: var(--retold-accent);
		}
		/* Selection info display */
		.retold-remote-vex-selection-info
		{
			display: inline-flex;
			align-items: center;
			gap: 8px;
			font-size: 0.75rem;
			color: var(--retold-text-secondary);
			font-family: var(--retold-font-mono, monospace);
		}
		.retold-remote-vex-selection-info-label
		{
			color: var(--retold-text-muted);
		}
		.retold-remote-vex-clear-btn
		{
			padding: 2px 8px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-dim);
			font-size: 0.7rem;
			cursor: pointer;
			transition: color 0.15s, border-color 0.15s;
			font-family: inherit;
		}
		.retold-remote-vex-clear-btn:hover
		{
			color: #e06c75;
			border-color: #e06c75;
		}
		/* Generate frames across range */
		.retold-remote-vex-generate-controls
		{
			display: inline-flex;
			align-items: center;
			gap: 6px;
		}
		.retold-remote-vex-generate-btn
		{
			padding: 3px 12px;
			border: 1px solid var(--retold-accent);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-accent);
			font-size: 0.75rem;
			cursor: pointer;
			transition: background 0.15s, color 0.15s;
			font-family: inherit;
		}
		.retold-remote-vex-generate-btn:hover
		{
			background: var(--retold-accent);
			color: var(--retold-bg-primary);
		}
		/* Save segment to collection button */
		.retold-remote-vex-save-btn
		{
			padding: 3px 12px;
			border: 1px solid #98c379;
			border-radius: 3px;
			background: transparent;
			color: #98c379;
			font-size: 0.75rem;
			cursor: pointer;
			transition: background 0.15s, color 0.15s;
			font-family: inherit;
		}
		.retold-remote-vex-save-btn:hover
		{
			background: #98c379;
			color: var(--retold-bg-primary);
		}
		.retold-remote-vex-range-frame-select
		{
			font-size: 0.75rem;
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-primary);
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			padding: 2px 6px;
			font-family: inherit;
		}
		/* Timeline selection overlay */
		.retold-remote-vex-timeline-selection
		{
			position: absolute;
			top: 0;
			height: 100%;
			background: color-mix(in srgb, var(--retold-accent) 20%, transparent);
			border-left: 2px solid var(--retold-accent);
			border-right: 2px solid var(--retold-accent);
			pointer-events: none;
			z-index: 1;
			box-sizing: border-box;
		}
		.retold-remote-vex-timeline-bar.selecting
		{
			cursor: crosshair;
		}
		/* Frame preview overlay */
		.retold-remote-vex-preview-backdrop
		{
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.85);
			z-index: 100;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
		}
		.retold-remote-vex-preview-header
		{
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 8px 16px;
			width: 100%;
			max-width: 95vw;
			flex-shrink: 0;
		}
		.retold-remote-vex-preview-header .retold-remote-vex-nav-btn
		{
			background: rgba(40, 44, 52, 0.8);
		}
		.retold-remote-vex-preview-title
		{
			flex: 1;
			font-size: 0.82rem;
			color: var(--retold-text-secondary);
			text-align: center;
		}
		.retold-remote-vex-preview-body
		{
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: auto;
			padding: 8px;
			max-width: 95vw;
			max-height: calc(100vh - 60px);
		}
		.retold-remote-vex-preview-body img
		{
			max-width: 100%;
			max-height: 100%;
			object-fit: contain;
			border-radius: 4px;
			box-shadow: 0 4px 24px rgba(0, 0, 0, 0.6);
		}
		/* Error state */
		.retold-remote-vex-error
		{
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			height: 100%;
			color: var(--retold-text-dim);
			font-size: 0.85rem;
			text-align: center;
			padding: 40px;
		}
		.retold-remote-vex-error-message
		{
			color: #e06c75;
			margin-bottom: 16px;
		}
	`
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

	// -----------------------------------------------------------------
	//  Selection mode
	// -----------------------------------------------------------------

	/**
	 * Toggle selection mode on or off.
	 * When on, timeline clicks/drags create a selection range.
	 * When off, timeline clicks extract frames (existing behavior).
	 */
	toggleSelectionMode()
	{
		this._selectionModeActive = !this._selectionModeActive;

		let tmpBtn = document.getElementById('RetoldRemote-VEX-SelectBtn');
		if (tmpBtn)
		{
			if (this._selectionModeActive)
			{
				tmpBtn.classList.add('active');
			}
			else
			{
				tmpBtn.classList.remove('active');
			}
		}

		let tmpBar = document.getElementById('RetoldRemote-VEX-TimelineBar');
		if (tmpBar)
		{
			if (this._selectionModeActive)
			{
				tmpBar.classList.add('selecting');
			}
			else
			{
				tmpBar.classList.remove('selecting');
			}
		}
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

	/**
	 * Set the selection start marker.
	 *
	 * @param {number} pTime - Timestamp in seconds
	 */
	setSelectionStart(pTime)
	{
		this._selectionStartTime = pTime;
		this._renderSelectionOverlay();
		this._renderSliderHandles();
		this._updateSelectionInfo();
		this._saveState();
	}

	/**
	 * Set the selection end marker.
	 *
	 * @param {number} pTime - Timestamp in seconds
	 */
	setSelectionEnd(pTime)
	{
		this._selectionEndTime = pTime;
		this._renderSelectionOverlay();
		this._renderSliderHandles();
		this._updateSelectionInfo();
		this._saveState();
	}

	/**
	 * Clear the selection range.
	 */
	clearSelection()
	{
		this._selectionStartTime = -1;
		this._selectionEndTime = -1;
		this._renderSelectionOverlay();
		this._renderSliderHandles();
		this._updateSelectionInfo();
		this._saveState();
	}

	/**
	 * Render (or remove) the selection overlay div inside the timeline bar.
	 */
	_renderSelectionOverlay()
	{
		let tmpBar = document.getElementById('RetoldRemote-VEX-TimelineBar');
		if (!tmpBar)
		{
			return;
		}

		// Remove any existing overlay
		let tmpExisting = tmpBar.querySelector('.retold-remote-vex-timeline-selection');
		if (tmpExisting)
		{
			tmpExisting.remove();
		}

		if (this._selectionStartTime < 0 || this._selectionEndTime < 0 || !this._frameData || !this._frameData.Duration)
		{
			return;
		}

		let tmpStart = Math.min(this._selectionStartTime, this._selectionEndTime);
		let tmpEnd = Math.max(this._selectionStartTime, this._selectionEndTime);
		let tmpDuration = this._frameData.Duration;

		let tmpLeftPercent = (tmpStart / tmpDuration) * 100;
		let tmpWidthPercent = ((tmpEnd - tmpStart) / tmpDuration) * 100;

		let tmpOverlay = document.createElement('div');
		tmpOverlay.className = 'retold-remote-vex-timeline-selection';
		tmpOverlay.style.left = tmpLeftPercent.toFixed(2) + '%';
		tmpOverlay.style.width = tmpWidthPercent.toFixed(2) + '%';
		tmpBar.appendChild(tmpOverlay);
	}

	/**
	 * Update the selection info display with current selection range.
	 */
	_updateSelectionInfo()
	{
		let tmpInfoEl = document.getElementById('RetoldRemote-VEX-SelectionInfo');
		let tmpClearBtn = document.getElementById('RetoldRemote-VEX-ClearBtn');
		let tmpGenControls = document.getElementById('RetoldRemote-VEX-GenerateControls');

		if (!tmpInfoEl)
		{
			return;
		}

		if (this._selectionStartTime < 0 || this._selectionEndTime < 0)
		{
			tmpInfoEl.style.display = 'none';
			if (tmpClearBtn)
			{
				tmpClearBtn.style.display = 'none';
			}
			if (tmpGenControls)
			{
				tmpGenControls.style.display = 'none';
			}
			return;
		}

		let tmpStart = Math.min(this._selectionStartTime, this._selectionEndTime);
		let tmpEnd = Math.max(this._selectionStartTime, this._selectionEndTime);
		let tmpDuration = tmpEnd - tmpStart;

		let tmpFmt = this._getFmt();
		let tmpText = '<span class="retold-remote-vex-selection-info-label">Selection:</span> '
			+ tmpFmt.formatTimestamp(tmpStart) + ' \u2013 ' + tmpFmt.formatTimestamp(tmpEnd)
			+ ' (' + tmpFmt.formatTimestamp(tmpDuration) + ')';

		tmpInfoEl.innerHTML = tmpText;
		tmpInfoEl.style.display = '';
		if (tmpClearBtn)
		{
			tmpClearBtn.style.display = '';
		}
		if (tmpGenControls)
		{
			tmpGenControls.style.display = '';
		}
	}

	/**
	 * Handle selection drag start (mousedown or touchstart on timeline bar).
	 *
	 * @param {Event} pEvent - MouseEvent or TouchEvent
	 */
	_onSelectionDragStart(pEvent)
	{
		if (!this._selectionModeActive)
		{
			return;
		}

		// Don't start drag on marker clicks
		let tmpMarker = pEvent.target.closest('.retold-remote-vex-timeline-marker');
		if (tmpMarker)
		{
			return;
		}

		pEvent.preventDefault();
		this._isDraggingTimeline = true;
		let tmpTimestamp = this._getTimelineTimestamp(pEvent);
		this._selectionStartTime = tmpTimestamp;
		this._selectionEndTime = tmpTimestamp;
		this._renderSelectionOverlay();
	}

	/**
	 * Handle selection drag move (mousemove or touchmove on timeline bar).
	 *
	 * @param {Event} pEvent - MouseEvent or TouchEvent
	 */
	_onSelectionDragMove(pEvent)
	{
		if (!this._isDraggingTimeline)
		{
			return;
		}

		pEvent.preventDefault();
		this._selectionEndTime = this._getTimelineTimestamp(pEvent);
		this._renderSelectionOverlay();
	}

	/**
	 * Handle selection drag end (mouseup or touchend on window).
	 *
	 * @param {Event} pEvent - MouseEvent or TouchEvent
	 */
	_onSelectionDragEnd(pEvent)
	{
		if (!this._isDraggingTimeline)
		{
			return;
		}

		this._isDraggingTimeline = false;

		// If selection is too small (< 0.5s), clear it
		let tmpRange = Math.abs(this._selectionEndTime - this._selectionStartTime);
		if (tmpRange < 0.5)
		{
			this._selectionStartTime = -1;
			this._selectionEndTime = -1;
		}

		this._renderSelectionOverlay();
		this._renderSliderHandles();
		this._updateSelectionInfo();
		this._saveState();
	}

	/**
	 * Clean up window-level event listeners (mouseup/touchend).
	 * Called when the explorer is closed or refreshed.
	 */
	_cleanupWindowListeners()
	{
		if (this._boundDragEnd)
		{
			window.removeEventListener('mouseup', this._boundDragEnd);
			window.removeEventListener('touchend', this._boundDragEnd);
			this._boundDragEnd = null;
		}
	}

	/**
	 * Render (or clear) the slider handles in the slider track above
	 * the timeline bar.  The handles sit at the start/end positions
	 * of the current selection range.
	 */
	_renderSliderHandles()
	{
		let tmpTrack = document.getElementById('RetoldRemote-VEX-SliderTrack');
		if (!tmpTrack)
		{
			return;
		}

		// Clear existing handles
		tmpTrack.innerHTML = '';

		if (this._selectionStartTime < 0 || this._selectionEndTime < 0
			|| !this._frameData || !this._frameData.Duration)
		{
			tmpTrack.style.display = 'none';
			return;
		}

		tmpTrack.style.display = '';

		let tmpDuration = this._frameData.Duration;
		let tmpStart = Math.min(this._selectionStartTime, this._selectionEndTime);
		let tmpEnd = Math.max(this._selectionStartTime, this._selectionEndTime);

		let tmpStartPercent = (tmpStart / tmpDuration) * 100;
		let tmpEndPercent = (tmpEnd / tmpDuration) * 100;

		let tmpStartHandle = document.createElement('div');
		tmpStartHandle.className = 'retold-remote-vex-slider-handle';
		tmpStartHandle.id = 'RetoldRemote-VEX-HandleStart';
		tmpStartHandle.style.left = tmpStartPercent.toFixed(2) + '%';
		tmpStartHandle.title = 'Drag to adjust selection start';
		tmpTrack.appendChild(tmpStartHandle);

		let tmpEndHandle = document.createElement('div');
		tmpEndHandle.className = 'retold-remote-vex-slider-handle';
		tmpEndHandle.id = 'RetoldRemote-VEX-HandleEnd';
		tmpEndHandle.style.left = tmpEndPercent.toFixed(2) + '%';
		tmpEndHandle.title = 'Drag to adjust selection end';
		tmpTrack.appendChild(tmpEndHandle);
	}

	/**
	 * Bind drag interaction to the slider handles (mouse + touch).
	 * Uses the slider track element for coordinate computation.
	 */
	_bindSliderHandleDrag()
	{
		let tmpTrack = document.getElementById('RetoldRemote-VEX-SliderTrack');
		if (!tmpTrack)
		{
			return;
		}

		let tmpSelf = this;

		// Mouse handlers on the track (delegated — detect which handle)
		tmpTrack.addEventListener('mousedown', (pEvent) =>
		{
			if (pEvent.button !== 0) { return; }
			tmpSelf._onSliderDragStart(pEvent);
		});

		// Touch handlers on the track
		tmpTrack.addEventListener('touchstart', (pEvent) =>
		{
			tmpSelf._onSliderDragStart(pEvent);
		}, { passive: false });
	}

	/**
	 * Begin dragging a slider handle.
	 *
	 * @param {Event} pEvent - mousedown or touchstart
	 */
	_onSliderDragStart(pEvent)
	{
		let tmpTarget = pEvent.target;
		if (!tmpTarget.classList.contains('retold-remote-vex-slider-handle'))
		{
			return;
		}

		pEvent.preventDefault();
		pEvent.stopPropagation();

		// Determine which handle
		if (tmpTarget.id === 'RetoldRemote-VEX-HandleStart')
		{
			this._draggingHandle = 'start';
		}
		else if (tmpTarget.id === 'RetoldRemote-VEX-HandleEnd')
		{
			this._draggingHandle = 'end';
		}
		else
		{
			return;
		}

		tmpTarget.classList.add('dragging');

		let tmpSelf = this;

		// Create window-level move/end handlers
		let tmpBoundMove = (pMoveEvent) =>
		{
			tmpSelf._onSliderDragMove(pMoveEvent);
		};

		let tmpBoundEnd = (pEndEvent) =>
		{
			tmpSelf._onSliderDragEnd(pEndEvent);
			window.removeEventListener('mousemove', tmpBoundMove);
			window.removeEventListener('mouseup', tmpBoundEnd);
			window.removeEventListener('touchmove', tmpBoundMove);
			window.removeEventListener('touchend', tmpBoundEnd);
		};

		window.addEventListener('mousemove', tmpBoundMove);
		window.addEventListener('mouseup', tmpBoundEnd);
		window.addEventListener('touchmove', tmpBoundMove, { passive: false });
		window.addEventListener('touchend', tmpBoundEnd);
	}

	/**
	 * Handle slider handle drag move.
	 *
	 * @param {Event} pEvent - mousemove or touchmove
	 */
	_onSliderDragMove(pEvent)
	{
		if (!this._draggingHandle)
		{
			return;
		}

		pEvent.preventDefault();

		// Compute timestamp from the timeline bar position
		let tmpBar = document.getElementById('RetoldRemote-VEX-TimelineBar');
		if (!tmpBar || !this._frameData || !this._frameData.Duration)
		{
			return;
		}

		let tmpRect = tmpBar.getBoundingClientRect();
		let tmpClientX = this._getClientX(pEvent);
		if (tmpClientX === null)
		{
			return;
		}

		let tmpPercent = Math.max(0, Math.min(1, (tmpClientX - tmpRect.left) / tmpRect.width));
		let tmpTimestamp = tmpPercent * this._frameData.Duration;

		if (this._draggingHandle === 'start')
		{
			this._selectionStartTime = tmpTimestamp;
		}
		else
		{
			this._selectionEndTime = tmpTimestamp;
		}

		// Update the handle position directly (avoid full re-render for performance)
		let tmpHandle = document.getElementById(
			this._draggingHandle === 'start' ? 'RetoldRemote-VEX-HandleStart' : 'RetoldRemote-VEX-HandleEnd'
		);
		if (tmpHandle)
		{
			tmpHandle.style.left = (tmpPercent * 100).toFixed(2) + '%';
		}

		this._renderSelectionOverlay();
		this._updateSelectionInfo();
	}

	/**
	 * Handle slider handle drag end.
	 *
	 * @param {Event} pEvent - mouseup or touchend
	 */
	_onSliderDragEnd(pEvent)
	{
		if (!this._draggingHandle)
		{
			return;
		}

		// Remove dragging class from handles
		let tmpHandle = document.getElementById(
			this._draggingHandle === 'start' ? 'RetoldRemote-VEX-HandleStart' : 'RetoldRemote-VEX-HandleEnd'
		);
		if (tmpHandle)
		{
			tmpHandle.classList.remove('dragging');
		}

		this._draggingHandle = null;

		// If the selection is too small (< 0.5s), clear it
		let tmpRange = Math.abs(this._selectionEndTime - this._selectionStartTime);
		if (tmpRange < 0.5)
		{
			this._selectionStartTime = -1;
			this._selectionEndTime = -1;
		}

		this._renderSelectionOverlay();
		this._renderSliderHandles();
		this._updateSelectionInfo();
		this._saveState();
	}

	/**
	 * Generate frames evenly spaced across the current selection range.
	 * Uses the frame count from the GenerateControls dropdown.
	 */
	generateSelectionFrames()
	{
		if (this._selectionStartTime < 0 || this._selectionEndTime < 0)
		{
			return;
		}

		let tmpStart = Math.min(this._selectionStartTime, this._selectionEndTime);
		let tmpEnd = Math.max(this._selectionStartTime, this._selectionEndTime);

		let tmpCountEl = document.getElementById('RetoldRemote-VEX-RangeFrameCount');
		let tmpCount = tmpCountEl ? parseInt(tmpCountEl.value, 10) : 5;
		if (tmpCount < 1) { tmpCount = 5; }

		let tmpData = this._frameData;
		if (!tmpData || !tmpData.CacheKey)
		{
			return;
		}

		// Calculate evenly-spaced timestamps within the selection range
		let tmpTimestamps = [];
		if (tmpCount === 1)
		{
			tmpTimestamps.push(tmpStart + (tmpEnd - tmpStart) / 2);
		}
		else
		{
			let tmpStep = (tmpEnd - tmpStart) / (tmpCount - 1);
			for (let i = 0; i < tmpCount; i++)
			{
				tmpTimestamps.push(tmpStart + (tmpStep * i));
			}
		}

		let tmpSelf = this;
		let tmpPathParam = this._getPathParam(this._currentPath);

		// Launch all frame extractions (insert placeholder immediately, replace on success)
		for (let i = 0; i < tmpTimestamps.length; i++)
		{
			let tmpTimestamp = tmpTimestamps[i];
			let tmpPlaceholderId = 'retold-vex-gen-' + Date.now() + '-' + i;
			tmpSelf._insertFramePlaceholder(tmpTimestamp, tmpPlaceholderId);

			let tmpURL = '/api/media/video-frame-at?path=' + tmpPathParam
				+ '&cacheKey=' + encodeURIComponent(tmpData.CacheKey)
				+ '&timestamp=' + tmpTimestamp.toFixed(3);

			if (tmpSelf._fullResFrames)
			{
				tmpURL += '&width=1920&height=1080';
			}

			// Use a closure to capture the correct placeholder id and timestamp
			(function(fPlaceholderId, fTimestamp)
			{
				fetch(tmpURL)
					.then((pResponse) => pResponse.json())
					.then((pResult) =>
					{
						if (!pResult || !pResult.Success)
						{
							throw new Error(pResult ? pResult.Error : 'Extraction failed.');
						}

						// Store the custom frame
						tmpSelf._customFrames.push(pResult);

						// Replace the placeholder with the real frame
						let tmpPlaceholder = document.getElementById(fPlaceholderId);
						if (tmpPlaceholder)
						{
							let tmpFrameURL = tmpSelf._buildFrameURL(tmpData.CacheKey, pResult.Filename);
							let tmpEscFilename = tmpSelf._getFmt().escapeHTML(pResult.Filename).replace(/'/g, "\\'");
							let tmpEscTimestamp = tmpSelf._getFmt().escapeHTML(pResult.TimestampFormatted).replace(/'/g, "\\'");
							tmpPlaceholder.ondblclick = function() { pict.views['RetoldRemote-VideoExplorer'].openCustomFrameFullsize(tmpEscFilename, tmpEscTimestamp); };
							tmpPlaceholder.style.cursor = 'pointer';
							tmpPlaceholder.innerHTML = '<img src="' + tmpFrameURL + '" alt="Frame at ' + tmpSelf._getFmt().escapeHTML(pResult.TimestampFormatted) + '" loading="lazy">'
								+ '<div class="retold-remote-vex-frame-info">'
								+ '<span class="retold-remote-vex-frame-timestamp">' + tmpSelf._getFmt().escapeHTML(pResult.TimestampFormatted) + '</span>'
								+ '<span class="retold-remote-vex-frame-index">custom</span>'
								+ '</div>';
						}

						// Re-render timeline to show the new custom marker
						tmpSelf._renderTimeline();
					})
					.catch((pError) =>
					{
						let tmpPlaceholder = document.getElementById(fPlaceholderId);
						if (tmpPlaceholder)
						{
							tmpPlaceholder.innerHTML = '<div class="retold-remote-vex-frame-loading">Failed: ' + tmpSelf._getFmt().escapeHTML(pError.message) + '</div>'
								+ '<div class="retold-remote-vex-frame-info">'
								+ '<span class="retold-remote-vex-frame-timestamp">' + tmpSelf._getFmt().formatTimestamp(fTimestamp) + '</span>'
								+ '<span class="retold-remote-vex-frame-index">error</span>'
								+ '</div>';
						}
					});
			})(tmpPlaceholderId, tmpTimestamp);
		}
	}

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

		// Update the hash
		let tmpFragProvider = this._getProvider();
		let tmpFragId = tmpFragProvider ? tmpFragProvider.getFragmentIdentifier(pFilePath) : pFilePath;
		window.location.hash = '#/explore/' + tmpFragId;

		// Show viewer container, hide gallery
		let tmpGalleryContainer = document.getElementById('RetoldRemote-Gallery-Container');
		let tmpViewerContainer = document.getElementById('RetoldRemote-Viewer-Container');

		if (tmpGalleryContainer) tmpGalleryContainer.style.display = 'none';
		if (tmpViewerContainer) tmpViewerContainer.style.display = 'block';

		let tmpFileName = pFilePath.replace(/^.*\//, '');

		// Build initial UI with loading state
		let tmpHTML = '<div class="retold-remote-vex">';

		// Header
		tmpHTML += '<div class="retold-remote-vex-header">';
		tmpHTML += '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].goBack()" title="Back to video (Esc)">&larr; Back</button>';
		tmpHTML += '<div class="retold-remote-vex-title">Video Explorer &mdash; ' + this._getFmt().escapeHTML(tmpFileName) + '</div>';
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

		fetch(tmpURL)
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				if (!pData || !pData.Success)
				{
					tmpSelf._showError(pData ? pData.Error : 'Unknown error');
					return;
				}

				tmpSelf._frameData = pData;
				tmpSelf._renderFrames();

				// Load any previously saved custom frames
				tmpSelf._loadSavedCustomFrames();
			})
			.catch((pError) =>
			{
				tmpSelf._showError(pError.message);
			});
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

	/**
	 * Handle a click on the timeline bar (not on a marker).
	 * Calculates the timestamp from the click position and extracts a single frame.
	 *
	 * @param {MouseEvent} pEvent - The click event
	 */
	onTimelineClick(pEvent)
	{
		let tmpData = this._frameData;
		if (!tmpData || !tmpData.Duration || !tmpData.CacheKey)
		{
			return;
		}

		let tmpBar = document.getElementById('RetoldRemote-VEX-TimelineBar');
		if (!tmpBar)
		{
			return;
		}

		// Calculate timestamp from click position
		let tmpRect = tmpBar.getBoundingClientRect();
		let tmpClickX = pEvent.clientX - tmpRect.left;
		let tmpPercent = Math.max(0, Math.min(1, tmpClickX / tmpRect.width));
		let tmpTimestamp = tmpPercent * tmpData.Duration;

		let tmpSelf = this;
		let tmpPathParam = this._getPathParam(this._currentPath);

		// Build the URL — pass the same resolution settings as the initial extraction
		let tmpURL = '/api/media/video-frame-at?path=' + tmpPathParam
			+ '&cacheKey=' + encodeURIComponent(tmpData.CacheKey)
			+ '&timestamp=' + tmpTimestamp.toFixed(3);

		if (this._fullResFrames)
		{
			tmpURL += '&width=1920&height=1080';
		}

		// Insert a placeholder into the grid immediately
		let tmpPlaceholderId = 'retold-vex-custom-' + Date.now();
		this._insertFramePlaceholder(tmpTimestamp, tmpPlaceholderId);

		fetch(tmpURL)
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				if (!pResult || !pResult.Success)
				{
					throw new Error(pResult ? pResult.Error : 'Extraction failed.');
				}

				// Store the custom frame
				tmpSelf._customFrames.push(pResult);

				// Replace the placeholder with the real frame
				let tmpPlaceholder = document.getElementById(tmpPlaceholderId);
				if (tmpPlaceholder)
				{
					let tmpFrameURL = tmpSelf._buildFrameURL(tmpData.CacheKey, pResult.Filename);
					let tmpEscFilename = tmpSelf._getFmt().escapeHTML(pResult.Filename).replace(/'/g, "\\'");
					let tmpEscTimestamp = tmpSelf._getFmt().escapeHTML(pResult.TimestampFormatted).replace(/'/g, "\\'");
					tmpPlaceholder.ondblclick = function() { pict.views['RetoldRemote-VideoExplorer'].openCustomFrameFullsize(tmpEscFilename, tmpEscTimestamp); };
					tmpPlaceholder.style.cursor = 'pointer';
					tmpPlaceholder.innerHTML = '<img src="' + tmpFrameURL + '" alt="Frame at ' + tmpSelf._getFmt().escapeHTML(pResult.TimestampFormatted) + '" loading="lazy">'
						+ '<div class="retold-remote-vex-frame-info">'
						+ '<span class="retold-remote-vex-frame-timestamp">' + tmpSelf._getFmt().escapeHTML(pResult.TimestampFormatted) + '</span>'
						+ '<span class="retold-remote-vex-frame-index">custom</span>'
						+ '</div>';
				}

				// Re-render timeline to show the new custom marker
				tmpSelf._renderTimeline();
			})
			.catch((pError) =>
			{
				let tmpPlaceholder = document.getElementById(tmpPlaceholderId);
				if (tmpPlaceholder)
				{
					tmpPlaceholder.innerHTML = '<div class="retold-remote-vex-frame-loading">Failed: ' + tmpSelf._getFmt().escapeHTML(pError.message) + '</div>'
						+ '<div class="retold-remote-vex-frame-info">'
						+ '<span class="retold-remote-vex-frame-timestamp">' + tmpSelf._getFmt().formatTimestamp(tmpTimestamp) + '</span>'
						+ '<span class="retold-remote-vex-frame-index">error</span>'
						+ '</div>';
				}
			});
	}

	/**
	 * Load previously saved custom frames from the server and restore
	 * them into the grid.  Called after batch frames are rendered.
	 */
	_loadSavedCustomFrames()
	{
		let tmpSelf = this;
		let tmpPathParam = this._getPathParam(this._currentPath);

		let tmpURL = '/api/media/video-explorer-state?path=' + tmpPathParam;

		fetch(tmpURL)
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				if (!pData || !pData.Success || !pData.State)
				{
					return;
				}

				// Restore selection state if present — but only when the
				// caller did not already provide an explicit selection
				// (e.g. opening a saved clip from a collection)
				if (tmpSelf._selectionFromCaller)
				{
					// Caller supplied selection — render it but do not overwrite
					tmpSelf._selectionFromCaller = false;
					tmpSelf._renderSelectionOverlay();
					tmpSelf._renderSliderHandles();
					tmpSelf._updateSelectionInfo();
				}
				else if (typeof pData.State.SelectionStartTime === 'number' && pData.State.SelectionStartTime >= 0
					&& typeof pData.State.SelectionEndTime === 'number' && pData.State.SelectionEndTime >= 0)
				{
					tmpSelf._selectionStartTime = pData.State.SelectionStartTime;
					tmpSelf._selectionEndTime = pData.State.SelectionEndTime;
					tmpSelf._renderSelectionOverlay();
					tmpSelf._renderSliderHandles();
					tmpSelf._updateSelectionInfo();
				}

				// Restore custom frames
				if (!Array.isArray(pData.State.CustomFrames) || pData.State.CustomFrames.length === 0)
				{
					return;
				}

				let tmpSavedFrames = pData.State.CustomFrames;

				// Restore each saved custom frame into the grid
				for (let i = 0; i < tmpSavedFrames.length; i++)
				{
					let tmpFrame = tmpSavedFrames[i];
					// Use the frame's own CacheKey for the image URL
					let tmpCacheKey = tmpFrame.CacheKey || (tmpSelf._frameData ? tmpSelf._frameData.CacheKey : '');
					let tmpFrameURL = tmpSelf._buildFrameURL(tmpCacheKey, tmpFrame.Filename);

					// Add to in-memory array
					tmpSelf._customFrames.push(tmpFrame);

					// Insert card into grid at correct position
					tmpSelf._insertRestoredCustomFrame(tmpFrame, tmpFrameURL);
				}

				// Re-render timeline to show all custom markers
				tmpSelf._renderTimeline();
			})
			.catch((pError) =>
			{
				// Silent failure — explorer still works, just without restored custom frames
			});
	}

	/**
	 * Save the current selection state to the server (fire-and-forget).
	 * Called whenever the selection changes.
	 */
	_saveState()
	{
		if (!this._currentPath)
		{
			return;
		}

		let tmpBody =
		{
			Path: this._currentPath,
			SelectionStartTime: this._selectionStartTime,
			SelectionEndTime: this._selectionEndTime
		};

		fetch('/api/media/video-explorer-state',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(tmpBody)
		}).catch(() => {});
	}

	/**
	 * Insert a DOM element into the frame grid at the correct chronological
	 * position based on timestamp.  Shared helper for placeholder and
	 * restored frame insertion.
	 *
	 * @param {HTMLElement} pElement - The element to insert
	 * @param {number} pTimestamp - Timestamp in seconds for sort position
	 */
	_insertFrameAtPosition(pElement, pTimestamp)
	{
		let tmpGrid = document.querySelector('.retold-remote-vex-grid');
		if (!tmpGrid)
		{
			return;
		}

		let tmpInsertBefore = null;
		let tmpChildren = tmpGrid.children;

		for (let i = 0; i < tmpChildren.length; i++)
		{
			let tmpChild = tmpChildren[i];
			let tmpTsEl = tmpChild.querySelector('.retold-remote-vex-frame-timestamp');
			if (tmpTsEl)
			{
				let tmpChildTimestamp = this._parseTimestamp(tmpTsEl.textContent);
				if (tmpChildTimestamp > pTimestamp)
				{
					tmpInsertBefore = tmpChild;
					break;
				}
			}
		}

		if (tmpInsertBefore)
		{
			tmpGrid.insertBefore(pElement, tmpInsertBefore);
		}
		else
		{
			tmpGrid.appendChild(pElement);
		}
	}

	/**
	 * Insert a fully-rendered custom frame card into the grid at its
	 * correct chronological position.  Used when restoring saved state
	 * (the image already exists on disk, so no loading placeholder needed).
	 *
	 * @param {Object} pFrame    - Saved custom frame object { Timestamp, TimestampFormatted, Filename, CacheKey }
	 * @param {string} pFrameURL - Image URL for the frame
	 */
	_insertRestoredCustomFrame(pFrame, pFrameURL)
	{
		let tmpEl = document.createElement('div');
		tmpEl.className = 'retold-remote-vex-frame custom-frame';

		let tmpEscFilename = this._getFmt().escapeHTML(pFrame.Filename).replace(/'/g, "\\'");
		let tmpEscTimestamp = this._getFmt().escapeHTML(pFrame.TimestampFormatted).replace(/'/g, "\\'");

		tmpEl.style.cursor = 'pointer';
		tmpEl.ondblclick = function() { pict.views['RetoldRemote-VideoExplorer'].openCustomFrameFullsize(tmpEscFilename, tmpEscTimestamp); };
		tmpEl.innerHTML = '<img src="' + pFrameURL + '" alt="Frame at ' + this._getFmt().escapeHTML(pFrame.TimestampFormatted) + '" loading="lazy">'
			+ '<div class="retold-remote-vex-frame-info">'
			+ '<span class="retold-remote-vex-frame-timestamp">' + this._getFmt().escapeHTML(pFrame.TimestampFormatted) + '</span>'
			+ '<span class="retold-remote-vex-frame-index">custom</span>'
			+ '</div>';

		this._insertFrameAtPosition(tmpEl, pFrame.Timestamp);
	}

	/**
	 * Insert a loading placeholder frame card into the grid at the correct
	 * chronological position based on timestamp.
	 *
	 * @param {number} pTimestamp    - Timestamp in seconds
	 * @param {string} pPlaceholderId - DOM id for the placeholder element
	 */
	_insertFramePlaceholder(pTimestamp, pPlaceholderId)
	{
		let tmpEl = document.createElement('div');
		tmpEl.className = 'retold-remote-vex-frame custom-frame';
		tmpEl.id = pPlaceholderId;
		tmpEl.innerHTML = '<div class="retold-remote-vex-frame-loading">Extracting...</div>'
			+ '<div class="retold-remote-vex-frame-info">'
			+ '<span class="retold-remote-vex-frame-timestamp">' + this._getFmt().formatTimestamp(pTimestamp) + '</span>'
			+ '<span class="retold-remote-vex-frame-index">custom</span>'
			+ '</div>';

		this._insertFrameAtPosition(tmpEl, pTimestamp);

		// Scroll the new element into view
		tmpEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	/**
	 * Parse a formatted timestamp string back to seconds.
	 * Handles "M:SS", "MM:SS", and "H:MM:SS" formats.
	 *
	 * @param {string} pText - Formatted timestamp like "1:23" or "1:02:34"
	 * @returns {number} Seconds
	 */
	_parseTimestamp(pText)
	{
		if (!pText) return 0;
		let tmpParts = pText.trim().split(':');
		if (tmpParts.length === 3)
		{
			return parseInt(tmpParts[0], 10) * 3600 + parseInt(tmpParts[1], 10) * 60 + parseInt(tmpParts[2], 10);
		}
		if (tmpParts.length === 2)
		{
			return parseInt(tmpParts[0], 10) * 60 + parseInt(tmpParts[1], 10);
		}
		return parseFloat(pText) || 0;
	}

	/**
	 * Open any frame in the preview overlay.
	 * Unified entry point for both regular and custom frames.
	 *
	 * @param {Object} pFrameInfo - Frame descriptor { Type: 'regular'|'custom', Index, Filename, TimestampFormatted, CacheKey }
	 */
	openFrame(pFrameInfo)
	{
		if (!this._frameData || !pFrameInfo)
		{
			return;
		}

		let tmpCacheKey = pFrameInfo.CacheKey || this._frameData.CacheKey;
		let tmpURL = this._buildFrameURL(tmpCacheKey, pFrameInfo.Filename);
		let tmpLabel = pFrameInfo.TimestampFormatted + '  \u00b7  '
			+ (pFrameInfo.Type === 'regular' ? '#' + ((pFrameInfo.Index || 0) + 1) : 'custom');

		this._showFramePreview(tmpURL, tmpLabel, pFrameInfo.Type, pFrameInfo.Index);
	}

	/**
	 * Open a regular frame at full size (convenience wrapper for grid onclick).
	 *
	 * @param {number} pIndex - Frame index in the regular Frames array
	 */
	openFrameFullsize(pIndex)
	{
		if (!this._frameData || !this._frameData.Frames[pIndex])
		{
			return;
		}

		let tmpFrame = this._frameData.Frames[pIndex];
		this.openFrame(
		{
			Type: 'regular',
			Index: pIndex,
			Filename: tmpFrame.Filename,
			TimestampFormatted: tmpFrame.TimestampFormatted,
			CacheKey: this._frameData.CacheKey
		});
	}

	/**
	 * Open a custom frame in the preview overlay (convenience wrapper).
	 *
	 * @param {string} pFilename - Custom frame filename
	 * @param {string} pTimestamp - Formatted timestamp label
	 */
	openCustomFrameFullsize(pFilename, pTimestamp)
	{
		if (!this._frameData)
		{
			return;
		}

		// Find the custom frame by filename
		let tmpCustomIndex = -1;
		let tmpCacheKey = this._frameData.CacheKey;
		for (let i = 0; i < this._customFrames.length; i++)
		{
			if (this._customFrames[i].Filename === pFilename)
			{
				tmpCustomIndex = i;
				if (this._customFrames[i].CacheKey)
				{
					tmpCacheKey = this._customFrames[i].CacheKey;
				}
				break;
			}
		}

		this.openFrame(
		{
			Type: 'custom',
			Index: tmpCustomIndex,
			Filename: pFilename,
			TimestampFormatted: pTimestamp,
			CacheKey: tmpCacheKey
		});
	}

	/**
	 * Build a sorted list of all frames (regular + custom) for navigation.
	 */
	_buildAllFramesList()
	{
		let tmpAllFrames = [];

		// Add regular frames
		if (this._frameData && this._frameData.Frames)
		{
			for (let i = 0; i < this._frameData.Frames.length; i++)
			{
				let tmpFrame = this._frameData.Frames[i];
				tmpAllFrames.push({
					Type: 'regular',
					Index: i,
					Timestamp: tmpFrame.Timestamp,
					TimestampFormatted: tmpFrame.TimestampFormatted,
					Filename: tmpFrame.Filename,
					Label: tmpFrame.TimestampFormatted + '  \u00b7  #' + (tmpFrame.Index + 1)
				});
			}
		}

		// Add custom frames
		if (this._customFrames)
		{
			for (let i = 0; i < this._customFrames.length; i++)
			{
				let tmpCustom = this._customFrames[i];
				tmpAllFrames.push({
					Type: 'custom',
					Index: i,
					Timestamp: tmpCustom.Timestamp,
					TimestampFormatted: tmpCustom.TimestampFormatted,
					Filename: tmpCustom.Filename,
					CacheKey: tmpCustom.CacheKey || null,
					Label: tmpCustom.TimestampFormatted + '  \u00b7  custom'
				});
			}
		}

		// Sort by timestamp
		tmpAllFrames.sort((a, b) => a.Timestamp - b.Timestamp);

		return tmpAllFrames;
	}

	/**
	 * Show the frame preview overlay.
	 *
	 * @param {string} pURL - Frame image URL
	 * @param {string} pLabel - Frame label to display
	 * @param {string} pType - 'regular' or 'custom'
	 * @param {number} pIndex - Index within its type array
	 */
	_showFramePreview(pURL, pLabel, pType, pIndex)
	{
		// Store current preview state for navigation
		this._previewType = pType;
		this._previewIndex = pIndex;

		// Build all frames for prev/next navigation
		let tmpAllFrames = this._buildAllFramesList();
		this._previewAllFrames = tmpAllFrames;

		// Find current position in the unified list
		this._previewPosition = 0;
		for (let i = 0; i < tmpAllFrames.length; i++)
		{
			if (tmpAllFrames[i].Type === pType && tmpAllFrames[i].Index === pIndex)
			{
				this._previewPosition = i;
				break;
			}
		}

		// Build the overlay
		let tmpBackdrop = document.createElement('div');
		tmpBackdrop.className = 'retold-remote-vex-preview-backdrop';
		tmpBackdrop.id = 'RetoldRemote-VEX-Preview';
		tmpBackdrop.onclick = (e) =>
		{
			if (e.target === tmpBackdrop)
			{
				this.closeFramePreview();
			}
		};

		let tmpHTML = '';
		tmpHTML += '<div class="retold-remote-vex-preview-header">';
		tmpHTML += '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].closeFramePreview()" title="Back (Esc)">&larr; Back</button>';
		tmpHTML += '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].previewPrevFrame()" title="Previous (\u2190)">&lsaquo; Prev</button>';
		tmpHTML += '<div class="retold-remote-vex-preview-title" id="RetoldRemote-VEX-PreviewTitle">' + this._getFmt().escapeHTML(pLabel) + '</div>';
		tmpHTML += '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].previewNextFrame()" title="Next (\u2192)">Next &rsaquo;</button>';
		tmpHTML += '</div>';
		tmpHTML += '<div class="retold-remote-vex-preview-body" id="RetoldRemote-VEX-PreviewBody">';
		tmpHTML += '<img src="' + pURL + '" alt="' + this._getFmt().escapeHTML(pLabel) + '">';
		tmpHTML += '</div>';

		tmpBackdrop.innerHTML = tmpHTML;
		document.body.appendChild(tmpBackdrop);

		// Bind keyboard handler (stopImmediatePropagation prevents the global handler from also firing)
		this._previewKeyHandler = (e) =>
		{
			switch (e.key)
			{
				case 'Escape':
					e.preventDefault();
					e.stopImmediatePropagation();
					this.closeFramePreview();
					break;
				case 'ArrowLeft':
				case 'k':
					e.preventDefault();
					e.stopImmediatePropagation();
					this.previewPrevFrame();
					break;
				case 'ArrowRight':
				case 'j':
					e.preventDefault();
					e.stopImmediatePropagation();
					this.previewNextFrame();
					break;
			}
		};
		document.addEventListener('keydown', this._previewKeyHandler);
	}

	/**
	 * Close the frame preview overlay.
	 */
	closeFramePreview()
	{
		let tmpBackdrop = document.getElementById('RetoldRemote-VEX-Preview');
		if (tmpBackdrop)
		{
			tmpBackdrop.remove();
		}

		if (this._previewKeyHandler)
		{
			document.removeEventListener('keydown', this._previewKeyHandler);
			this._previewKeyHandler = null;
		}
	}

	/**
	 * Navigate to the previous frame in the preview.
	 */
	previewPrevFrame()
	{
		if (!this._previewAllFrames || this._previewPosition <= 0)
		{
			return;
		}

		this._previewPosition--;
		this._updatePreviewFrame();
	}

	/**
	 * Navigate to the next frame in the preview.
	 */
	previewNextFrame()
	{
		if (!this._previewAllFrames || this._previewPosition >= this._previewAllFrames.length - 1)
		{
			return;
		}

		this._previewPosition++;
		this._updatePreviewFrame();
	}

	/**
	 * Update the preview to show the frame at the current position.
	 */
	_updatePreviewFrame()
	{
		let tmpFrame = this._previewAllFrames[this._previewPosition];
		if (!tmpFrame || !this._frameData)
		{
			return;
		}

		// For custom frames, use the frame's own CacheKey (may differ from current batch)
		let tmpCacheKey = this._frameData.CacheKey;
		if (tmpFrame.Type === 'custom' && tmpFrame.CacheKey)
		{
			tmpCacheKey = tmpFrame.CacheKey;
		}
		let tmpURL = this._buildFrameURL(tmpCacheKey, tmpFrame.Filename);

		let tmpBody = document.getElementById('RetoldRemote-VEX-PreviewBody');
		if (tmpBody)
		{
			tmpBody.innerHTML = '<img src="' + tmpURL + '" alt="' + this._getFmt().escapeHTML(tmpFrame.Label) + '">';
		}

		let tmpTitle = document.getElementById('RetoldRemote-VEX-PreviewTitle');
		if (tmpTitle)
		{
			tmpTitle.textContent = tmpFrame.Label;
		}

		// Also select the corresponding frame in the grid behind the overlay
		this._previewType = tmpFrame.Type;
		this._previewIndex = tmpFrame.Index;

		if (tmpFrame.Type === 'regular')
		{
			this.selectFrame(tmpFrame.Index);
		}
	}

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

	/**
	 * Navigate back to the video viewer.
	 */
	goBack()
	{
		this._cleanupWindowListeners();

		if (this._currentPath)
		{
			let tmpApp = this.pict.views['RetoldRemote-MediaViewer'];
			if (tmpApp)
			{
				tmpApp.showMedia(this._currentPath, 'video');
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

RetoldRemoteVideoExplorerView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteVideoExplorerView;
