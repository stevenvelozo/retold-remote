/**
 * VideoExplorer — Custom Frames Mixin
 *
 * Methods for extracting individual frames at arbitrary timestamps,
 * generating evenly-spaced frames across a selection range, inserting
 * frame cards into the grid, loading saved custom frames from the
 * server, and the timeline click handler.
 *
 * Mixed into RetoldRemoteVideoExplorerView.prototype via Object.assign().
 * All methods access state through `this` (the view instance).
 *
 * @license MIT
 */

module.exports =
{
	// -----------------------------------------------------------------
	//  Frame extraction
	// -----------------------------------------------------------------

	/**
	 * Generate frames evenly spaced across the current selection range.
	 * Uses the frame count from the GenerateControls dropdown.
	 */
	generateSelectionFrames: function generateSelectionFrames()
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
	},

	/**
	 * Handle a click on the timeline bar (not on a marker).
	 * Calculates the timestamp from the click position and extracts a single frame.
	 *
	 * @param {MouseEvent} pEvent - The click event
	 */
	onTimelineClick: function onTimelineClick(pEvent)
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
	},

	// -----------------------------------------------------------------
	//  Saved custom frames (load from server)
	// -----------------------------------------------------------------

	/**
	 * Load previously saved custom frames from the server and restore
	 * them into the grid.  Called after batch frames are rendered.
	 */
	_loadSavedCustomFrames: function _loadSavedCustomFrames()
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
	},

	// -----------------------------------------------------------------
	//  DOM insertion helpers
	// -----------------------------------------------------------------

	/**
	 * Insert a DOM element into the frame grid at the correct chronological
	 * position based on timestamp.  Shared helper for placeholder and
	 * restored frame insertion.
	 *
	 * @param {HTMLElement} pElement - The element to insert
	 * @param {number} pTimestamp - Timestamp in seconds for sort position
	 */
	_insertFrameAtPosition: function _insertFrameAtPosition(pElement, pTimestamp)
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
	},

	/**
	 * Insert a fully-rendered custom frame card into the grid at its
	 * correct chronological position.  Used when restoring saved state
	 * (the image already exists on disk, so no loading placeholder needed).
	 *
	 * @param {Object} pFrame    - Saved custom frame object { Timestamp, TimestampFormatted, Filename, CacheKey }
	 * @param {string} pFrameURL - Image URL for the frame
	 */
	_insertRestoredCustomFrame: function _insertRestoredCustomFrame(pFrame, pFrameURL)
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
	},

	/**
	 * Insert a loading placeholder frame card into the grid at the correct
	 * chronological position based on timestamp.
	 *
	 * @param {number} pTimestamp    - Timestamp in seconds
	 * @param {string} pPlaceholderId - DOM id for the placeholder element
	 */
	_insertFramePlaceholder: function _insertFramePlaceholder(pTimestamp, pPlaceholderId)
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
	},

	/**
	 * Parse a formatted timestamp string back to seconds.
	 * Handles "M:SS", "MM:SS", and "H:MM:SS" formats.
	 *
	 * @param {string} pText - Formatted timestamp like "1:23" or "1:02:34"
	 * @returns {number} Seconds
	 */
	_parseTimestamp: function _parseTimestamp(pText)
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
};
