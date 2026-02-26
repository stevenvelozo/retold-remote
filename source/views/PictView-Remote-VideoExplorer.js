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
			align-items: center;
			gap: 8px;
			padding: 8px 16px;
			background: var(--retold-bg-secondary);
			border-top: 1px solid var(--retold-border);
			flex-shrink: 0;
		}
		.retold-remote-vex-timeline-bar
		{
			flex: 1;
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
		this._fullResFrames = false;
		this._customFrames = [];
	}

	/**
	 * Show the video explorer for a given video file.
	 *
	 * @param {string} pFilePath - Relative file path
	 */
	showExplorer(pFilePath)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ActiveMode = 'video-explorer';
		this._currentPath = pFilePath;
		this._frameData = null;
		this._selectedFrameIndex = -1;
		this._customFrames = [];

		// Update the hash
		let tmpFragProvider = this.pict.providers['RetoldRemote-Provider'];
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
		tmpHTML += '<div class="retold-remote-vex-title">Video Explorer &mdash; ' + this._escapeHTML(tmpFileName) + '</div>';
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
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

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
			tmpInfoHTML += '<span class="retold-remote-vex-info-item"><span class="retold-remote-vex-info-label">Duration</span> <span class="retold-remote-vex-info-value">' + this._escapeHTML(tmpData.DurationFormatted) + '</span></span>';
			if (tmpData.VideoWidth && tmpData.VideoHeight)
			{
				tmpInfoHTML += '<span class="retold-remote-vex-info-item"><span class="retold-remote-vex-info-label">Resolution</span> <span class="retold-remote-vex-info-value">' + tmpData.VideoWidth + '&times;' + tmpData.VideoHeight + '</span></span>';
			}
			if (tmpData.Codec)
			{
				tmpInfoHTML += '<span class="retold-remote-vex-info-item"><span class="retold-remote-vex-info-label">Codec</span> <span class="retold-remote-vex-info-value">' + this._escapeHTML(tmpData.Codec) + '</span></span>';
			}
			if (tmpData.FileSize)
			{
				tmpInfoHTML += '<span class="retold-remote-vex-info-item"><span class="retold-remote-vex-info-label">Size</span> <span class="retold-remote-vex-info-value">' + this._formatFileSize(tmpData.FileSize) + '</span></span>';
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
				let tmpFrameURL = '/api/media/video-frame/' + tmpData.CacheKey + '/' + tmpFrame.Filename;

				tmpGridHTML += '<div class="retold-remote-vex-frame" id="retold-vex-frame-' + i + '" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].selectFrame(' + i + ')" ondblclick="pict.views[\'RetoldRemote-VideoExplorer\'].openFrameFullsize(' + i + ')">';
				tmpGridHTML += '<img src="' + tmpFrameURL + '" alt="Frame at ' + this._escapeHTML(tmpFrame.TimestampFormatted) + '" loading="lazy">';
				tmpGridHTML += '<div class="retold-remote-vex-frame-info">';
				tmpGridHTML += '<span class="retold-remote-vex-frame-timestamp">' + this._escapeHTML(tmpFrame.TimestampFormatted) + '</span>';
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
		tmpHTML += '<div class="retold-remote-vex-timeline-bar" id="RetoldRemote-VEX-TimelineBar" '
			+ 'onclick="pict.views[\'RetoldRemote-VideoExplorer\'].onTimelineClick(event)">';

		for (let i = 0; i < tmpData.Frames.length; i++)
		{
			let tmpFrame = tmpData.Frames[i];
			let tmpPercent = (tmpFrame.Timestamp / tmpData.Duration) * 100;
			let tmpSelectedClass = (i === this._selectedFrameIndex) ? ' selected' : '';
			tmpHTML += '<div class="retold-remote-vex-timeline-marker' + tmpSelectedClass + '" '
				+ 'style="left:' + tmpPercent.toFixed(2) + '%;" '
				+ 'title="' + this._escapeHTML(tmpFrame.TimestampFormatted) + '" '
				+ 'onclick="event.stopPropagation(); pict.views[\'RetoldRemote-VideoExplorer\'].selectFrame(' + i + ')">'
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
					+ 'title="' + this._escapeHTML(tmpCustom.TimestampFormatted) + '">'
					+ '</div>';
			}
		}

		tmpHTML += '</div>';
		tmpHTML += '<span class="retold-remote-vex-timeline-label">' + this._escapeHTML(tmpData.DurationFormatted) + '</span>';

		tmpTimeline.innerHTML = tmpHTML;
		tmpTimeline.style.display = '';
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
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(this._currentPath) : encodeURIComponent(this._currentPath);

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
					let tmpFrameURL = '/api/media/video-frame/' + tmpData.CacheKey + '/' + pResult.Filename;
					let tmpEscFilename = tmpSelf._escapeHTML(pResult.Filename).replace(/'/g, "\\'");
					let tmpEscTimestamp = tmpSelf._escapeHTML(pResult.TimestampFormatted).replace(/'/g, "\\'");
					tmpPlaceholder.ondblclick = function() { pict.views['RetoldRemote-VideoExplorer'].openCustomFrameFullsize(tmpEscFilename, tmpEscTimestamp); };
					tmpPlaceholder.style.cursor = 'pointer';
					tmpPlaceholder.innerHTML = '<img src="' + tmpFrameURL + '" alt="Frame at ' + tmpSelf._escapeHTML(pResult.TimestampFormatted) + '" loading="lazy">'
						+ '<div class="retold-remote-vex-frame-info">'
						+ '<span class="retold-remote-vex-frame-timestamp">' + tmpSelf._escapeHTML(pResult.TimestampFormatted) + '</span>'
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
					tmpPlaceholder.innerHTML = '<div class="retold-remote-vex-frame-loading">Failed: ' + tmpSelf._escapeHTML(pError.message) + '</div>'
						+ '<div class="retold-remote-vex-frame-info">'
						+ '<span class="retold-remote-vex-frame-timestamp">' + tmpSelf._formatTimestamp(tmpTimestamp) + '</span>'
						+ '<span class="retold-remote-vex-frame-index">error</span>'
						+ '</div>';
				}
			});
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
		let tmpGrid = document.querySelector('.retold-remote-vex-grid');
		if (!tmpGrid)
		{
			return;
		}

		let tmpData = this._frameData;

		// Build the placeholder element
		let tmpEl = document.createElement('div');
		tmpEl.className = 'retold-remote-vex-frame custom-frame';
		tmpEl.id = pPlaceholderId;
		tmpEl.innerHTML = '<div class="retold-remote-vex-frame-loading">Extracting...</div>'
			+ '<div class="retold-remote-vex-frame-info">'
			+ '<span class="retold-remote-vex-frame-timestamp">' + this._formatTimestamp(pTimestamp) + '</span>'
			+ '<span class="retold-remote-vex-frame-index">custom</span>'
			+ '</div>';

		// Find the correct insertion position by comparing timestamps
		// The grid children correspond to tmpData.Frames (original batch) plus any previously inserted custom frames
		let tmpInsertBefore = null;
		let tmpChildren = tmpGrid.children;

		for (let i = 0; i < tmpChildren.length; i++)
		{
			let tmpChild = tmpChildren[i];
			// Get the timestamp from the info bar text
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
			tmpGrid.insertBefore(tmpEl, tmpInsertBefore);
		}
		else
		{
			tmpGrid.appendChild(tmpEl);
		}

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
	 * Format a timestamp in seconds to a human-readable string.
	 *
	 * @param {number} pSeconds - Timestamp in seconds
	 * @returns {string} Formatted string like "1:23" or "1:02:34"
	 */
	_formatTimestamp(pSeconds)
	{
		let tmpHours = Math.floor(pSeconds / 3600);
		let tmpMinutes = Math.floor((pSeconds % 3600) / 60);
		let tmpSecs = Math.floor(pSeconds % 60);

		if (tmpHours > 0)
		{
			return tmpHours + ':' + String(tmpMinutes).padStart(2, '0') + ':' + String(tmpSecs).padStart(2, '0');
		}
		return tmpMinutes + ':' + String(tmpSecs).padStart(2, '0');
	}

	/**
	 * Open a frame at full size in an inline preview overlay.
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
		let tmpURL = '/api/media/video-frame/' + this._frameData.CacheKey + '/' + tmpFrame.Filename;
		let tmpLabel = tmpFrame.TimestampFormatted + '  \u00b7  #' + (tmpFrame.Index + 1);

		this._showFramePreview(tmpURL, tmpLabel, 'regular', pIndex);
	}

	/**
	 * Open a custom frame (from timeline click) in the preview overlay.
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

		let tmpURL = '/api/media/video-frame/' + this._frameData.CacheKey + '/' + pFilename;
		let tmpLabel = pTimestamp + '  \u00b7  custom';

		// Find the custom frame index for navigation
		let tmpCustomIndex = -1;
		for (let i = 0; i < this._customFrames.length; i++)
		{
			if (this._customFrames[i].Filename === pFilename)
			{
				tmpCustomIndex = i;
				break;
			}
		}

		this._showFramePreview(tmpURL, tmpLabel, 'custom', tmpCustomIndex);
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
		tmpHTML += '<div class="retold-remote-vex-preview-title" id="RetoldRemote-VEX-PreviewTitle">' + this._escapeHTML(pLabel) + '</div>';
		tmpHTML += '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].previewNextFrame()" title="Next (\u2192)">Next &rsaquo;</button>';
		tmpHTML += '</div>';
		tmpHTML += '<div class="retold-remote-vex-preview-body" id="RetoldRemote-VEX-PreviewBody">';
		tmpHTML += '<img src="' + pURL + '" alt="' + this._escapeHTML(pLabel) + '">';
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

		let tmpURL = '/api/media/video-frame/' + this._frameData.CacheKey + '/' + tmpFrame.Filename;

		let tmpBody = document.getElementById('RetoldRemote-VEX-PreviewBody');
		if (tmpBody)
		{
			tmpBody.innerHTML = '<img src="' + tmpURL + '" alt="' + this._escapeHTML(tmpFrame.Label) + '">';
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
				+ '<div class="retold-remote-vex-error-message">' + this._escapeHTML(pMessage || 'An error occurred.') + '</div>'
				+ '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].goBack()">Back to Video</button>'
				+ '</div>';
		}
	}

	_escapeHTML(pText)
	{
		if (!pText) return '';
		return pText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	_formatFileSize(pBytes)
	{
		if (!pBytes || pBytes === 0) return '0 B';
		let tmpUnits = ['B', 'KB', 'MB', 'GB', 'TB'];
		let tmpIndex = Math.floor(Math.log(pBytes) / Math.log(1024));
		if (tmpIndex >= tmpUnits.length) tmpIndex = tmpUnits.length - 1;
		let tmpSize = pBytes / Math.pow(1024, tmpIndex);
		return tmpSize.toFixed(tmpIndex === 0 ? 0 : 1) + ' ' + tmpUnits[tmpIndex];
	}
}

RetoldRemoteVideoExplorerView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteVideoExplorerView;
