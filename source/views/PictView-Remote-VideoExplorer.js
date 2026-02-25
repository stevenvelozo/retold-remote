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
		tmpHTML += '<div class="retold-remote-vex-timeline-bar" id="RetoldRemote-VEX-TimelineBar">';

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
	 * Open a frame at full size (the original extracted frame).
	 *
	 * @param {number} pIndex - Frame index
	 */
	openFrameFullsize(pIndex)
	{
		if (!this._frameData || !this._frameData.Frames[pIndex])
		{
			return;
		}

		let tmpFrame = this._frameData.Frames[pIndex];
		let tmpURL = '/api/media/video-frame/' + this._frameData.CacheKey + '/' + tmpFrame.Filename;
		window.open(tmpURL, '_blank');
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
