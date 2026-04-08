const libPictView = require('pict-view');

const _MediaViewerEbookViewer = require('./MediaViewer-EbookViewer');
const _MediaViewerCodeViewer = require('./MediaViewer-CodeViewer');
const _MediaViewerPdfViewer = require('./MediaViewer-PdfViewer');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-MediaViewer",
	DefaultRenderable: "RetoldRemote-MediaViewer",
	DefaultDestinationAddress: "#RetoldRemote-Viewer-Container",
	AutoRender: false,

	CSS: ``
};

class RetoldRemoteMediaViewerView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._swipeStartX = 0;
		this._swipeStartY = 0;
		this._swipeTouchCount = 0;
		this._swipeHandlers = null;
		this._dfExitHandlers = null;
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

		// Notify the layout so active sidebar panels (Info, Regions, etc.)
		// refresh to the new file instead of keeping stale content.
		let tmpLayout = this.pict.views['ContentEditor-Layout'];
		if (tmpLayout && typeof tmpLayout.notifyCurrentFileChanged === 'function')
		{
			tmpLayout.notifyCurrentFileChanged(pFilePath);
		}

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
		tmpHTML += '<div class="retold-remote-viewer-title">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpFileName) + '</div>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" id="RetoldRemote-HeaderExploreBtn" onclick="pict.views[\'RetoldRemote-ImageExplorer\'].showExplorer(pict.AppData.RetoldRemote.CurrentViewerFile)" title="Explore image (e)" style="display:none;">&#128269; Explore</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\'].nextFile()" title="Next (j)">Next &rsaquo;</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._toggleFileInfo()" title="Info (i)">&#9432;</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].toggleDistractionFree()" title="Distraction-Free (d)">&#9634;</button>';
		tmpHTML += '</div>';

		// Body with media content
		tmpHTML += '<div class="retold-remote-viewer-body">';

		// Exit hotspot for distraction-free mode (double-click/tap top-left to exit)
		let tmpDFHotspotDisplay = tmpRemote._distractionFreeMode ? '' : ' style="display:none"';
		tmpHTML += '<div class="retold-remote-df-exit-hotspot" id="RetoldRemote-DF-ExitHotspot"' + tmpDFHotspotDisplay + '></div>';

		// For images, probe size first to decide what URL to use
		if (pMediaType === 'image')
		{
			// Show a placeholder while we probe
			tmpHTML += this._buildImagePlaceholderHTML(tmpFileName);
		}
		else
		{
			switch (pMediaType)
			{
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

		// For images, probe dimensions and decide how to display
		if (pMediaType === 'image')
		{
			this._probeAndShowImage(pFilePath, tmpContentURL, tmpFileName);
		}

		// Fetch and populate file info
		this._loadFileInfo(pFilePath);

		// Fetch text content and initialize code viewer
		if (pMediaType === 'text')
		{
			this._loadCodeViewer(tmpContentURL, pFilePath);
		}

		// Load document viewers: ebook for epub/mobi, PDF for pdf, convert-then-PDF for others
		if (pMediaType === 'document')
		{
			let tmpExt = pFilePath.replace(/^.*\./, '').toLowerCase();
			if (tmpExt === 'epub' || tmpExt === 'mobi')
			{
				this._loadEbookViewer(tmpContentURL, pFilePath);
			}
			else if (tmpExt === 'pdf')
			{
				this._loadPdfViewer(tmpContentURL, pFilePath);
			}
			else
			{
				// Convertible document types — convert to PDF first, then load PDF viewer
				this._loadConvertedDocumentViewer(pFilePath);
			}
		}

		// Set up swipe navigation for touch devices
		this._setupSwipeNavigation();

		// Set up distraction-free exit hotspot (double-click/tap top-left)
		this._setupDFExitHotspot();

		// Update topbar
		let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBar)
		{
			tmpTopBar.updateInfo();
		}
	}

	/**
	 * Show an image in the viewer from a direct URL, bypassing the
	 * content-path and probe logic.  Used for video-frame collection
	 * items whose images live at a cache URL rather than a file path.
	 *
	 * @param {string} pURL          - Direct image URL
	 * @param {string} pDisplayTitle - Title to show in the viewer header
	 * @param {string} [pFilePath]   - Original file path (for state tracking)
	 */
	showDirectImage(pURL, pDisplayTitle, pFilePath)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ActiveMode = 'viewer';
		tmpRemote.CurrentViewerFile = pFilePath || '';
		tmpRemote.CurrentViewerMediaType = 'image';
		tmpRemote.VideoMenuActive = false;

		// Notify the layout so active sidebar panels (Info, Regions, etc.)
		// refresh. This is especially important when switching between
		// collection items via the direct-image path.
		let tmpLayout = this.pict.views['ContentEditor-Layout'];
		if (tmpLayout && typeof tmpLayout.notifyCurrentFileChanged === 'function')
		{
			tmpLayout.notifyCurrentFileChanged(pFilePath || '');
		}

		// Show viewer, hide gallery
		let tmpGalleryContainer = document.getElementById('RetoldRemote-Gallery-Container');
		let tmpViewerContainer = document.getElementById('RetoldRemote-Viewer-Container');

		if (tmpGalleryContainer) tmpGalleryContainer.style.display = 'none';
		if (tmpViewerContainer) tmpViewerContainer.style.display = 'block';

		let tmpEscapedTitle = this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pDisplayTitle);

		// Build the viewer HTML (same chrome as showMedia, but with a direct <img>)
		let tmpHTML = '<div class="retold-remote-viewer">';

		// Header with nav
		tmpHTML += '<div class="retold-remote-viewer-header">';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\'].closeViewer()" title="Back (Esc)">&larr; Back</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\'].prevFile()" title="Previous (k)">&lsaquo; Prev</button>';
		tmpHTML += '<div class="retold-remote-viewer-title">' + tmpEscapedTitle + '</div>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\'].nextFile()" title="Next (j)">Next &rsaquo;</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._toggleFileInfo()" title="Info (i)">&#9432;</button>';
		tmpHTML += '<button class="retold-remote-viewer-nav-btn" onclick="pict.views[\'RetoldRemote-MediaViewer\'].toggleDistractionFree()" title="Distraction-Free (d)">&#9634;</button>';
		tmpHTML += '</div>';

		// Body with the frame image
		tmpHTML += '<div class="retold-remote-viewer-body">';

		// Exit hotspot for distraction-free mode
		let tmpDFHotspotDisplay = tmpRemote._distractionFreeMode ? '' : ' style="display:none"';
		tmpHTML += '<div class="retold-remote-df-exit-hotspot" id="RetoldRemote-DF-ExitHotspot"' + tmpDFHotspotDisplay + '></div>';

		// Direct image tag — no probing needed for cached frame images
		tmpHTML += '<img id="RetoldRemote-ImageViewer-Img" src="' + pURL + '" alt="' + tmpEscapedTitle + '"'
			+ ' style="max-width: 100%; max-height: 100%; object-fit: contain; cursor: zoom-in;"'
			+ ' onload="if (pict.views[\'RetoldRemote-ImageViewer\']) pict.views[\'RetoldRemote-ImageViewer\'].initImage();"'
			+ ' onclick="if (pict.views[\'RetoldRemote-ImageViewer\']) pict.views[\'RetoldRemote-ImageViewer\'].toggleZoom();"'
			+ ' />';

		// File info overlay (hidden by default)
		tmpHTML += '<div class="retold-remote-fileinfo-overlay" id="RetoldRemote-FileInfo-Overlay">';
		tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Frame: ' + tmpEscapedTitle + '</span></div>';
		tmpHTML += '</div>';

		tmpHTML += '</div>'; // end body
		tmpHTML += '</div>'; // end viewer

		if (tmpViewerContainer)
		{
			tmpViewerContainer.innerHTML = tmpHTML;
		}

		// Set up swipe navigation and DF exit
		this._setupSwipeNavigation();
		this._setupDFExitHotspot();

		// Update topbar
		let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBar)
		{
			tmpTopBar.updateInfo();
		}
	}

	/**
	 * Attach touch event listeners to the viewer body for swipe-based
	 * prev/next navigation.  Only single-finger horizontal swipes are
	 * recognised; pinch gestures and vertical scrolling are ignored.
	 * Swipes are also suppressed when the image is zoomed and the
	 * container is scrollable, so the user can pan freely.
	 */
	_setupSwipeNavigation()
	{
		// Clean up any previous listeners
		this._cleanupSwipe();

		let tmpBody = document.querySelector('.retold-remote-viewer-body');
		if (!tmpBody)
		{
			return;
		}

		let tmpSelf = this;
		let tmpSwipeThreshold = 50; // minimum px to count as a swipe

		let tmpOnTouchStart = function (pEvent)
		{
			tmpSelf._swipeTouchCount = pEvent.touches.length;
			if (pEvent.touches.length !== 1)
			{
				return;
			}
			tmpSelf._swipeStartX = pEvent.touches[0].clientX;
			tmpSelf._swipeStartY = pEvent.touches[0].clientY;
		};

		let tmpOnTouchEnd = function (pEvent)
		{
			// Ignore multi-touch (pinch zoom, etc.)
			if (tmpSelf._swipeTouchCount !== 1)
			{
				return;
			}

			let tmpEndX = pEvent.changedTouches[0].clientX;
			let tmpEndY = pEvent.changedTouches[0].clientY;
			let tmpDeltaX = tmpEndX - tmpSelf._swipeStartX;
			let tmpDeltaY = tmpEndY - tmpSelf._swipeStartY;

			// Must be primarily horizontal
			if (Math.abs(tmpDeltaX) < tmpSwipeThreshold || Math.abs(tmpDeltaY) > Math.abs(tmpDeltaX))
			{
				return;
			}

			// If the viewer body is scrollable (zoomed image), don't
			// swipe — let the user pan instead.
			let tmpContainer = document.querySelector('.retold-remote-viewer-body');
			if (tmpContainer && (tmpContainer.scrollWidth > tmpContainer.clientWidth + 2))
			{
				return;
			}

			let tmpNav = tmpSelf.pict.providers['RetoldRemote-GalleryNavigation'];
			if (!tmpNav)
			{
				return;
			}

			if (tmpDeltaX < 0)
			{
				tmpNav.nextFile();
			}
			else
			{
				tmpNav.prevFile();
			}
		};

		tmpBody.addEventListener('touchstart', tmpOnTouchStart, { passive: true });
		tmpBody.addEventListener('touchend', tmpOnTouchEnd, { passive: true });

		this._swipeHandlers =
		{
			element: tmpBody,
			touchstart: tmpOnTouchStart,
			touchend: tmpOnTouchEnd
		};
	}

	/**
	 * Remove swipe touch listeners from the viewer body.
	 */
	_cleanupSwipe()
	{
		if (this._swipeHandlers)
		{
			this._swipeHandlers.element.removeEventListener('touchstart', this._swipeHandlers.touchstart);
			this._swipeHandlers.element.removeEventListener('touchend', this._swipeHandlers.touchend);
			this._swipeHandlers = null;
		}
	}

	/**
	 * Toggle distraction-free mode from the viewer overlay button.
	 * Delegates to the gallery navigation provider, then updates
	 * the toggle button and exit hotspot state.
	 */
	toggleDistractionFree()
	{
		let tmpNav = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNav)
		{
			tmpNav._toggleDistractionFree();
		}
		this._updateDFControls();
	}

	/**
	 * Sync the exit hotspot with the current distraction-free mode state.
	 */
	_updateDFControls()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpActive = tmpRemote._distractionFreeMode || false;

		let tmpHotspot = document.getElementById('RetoldRemote-DF-ExitHotspot');
		if (tmpHotspot)
		{
			tmpHotspot.style.display = tmpActive ? '' : 'none';
		}
	}

	/**
	 * Set up the double-click / double-tap handler on the
	 * exit hotspot so the user can leave distraction-free mode
	 * from the top-left corner of the viewer.
	 */
	_setupDFExitHotspot()
	{
		this._cleanupDFExitHotspot();

		let tmpHotspot = document.getElementById('RetoldRemote-DF-ExitHotspot');
		if (!tmpHotspot)
		{
			return;
		}

		let tmpSelf = this;

		// Double-click for mouse
		let tmpOnDblClick = function ()
		{
			let tmpRemote = tmpSelf.pict.AppData.RetoldRemote;
			if (tmpRemote._distractionFreeMode)
			{
				tmpSelf.toggleDistractionFree();
			}
		};

		// Double-tap for touch: detect two taps within 300ms
		let tmpLastTap = 0;
		let tmpOnTouchEnd = function (pEvent)
		{
			let tmpNow = Date.now();
			if (tmpNow - tmpLastTap < 300)
			{
				pEvent.preventDefault();
				let tmpRemote = tmpSelf.pict.AppData.RetoldRemote;
				if (tmpRemote._distractionFreeMode)
				{
					tmpSelf.toggleDistractionFree();
				}
				tmpLastTap = 0;
			}
			else
			{
				tmpLastTap = tmpNow;
			}
		};

		tmpHotspot.addEventListener('dblclick', tmpOnDblClick);
		tmpHotspot.addEventListener('touchend', tmpOnTouchEnd);

		this._dfExitHandlers =
		{
			element: tmpHotspot,
			dblclick: tmpOnDblClick,
			touchend: tmpOnTouchEnd
		};
	}

	/**
	 * Remove exit hotspot event listeners.
	 */
	_cleanupDFExitHotspot()
	{
		if (this._dfExitHandlers)
		{
			this._dfExitHandlers.element.removeEventListener('dblclick', this._dfExitHandlers.dblclick);
			this._dfExitHandlers.element.removeEventListener('touchend', this._dfExitHandlers.touchend);
			this._dfExitHandlers = null;
		}
	}

	/**
	 * Build a lightweight placeholder while probing image dimensions.
	 */
	_buildImagePlaceholderHTML(pFileName)
	{
		let tmpEscapedName = this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pFileName);
		return '<div id="RetoldRemote-ImagePlaceholder" style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--retold-text-dim);font-size:0.85rem;">'
			+ 'Loading ' + tmpEscapedName + '\u2026</div>';
	}

	/**
	 * Probe image dimensions, then decide how to display it:
	 *   - ≤4096px: load direct content URL in the normal viewer
	 *   - 4096–8192px: load a server preview in the normal viewer, show Explore button
	 *   - >8192px: auto-launch the OpenSeadragon image explorer
	 *
	 * @param {string} pFilePath   - Relative file path
	 * @param {string} pContentURL - Direct content URL (fallback)
	 * @param {string} pFileName   - Display name
	 */
	_probeAndShowImage(pFilePath, pContentURL, pFileName)
	{
		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

		fetch('/api/media/image-preview?path=' + tmpPathParam)
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				// If the probe failed or sharp isn't available, fall back to direct load
				if (!pResult || !pResult.Success)
				{
					tmpSelf._insertImageTag(pContentURL, pFileName, false);
					return;
				}

				let tmpLongest = Math.max(pResult.OrigWidth || 0, pResult.OrigHeight || 0);

				// >8192px: auto-launch the OpenSeadragon image explorer
				if (tmpLongest > 8192)
				{
					let tmpIEX = tmpSelf.pict.views['RetoldRemote-ImageExplorer'];
					if (tmpIEX)
					{
						tmpIEX.showExplorer(pFilePath);
						return;
					}
					// Fall through if explorer view isn't available
				}

				// 4096–8192px: use the server preview
				if (pResult.NeedsPreview && pResult.CacheKey)
				{
					let tmpPreviewURL = '/api/media/image-preview-file/' +
						encodeURIComponent(pResult.CacheKey) + '/' +
						encodeURIComponent(pResult.OutputFilename);
					tmpSelf._insertImageTag(tmpPreviewURL, pFileName, true,
						pResult.OrigWidth, pResult.OrigHeight);
					return;
				}

				// ≤4096px: load the direct content URL
				tmpSelf._insertImageTag(pContentURL, pFileName, false);
			})
			.catch(() =>
			{
				// Probe failed — fall back to direct load
				tmpSelf._insertImageTag(pContentURL, pFileName, false);
			});
	}

	/**
	 * Insert the actual <img> tag into the viewer body, replacing the placeholder.
	 *
	 * @param {string}  pURL         - Image URL to load
	 * @param {string}  pFileName    - Display name
	 * @param {boolean} pShowExplore - Whether to show the Explore button immediately
	 * @param {number}  [pOrigWidth] - Original image width (for the badge)
	 * @param {number}  [pOrigHeight]- Original image height (for the badge)
	 */
	_insertImageTag(pURL, pFileName, pShowExplore, pOrigWidth, pOrigHeight)
	{
		let tmpPlaceholder = document.getElementById('RetoldRemote-ImagePlaceholder');
		if (!tmpPlaceholder || !tmpPlaceholder.parentElement)
		{
			return;
		}

		let tmpEscapedName = this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pFileName);
		let tmpFragment = document.createDocumentFragment();

		// The image element
		let tmpImg = document.createElement('img');
		tmpImg.src = pURL;
		tmpImg.alt = tmpEscapedName;
		tmpImg.id = 'RetoldRemote-ImageViewer-Img';
		tmpImg.style.cssText = 'max-width: 100%; max-height: 100%; object-fit: contain; cursor: zoom-in;';
		tmpImg.onload = function () { pict.views['RetoldRemote-ImageViewer'].initImage(); };
		tmpImg.onclick = function () { pict.views['RetoldRemote-ImageViewer'].toggleZoom(); };
		tmpFragment.appendChild(tmpImg);

		// Always show the Explore button in the header nav bar for images
		let tmpHeaderExploreBtn = document.getElementById('RetoldRemote-HeaderExploreBtn');
		if (tmpHeaderExploreBtn)
		{
			tmpHeaderExploreBtn.style.display = '';
		}

		// Dimension badge for large images
		if (pShowExplore && pOrigWidth && pOrigHeight)
		{
			let tmpBadge = document.createElement('div');
			tmpBadge.id = 'RetoldRemote-LargeImageBadge';
			tmpBadge.className = 'retold-remote-image-large-badge';
			tmpBadge.textContent = pOrigWidth + ' \u00d7 ' + pOrigHeight + ' px (preview)';
			tmpFragment.appendChild(tmpBadge);
		}

		tmpPlaceholder.parentElement.replaceChild(tmpFragment, tmpPlaceholder);
	}

	_buildImageHTML(pURL, pFileName)
	{
		let tmpEscapedName = this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pFileName);
		let tmpHTML = '<img src="' + pURL + '" alt="' + tmpEscapedName + '" '
			+ 'style="max-width: 100%; max-height: 100%; object-fit: contain; cursor: zoom-in;" '
			+ 'id="RetoldRemote-ImageViewer-Img" '
			+ 'onload="pict.views[\'RetoldRemote-ImageViewer\'].initImage()" '
			+ 'onclick="pict.views[\'RetoldRemote-ImageViewer\'].toggleZoom()">';
		return tmpHTML;
	}

	_buildVideoHTML(pURL, pFileName)
	{
		let tmpCapabilities = this.pict.AppData.RetoldRemote.ServerCapabilities || {};
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpFilePath = tmpRemote.CurrentViewerFile;

		// Build the action menu (shown by default instead of the player)
		let tmpHTML = '<div class="retold-remote-video-action-menu" id="RetoldRemote-VideoActionMenu">';
		tmpHTML += '<div class="retold-remote-video-action-menu-title">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pFileName) + '</div>';

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
						+ 'alt="' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpFilePath.replace(/^.*\//, '')) + '" '
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
			+ '<div style="font-size: 1.1rem; color: var(--retold-text-secondary); margin-bottom: 24px;">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pFileName) + '</div>'
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
			return this._buildPdfHTML(pURL, pFileName, pFilePath);
		}

		if (tmpExtension === 'epub' || tmpExtension === 'mobi')
		{
			return this._buildEbookHTML(pURL, pFileName, pFilePath);
		}

		// For convertible document types (doc, docx, rtf, odt, wpd, etc.),
		// show the PDF viewer shell — conversion happens async in _loadDocumentViewer
		let tmpConvertibleExts = { 'doc': true, 'docx': true, 'rtf': true, 'odt': true, 'wpd': true, 'wps': true, 'pages': true, 'odp': true, 'ppt': true, 'pptx': true, 'ods': true, 'xls': true, 'xlsx': true };
		if (tmpConvertibleExts[tmpExtension])
		{
			return this._buildPdfHTML(pURL, pFileName, pFilePath);
		}

		// Unknown document types: show a download link
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpDocIconHTML = tmpIconProvider ? '<span class="retold-remote-icon retold-remote-icon-lg">' + tmpIconProvider.getIcon('document-large', 64) + '</span>' : '&#128196;';
		return '<div style="text-align: center; padding: 40px;">'
			+ '<div style="margin-bottom: 24px;">' + tmpDocIconHTML + '</div>'
			+ '<div style="font-size: 1.1rem; color: var(--retold-text-secondary); margin-bottom: 24px;">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pFileName) + '</div>'
			+ '<a href="' + pURL + '" target="_blank" style="color: var(--retold-accent); font-size: 0.9rem;">Open in new tab</a>'
			+ '</div>';
	}

	// Note: _buildTextHTML, _getHighlightLanguage, _loadCodeViewer
	// are in MediaViewer-CodeViewer.js (mixed in below).

	// Note: _buildEbookHTML, _loadEbookViewer, _renderEpub, _renderEbookTOC,
	// ebookGoToChapter, ebookPrevPage, ebookNextPage, toggleEbookTOC
	// are in MediaViewer-EbookViewer.js (mixed in below).

	/**
	 * Convert a document (doc, docx, rtf, odt, wpd, etc.) to PDF and load in the PDF viewer.
	 * Shows a converting message in the PDF content area while waiting.
	 *
	 * @param {string} pFilePath - Relative file path
	 */
	_loadConvertedDocumentViewer(pFilePath)
	{
		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

		// Show converting message in the PDF content area
		let tmpContent = document.getElementById('RetoldRemote-PdfContent');
		if (tmpContent)
		{
			tmpContent.innerHTML = '<div style="text-align:center;padding:40px;color:var(--retold-text-dim);">'
				+ '<div style="font-size:1.5rem;margin-bottom:12px;">&#9881;</div>'
				+ 'Converting document to PDF\u2026'
				+ '</div>';
		}

		fetch('/api/media/doc-convert?path=' + tmpPathParam)
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				if (!pData || !pData.Success)
				{
					throw new Error(pData ? pData.Error : 'Conversion failed.');
				}

				// Build the PDF URL from the ebook cache (same serving endpoint)
				let tmpPdfURL = '/api/media/ebook/' + pData.CacheKey + '/' + pData.OutputFilename;

				// Load the PDF viewer with the converted file
				tmpSelf._loadPdfViewer(tmpPdfURL, pFilePath);
			})
			.catch((pError) =>
			{
				if (tmpContent)
				{
					let tmpFmt = tmpSelf.pict.providers['RetoldRemote-FormattingUtilities'];
					tmpContent.innerHTML = '<div style="text-align:center;padding:40px;color:var(--retold-text-dim);">'
						+ '<div style="margin-bottom:12px;color:#e06c75;">Conversion failed</div>'
						+ '<div style="font-size:0.85rem;">' + tmpFmt.escapeHTML(pError.message) + '</div>'
						+ '<div style="margin-top:16px;">'
						+ '<a href="' + (tmpProvider ? tmpProvider.getContentURL(pFilePath) : '/content/' + encodeURIComponent(pFilePath))
						+ '" target="_blank" style="color:var(--retold-accent);font-size:0.85rem;">Download original file</a>'
						+ '</div>'
						+ '</div>';
				}
			});
	}

	_buildFallbackHTML(pURL, pFileName)
	{
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpFallbackIconHTML = tmpIconProvider ? '<span class="retold-remote-icon retold-remote-icon-lg">' + tmpIconProvider.getIcon('document-large', 64) + '</span>' : '&#128196;';
		return '<div style="text-align: center; padding: 40px;">'
			+ '<div style="margin-bottom: 24px;">' + tmpFallbackIconHTML + '</div>'
			+ '<div style="font-size: 1.1rem; color: var(--retold-text-secondary); margin-bottom: 24px;">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(pFileName) + '</div>'
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
						tmpHTML += '<div class="retold-remote-fileinfo-row"><span class="retold-remote-fileinfo-label">Size</span><span class="retold-remote-fileinfo-value">' + tmpSelf.pict.providers['RetoldRemote-FormattingUtilities'].formatFileSize(pData.Size) + '</span></div>';
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
						tmpStatsHTML += '<span><span class="retold-remote-video-stat-label">Size</span> <span class="retold-remote-video-stat-value">' + tmpSelf.pict.providers['RetoldRemote-FormattingUtilities'].formatFileSize(pData.Size) + '</span></span>';
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

}

Object.assign(RetoldRemoteMediaViewerView.prototype, _MediaViewerEbookViewer);
Object.assign(RetoldRemoteMediaViewerView.prototype, _MediaViewerCodeViewer);
Object.assign(RetoldRemoteMediaViewerView.prototype, _MediaViewerPdfViewer);

RetoldRemoteMediaViewerView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteMediaViewerView;
