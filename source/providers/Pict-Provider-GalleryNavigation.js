const libPictProvider = require('pict-provider');

const libHandleGalleryKey = require('./keyboard-handlers/KeyHandler-Gallery.js');
const libHandleViewerKey = require('./keyboard-handlers/KeyHandler-Viewer.js');
const libHandleSidebarKey = require('./keyboard-handlers/KeyHandler-Sidebar.js');
const libHandleVideoExplorerKey = require('./keyboard-handlers/KeyHandler-VideoExplorer.js');
const libHandleAudioExplorerKey = require('./keyboard-handlers/KeyHandler-AudioExplorer.js');
const libHandleImageExplorerKey = require('./keyboard-handlers/KeyHandler-ImageExplorer.js');

const _DefaultProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-GalleryNavigation',
	AutoInitialize: true,
	AutoSolveWithApp: false
};

class GalleryNavigationProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._columnsPerRow = 4;
		this._keydownBound = false;
		this._helpPanelVisible = false;
		this._sidebarFocused = false;
		this._sidebarCursorIndex = 0;
	}

	/**
	 * Calculate how many columns are in the current gallery grid by
	 * inspecting the rendered DOM.  In list mode this is always 1.
	 */
	recalculateColumns()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;

		// List mode is always a single column
		if (tmpRemote.ViewMode === 'list')
		{
			this._columnsPerRow = 1;
			return;
		}

		// Count tiles that share the same offsetTop as the first tile
		let tmpTiles = document.querySelectorAll('.retold-remote-tile');
		if (tmpTiles.length < 2)
		{
			this._columnsPerRow = Math.max(1, tmpTiles.length);
			return;
		}

		let tmpFirstTop = tmpTiles[0].offsetTop;
		let tmpCols = 1;
		for (let i = 1; i < tmpTiles.length; i++)
		{
			if (tmpTiles[i].offsetTop === tmpFirstTop)
			{
				tmpCols++;
			}
			else
			{
				break;
			}
		}
		this._columnsPerRow = tmpCols;
	}

	/**
	 * Bind the global keydown handler for gallery and viewer navigation.
	 */
	bindKeyboardNavigation()
	{
		if (this._keydownBound)
		{
			return;
		}

		let tmpSelf = this;

		this._keydownHandler = function (pEvent)
		{
			// F1 toggles help in any mode, even when an input is focused
			if (pEvent.key === 'F1')
			{
				pEvent.preventDefault();
				tmpSelf._toggleHelpPanel();
				return;
			}

			// F9 toggles sidebar focus from any mode
			if (pEvent.key === 'F9')
			{
				pEvent.preventDefault();
				if (tmpSelf._sidebarFocused)
				{
					tmpSelf._blurSidebar();
				}
				else
				{
					tmpSelf._focusSidebar();
				}
				return;
			}

			// / toggles filter bar from any context (including when search is focused)
			if (pEvent.key === '/')
			{
				// If the search input is currently focused, / should hide the bar
				let tmpSearchInput = document.getElementById('RetoldRemote-Gallery-Search');
				if (pEvent.target === tmpSearchInput)
				{
					pEvent.preventDefault();
					tmpSelf._hideFilterBar();
					tmpSearchInput.blur();
					return;
				}

				// If another input is focused, let it type normally
				if (pEvent.target.tagName === 'INPUT' || pEvent.target.tagName === 'TEXTAREA' || pEvent.target.isContentEditable)
				{
					return;
				}

				// Otherwise toggle the filter bar
				pEvent.preventDefault();
				tmpSelf._toggleFilterBar();
				return;
			}

			// Escape from the search input hides the filter bar
			if (pEvent.key === 'Escape' && pEvent.target.id === 'RetoldRemote-Gallery-Search')
			{
				pEvent.preventDefault();
				pEvent.target.blur();
				tmpSelf._hideFilterBar();
				return;
			}

			// Don't capture keys when an input is focused
			if (pEvent.target.tagName === 'INPUT' || pEvent.target.tagName === 'TEXTAREA' || pEvent.target.isContentEditable)
			{
				return;
			}

			// If the help panel is visible, Escape closes it
			if (tmpSelf._helpPanelVisible && pEvent.key === 'Escape')
			{
				pEvent.preventDefault();
				tmpSelf._toggleHelpPanel();
				return;
			}

			let tmpRemote = tmpSelf.pict.AppData.RetoldRemote;
			let tmpActiveMode = tmpRemote.ActiveMode;

			if (tmpActiveMode === 'gallery' && tmpSelf._sidebarFocused)
			{
				tmpSelf._handleSidebarKey(pEvent);
			}
			else if (tmpActiveMode === 'gallery')
			{
				tmpSelf._handleGalleryKey(pEvent);
			}
			else if (tmpActiveMode === 'video-explorer')
			{
				tmpSelf._handleVideoExplorerKey(pEvent);
			}
			else if (tmpActiveMode === 'audio-explorer')
			{
				tmpSelf._handleAudioExplorerKey(pEvent);
			}
			else if (tmpActiveMode === 'image-explorer')
			{
				tmpSelf._handleImageExplorerKey(pEvent);
			}
			else if (tmpActiveMode === 'viewer')
			{
				tmpSelf._handleViewerKey(pEvent);
			}
		};

		document.addEventListener('keydown', this._keydownHandler);
		this._keydownBound = true;

		// Set up edge-swipe gestures for distraction-free mode on touch devices
		this._setupDFSwipeGestures();
	}

	/**
	 * Set up touch swipe gestures near the top edge for toggling
	 * distraction-free mode.
	 *
	 * - Swipe UP starting within the top 60px of the viewport → enter DF
	 * - Swipe DOWN starting within the top 40px of the viewport → exit DF
	 *
	 * Only single-finger vertical swipes that exceed the threshold are
	 * recognised.  Horizontal movement greater than vertical is ignored.
	 */
	_setupDFSwipeGestures()
	{
		if (this._dfSwipeBound)
		{
			return;
		}

		let tmpSelf = this;
		let tmpSwipeThreshold = 60;
		let tmpEdgeEnter = 60;
		let tmpEdgeExit = 40;
		let tmpStartY = 0;
		let tmpStartX = 0;
		let tmpStartClientY = 0;
		let tmpTouchCount = 0;

		this._dfSwipeTouchStart = function (pEvent)
		{
			tmpTouchCount = pEvent.touches.length;
			if (tmpTouchCount !== 1)
			{
				return;
			}
			tmpStartX = pEvent.touches[0].clientX;
			tmpStartY = pEvent.touches[0].clientY;
			tmpStartClientY = tmpStartY;
		};

		this._dfSwipeTouchEnd = function (pEvent)
		{
			if (tmpTouchCount !== 1)
			{
				return;
			}

			let tmpEndX = pEvent.changedTouches[0].clientX;
			let tmpEndY = pEvent.changedTouches[0].clientY;
			let tmpDeltaX = tmpEndX - tmpStartX;
			let tmpDeltaY = tmpEndY - tmpStartY;

			// Must be primarily vertical
			if (Math.abs(tmpDeltaY) < tmpSwipeThreshold || Math.abs(tmpDeltaX) > Math.abs(tmpDeltaY))
			{
				return;
			}

			let tmpRemote = tmpSelf.pict.AppData.RetoldRemote;
			let tmpIsDF = tmpRemote._distractionFreeMode || false;

			if (!tmpIsDF && tmpDeltaY < 0 && tmpStartClientY <= tmpEdgeEnter)
			{
				// Swipe up from top edge → enter DF
				tmpSelf._toggleDistractionFree();
			}
			else if (tmpIsDF && tmpDeltaY > 0 && tmpStartClientY <= tmpEdgeExit)
			{
				// Swipe down from top edge → exit DF
				tmpSelf._toggleDistractionFree();
			}
		};

		document.addEventListener('touchstart', this._dfSwipeTouchStart, { passive: true });
		document.addEventListener('touchend', this._dfSwipeTouchEnd, { passive: true });
		this._dfSwipeBound = true;
	}

	/**
	 * Handle keyboard events in gallery mode.
	 */
	_handleGalleryKey(pEvent)
	{
		libHandleGalleryKey(this, pEvent);
	}

	/**
	 * Handle keyboard events when the sidebar file list has focus.
	 */
	_handleSidebarKey(pEvent)
	{
		libHandleSidebarKey(this, pEvent);
	}

	/**
	 * Move focus into the sidebar file list.
	 */
	_focusSidebar()
	{
		let tmpWrap = document.querySelector('.content-editor-sidebar-wrap');
		if (!tmpWrap || tmpWrap.classList.contains('collapsed'))
		{
			return;
		}

		this._sidebarFocused = true;
		this._sidebarCursorIndex = 0;

		// Apply visual focus ring on the sidebar
		let tmpInner = document.querySelector('.content-editor-sidebar-inner');
		if (tmpInner)
		{
			tmpInner.classList.add('keyboard-focused');
		}

		this._moveSidebarCursor(0);
	}

	/**
	 * Return focus from sidebar back to the gallery.
	 */
	_blurSidebar()
	{
		this._sidebarFocused = false;

		// Remove sidebar focus ring
		let tmpInner = document.querySelector('.content-editor-sidebar-inner');
		if (tmpInner)
		{
			tmpInner.classList.remove('keyboard-focused');
		}

		// Remove highlight from all rows
		let tmpRows = document.querySelectorAll('#Pict-FileBrowser-DetailRows .pict-fb-detail-row');
		for (let i = 0; i < tmpRows.length; i++)
		{
			tmpRows[i].classList.remove('sidebar-focused');
		}
	}

	/**
	 * Move the sidebar cursor to a new index and highlight the row.
	 */
	_moveSidebarCursor(pIndex)
	{
		let tmpRows = document.querySelectorAll('#Pict-FileBrowser-DetailRows .pict-fb-detail-row');
		if (tmpRows.length === 0)
		{
			return;
		}

		// Remove old highlight
		if (this._sidebarCursorIndex < tmpRows.length)
		{
			tmpRows[this._sidebarCursorIndex].classList.remove('sidebar-focused');
		}

		this._sidebarCursorIndex = pIndex;

		// Apply new highlight and scroll into view
		if (pIndex < tmpRows.length)
		{
			tmpRows[pIndex].classList.add('sidebar-focused');
			tmpRows[pIndex].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}
	}

	/**
	 * Handle keyboard events in viewer mode.
	 */
	_handleViewerKey(pEvent)
	{
		libHandleViewerKey(this, pEvent);
	}

	/**
	 * Handle keyboard events in video explorer mode.
	 */
	_handleVideoExplorerKey(pEvent)
	{
		libHandleVideoExplorerKey(this, pEvent);
	}

	/**
	 * Handle keyboard events in audio explorer mode.
	 */
	_handleAudioExplorerKey(pEvent)
	{
		libHandleAudioExplorerKey(this, pEvent);
	}

	/**
	 * Handle keyboard events in image explorer mode.
	 */
	_handleImageExplorerKey(pEvent)
	{
		libHandleImageExplorerKey(this, pEvent);
	}

	/**
	 * Move the gallery cursor to a new index and update the UI.
	 *
	 * @param {number} pNewIndex - The new cursor position
	 */
	moveCursor(pNewIndex)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpOldIndex = tmpRemote.GalleryCursorIndex || 0;

		if (pNewIndex === tmpOldIndex)
		{
			return;
		}

		tmpRemote.GalleryCursorIndex = pNewIndex;

		// Update CSS classes on the affected elements (tiles in grid mode, rows in list mode)
		let tmpOldTile = document.querySelector(`.retold-remote-tile[data-index="${tmpOldIndex}"], .retold-remote-list-row[data-index="${tmpOldIndex}"]`);
		let tmpNewTile = document.querySelector(`.retold-remote-tile[data-index="${pNewIndex}"], .retold-remote-list-row[data-index="${pNewIndex}"]`);

		if (tmpOldTile)
		{
			tmpOldTile.classList.remove('selected');
		}
		if (tmpNewTile)
		{
			tmpNewTile.classList.add('selected');
			// Scroll the tile into view if needed
			tmpNewTile.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
		}

		// Update the top bar info to reflect the new cursor position
		let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBar)
		{
			tmpTopBar.updateInfo();
		}
	}

	/**
	 * Open the currently selected gallery item.
	 */
	openCurrent()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpIndex = tmpRemote.GalleryCursorIndex || 0;

		if (tmpIndex >= tmpItems.length)
		{
			return;
		}

		let tmpItem = tmpItems[tmpIndex];

		if (tmpItem.Type === 'folder' || tmpItem.Type === 'archive')
		{
			// Remember cursor position in the current folder before navigating away
			let tmpCurrentLocation = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';
			tmpRemote.FolderCursorHistory[tmpCurrentLocation] = tmpIndex;

			// Navigate into the folder or archive
			let tmpApp = this.pict.PictApplication;
			if (tmpApp && tmpApp.loadFileList)
			{
				tmpApp.loadFileList(tmpItem.Path);
			}
		}
		else
		{
			// Open the file in the viewer
			let tmpApp = this.pict.PictApplication;
			if (tmpApp && tmpApp.navigateToFile)
			{
				tmpApp.navigateToFile(tmpItem.Path);
			}
		}
	}

	/**
	 * Open the currently selected gallery item, forcing a specific media type
	 * regardless of its file extension.
	 *
	 * @param {string} pMediaType - 'image', 'video', 'audio', or 'text'
	 */
	openCurrentAs(pMediaType)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpIndex = tmpRemote.GalleryCursorIndex || 0;

		if (tmpIndex >= tmpItems.length)
		{
			return;
		}

		let tmpItem = tmpItems[tmpIndex];

		if (tmpItem.Type === 'folder' || tmpItem.Type === 'archive')
		{
			return;
		}

		let tmpApp = this.pict.PictApplication;
		if (tmpApp && tmpApp.navigateToFileAs)
		{
			tmpApp.navigateToFileAs(tmpItem.Path, pMediaType);
		}
	}

	/**
	 * Re-open the currently viewed file with a different media type.
	 *
	 * @param {string} pMediaType - 'image', 'video', 'audio', or 'text'
	 */
	switchViewerType(pMediaType)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpFilePath = tmpRemote.CurrentViewerFile;

		if (!tmpFilePath)
		{
			return;
		}

		let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
		if (tmpViewer)
		{
			tmpViewer.showMedia(tmpFilePath, pMediaType);
		}
	}

	/**
	 * Navigate up one directory level.
	 */
	navigateUp()
	{
		let tmpCurrentLocation = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';

		if (!tmpCurrentLocation)
		{
			return;
		}

		// Remember cursor position in the current folder before navigating away
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.FolderCursorHistory[tmpCurrentLocation] = tmpRemote.GalleryCursorIndex || 0;

		let tmpParent = tmpCurrentLocation.indexOf('/') >= 0
			? tmpCurrentLocation.replace(/\/[^/]+\/?$/, '')
			: '';
		let tmpApp = this.pict.PictApplication;
		if (tmpApp && tmpApp.loadFileList)
		{
			tmpApp.loadFileList(tmpParent);
		}
	}

	/**
	 * Close the viewer and return to gallery mode.
	 */
	closeViewer()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ActiveMode = 'gallery';

		// Clear viewer file state so collection/favorites resolution
		// falls through to the gallery cursor instead of a stale path
		tmpRemote.CurrentViewerFile = '';
		tmpRemote.CurrentViewerMediaType = '';

		// Exit collection browsing mode
		tmpRemote.BrowsingCollection = false;
		tmpRemote.BrowsingCollectionIndex = -1;

		let tmpGalleryContainer = document.getElementById('RetoldRemote-Gallery-Container');
		let tmpViewerContainer = document.getElementById('RetoldRemote-Viewer-Container');

		// Stop any playing video/audio and release resources before hiding the viewer
		let tmpVideo = document.querySelector('#RetoldRemote-Viewer-Container video');
		let tmpAudio = document.querySelector('#RetoldRemote-Viewer-Container audio');
		if (tmpVideo) { tmpVideo.pause(); tmpVideo.removeAttribute('src'); tmpVideo.load(); }
		if (tmpAudio) { tmpAudio.pause(); tmpAudio.removeAttribute('src'); tmpAudio.load(); }

		if (tmpGalleryContainer) tmpGalleryContainer.style.display = '';
		if (tmpViewerContainer) tmpViewerContainer.style.display = 'none';

		// Clean up swipe and DF exit listeners
		let tmpMediaViewer = this.pict.views['RetoldRemote-MediaViewer'];
		if (tmpMediaViewer)
		{
			if (tmpMediaViewer._cleanupSwipe)
			{
				tmpMediaViewer._cleanupSwipe();
			}
			if (tmpMediaViewer._cleanupDFExitHotspot)
			{
				tmpMediaViewer._cleanupDFExitHotspot();
			}
		}

		// Restore the hash to the browse route (use hashed identifier when available)
		let tmpCurrentLocation = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';
		let tmpFragProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpFragId = (tmpFragProvider && tmpCurrentLocation) ? tmpFragProvider.getFragmentIdentifier(tmpCurrentLocation) : tmpCurrentLocation;
		window.location.hash = tmpFragId ? '#/browse/' + tmpFragId : '#/browse/';

		// Re-render gallery to ensure cursor is visible
		let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
		if (tmpGalleryView)
		{
			tmpGalleryView.renderGallery();
		}
	}

	/**
	 * Navigate to a collection item based on its type.  Video-frame items
	 * are shown as images in the media viewer; video/audio clips open
	 * their respective explorers; everything else uses navigateToFile.
	 *
	 * @param {object} pItem      - The collection item record
	 * @param {number} pItemIndex - Index within ActiveCollection.Items
	 */
	_navigateToCollectionItem(pItem, pItemIndex)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.BrowsingCollection = true;
		tmpRemote.BrowsingCollectionIndex = pItemIndex;

		if (pItem.Type === 'video-clip')
		{
			let tmpVEX = this.pict.views['RetoldRemote-VideoExplorer'];
			if (tmpVEX)
			{
				tmpVEX.showExplorer(pItem.Path, pItem.VideoStart, pItem.VideoEnd);
			}
		}
		else if (pItem.Type === 'audio-clip')
		{
			let tmpAEX = this.pict.views['RetoldRemote-AudioExplorer'];
			if (tmpAEX)
			{
				tmpAEX.showExplorer(pItem.Path, pItem.AudioStart, pItem.AudioEnd);
			}
		}
		else if (pItem.Type === 'document-region')
		{
			// Navigate to the document, then to the specific location
			let tmpApp = this.pict.PictApplication;
			if (tmpApp && tmpApp.navigateToFile)
			{
				tmpApp.navigateToFile(pItem.Path);

				// After the viewer loads, navigate to the specific page/CFI
				let tmpSelf = this;
				setTimeout(() =>
				{
					let tmpMediaViewer = tmpSelf.pict.views['RetoldRemote-MediaViewer'];
					if (tmpMediaViewer)
					{
						if (pItem.CFI && tmpMediaViewer._activeRendition)
						{
							tmpMediaViewer._activeRendition.display(pItem.CFI);
						}
						else if (pItem.PageNumber && typeof tmpMediaViewer._renderPdfPage === 'function')
						{
							tmpMediaViewer._renderPdfPage(pItem.PageNumber);
						}
					}
				}, 1000);
			}
		}
		else if (pItem.Type === 'image-crop' && pItem.CropRegion)
		{
			let tmpIEX = this.pict.views['RetoldRemote-ImageExplorer'];
			if (tmpIEX)
			{
				tmpIEX.showExplorer(pItem.Path);
				// Zoom to the crop region after the viewer loads
				let tmpCrop = pItem.CropRegion;
				setTimeout(() =>
				{
					if (tmpIEX._osdViewer && tmpIEX._dziData)
					{
						let tmpImageRect = new OpenSeadragon.Rect(tmpCrop.X, tmpCrop.Y, tmpCrop.Width, tmpCrop.Height);
						let tmpViewportRect = tmpIEX._osdViewer.viewport.imageToViewportRectangle(tmpImageRect);
						tmpIEX._osdViewer.viewport.fitBounds(tmpViewportRect);
					}
				}, 800);
			}
		}
		else if (pItem.Type === 'video-frame' && pItem.FrameCacheKey && pItem.FrameFilename)
		{
			// Show the cached frame image directly in the viewer
			let tmpFrameURL = '/api/media/video-frame/'
				+ encodeURIComponent(pItem.FrameCacheKey) + '/'
				+ encodeURIComponent(pItem.FrameFilename);
			let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
			if (tmpViewer)
			{
				tmpViewer.showDirectImage(tmpFrameURL, pItem.Label || pItem.FrameFilename, pItem.Path);
			}
		}
		else
		{
			let tmpApp = this.pict.PictApplication;
			if (tmpApp && tmpApp.navigateToFile)
			{
				tmpApp.navigateToFile(pItem.Path);
			}
		}
	}

	/**
	 * Navigate to the next file in the gallery list.
	 * When browsing a collection, navigates through collection items instead.
	 */
	nextFile()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;

		// Collection browsing mode — navigate through ActiveCollection.Items
		if (tmpRemote.BrowsingCollection && tmpRemote.ActiveCollection)
		{
			let tmpCollItems = tmpRemote.ActiveCollection.Items || [];
			let tmpCollIndex = tmpRemote.BrowsingCollectionIndex;

			for (let i = tmpCollIndex + 1; i < tmpCollItems.length; i++)
			{
				let tmpItem = tmpCollItems[i];
				if (tmpItem.Type === 'file' || tmpItem.Type === 'subfile' ||
					tmpItem.Type === 'image-crop' || tmpItem.Type === 'video-clip' ||
					tmpItem.Type === 'video-frame')
				{
					this._navigateToCollectionItem(tmpItem, i);
					return;
				}
			}
			return;
		}

		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpIndex = tmpRemote.GalleryCursorIndex || 0;

		// Find the next file (skip folders)
		for (let i = tmpIndex + 1; i < tmpItems.length; i++)
		{
			if (tmpItems[i].Type === 'file')
			{
				tmpRemote.GalleryCursorIndex = i;
				let tmpApp = this.pict.PictApplication;
				if (tmpApp && tmpApp.navigateToFile)
				{
					tmpApp.navigateToFile(tmpItems[i].Path);
				}
				return;
			}
		}
	}

	/**
	 * Navigate to the previous file in the gallery list.
	 * When browsing a collection, navigates through collection items instead.
	 */
	prevFile()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;

		// Collection browsing mode — navigate through ActiveCollection.Items
		if (tmpRemote.BrowsingCollection && tmpRemote.ActiveCollection)
		{
			let tmpCollItems = tmpRemote.ActiveCollection.Items || [];
			let tmpCollIndex = tmpRemote.BrowsingCollectionIndex;

			for (let i = tmpCollIndex - 1; i >= 0; i--)
			{
				let tmpItem = tmpCollItems[i];
				if (tmpItem.Type === 'file' || tmpItem.Type === 'subfile' ||
					tmpItem.Type === 'image-crop' || tmpItem.Type === 'video-clip' ||
					tmpItem.Type === 'video-frame')
				{
					this._navigateToCollectionItem(tmpItem, i);
					return;
				}
			}
			return;
		}

		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpIndex = tmpRemote.GalleryCursorIndex || 0;

		// Find the previous file (skip folders)
		for (let i = tmpIndex - 1; i >= 0; i--)
		{
			if (tmpItems[i].Type === 'file')
			{
				tmpRemote.GalleryCursorIndex = i;
				let tmpApp = this.pict.PictApplication;
				if (tmpApp && tmpApp.navigateToFile)
				{
					tmpApp.navigateToFile(tmpItems[i].Path);
				}
				return;
			}
		}
	}

	_toggleViewMode()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ViewMode = (tmpRemote.ViewMode === 'gallery') ? 'list' : 'gallery';

		let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
		if (tmpGalleryView)
		{
			tmpGalleryView.renderGallery();
		}

		// Persist the change
		let tmpApp = this.pict.PictApplication;
		if (tmpApp && typeof tmpApp.saveSettings === 'function')
		{
			tmpApp.saveSettings();
		}
	}

	_focusSearch()
	{
		let tmpSearch = document.getElementById('RetoldRemote-Gallery-Search');
		if (tmpSearch)
		{
			tmpSearch.focus();
		}
	}

	// ──────────────────────────────────────────────
	// Filter bar toggle
	// ──────────────────────────────────────────────

	/**
	 * Toggle the filter bar visibility.
	 * If hidden, show it and focus the search input.
	 * If visible, hide it.
	 */
	_toggleFilterBar()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;

		if (tmpRemote.FilterBarVisible)
		{
			this._hideFilterBar();
		}
		else
		{
			this._showFilterBar();
		}
	}

	/**
	 * Show the filter bar and focus the search input.
	 */
	_showFilterBar()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;

		if (tmpRemote.FilterBarVisible)
		{
			// Already visible — just focus search
			let tmpSearch = document.getElementById('RetoldRemote-Gallery-Search');
			if (tmpSearch)
			{
				tmpSearch.focus();
			}
			return;
		}

		tmpRemote.FilterBarVisible = true;

		let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
		if (tmpGalleryView)
		{
			tmpGalleryView.renderGallery();
		}

		// Focus the search input after render
		setTimeout(() =>
		{
			let tmpSearch = document.getElementById('RetoldRemote-Gallery-Search');
			if (tmpSearch)
			{
				tmpSearch.focus();
			}
		}, 50);
	}

	/**
	 * Hide the filter bar.
	 */
	_hideFilterBar()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.FilterBarVisible = false;
		tmpRemote.FilterPanelOpen = false;

		let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
		if (tmpGalleryView)
		{
			tmpGalleryView.renderGallery();
		}
	}

	/**
	 * Clear all active filters and update the gallery.
	 */
	_clearAllFilters()
	{
		let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
		if (tmpGalleryView)
		{
			tmpGalleryView.clearAllFilters();
		}

		this.pict.providers['RetoldRemote-ToastNotification'].showOverlayIndicator('Filters cleared');
	}

	// ──────────────────────────────────────────────
	// Help panel
	// ──────────────────────────────────────────────

	/**
	 * Toggle the keyboard shortcuts help panel.
	 * Works in both gallery and viewer modes, including fullscreen.
	 */
	_toggleHelpPanel()
	{
		let tmpExisting = document.getElementById('RetoldRemote-Help-Panel');
		if (tmpExisting)
		{
			tmpExisting.remove();
			this._helpPanelVisible = false;
			return;
		}

		this._helpPanelVisible = true;

		let tmpPanel = document.createElement('div');
		tmpPanel.id = 'RetoldRemote-Help-Panel';
		tmpPanel.innerHTML = this._buildHelpPanelHTML();

		// In fullscreen mode, append to the fullscreen element so it's visible;
		// otherwise append to document.body
		let tmpParent = document.fullscreenElement || document.body;
		tmpParent.appendChild(tmpPanel);
	}

	/**
	 * Build the HTML for the help panel flyout.
	 */
	_buildHelpPanelHTML()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpActiveMode = tmpRemote.ActiveMode || 'gallery';

		let tmpHTML = '<div class="retold-remote-help-backdrop" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._toggleHelpPanel()">';
		tmpHTML += '<div class="retold-remote-help-flyout" onclick="event.stopPropagation()">';

		tmpHTML += '<div class="retold-remote-help-header">';
		tmpHTML += '<span class="retold-remote-help-title">Keyboard Shortcuts</span>';
		tmpHTML += '<button class="retold-remote-help-close" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._toggleHelpPanel()">&times;</button>';
		tmpHTML += '</div>';

		// Gallery shortcuts
		tmpHTML += '<div class="retold-remote-help-section">';
		tmpHTML += '<div class="retold-remote-help-section-title">Gallery / File List</div>';

		let tmpGalleryShortcuts =
		[
			['← → ↑ ↓', 'Navigate tiles'],
			['Enter', 'Open selected item'],
			['Escape', 'Go up one folder'],
			['F9', 'Toggle sidebar focus'],
			['Home / End', 'Jump to first / last'],
			['g', 'Toggle gallery / list view'],
			['/', 'Toggle filter bar &amp; search'],
			['f', 'Toggle advanced filter panel'],
			['s', 'Focus sort dropdown'],
			['x', 'Clear all filters'],
			['c', 'Settings / config panel'],
			['d', 'Distraction-free mode'],
			['e', 'Video explorer (on video files)']
		];
		for (let i = 0; i < tmpGalleryShortcuts.length; i++)
		{
			tmpHTML += '<div class="retold-remote-help-row">';
			tmpHTML += '<kbd class="retold-remote-help-key">' + tmpGalleryShortcuts[i][0] + '</kbd>';
			tmpHTML += '<span class="retold-remote-help-desc">' + tmpGalleryShortcuts[i][1] + '</span>';
			tmpHTML += '</div>';
		}
		tmpHTML += '</div>';

		// Sidebar shortcuts
		tmpHTML += '<div class="retold-remote-help-section">';
		tmpHTML += '<div class="retold-remote-help-section-title">Sidebar (F9 to focus)</div>';

		let tmpSidebarShortcuts =
		[
			['↑ / ↓', 'Navigate file list'],
			['Enter', 'Open selected item'],
			['Home / End', 'Jump to first / last'],
			['Escape / F9', 'Return to gallery']
		];
		for (let i = 0; i < tmpSidebarShortcuts.length; i++)
		{
			tmpHTML += '<div class="retold-remote-help-row">';
			tmpHTML += '<kbd class="retold-remote-help-key">' + tmpSidebarShortcuts[i][0] + '</kbd>';
			tmpHTML += '<span class="retold-remote-help-desc">' + tmpSidebarShortcuts[i][1] + '</span>';
			tmpHTML += '</div>';
		}
		tmpHTML += '</div>';

		// Viewer shortcuts
		tmpHTML += '<div class="retold-remote-help-section">';
		tmpHTML += '<div class="retold-remote-help-section-title">Media Viewer</div>';

		let tmpViewerShortcuts =
		[
			['← / k', 'Previous file'],
			['→ / j', 'Next file'],
			['Escape', 'Back to gallery'],
			['f', 'Toggle fullscreen'],
			['i', 'Toggle file info'],
			['Space', 'Play / pause media'],
			['Enter', 'Open video in VLC'],
			['z', 'Cycle fit mode'],
			['+ / -', 'Zoom in / out'],
			['0', 'Reset zoom'],
			['d', 'Distraction-free mode']
		];
		for (let i = 0; i < tmpViewerShortcuts.length; i++)
		{
			tmpHTML += '<div class="retold-remote-help-row">';
			tmpHTML += '<kbd class="retold-remote-help-key">' + tmpViewerShortcuts[i][0] + '</kbd>';
			tmpHTML += '<span class="retold-remote-help-desc">' + tmpViewerShortcuts[i][1] + '</span>';
			tmpHTML += '</div>';
		}
		tmpHTML += '</div>';

		// Global
		tmpHTML += '<div class="retold-remote-help-section">';
		tmpHTML += '<div class="retold-remote-help-section-title">Global</div>';

		let tmpGlobalShortcuts =
		[
			['F1', 'Toggle this help panel'],
			['F9', 'Toggle sidebar focus'],
			['Escape', 'Close help panel']
		];
		for (let i = 0; i < tmpGlobalShortcuts.length; i++)
		{
			tmpHTML += '<div class="retold-remote-help-row">';
			tmpHTML += '<kbd class="retold-remote-help-key">' + tmpGlobalShortcuts[i][0] + '</kbd>';
			tmpHTML += '<span class="retold-remote-help-desc">' + tmpGlobalShortcuts[i][1] + '</span>';
			tmpHTML += '</div>';
		}
		tmpHTML += '</div>';

		// Documentation link
		tmpHTML += '<div class="retold-remote-help-section">';
		tmpHTML += '<div class="retold-remote-help-row" style="justify-content: center; padding: 8px 0;">';
		tmpHTML += '<a href="docs.html" target="_blank" style="color: var(--retold-accent, #569cd6); text-decoration: none; font-size: 0.9rem; cursor: pointer;">';
		tmpHTML += 'View Documentation &#x2197;</a>';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		// Active mode indicator
		tmpHTML += '<div class="retold-remote-help-footer">';
		let tmpModeLabel = 'Gallery';
		if (tmpActiveMode === 'viewer') tmpModeLabel = 'Media Viewer';
		else if (tmpActiveMode === 'video-explorer') tmpModeLabel = 'Video Explorer';
		else if (tmpActiveMode === 'audio-explorer') tmpModeLabel = 'Audio Explorer';
		tmpHTML += 'Current mode: <strong>' + tmpModeLabel + '</strong>';
		tmpHTML += '</div>';

		tmpHTML += '</div>'; // end flyout
		tmpHTML += '</div>'; // end backdrop

		return tmpHTML;
	}

	/**
	 * F9 — Toggle the settings/configuration panel.
	 * Opens the sidebar if collapsed, switches to the Settings tab,
	 * or toggles back to the Files tab if Settings is already showing.
	 */
	_toggleSettingsPanel()
	{
		let tmpLayoutView = this.pict.views['ContentEditor-Layout'];
		if (!tmpLayoutView)
		{
			return;
		}

		let tmpWrap = document.querySelector('.content-editor-sidebar-wrap');
		if (!tmpWrap)
		{
			return;
		}

		let tmpIsCollapsed = tmpWrap.classList.contains('collapsed');
		let tmpSettingsTab = document.querySelector('.content-editor-sidebar-tab[data-tab="settings"]');
		let tmpIsSettingsActive = tmpSettingsTab && tmpSettingsTab.classList.contains('active');

		if (tmpIsCollapsed)
		{
			// Sidebar is collapsed: open it and switch to settings
			tmpLayoutView.toggleSidebar();
			tmpLayoutView.switchSidebarTab('settings');
		}
		else if (tmpIsSettingsActive)
		{
			// Settings already showing: switch back to files
			tmpLayoutView.switchSidebarTab('files');
		}
		else
		{
			// Sidebar open on files: switch to settings
			tmpLayoutView.switchSidebarTab('settings');
		}
	}

	/**
	 * F3 — Drop down the saved filter presets list.
	 * If the filter panel is closed, open it first.
	 * Then focus/open the preset select dropdown.
	 */
	_toggleFilterPresets()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];

		// Only works in gallery mode
		if (tmpRemote.ActiveMode !== 'gallery')
		{
			return;
		}

		// Ensure filter panel is open
		if (!tmpRemote.FilterPanelOpen && tmpGalleryView)
		{
			tmpGalleryView.toggleFilterPanel();
		}

		// Focus the preset select dropdown after a brief render delay
		setTimeout(() =>
		{
			let tmpPresetSelect = document.getElementById('RetoldRemote-Filter-PresetSelect');
			if (tmpPresetSelect)
			{
				tmpPresetSelect.focus();
				// Programmatically open the dropdown
				tmpPresetSelect.click();
			}
			else
			{
				// No presets saved yet — focus the preset name input instead
				let tmpPresetInput = document.getElementById('RetoldRemote-Filter-PresetName');
				if (tmpPresetInput)
				{
					tmpPresetInput.focus();
				}
			}
		}, 50);
	}

	/**
	 * F4 — Toggle distraction-free mode.
	 * Hides/shows both the sidebar and the top bar.
	 */
	_toggleDistractionFree()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;

		let tmpTopBar = document.getElementById('ContentEditor-TopBar-Container');
		let tmpSidebarWrap = document.querySelector('.content-editor-sidebar-wrap');

		if (!tmpTopBar || !tmpSidebarWrap)
		{
			return;
		}

		// Check current state — if either is visible, hide both; if both hidden, show both
		let tmpIsDistractionFree = tmpRemote._distractionFreeMode || false;

		if (tmpIsDistractionFree)
		{
			// Restore
			tmpTopBar.style.display = '';
			tmpSidebarWrap.style.display = '';
			tmpRemote._distractionFreeMode = false;

			// Restore viewer nav header
			let tmpViewerHeader = document.querySelector('.retold-remote-viewer-header');
			if (tmpViewerHeader)
			{
				tmpViewerHeader.style.display = '';
			}

			// Restore collections panel if it was open before DF mode
			if (tmpRemote._collectionsPanelWasOpen)
			{
				let tmpCollWrap = document.getElementById('RetoldRemote-Collections-Wrap');
				if (tmpCollWrap)
				{
					tmpCollWrap.classList.remove('collapsed');
					if (tmpRemote.CollectionsPanelWidth)
					{
						tmpCollWrap.style.width = tmpRemote.CollectionsPanelWidth + 'px';
					}
				}
				tmpRemote.CollectionsPanelOpen = true;
				tmpRemote._collectionsPanelWasOpen = false;
			}
		}
		else
		{
			// Hide
			tmpTopBar.style.display = 'none';
			tmpSidebarWrap.style.display = 'none';
			tmpRemote._distractionFreeMode = true;

			// Hide viewer nav header if setting says so
			if (!tmpRemote.DistractionFreeShowNav)
			{
				let tmpViewerHeader = document.querySelector('.retold-remote-viewer-header');
				if (tmpViewerHeader)
				{
					tmpViewerHeader.style.display = 'none';
				}
			}

			// Hide collections panel if it's open
			if (tmpRemote.CollectionsPanelOpen)
			{
				tmpRemote._collectionsPanelWasOpen = true;
				let tmpCollWrap = document.getElementById('RetoldRemote-Collections-Wrap');
				if (tmpCollWrap)
				{
					tmpCollWrap.classList.add('collapsed');
				}
				tmpRemote.CollectionsPanelOpen = false;
			}
		}

		// Sync DF toggle/hotspot in the media viewer
		let tmpMediaViewer = this.pict.views['RetoldRemote-MediaViewer'];
		if (tmpMediaViewer && tmpMediaViewer._updateDFControls)
		{
			tmpMediaViewer._updateDFControls();
		}

		// Recalculate gallery columns after layout change
		setTimeout(() => this.recalculateColumns(), 100);
	}

	_toggleFullscreen()
	{
		if (document.fullscreenElement)
		{
			document.exitFullscreen();
			return;
		}

		// When viewing a video, fullscreen the video element itself
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (tmpRemote.CurrentViewerMediaType === 'video')
		{
			let tmpVideo = document.getElementById('RetoldRemote-VideoPlayer');
			if (tmpVideo)
			{
				tmpVideo.requestFullscreen();
				return;
			}
		}

		// For other media types, fullscreen the viewer container
		let tmpViewer = document.getElementById('RetoldRemote-Viewer-Container');
		if (tmpViewer)
		{
			tmpViewer.requestFullscreen();
		}
	}

	_toggleFileInfo()
	{
		let tmpInfoOverlay = document.getElementById('RetoldRemote-FileInfo-Overlay');
		if (tmpInfoOverlay)
		{
			let tmpIsHidden = window.getComputedStyle(tmpInfoOverlay).display === 'none';
			tmpInfoOverlay.style.display = tmpIsHidden ? 'block' : 'none';
		}
	}

	_togglePlayPause()
	{
		let tmpVideo = document.querySelector('#RetoldRemote-Viewer-Container video');
		let tmpAudio = document.querySelector('#RetoldRemote-Viewer-Container audio');
		let tmpMedia = tmpVideo || tmpAudio;

		if (tmpMedia)
		{
			if (tmpMedia.paused)
			{
				tmpMedia.play();
			}
			else
			{
				tmpMedia.pause();
			}
		}
	}

	_zoomIn()
	{
		let tmpImageViewer = this.pict.views['RetoldRemote-ImageViewer'];
		if (tmpImageViewer && tmpImageViewer.zoomIn)
		{
			tmpImageViewer.zoomIn();
		}
	}

	_zoomOut()
	{
		let tmpImageViewer = this.pict.views['RetoldRemote-ImageViewer'];
		if (tmpImageViewer && tmpImageViewer.zoomOut)
		{
			tmpImageViewer.zoomOut();
		}
	}

	_zoomReset()
	{
		let tmpImageViewer = this.pict.views['RetoldRemote-ImageViewer'];
		if (tmpImageViewer && tmpImageViewer.zoomReset)
		{
			tmpImageViewer.zoomReset();
		}
	}

	_cycleFitMode()
	{
		let tmpImageViewer = this.pict.views['RetoldRemote-ImageViewer'];
		if (tmpImageViewer && tmpImageViewer.cycleFitMode)
		{
			tmpImageViewer.cycleFitMode();
		}
	}

	/**
	 * Open the current video file with VLC via the server endpoint.
	 */
	_openWithVLC()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;

		// Only works for video files
		if (tmpRemote.CurrentViewerMediaType !== 'video')
		{
			return;
		}

		// Check if VLC is available
		let tmpCapabilities = tmpRemote.ServerCapabilities || {};
		if (!tmpCapabilities.vlc)
		{
			return;
		}

		let tmpFilePath = tmpRemote.CurrentViewerFile;
		if (!tmpFilePath)
		{
			return;
		}

		// Show a brief toast
		this.pict.providers['RetoldRemote-ToastNotification'].showOverlayIndicator('Opening in VLC...');

		// POST to the server to open the file
		fetch('/api/media/open',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ path: tmpFilePath })
		})
		.then((pResponse) =>
		{
			return pResponse.json();
		})
		.then((pData) =>
		{
			if (!pData.Success)
			{
				this.pict.providers['RetoldRemote-ToastNotification'].showOverlayIndicator('Failed to open: ' + (pData.Error || 'Unknown error'));
			}
		})
		.catch((pError) =>
		{
			this.pict.providers['RetoldRemote-ToastNotification'].showOverlayIndicator('Failed to open: ' + pError.message);
		});
	}

	/**
	 * Stream the current media file to VLC on the client device via vlc:// protocol link.
	 */
	_streamWithVLC()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpMediaType = tmpRemote.CurrentViewerMediaType;

		if (tmpMediaType !== 'video' && tmpMediaType !== 'audio')
		{
			return;
		}

		let tmpFilePath = tmpRemote.CurrentViewerFile;
		if (!tmpFilePath)
		{
			return;
		}

		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpContentPath = tmpProvider ? tmpProvider.getContentURL(tmpFilePath) : ('/content/' + encodeURIComponent(tmpFilePath));
		let tmpStreamURL = window.location.origin + tmpContentPath;

		// Detect platform for VLC URL format.
		// iPadOS 13+ sends a macOS user agent — detect it via maxTouchPoints.
		let tmpIsWindows = /Windows/.test(navigator.userAgent);
		let tmpIsIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
			|| (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
		let tmpIsAndroid = /Android/i.test(navigator.userAgent);
		let tmpIsMobile = tmpIsIOS || tmpIsAndroid;

		let tmpVLCURL;
		if (tmpIsIOS)
		{
			// iOS/iPadOS: use vlc-x-callback for reliable app launching
			tmpVLCURL = 'vlc-x-callback://x-callback-url/stream?url=' + encodeURIComponent(tmpStreamURL);
		}
		else if (tmpIsAndroid)
		{
			// Android: VLC app handles the raw URL natively via intent
			tmpVLCURL = 'vlc://' + tmpStreamURL;
		}
		else
		{
			// Windows, macOS, Linux: encode the URL so the custom protocol
			// handler can decode it.  On Windows this is required because the
			// shell strips the colon from nested http:// URLs.
			tmpVLCURL = 'vlc://' + encodeURIComponent(tmpStreamURL);
		}

		this.pict.providers['RetoldRemote-ToastNotification'].showOverlayIndicator('Opening VLC...');

		// Use window.location for iOS (more reliable for custom URL schemes
		// on iOS Safari than a programmatic anchor click), anchor for others.
		if (tmpIsIOS)
		{
			window.location.href = tmpVLCURL;
		}
		else
		{
			let tmpLink = document.createElement('a');
			tmpLink.href = tmpVLCURL;
			tmpLink.style.display = 'none';
			document.body.appendChild(tmpLink);
			tmpLink.click();
			document.body.removeChild(tmpLink);
		}
	}

}

GalleryNavigationProvider.default_configuration = _DefaultProviderConfiguration;

module.exports = GalleryNavigationProvider;
