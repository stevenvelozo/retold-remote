/**
 * VideoExplorer — Selection Mixin
 *
 * Methods for timeline range selection: toggling selection mode,
 * setting/clearing range markers, drag-to-select on the timeline,
 * draggable slider handles for adjusting boundaries, and persisting
 * selection state to the server.
 *
 * Mixed into RetoldRemoteVideoExplorerView.prototype via Object.assign().
 * All methods access state through `this` (the view instance).
 *
 * @license MIT
 */

module.exports =
{
	// -----------------------------------------------------------------
	//  Selection mode
	// -----------------------------------------------------------------

	/**
	 * Toggle selection mode on or off.
	 * When on, timeline clicks/drags create a selection range.
	 * When off, timeline clicks extract frames (existing behavior).
	 */
	toggleSelectionMode: function toggleSelectionMode()
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
	},

	/**
	 * Set the selection start marker.
	 *
	 * @param {number} pTime - Timestamp in seconds
	 */
	setSelectionStart: function setSelectionStart(pTime)
	{
		this._selectionStartTime = pTime;
		this._renderSelectionOverlay();
		this._renderSliderHandles();
		this._updateSelectionInfo();
		this._saveState();
	},

	/**
	 * Set the selection end marker.
	 *
	 * @param {number} pTime - Timestamp in seconds
	 */
	setSelectionEnd: function setSelectionEnd(pTime)
	{
		this._selectionEndTime = pTime;
		this._renderSelectionOverlay();
		this._renderSliderHandles();
		this._updateSelectionInfo();
		this._saveState();
	},

	/**
	 * Clear the selection range.
	 */
	clearSelection: function clearSelection()
	{
		this._selectionStartTime = -1;
		this._selectionEndTime = -1;
		this._renderSelectionOverlay();
		this._renderSliderHandles();
		this._updateSelectionInfo();
		this._saveState();
	},

	/**
	 * Render (or remove) the selection overlay div inside the timeline bar.
	 */
	_renderSelectionOverlay: function _renderSelectionOverlay()
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
	},

	/**
	 * Update the selection info display with current selection range.
	 */
	_updateSelectionInfo: function _updateSelectionInfo()
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
	},

	// -----------------------------------------------------------------
	//  Selection drag (timeline bar)
	// -----------------------------------------------------------------

	/**
	 * Handle selection drag start (mousedown or touchstart on timeline bar).
	 *
	 * @param {Event} pEvent - MouseEvent or TouchEvent
	 */
	_onSelectionDragStart: function _onSelectionDragStart(pEvent)
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
	},

	/**
	 * Handle selection drag move (mousemove or touchmove on timeline bar).
	 *
	 * @param {Event} pEvent - MouseEvent or TouchEvent
	 */
	_onSelectionDragMove: function _onSelectionDragMove(pEvent)
	{
		if (!this._isDraggingTimeline)
		{
			return;
		}

		pEvent.preventDefault();
		this._selectionEndTime = this._getTimelineTimestamp(pEvent);
		this._renderSelectionOverlay();
	},

	/**
	 * Handle selection drag end (mouseup or touchend on window).
	 *
	 * @param {Event} pEvent - MouseEvent or TouchEvent
	 */
	_onSelectionDragEnd: function _onSelectionDragEnd(pEvent)
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
	},

	/**
	 * Clean up window-level event listeners (mouseup/touchend).
	 * Called when the explorer is closed or refreshed.
	 */
	_cleanupWindowListeners: function _cleanupWindowListeners()
	{
		if (this._boundDragEnd)
		{
			window.removeEventListener('mouseup', this._boundDragEnd);
			window.removeEventListener('touchend', this._boundDragEnd);
			this._boundDragEnd = null;
		}
	},

	// -----------------------------------------------------------------
	//  Slider handles (fine-adjustment of selection boundaries)
	// -----------------------------------------------------------------

	/**
	 * Render (or clear) the slider handles in the slider track above
	 * the timeline bar.  The handles sit at the start/end positions
	 * of the current selection range.
	 */
	_renderSliderHandles: function _renderSliderHandles()
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
	},

	/**
	 * Bind drag interaction to the slider handles (mouse + touch).
	 * Uses the slider track element for coordinate computation.
	 */
	_bindSliderHandleDrag: function _bindSliderHandleDrag()
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
	},

	/**
	 * Begin dragging a slider handle.
	 *
	 * @param {Event} pEvent - mousedown or touchstart
	 */
	_onSliderDragStart: function _onSliderDragStart(pEvent)
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
	},

	/**
	 * Handle slider handle drag move.
	 *
	 * @param {Event} pEvent - mousemove or touchmove
	 */
	_onSliderDragMove: function _onSliderDragMove(pEvent)
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
	},

	/**
	 * Handle slider handle drag end.
	 *
	 * @param {Event} pEvent - mouseup or touchend
	 */
	_onSliderDragEnd: function _onSliderDragEnd(pEvent)
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
	},

	// -----------------------------------------------------------------
	//  State persistence
	// -----------------------------------------------------------------

	/**
	 * Save the current selection state to the server (fire-and-forget).
	 * Called whenever the selection changes.
	 */
	_saveState: function _saveState()
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
};
