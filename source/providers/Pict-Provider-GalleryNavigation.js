const libPictProvider = require('pict-provider');

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

			if (tmpActiveMode === 'gallery')
			{
				tmpSelf._handleGalleryKey(pEvent);
			}
			else if (tmpActiveMode === 'viewer')
			{
				tmpSelf._handleViewerKey(pEvent);
			}
		};

		document.addEventListener('keydown', this._keydownHandler);
		this._keydownBound = true;
	}

	/**
	 * Handle keyboard events in gallery mode.
	 */
	_handleGalleryKey(pEvent)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpIndex = tmpRemote.GalleryCursorIndex || 0;

		switch (pEvent.key)
		{
			case 'ArrowRight':
				pEvent.preventDefault();
				this.moveCursor(Math.min(tmpIndex + 1, tmpItems.length - 1));
				break;

			case 'ArrowLeft':
				pEvent.preventDefault();
				this.moveCursor(Math.max(tmpIndex - 1, 0));
				break;

			case 'ArrowDown':
				pEvent.preventDefault();
				this.moveCursor(Math.min(tmpIndex + this._columnsPerRow, tmpItems.length - 1));
				break;

			case 'ArrowUp':
				pEvent.preventDefault();
				this.moveCursor(Math.max(tmpIndex - this._columnsPerRow, 0));
				break;

			case 'Enter':
				pEvent.preventDefault();
				this.openCurrent();
				break;

			case 'Escape':
				pEvent.preventDefault();
				this.navigateUp();
				break;

			case 'g':
				pEvent.preventDefault();
				this._toggleViewMode();
				break;

			case '/':
				pEvent.preventDefault();
				this._focusSearch();
				break;

			case 'Home':
				pEvent.preventDefault();
				this.moveCursor(0);
				break;

			case 'End':
				pEvent.preventDefault();
				this.moveCursor(tmpItems.length - 1);
				break;

			case 'f':
				pEvent.preventDefault();
				{
					let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
					if (tmpGalleryView)
					{
						tmpGalleryView.toggleFilterPanel();
					}
				}
				break;

			case 's':
				pEvent.preventDefault();
				{
					let tmpSortSelect = document.getElementById('RetoldRemote-Gallery-Sort');
					if (tmpSortSelect)
					{
						tmpSortSelect.focus();
					}
				}
				break;

			case 'c':
				pEvent.preventDefault();
				this._toggleSettingsPanel();
				break;

			case 'd':
				pEvent.preventDefault();
				this._toggleDistractionFree();
				break;
		}
	}

	/**
	 * Handle keyboard events in viewer mode.
	 */
	_handleViewerKey(pEvent)
	{
		switch (pEvent.key)
		{
			case 'Escape':
				pEvent.preventDefault();
				this.closeViewer();
				break;

			case 'ArrowRight':
			case 'j':
				pEvent.preventDefault();
				this.nextFile();
				break;

			case 'ArrowLeft':
			case 'k':
				pEvent.preventDefault();
				this.prevFile();
				break;

			case 'f':
				pEvent.preventDefault();
				this._toggleFullscreen();
				break;

			case 'i':
				pEvent.preventDefault();
				this._toggleFileInfo();
				break;

			case ' ':
				pEvent.preventDefault();
				this._togglePlayPause();
				break;

			case '+':
			case '=':
				pEvent.preventDefault();
				this._zoomIn();
				break;

			case '-':
				pEvent.preventDefault();
				this._zoomOut();
				break;

			case '0':
				pEvent.preventDefault();
				this._zoomReset();
				break;

			case 'z':
				pEvent.preventDefault();
				this._cycleFitMode();
				break;

			case 'd':
				pEvent.preventDefault();
				this._toggleDistractionFree();
				break;
		}
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

		if (tmpItem.Type === 'folder')
		{
			// Navigate into the folder
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
	 * Navigate up one directory level.
	 */
	navigateUp()
	{
		let tmpCurrentLocation = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';

		if (!tmpCurrentLocation)
		{
			return;
		}

		let tmpParent = tmpCurrentLocation.replace(/\/[^/]+\/?$/, '') || '';
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

		let tmpGalleryContainer = document.getElementById('RetoldRemote-Gallery-Container');
		let tmpViewerContainer = document.getElementById('RetoldRemote-Viewer-Container');

		if (tmpGalleryContainer) tmpGalleryContainer.style.display = '';
		if (tmpViewerContainer) tmpViewerContainer.style.display = 'none';

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
	 * Navigate to the next file in the gallery list.
	 */
	nextFile()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
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
	 */
	prevFile()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
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
			['Home / End', 'Jump to first / last'],
			['g', 'Toggle gallery / list view'],
			['/', 'Focus search bar'],
			['f', 'Toggle filter panel'],
			['s', 'Focus sort dropdown'],
			['c', 'Settings / config panel'],
			['d', 'Distraction-free mode']
		];
		for (let i = 0; i < tmpGalleryShortcuts.length; i++)
		{
			tmpHTML += '<div class="retold-remote-help-row">';
			tmpHTML += '<kbd class="retold-remote-help-key">' + tmpGalleryShortcuts[i][0] + '</kbd>';
			tmpHTML += '<span class="retold-remote-help-desc">' + tmpGalleryShortcuts[i][1] + '</span>';
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

		// Active mode indicator
		tmpHTML += '<div class="retold-remote-help-footer">';
		tmpHTML += 'Current mode: <strong>' + (tmpActiveMode === 'viewer' ? 'Media Viewer' : 'Gallery') + '</strong>';
		tmpHTML += '</div>';

		tmpHTML += '</div>'; // end flyout
		tmpHTML += '</div>'; // end backdrop

		return tmpHTML;
	}

	/**
	 * F2 — Toggle the settings/configuration panel.
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
		}

		// Recalculate gallery columns after layout change
		setTimeout(() => this.recalculateColumns(), 100);
	}

	_toggleFullscreen()
	{
		let tmpViewer = document.getElementById('RetoldRemote-Viewer-Container');
		if (!tmpViewer) return;

		if (document.fullscreenElement)
		{
			document.exitFullscreen();
		}
		else
		{
			tmpViewer.requestFullscreen();
		}
	}

	_toggleFileInfo()
	{
		let tmpInfoOverlay = document.getElementById('RetoldRemote-FileInfo-Overlay');
		if (tmpInfoOverlay)
		{
			tmpInfoOverlay.style.display = (tmpInfoOverlay.style.display === 'none') ? '' : 'none';
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
}

GalleryNavigationProvider.default_configuration = _DefaultProviderConfiguration;

module.exports = GalleryNavigationProvider;
