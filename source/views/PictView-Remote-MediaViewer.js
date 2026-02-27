const libPictView = require('pict-view');
const libPictSectionCode = require('pict-section-code');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-MediaViewer",
	DefaultRenderable: "RetoldRemote-MediaViewer",
	DefaultDestinationAddress: "#RetoldRemote-Viewer-Container",
	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-viewer
		{
			display: flex;
			flex-direction: column;
			height: 100%;
		}
		.retold-remote-viewer-header
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
		.retold-remote-viewer-nav-btn
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
		.retold-remote-viewer-nav-btn:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
		.retold-remote-viewer-title
		{
			flex: 1;
			font-size: 0.82rem;
			color: var(--retold-text-secondary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-align: center;
		}
		.retold-remote-viewer-body
		{
			flex: 1;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: auto;
			position: relative;
		}
		/* File info overlay */
		.retold-remote-fileinfo-overlay
		{
			position: absolute;
			top: 48px;
			right: 16px;
			background: var(--retold-bg-secondary);
			border: 1px solid var(--retold-border);
			border-radius: 6px;
			padding: 16px;
			color: var(--retold-text-secondary);
			font-size: 0.78rem;
			z-index: 10;
			min-width: 200px;
			display: none;
		}
		.retold-remote-fileinfo-row
		{
			display: flex;
			justify-content: space-between;
			padding: 3px 0;
		}
		.retold-remote-fileinfo-label
		{
			color: var(--retold-text-dim);
		}
		.retold-remote-fileinfo-value
		{
			color: var(--retold-text-primary);
		}
		/* Code viewer container */
		.retold-remote-code-viewer-container
		{
			width: 100%;
			height: 100%;
			overflow: hidden;
		}
		.retold-remote-code-viewer-loading
		{
			padding: 16px 20px;
			color: var(--retold-text-dim);
			font-style: italic;
			font-size: 0.82rem;
		}
		/* pict-section-code dark theme overrides */
		.retold-remote-code-viewer-container .pict-code-editor-wrap
		{
			border: none;
			border-radius: 0;
			height: 100%;
			font-family: var(--retold-font-mono, 'SFMono-Regular', 'SF Mono', 'Menlo', 'Consolas', monospace);
			font-size: 0.82rem;
			line-height: 1.6;
		}
		.retold-remote-code-viewer-container .pict-code-line-numbers
		{
			background: var(--retold-bg-secondary);
			border-right: 1px solid var(--retold-border);
			color: var(--retold-text-dim);
			font-size: 0.78rem;
			line-height: 1.6;
			padding: 10px 0;
		}
		.retold-remote-code-viewer-container .pict-code-editor
		{
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-primary);
			padding: 10px 10px 10px 12px;
			tab-size: 4;
			-moz-tab-size: 4;
			caret-color: var(--retold-accent);
			border-radius: 0;
		}
		/* Syntax highlighting colors for dark themes */
		.retold-remote-code-viewer-container .pict-code-editor .keyword { color: #C678DD; }
		.retold-remote-code-viewer-container .pict-code-editor .string { color: #98C379; }
		.retold-remote-code-viewer-container .pict-code-editor .number { color: #D19A66; }
		.retold-remote-code-viewer-container .pict-code-editor .comment { color: #5C6370; font-style: italic; }
		.retold-remote-code-viewer-container .pict-code-editor .operator { color: #56B6C2; }
		.retold-remote-code-viewer-container .pict-code-editor .punctuation { color: #ABB2BF; }
		.retold-remote-code-viewer-container .pict-code-editor .function-name { color: #61AFEF; }
		.retold-remote-code-viewer-container .pict-code-editor .property { color: #E06C75; }
		.retold-remote-code-viewer-container .pict-code-editor .tag { color: #E06C75; }
		.retold-remote-code-viewer-container .pict-code-editor .attr-name { color: #D19A66; }
		.retold-remote-code-viewer-container .pict-code-editor .attr-value { color: #98C379; }
		/* Video wrap with stats bar */
		.retold-remote-video-wrap
		{
			display: flex;
			flex-direction: column;
			align-items: center;
			max-width: 100%;
			max-height: 100%;
			width: 100%;
			height: 100%;
		}
		.retold-remote-video-wrap video
		{
			flex: 1;
			min-height: 0;
			max-width: 100%;
			max-height: calc(100% - 40px);
			object-fit: contain;
		}
		.retold-remote-video-stats
		{
			display: flex;
			align-items: center;
			gap: 16px;
			padding: 6px 16px;
			background: var(--retold-bg-secondary);
			border-top: 1px solid var(--retold-border);
			width: 100%;
			flex-shrink: 0;
			font-size: 0.75rem;
			color: var(--retold-text-dim);
			white-space: nowrap;
			overflow-x: auto;
		}
		.retold-remote-video-stats span
		{
			display: inline-flex;
			align-items: center;
			gap: 4px;
		}
		.retold-remote-video-stats .retold-remote-video-stat-label
		{
			color: var(--retold-text-muted);
		}
		.retold-remote-video-stats .retold-remote-video-stat-value
		{
			color: var(--retold-text-secondary);
		}
		.retold-remote-explore-btn
		{
			margin-left: auto;
			padding: 3px 12px;
			border: 1px solid var(--retold-accent);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-accent);
			font-size: 0.75rem;
			cursor: pointer;
			transition: background 0.15s, color 0.15s;
			font-family: inherit;
			white-space: nowrap;
		}
		.retold-remote-explore-btn:hover
		{
			background: var(--retold-accent);
			color: var(--retold-bg-primary);
		}
		.retold-remote-vlc-btn
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
			white-space: nowrap;
		}
		.retold-remote-vlc-btn:hover
		{
			background: var(--retold-accent);
			color: var(--retold-bg-primary);
		}
		/* Video action menu */
		.retold-remote-video-action-menu
		{
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 12px;
			width: 100%;
			height: 100%;
		}
		.retold-remote-video-action-menu-title
		{
			font-size: 0.85rem;
			color: var(--retold-text-secondary);
			margin-bottom: 4px;
			text-align: center;
			overflow: hidden;
			text-overflow: ellipsis;
			max-width: 80%;
		}
		.retold-remote-video-action-thumb-wrap
		{
			margin-bottom: 4px;
			text-align: center;
		}
		.retold-remote-video-action-thumb-wrap img
		{
			max-width: 640px;
			max-height: 360px;
			border-radius: 6px;
			border: 1px solid var(--retold-border);
			object-fit: contain;
			background: var(--retold-bg-primary);
		}
		.retold-remote-video-action-thumb-wrap .retold-remote-video-action-thumb-loading
		{
			color: var(--retold-text-dim);
			font-size: 0.78rem;
			font-style: italic;
			padding: 8px;
		}
		.retold-remote-video-action-btn
		{
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 12px 24px;
			min-width: 280px;
			border: 1px solid var(--retold-border);
			border-radius: 6px;
			background: var(--retold-bg-secondary);
			color: var(--retold-text-secondary);
			font-size: 0.85rem;
			cursor: pointer;
			transition: border-color 0.15s, color 0.15s, background 0.15s;
			font-family: inherit;
			text-align: left;
		}
		.retold-remote-video-action-btn:hover,
		.retold-remote-video-action-btn.selected
		{
			border-color: var(--retold-accent);
			color: var(--retold-text-primary);
			background: var(--retold-bg-tertiary);
		}
		.retold-remote-video-action-key
		{
			display: inline-block;
			padding: 2px 8px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: var(--retold-bg-primary);
			color: var(--retold-text-dim);
			font-size: 0.72rem;
			font-family: var(--retold-font-mono, monospace);
			min-width: 24px;
			text-align: center;
		}
		/* Ebook reader */
		.retold-remote-ebook-wrap
		{
			display: flex;
			width: 100%;
			height: 100%;
			position: relative;
		}
		.retold-remote-ebook-toc
		{
			width: 240px;
			flex-shrink: 0;
			background: var(--retold-bg-secondary);
			border-right: 1px solid var(--retold-border);
			overflow-y: auto;
			font-size: 0.78rem;
			padding: 8px 0;
		}
		.retold-remote-ebook-toc.collapsed
		{
			display: none;
		}
		.retold-remote-ebook-toc-item
		{
			display: block;
			padding: 6px 16px;
			color: var(--retold-text-secondary);
			text-decoration: none;
			cursor: pointer;
			transition: background 0.1s, color 0.1s;
			border: none;
			background: none;
			width: 100%;
			text-align: left;
			font-family: inherit;
			font-size: inherit;
		}
		.retold-remote-ebook-toc-item:hover
		{
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-primary);
		}
		.retold-remote-ebook-toc-item.indent-1
		{
			padding-left: 32px;
		}
		.retold-remote-ebook-toc-item.indent-2
		{
			padding-left: 48px;
		}
		.retold-remote-ebook-reader
		{
			flex: 1;
			display: flex;
			flex-direction: column;
			min-width: 0;
			position: relative;
		}
		.retold-remote-ebook-content
		{
			flex: 1;
			position: relative;
			overflow: hidden;
		}
		.retold-remote-ebook-content iframe
		{
			border: none;
		}
		.retold-remote-ebook-controls
		{
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 16px;
			padding: 8px 16px;
			background: var(--retold-bg-secondary);
			border-top: 1px solid var(--retold-border);
			flex-shrink: 0;
		}
		.retold-remote-ebook-page-btn
		{
			padding: 6px 20px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.82rem;
			cursor: pointer;
			transition: color 0.15s, border-color 0.15s;
			font-family: inherit;
		}
		.retold-remote-ebook-page-btn:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
		.retold-remote-ebook-toc-btn
		{
			padding: 6px 12px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.75rem;
			cursor: pointer;
			font-family: inherit;
		}
		.retold-remote-ebook-toc-btn:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
		.retold-remote-ebook-loading
		{
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			height: 100%;
			color: var(--retold-text-dim);
			font-size: 0.85rem;
		}
	`
};

class RetoldRemoteMediaViewerView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	/**
	 * Show the media viewer for a given file.
	 *
	 * @param {string} pFilePath  - Relative file path
	 * @param {string} pMediaType - 'image', 'video', 'audio', 'document', or 'other'
	 */
	showMedia(pFilePath, pMediaType)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ActiveMode = 'viewer';
		tmpRemote.CurrentViewerFile = pFilePath;
		tmpRemote.CurrentViewerMediaType = pMediaType;
		tmpRemote.VideoMenuActive = (pMediaType === 'video');

		// Show viewer, hide gallery
		let tmpGalleryContainer = document.getElementById('RetoldRemote-Gallery-Container');
		let tmpViewerContainer = document.getElementById('RetoldRemote-Viewer-Container');

		if (tmpGalleryContainer) tmpGalleryContainer.style.display = 'none';
		if (tmpViewerContainer) tmpViewerContainer.style.display = 'block';

		let tmpFileName = pFilePath.replace(/^.*\//, '');
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpContentURL = tmpProvider ? tmpProvider.getContentURL(pFilePath) : ('/content/' + encodeURIComponent(pFilePath));

		// Build the viewer HTML
		let tmpHTML = '<div class="retold-remote-viewer">';

		// Header with nav
		tmpHTML += '<div class="retold-remote-viewer-header">';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\'].closeViewer()" title="Back (Esc)">&larr; Back</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\'].prevFile()" title="Previous (k)">&lsaquo; Prev</button>';
		tmpHTML += '<div class="retold-remote-viewer-title">' + this._escapeHTML(tmpFileName) + '</div>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\'].nextFile()" title="Next (j)">Next &rsaquo;</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._toggleFileInfo()" title="Info (i)">&#9432;</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._toggleFullscreen()" title="Fullscreen (f)">&#9634;</button>';
		tmpHTML += '</div>';

		// Body with media content
		tmpHTML += '<div class="retold-remote-viewer-body">';

		switch (pMediaType)
		{
			case 'image':
				tmpHTML += this._buildImageHTML(tmpContentURL, tmpFileName);
				break;
			case 'video':
				tmpHTML += this._buildVideoHTML(tmpContentURL, tmpFileName);
				break;
			case 'audio':
				tmpHTML += this._buildAudioHTML(tmpContentURL, tmpFileName);
				break;
			case 'text':
				tmpHTML += this._buildTextHTML(tmpContentURL, tmpFileName, pFilePath);
				break;
			case 'document':
				tmpHTML += this._buildDocumentHTML(tmpContentURL, tmpFileName, pFilePath);
				break;
			default:
				tmpHTML += this._buildFallbackHTML(tmpContentURL, tmpFileName);
				break;
		}

		// File info overlay (hidden by default)
		tmpHTML += '<div class="retold-remote-fileinfo-overlay" id="RetoldRemote-FileInfo-Overlay">';
		tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Loading...</span></div>';
		tmpHTML += '</div>';

		tmpHTML += '</div>'; // end body
		tmpHTML += '</div>'; // end viewer

		if (tmpViewerContainer)
		{
			tmpViewerContainer.innerHTML = tmpHTML;
		}

		// Fetch and populate file info
		this._loadFileInfo(pFilePath);

		// Fetch text content and initialize code viewer
		if (pMediaType === 'text')
		{
			this._loadCodeViewer(tmpContentURL, pFilePath);
		}

		// Load ebook viewer for epub/mobi
		if (pMediaType === 'document')
		{
			let tmpExt = pFilePath.replace(/^.*\./, '').toLowerCase();
			if (tmpExt === 'epub' || tmpExt === 'mobi')
			{
				this._loadEbookViewer(tmpContentURL, pFilePath);
			}
		}

		// Update topbar
		let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBar)
		{
			tmpTopBar.updateInfo();
		}
	}

	_buildImageHTML(pURL, pFileName)
	{
		return '<img src="' + pURL + '" alt="' + this._escapeHTML(pFileName) + '" '
			+ 'style="max-width: 100%; max-height: 100%; object-fit: contain; cursor: zoom-in;" '
			+ 'id="RetoldRemote-ImageViewer-Img" '
			+ 'onload="pict.views[\'RetoldRemote-ImageViewer\'].initImage()" '
			+ 'onclick="pict.views[\'RetoldRemote-ImageViewer\'].toggleZoom()">';
	}

	_buildVideoHTML(pURL, pFileName)
	{
		let tmpCapabilities = this.pict.AppData.RetoldRemote.ServerCapabilities || {};
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpFilePath = tmpRemote.CurrentViewerFile;

		// Build the action menu (shown by default instead of the player)
		let tmpHTML = '<div class="retold-remote-video-action-menu" id="RetoldRemote-VideoActionMenu">';
		tmpHTML += '<div class="retold-remote-video-action-menu-title">' + this._escapeHTML(pFileName) + '</div>';

		// Frame preview container (loaded on demand via t key or automatically)
		if (tmpCapabilities.ffmpeg)
		{
			tmpHTML += '<div id="RetoldRemote-VideoActionThumb" class="retold-remote-video-action-thumb-wrap"></div>';
			// Kick off frame extraction automatically
			setTimeout(() => { this.loadVideoMenuFrame(); }, 0);
		}

		// Explore option (e)
		if (tmpCapabilities.ffmpeg)
		{
			tmpHTML += '<button class="retold-remote-video-action-btn" '
				+ 'onclick="pict.views[\'RetoldRemote-VideoExplorer\'].showExplorer(pict.AppData.RetoldRemote.CurrentViewerFile)" '
				+ 'title="Explore frames from this video">'
				+ '<span class="retold-remote-video-action-key">e</span>'
				+ 'Explore Video Frames'
				+ '</button>';
		}

		// Play option (space/enter)
		tmpHTML += '<button class="retold-remote-video-action-btn selected" '
			+ 'onclick="pict.views[\'RetoldRemote-MediaViewer\'].playVideo()" '
			+ 'title="Play video in browser">'
			+ '<span class="retold-remote-video-action-key">Space</span>'
			+ 'Play in Browser'
			+ '</button>';

		// Thumbnail option (t)
		if (tmpCapabilities.ffmpeg)
		{
			tmpHTML += '<button class="retold-remote-video-action-btn" '
				+ 'onclick="pict.views[\'RetoldRemote-MediaViewer\'].loadVideoMenuFrame()" '
				+ 'title="Extract a frame from the midpoint of this video">'
				+ '<span class="retold-remote-video-action-key">t</span>'
				+ 'Thumbnail'
				+ '</button>';
		}

		// VLC streaming option (v) — always available, streams from server to client VLC
		tmpHTML += '<button class="retold-remote-video-action-btn" '
			+ 'onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._streamWithVLC()" '
			+ 'title="Stream to VLC on this device">'
			+ '<span class="retold-remote-video-action-key">v</span>'
			+ 'Stream with VLC'
			+ '</button>';

		tmpHTML += '</div>';

		return tmpHTML;
	}

	/**
	 * Launch the in-browser video player (from the video action menu).
	 */
	playVideo()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpFilePath = tmpRemote.CurrentViewerFile;
		if (!tmpFilePath) return;

		let tmpFileName = tmpFilePath.replace(/^.*\//, '');
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpContentURL = tmpProvider ? tmpProvider.getContentURL(tmpFilePath) : ('/content/' + encodeURIComponent(tmpFilePath));
		let tmpCapabilities = tmpRemote.ServerCapabilities || {};

		let tmpHTML = '<div class="retold-remote-video-wrap">';

		let tmpAutoplayVideo = tmpRemote.AutoplayVideo ? ' autoplay' : '';
		tmpHTML += '<video controls' + tmpAutoplayVideo + ' preload="metadata" '
			+ 'id="RetoldRemote-VideoPlayer">'
			+ '<source src="' + tmpContentURL + '">'
			+ 'Your browser does not support the video tag.'
			+ '</video>';

		// Stats bar below the video
		tmpHTML += '<div class="retold-remote-video-stats" id="RetoldRemote-VideoStats">';
		tmpHTML += '<span class="retold-remote-video-stat-label">Loading info...</span>';

		if (tmpCapabilities.ffmpeg)
		{
			tmpHTML += '<button class="retold-remote-explore-btn" '
				+ 'onclick="pict.views[\'RetoldRemote-VideoExplorer\'].showExplorer(pict.AppData.RetoldRemote.CurrentViewerFile)" '
				+ 'title="Explore frames from this video">'
				+ 'Explore Video'
				+ '</button>';
		}

		tmpHTML += '<button class="retold-remote-vlc-btn" '
			+ 'onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._streamWithVLC()" '
			+ 'title="Stream to VLC on this device">'
			+ 'Stream with VLC'
			+ '</button>';

		tmpHTML += '</div>'; // end stats
		tmpHTML += '</div>'; // end wrap

		// Replace the action menu with the player
		let tmpMenu = document.getElementById('RetoldRemote-VideoActionMenu');
		if (tmpMenu)
		{
			tmpMenu.outerHTML = tmpHTML;
		}

		// Mark that we are now in player mode (not menu mode)
		tmpRemote.VideoMenuActive = false;
	}

	/**
	 * Extract and display a single full-resolution frame from the midpoint of the current video.
	 */
	loadVideoMenuFrame()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpFilePath = tmpRemote.CurrentViewerFile;
		if (!tmpFilePath) return;

		let tmpThumbWrap = document.getElementById('RetoldRemote-VideoActionThumb');
		if (!tmpThumbWrap) return;

		tmpThumbWrap.innerHTML = '<div class="retold-remote-video-action-thumb-loading">Extracting frame...</div>';

		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(tmpFilePath) : encodeURIComponent(tmpFilePath);

		fetch('/api/media/video-frames?path=' + tmpPathParam + '&count=1')
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				// Verify we are still on the same file and still in the menu
				if (tmpRemote.CurrentViewerFile !== tmpFilePath) return;
				let tmpWrap = document.getElementById('RetoldRemote-VideoActionThumb');
				if (!tmpWrap) return;

				if (pData && pData.Frames && pData.Frames.length > 0)
				{
					let tmpFrame = pData.Frames[0];
					let tmpFrameURL = '/api/media/video-frame/' + pData.CacheKey + '/' + tmpFrame.Filename;
					tmpWrap.innerHTML = '<img src="' + tmpFrameURL + '" '
						+ 'alt="' + this._escapeHTML(tmpFilePath.replace(/^.*\//, '')) + '" '
						+ 'onerror="this.parentNode.innerHTML=\'\'">';
				}
				else
				{
					tmpWrap.innerHTML = '';
				}
			})
			.catch(() =>
			{
				let tmpWrap = document.getElementById('RetoldRemote-VideoActionThumb');
				if (tmpWrap) tmpWrap.innerHTML = '';
			});
	}

	_buildAudioHTML(pURL, pFileName)
	{
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpIconHTML = tmpIconProvider ? '<span class="retold-remote-icon retold-remote-icon-lg">' + tmpIconProvider.getIcon('music-note', 64) + '</span>' : '&#127925;';

		let tmpHTML = '<div style="text-align: center; padding: 40px;">'
			+ '<div style="margin-bottom: 24px;">' + tmpIconHTML + '</div>'
			+ '<div style="font-size: 1.1rem; color: var(--retold-text-secondary); margin-bottom: 24px;">' + this._escapeHTML(pFileName) + '</div>'
			+ '<audio controls' + (this.pict.AppData.RetoldRemote.AutoplayAudio ? ' autoplay' : '') + ' preload="metadata" id="RetoldRemote-AudioPlayer" style="width: 100%; max-width: 500px;">'
			+ '<source src="' + pURL + '">'
			+ 'Your browser does not support the audio tag.'
			+ '</audio>';

		// Action buttons below the player
		tmpHTML += '<div style="margin-top: 20px; display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">';

		// Explore Audio button (available when ffprobe is present)
		let tmpCapabilities = this.pict.AppData.RetoldRemote.ServerCapabilities || {};
		if (tmpCapabilities.ffprobe || tmpCapabilities.ffmpeg)
		{
			tmpHTML += '<button class="retold-remote-explore-btn" '
				+ 'onclick="pict.views[\'RetoldRemote-AudioExplorer\'].showExplorer(pict.AppData.RetoldRemote.CurrentViewerFile)" '
				+ 'title="Explore waveform and extract segments from this audio">'
				+ 'Explore Audio'
				+ '</button>';
		}

		// Stream with VLC
		tmpHTML += '<button class="retold-remote-vlc-btn" '
			+ 'onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._streamWithVLC()" '
			+ 'title="Stream to VLC on this device (v)">'
			+ 'Stream with VLC'
			+ '</button>';

		tmpHTML += '</div>';

		tmpHTML += '</div>';
		return tmpHTML;
	}

	_buildDocumentHTML(pURL, pFileName, pFilePath)
	{
		let tmpExtension = pFilePath.replace(/^.*\./, '').toLowerCase();

		if (tmpExtension === 'pdf')
		{
			return '<iframe src="' + pURL + '" '
				+ 'style="width: 100%; height: 100%; border: none;">'
				+ '</iframe>';
		}

		if (tmpExtension === 'epub' || tmpExtension === 'mobi')
		{
			return this._buildEbookHTML(pURL, pFileName, pFilePath);
		}

		// For other document types, show a download link
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpDocIconHTML = tmpIconProvider ? '<span class="retold-remote-icon retold-remote-icon-lg">' + tmpIconProvider.getIcon('document-large', 64) + '</span>' : '&#128196;';
		return '<div style="text-align: center; padding: 40px;">'
			+ '<div style="margin-bottom: 24px;">' + tmpDocIconHTML + '</div>'
			+ '<div style="font-size: 1.1rem; color: var(--retold-text-secondary); margin-bottom: 24px;">' + this._escapeHTML(pFileName) + '</div>'
			+ '<a href="' + pURL + '" target="_blank" style="color: var(--retold-accent); font-size: 0.9rem;">Open in new tab</a>'
			+ '</div>';
	}

	_buildTextHTML(pURL, pFileName, pFilePath)
	{
		return '<div class="retold-remote-code-viewer-container" id="RetoldRemote-CodeViewer-Container">'
			+ '<div class="retold-remote-code-viewer-loading">Loading...</div>'
			+ '</div>';
	}

	/**
	 * Map a file extension to a pict-section-code highlight language.
	 *
	 * @param {string} pExtension - File extension (no dot)
	 * @returns {string} One of: javascript, json, html, css, sql
	 */
	_getHighlightLanguage(pExtension)
	{
		let tmpJSExtensions = { 'js': true, 'mjs': true, 'cjs': true, 'ts': true, 'tsx': true, 'jsx': true };
		if (tmpJSExtensions[pExtension]) return 'javascript';

		if (pExtension === 'json') return 'json';

		let tmpHTMLExtensions = { 'html': true, 'htm': true, 'xml': true, 'svg': true };
		if (tmpHTMLExtensions[pExtension]) return 'html';

		let tmpCSSExtensions = { 'css': true, 'scss': true, 'sass': true, 'less': true };
		if (tmpCSSExtensions[pExtension]) return 'css';

		if (pExtension === 'sql') return 'sql';

		// Default to javascript highlighting for other text files
		return 'javascript';
	}

	/**
	 * Load text content and display it using pict-section-code for
	 * syntax highlighting and line numbers.
	 *
	 * @param {string} pURL       - Content URL to fetch
	 * @param {string} pFilePath  - Full file path (used to derive extension)
	 */
	_loadCodeViewer(pURL, pFilePath)
	{
		let tmpSelf = this;
		let tmpExtension = pFilePath.replace(/^.*\./, '').toLowerCase();

		fetch(pURL)
			.then((pResponse) =>
			{
				if (!pResponse.ok)
				{
					throw new Error('HTTP ' + pResponse.status);
				}
				return pResponse.text();
			})
			.then((pText) =>
			{
				let tmpContainer = document.getElementById('RetoldRemote-CodeViewer-Container');
				if (!tmpContainer)
				{
					return;
				}

				let tmpLanguage = tmpSelf._getHighlightLanguage(tmpExtension);

				// Destroy any previous CodeJar instance
				if (tmpSelf._activeCodeJar)
				{
					tmpSelf._activeCodeJar.destroy();
					tmpSelf._activeCodeJar = null;
				}

				// Check that CodeJar is available
				if (typeof (window) === 'undefined' || typeof (window.CodeJar) !== 'function')
				{
					tmpContainer.innerHTML = '<div class="retold-remote-code-viewer-loading">CodeJar not loaded; showing plain text.</div>';
					let tmpPre = document.createElement('pre');
					tmpPre.style.cssText = 'padding:16px 20px; margin:0; color:var(--retold-text-primary); font-family:monospace; white-space:pre; tab-size:4; overflow:auto; height:100%;';
					tmpPre.textContent = pText;
					tmpContainer.appendChild(tmpPre);
					return;
				}

				// Build the editor DOM (mirrors pict-section-code _buildEditorDOM)
				tmpContainer.innerHTML = '';

				let tmpWrap = document.createElement('div');
				tmpWrap.className = 'pict-code-editor-wrap';

				let tmpLineNumbers = document.createElement('div');
				tmpLineNumbers.className = 'pict-code-line-numbers';
				tmpWrap.appendChild(tmpLineNumbers);

				let tmpEditor = document.createElement('div');
				tmpEditor.className = 'pict-code-editor language-' + tmpLanguage;
				tmpWrap.appendChild(tmpEditor);

				tmpContainer.appendChild(tmpWrap);

				// Create the highlight function from pict-section-code
				let tmpHighlight = libPictSectionCode.createHighlighter(tmpLanguage);

				// Instantiate CodeJar
				tmpSelf._activeCodeJar = window.CodeJar(tmpEditor, tmpHighlight,
				{
					tab: '\t',
					catchTab: false,
					addClosing: false
				});

				// Reset inline styles that CodeJar forces
				tmpEditor.style.whiteSpace = 'pre';
				tmpEditor.style.overflowWrap = 'normal';

				// Set the content
				tmpSelf._activeCodeJar.updateCode(pText);

				// Make it read-only
				tmpEditor.setAttribute('contenteditable', 'false');

				// Render line numbers
				let tmpLineCount = pText.split('\n').length;
				let tmpLineHTML = '';
				for (let i = 1; i <= tmpLineCount; i++)
				{
					tmpLineHTML += '<span>' + i + '</span>';
				}
				tmpLineNumbers.innerHTML = tmpLineHTML;
			})
			.catch((pError) =>
			{
				let tmpContainer = document.getElementById('RetoldRemote-CodeViewer-Container');
				if (tmpContainer)
				{
					tmpContainer.innerHTML = '<div class="retold-remote-code-viewer-loading">Failed to load file: ' + pError.message + '</div>';
				}
			});
	}

	/**
	 * Build the HTML shell for the ebook reader.
	 */
	_buildEbookHTML(pURL, pFileName, pFilePath)
	{
		return '<div class="retold-remote-ebook-wrap">'
			+ '<div class="retold-remote-ebook-toc collapsed" id="RetoldRemote-EbookTOC"></div>'
			+ '<div class="retold-remote-ebook-reader">'
			+ '<div class="retold-remote-ebook-content" id="RetoldRemote-EbookContent">'
			+ '<div class="retold-remote-ebook-loading">Loading ebook...</div>'
			+ '</div>'
			+ '<div class="retold-remote-ebook-controls">'
			+ '<button class="retold-remote-ebook-toc-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].toggleEbookTOC()">&#9776; TOC</button>'
			+ '<button class="retold-remote-ebook-page-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].ebookPrevPage()">&larr; Prev</button>'
			+ '<button class="retold-remote-ebook-page-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].ebookNextPage()">Next &rarr;</button>'
			+ '</div>'
			+ '</div>'
			+ '</div>';
	}

	/**
	 * Load and render an ebook using epub.js.
	 * For EPUB files, fetch directly. For MOBI files, convert server-side first.
	 *
	 * @param {string} pContentURL - Content URL for the file
	 * @param {string} pFilePath   - Relative file path
	 */
	_loadEbookViewer(pContentURL, pFilePath)
	{
		let tmpSelf = this;
		let tmpExtension = pFilePath.replace(/^.*\./, '').toLowerCase();

		if (tmpExtension === 'mobi')
		{
			// Convert MOBI to EPUB server-side first
			let tmpCapabilities = this.pict.AppData.RetoldRemote.ServerCapabilities || {};
			if (!tmpCapabilities.ebook_convert)
			{
				let tmpContent = document.getElementById('RetoldRemote-EbookContent');
				if (tmpContent)
				{
					tmpContent.innerHTML = '<div class="retold-remote-ebook-loading">'
						+ 'MOBI viewing requires Calibre (ebook-convert) on the server.<br>'
						+ '<a href="' + pContentURL + '" target="_blank" style="color: var(--retold-accent); margin-top: 12px; display: inline-block;">Download file</a>'
						+ '</div>';
				}
				return;
			}

			let tmpContent = document.getElementById('RetoldRemote-EbookContent');
			if (tmpContent)
			{
				tmpContent.innerHTML = '<div class="retold-remote-ebook-loading">Converting MOBI to EPUB...</div>';
			}

			let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
			let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

			fetch('/api/media/ebook-convert?path=' + tmpPathParam)
				.then((pResponse) => pResponse.json())
				.then((pData) =>
				{
					if (!pData || !pData.Success)
					{
						throw new Error(pData ? pData.Error : 'Conversion failed.');
					}

					// Fetch the converted EPUB and render
					let tmpEpubURL = '/api/media/ebook/' + pData.CacheKey + '/' + pData.OutputFilename;
					tmpSelf._renderEpub(tmpEpubURL);
				})
				.catch((pError) =>
				{
					let tmpEl = document.getElementById('RetoldRemote-EbookContent');
					if (tmpEl)
					{
						tmpEl.innerHTML = '<div class="retold-remote-ebook-loading">Failed to convert: '
							+ tmpSelf._escapeHTML(pError.message)
							+ '<br><a href="' + pContentURL + '" target="_blank" style="color: var(--retold-accent); margin-top: 12px; display: inline-block;">Download file</a>'
							+ '</div>';
					}
				});
		}
		else
		{
			// EPUB — render directly
			this._renderEpub(pContentURL);
		}
	}

	/**
	 * Initialize epub.js and render an EPUB into the viewer container.
	 *
	 * @param {string} pEpubURL - URL to fetch the EPUB from
	 */
	_renderEpub(pEpubURL)
	{
		let tmpSelf = this;

		// Check that epub.js is available
		if (typeof (window) === 'undefined' || typeof (window.ePub) !== 'function')
		{
			let tmpEl = document.getElementById('RetoldRemote-EbookContent');
			if (tmpEl)
			{
				tmpEl.innerHTML = '<div class="retold-remote-ebook-loading">epub.js library not loaded.</div>';
			}
			return;
		}

		// Destroy any previous book instance
		if (this._activeBook)
		{
			try { this._activeBook.destroy(); } catch (e) { /* ignore */ }
			this._activeBook = null;
			this._activeRendition = null;
		}

		let tmpContentEl = document.getElementById('RetoldRemote-EbookContent');
		if (!tmpContentEl)
		{
			return;
		}

		// Clear loading message
		tmpContentEl.innerHTML = '';

		// Fetch the EPUB as an ArrayBuffer and open with epub.js
		fetch(pEpubURL)
			.then((pResponse) =>
			{
				if (!pResponse.ok)
				{
					throw new Error('HTTP ' + pResponse.status);
				}
				return pResponse.arrayBuffer();
			})
			.then((pBuffer) =>
			{
				let tmpBook = window.ePub(pBuffer);
				tmpSelf._activeBook = tmpBook;

				let tmpRendition = tmpBook.renderTo(tmpContentEl,
				{
					width: '100%',
					height: '100%',
					spread: 'none'
				});

				tmpSelf._activeRendition = tmpRendition;

				tmpRendition.display();

				// Apply theme for dark backgrounds
				tmpRendition.themes.default(
				{
					'body':
					{
						'color': 'var(--retold-text-primary, #d4d4d4)',
						'background': 'var(--retold-bg-primary, #1e1e1e)',
						'font-family': 'Georgia, "Times New Roman", serif',
						'line-height': '1.6',
						'padding': '20px 40px'
					},
					'a':
					{
						'color': 'var(--retold-accent, #569cd6)'
					}
				});

				// Load table of contents
				tmpBook.loaded.navigation.then((pNav) =>
				{
					tmpSelf._renderEbookTOC(pNav.toc);
				});
			})
			.catch((pError) =>
			{
				if (tmpContentEl)
				{
					tmpContentEl.innerHTML = '<div class="retold-remote-ebook-loading">Failed to load ebook: '
						+ tmpSelf._escapeHTML(pError.message) + '</div>';
				}
			});
	}

	/**
	 * Render the table of contents for the ebook.
	 *
	 * @param {Array} pToc - epub.js navigation TOC array
	 */
	_renderEbookTOC(pToc)
	{
		let tmpTocEl = document.getElementById('RetoldRemote-EbookTOC');
		if (!tmpTocEl || !pToc)
		{
			return;
		}

		let tmpSelf = this;
		let tmpHTML = '';

		let tmpBuildItems = function (pItems, pDepth)
		{
			for (let i = 0; i < pItems.length; i++)
			{
				let tmpItem = pItems[i];
				let tmpIndentClass = pDepth > 0 ? ' indent-' + Math.min(pDepth, 2) : '';
				tmpHTML += '<button class="retold-remote-ebook-toc-item' + tmpIndentClass + '" '
					+ 'data-href="' + tmpSelf._escapeHTML(tmpItem.href) + '" '
					+ 'onclick="pict.views[\'RetoldRemote-MediaViewer\'].ebookGoToChapter(this.getAttribute(\'data-href\'))">'
					+ tmpSelf._escapeHTML(tmpItem.label.trim())
					+ '</button>';

				if (tmpItem.subitems && tmpItem.subitems.length > 0)
				{
					tmpBuildItems(tmpItem.subitems, pDepth + 1);
				}
			}
		};

		tmpBuildItems(pToc, 0);
		tmpTocEl.innerHTML = tmpHTML;
	}

	/**
	 * Navigate to a chapter in the ebook by href.
	 *
	 * @param {string} pHref - Chapter href from the TOC
	 */
	ebookGoToChapter(pHref)
	{
		if (this._activeRendition && pHref)
		{
			this._activeRendition.display(pHref);
		}
	}

	/**
	 * Go to the previous page in the ebook.
	 */
	ebookPrevPage()
	{
		if (this._activeRendition)
		{
			this._activeRendition.prev();
		}
	}

	/**
	 * Go to the next page in the ebook.
	 */
	ebookNextPage()
	{
		if (this._activeRendition)
		{
			this._activeRendition.next();
		}
	}

	/**
	 * Toggle the table of contents sidebar.
	 */
	toggleEbookTOC()
	{
		let tmpTocEl = document.getElementById('RetoldRemote-EbookTOC');
		if (tmpTocEl)
		{
			tmpTocEl.classList.toggle('collapsed');
		}
	}

	_buildFallbackHTML(pURL, pFileName)
	{
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpFallbackIconHTML = tmpIconProvider ? '<span class="retold-remote-icon retold-remote-icon-lg">' + tmpIconProvider.getIcon('document-large', 64) + '</span>' : '&#128196;';
		return '<div style="text-align: center; padding: 40px;">'
			+ '<div style="margin-bottom: 24px;">' + tmpFallbackIconHTML + '</div>'
			+ '<div style="font-size: 1.1rem; color: var(--retold-text-secondary); margin-bottom: 24px;">' + this._escapeHTML(pFileName) + '</div>'
			+ '<a href="' + pURL + '" target="_blank" style="color: var(--retold-accent); font-size: 0.9rem;">Download / Open in new tab</a>'
			+ '</div>';
	}

	/**
	 * Fetch file info and populate the overlay and video stats bar.
	 */
	_loadFileInfo(pFilePath)
	{
		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		if (!tmpProvider)
		{
			return;
		}

		tmpProvider.fetchMediaProbe(pFilePath,
			(pError, pData) =>
			{
				if (!pData)
				{
					return;
				}

				// Populate the info overlay
				let tmpOverlay = document.getElementById('RetoldRemote-FileInfo-Overlay');
				if (tmpOverlay)
				{
					let tmpHTML = '';

					if (pData.Size !== undefined)
					{
						tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Size</span><span class="retold-remote-fileinfo-value">' + tmpSelf._formatFileSize(pData.Size) + '</span></div>';
					}
					if (pData.Width && pData.Height)
					{
						tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Dimensions</span><span class="retold-remote-fileinfo-value">' + pData.Width + ' x ' + pData.Height + '</span></div>';
					}
					if (pData.Duration)
					{
						let tmpMin = Math.floor(pData.Duration / 60);
						let tmpSec = Math.floor(pData.Duration % 60);
						tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Duration</span><span class="retold-remote-fileinfo-value">' + tmpMin + ':' + (tmpSec < 10 ? '0' : '') + tmpSec + '</span></div>';
					}
					if (pData.Codec)
					{
						tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Codec</span><span class="retold-remote-fileinfo-value">' + pData.Codec + '</span></div>';
					}
					if (pData.Format)
					{
						tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Format</span><span class="retold-remote-fileinfo-value">' + pData.Format + '</span></div>';
					}
					if (pData.Modified)
					{
						tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Modified</span><span class="retold-remote-fileinfo-value">' + new Date(pData.Modified).toLocaleString() + '</span></div>';
					}
					if (pData.Path)
					{
						tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Path</span><span class="retold-remote-fileinfo-value">' + pData.Path + '</span></div>';
					}

					tmpOverlay.innerHTML = tmpHTML;
				}

				// Populate the video stats bar (if viewing a video)
				let tmpStatsBar = document.getElementById('RetoldRemote-VideoStats');
				if (tmpStatsBar)
				{
					let tmpStatsHTML = '';

					if (pData.Duration)
					{
						let tmpMin = Math.floor(pData.Duration / 60);
						let tmpSec = Math.floor(pData.Duration % 60);
						tmpStatsHTML += '<span><span class="retold-remote-video-stat-label">Duration</span> <span class="retold-remote-video-stat-value">' + tmpMin + ':' + (tmpSec < 10 ? '0' : '') + tmpSec + '</span></span>';
					}
					if (pData.Width && pData.Height)
					{
						tmpStatsHTML += '<span><span class="retold-remote-video-stat-label">Resolution</span> <span class="retold-remote-video-stat-value">' + pData.Width + '×' + pData.Height + '</span></span>';
					}
					if (pData.Codec)
					{
						tmpStatsHTML += '<span><span class="retold-remote-video-stat-label">Codec</span> <span class="retold-remote-video-stat-value">' + pData.Codec + '</span></span>';
					}
					if (pData.Bitrate)
					{
						let tmpBitrate = pData.Bitrate;
						let tmpBitrateStr;
						if (tmpBitrate >= 1000000)
						{
							tmpBitrateStr = (tmpBitrate / 1000000).toFixed(1) + ' Mbps';
						}
						else if (tmpBitrate >= 1000)
						{
							tmpBitrateStr = Math.round(tmpBitrate / 1000) + ' kbps';
						}
						else
						{
							tmpBitrateStr = tmpBitrate + ' bps';
						}
						tmpStatsHTML += '<span><span class="retold-remote-video-stat-label">Bitrate</span> <span class="retold-remote-video-stat-value">' + tmpBitrateStr + '</span></span>';
					}
					if (pData.Size !== undefined)
					{
						tmpStatsHTML += '<span><span class="retold-remote-video-stat-label">Size</span> <span class="retold-remote-video-stat-value">' + tmpSelf._formatFileSize(pData.Size) + '</span></span>';
					}

					// Preserve the Explore and VLC buttons if they exist
					let tmpExploreBtn = tmpStatsBar.querySelector('.retold-remote-explore-btn');
					let tmpExploreHTML = tmpExploreBtn ? tmpExploreBtn.outerHTML : '';
					let tmpVLCBtn = tmpStatsBar.querySelector('.retold-remote-vlc-btn');
					let tmpVLCHTML = tmpVLCBtn ? tmpVLCBtn.outerHTML : '';

					tmpStatsBar.innerHTML = tmpStatsHTML + tmpExploreHTML + tmpVLCHTML;
				}
			});
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

	_escapeHTML(pText)
	{
		if (!pText) return '';
		return pText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}
}

RetoldRemoteMediaViewerView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteMediaViewerView;
