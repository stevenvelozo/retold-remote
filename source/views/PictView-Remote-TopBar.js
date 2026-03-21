const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "ContentEditor-TopBar",

	DefaultRenderable: "RetoldRemote-TopBar",
	DefaultDestinationAddress: "#ContentEditor-TopBar-Container",

	AutoRender: false,

	CSS: ``,

	Templates:
	[
		{
			Hash: "RetoldRemote-TopBar",
			Template: /*html*/`
				<div class="retold-remote-topbar">
					<button class="retold-remote-topbar-sidebar-toggle" id="RetoldRemote-TopBar-SidebarToggle" onclick="pict.views['ContentEditor-Layout'].toggleSidebar()" title="Toggle Sidebar"></button>
					<button class="retold-remote-topbar-df-toggle" id="RetoldRemote-TopBar-DFToggle" onclick="pict.views['ContentEditor-TopBar'].toggleDistractionFree()" title="Distraction-free mode (d)"></button>
					<div class="retold-remote-topbar-location" id="RetoldRemote-TopBar-Location"></div>
					<div class="retold-remote-topbar-info" id="RetoldRemote-TopBar-Info"></div>
					<div class="retold-remote-topbar-actions">
						<button class="retold-remote-topbar-aisort-btn" id="RetoldRemote-TopBar-AISortBtn" onclick="pict.views['ContentEditor-TopBar'].triggerAISort()" title="AI Sort (generate sort plan for current folder)" style="display:none;">Ai</button>
						<button class="retold-remote-topbar-btn retold-remote-topbar-addcoll-btn" id="RetoldRemote-TopBar-AddToCollectionBtn" onclick="pict.views['ContentEditor-TopBar'].addToCollection(event)" title="Add to collection">&#9733;</button>
						<button class="retold-remote-topbar-btn retold-remote-topbar-favorites-btn" id="RetoldRemote-TopBar-FavoritesBtn" onclick="pict.views['ContentEditor-TopBar'].toggleFavorite()" title="Toggle favorite (h)">&#9825;</button>
						<button class="retold-remote-topbar-sidebar-toggle retold-remote-topbar-collections-btn" id="RetoldRemote-TopBar-CollectionsBtn" onclick="pict.views['ContentEditor-TopBar'].toggleCollections()" title="Toggle Collections panel (b)">&#9733;</button>
						<button class="retold-remote-topbar-filter-btn" id="RetoldRemote-TopBar-FilterBtn" onclick="pict.views['ContentEditor-TopBar'].toggleFilterBar()" title="Toggle filter bar (/)">&#9698;</button>
					</div>
				</div>
			`
		}
	],

	Renderables:
	[
		{
			RenderableHash: "RetoldRemote-TopBar",
			TemplateHash: "RetoldRemote-TopBar",
			DestinationAddress: "#ContentEditor-TopBar-Container"
		}
	]
};

class RetoldRemoteTopBarView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender()
	{
		super.onAfterRender();
		this.updateSidebarToggleIcon();
		this.updateDFToggleIcon();
		this.updateLocation();
		this.updateInfo();
		this.updateFavoritesIcon();
	}

	/**
	 * Inject the SVG sidebar icon into the sidebar toggle button.
	 */
	updateSidebarToggleIcon()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-SidebarToggle');
		if (!tmpBtn)
		{
			return;
		}

		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		if (tmpIconProvider)
		{
			tmpBtn.innerHTML = tmpIconProvider.getIcon('sidebar', 18);
		}
		else
		{
			tmpBtn.innerHTML = '&#9776;';
		}
	}

	/**
	 * Inject the SVG expand icon into the distraction-free toggle button.
	 */
	updateDFToggleIcon()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-DFToggle');
		if (!tmpBtn)
		{
			return;
		}

		// Four-corner expand icon
		tmpBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
			+ '<polyline points="15 3 21 3 21 9" />'
			+ '<polyline points="9 21 3 21 3 15" />'
			+ '<polyline points="21 15 21 21 15 21" />'
			+ '<polyline points="3 9 3 3 9 3" />'
			+ '</svg>';
	}

	/**
	 * Toggle distraction-free mode via the GalleryNavigation provider.
	 */
	toggleDistractionFree()
	{
		let tmpNav = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNav && tmpNav._toggleDistractionFree)
		{
			tmpNav._toggleDistractionFree();
		}
	}

	/**
	 * Update the breadcrumb location display.
	 *
	 * The home icon always shows and acts as a dropdown trigger
	 * listing all path segments in the chain.  Clicking individual
	 * items in the dropdown navigates to that level.
	 */
	updateLocation()
	{
		let tmpLocationEl = document.getElementById('RetoldRemote-TopBar-Location');
		if (!tmpLocationEl)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpCurrentLocation = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';

		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpHomeIcon = tmpIconProvider ? tmpIconProvider.getIcon('home', 16) : '/';

		let tmpParts = tmpCurrentLocation ? tmpCurrentLocation.split('/').filter((p) => p) : [];

		// Build the dropdown contents (path chain + Home at bottom)
		let tmpDropdownHTML = '';

		if (tmpParts.length > 0)
		{
			let tmpFolderIcon = tmpIconProvider ? tmpIconProvider.getIcon('folder', 16) : '';
			let tmpHomeIconSmall = tmpIconProvider ? tmpIconProvider.getIcon('home', 16) : '/';

			// All folders from deepest to shallowest, excluding current folder
			for (let i = tmpParts.length - 2; i >= 0; i--)
			{
				let tmpPath = tmpParts.slice(0, i + 1).join('/');
				let tmpFolderName = tmpParts[i] + '/';
				let tmpPrefix = '';
				if (i > 0)
				{
					tmpPrefix = '/' + tmpParts.slice(0, i).join('/') + '/';
				}

				tmpDropdownHTML += '<button class="retold-remote-topbar-overflow-item" onclick="pict.PictApplication.loadFileList(\'' + tmpPath + '\'); pict.views[\'ContentEditor-TopBar\'].closeBreadcrumbDropdown();">';
				tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-icon">' + tmpFolderIcon + '</span>';
				if (tmpPrefix)
				{
					tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-label"><span class="retold-remote-topbar-overflow-item-prefix">' + tmpPrefix + '</span>' + tmpFolderName + '</span>';
				}
				else
				{
					tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-label">' + tmpFolderName + '</span>';
				}
				tmpDropdownHTML += '</button>';
			}

			// Home / root item at the bottom
			tmpDropdownHTML += '<button class="retold-remote-topbar-overflow-item" onclick="pict.PictApplication.loadFileList(\'\'); pict.views[\'ContentEditor-TopBar\'].closeBreadcrumbDropdown();">';
			tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-icon">' + tmpHomeIconSmall + '</span>';
			tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-label">Home</span>';
			tmpDropdownHTML += '</button>';
		}

		// Assemble: [home icon with dropdown] / [current folder]
		let tmpHTML = '';
		tmpHTML += '<span class="retold-remote-topbar-breadcrumb-overflow">';
		tmpHTML += '<span class="retold-remote-topbar-home-crumb"';
		if (tmpParts.length > 0)
		{
			tmpHTML += ' onclick="pict.views[\'ContentEditor-TopBar\'].toggleBreadcrumbDropdown()"';
			tmpHTML += ' title="Navigate to parent folders"';
		}
		else
		{
			tmpHTML += ' title="Home"';
		}
		tmpHTML += '>' + tmpHomeIcon + '</span>';
		tmpHTML += '<div class="retold-remote-topbar-overflow-dropdown" id="RetoldRemote-BreadcrumbDropdown">';
		tmpHTML += tmpDropdownHTML;
		tmpHTML += '</div>';
		tmpHTML += '</span>';

		if (tmpParts.length > 0)
		{
			let tmpLastPart = tmpParts[tmpParts.length - 1];
			let tmpLastPath = tmpParts.join('/');
			tmpHTML += '<span class="retold-remote-topbar-location-inner">';
			tmpHTML += '<span class="retold-remote-topbar-sep">/</span>';
			tmpHTML += '<span class="retold-remote-topbar-location-crumb" onclick="pict.PictApplication.loadFileList(\'' + tmpLastPath + '\')">' + tmpLastPart + '</span>';
			tmpHTML += '</span>';
		}

		tmpLocationEl.innerHTML = tmpHTML;
	}

	/**
	 * Toggle the breadcrumb overflow dropdown.
	 */
	toggleBreadcrumbDropdown()
	{
		let tmpDropdown = document.getElementById('RetoldRemote-BreadcrumbDropdown');
		if (!tmpDropdown)
		{
			return;
		}

		let tmpIsOpen = tmpDropdown.classList.contains('open');

		if (tmpIsOpen)
		{
			this.closeBreadcrumbDropdown();
		}
		else
		{
			tmpDropdown.classList.add('open');

			// Close on outside click/tap
			let tmpSelf = this;
			let tmpCloseHandler = function(pEvent)
			{
				// Ignore clicks inside the dropdown or on the toggle button
				if (tmpDropdown.contains(pEvent.target))
				{
					return;
				}
				let tmpBtn = tmpDropdown.parentElement && tmpDropdown.parentElement.querySelector('.retold-remote-topbar-home-crumb');
				if (tmpBtn && tmpBtn.contains(pEvent.target))
				{
					return;
				}
				tmpSelf.closeBreadcrumbDropdown();
				document.removeEventListener('click', tmpCloseHandler, true);
				document.removeEventListener('touchstart', tmpCloseHandler, true);
			};

			// Defer attaching so the current click doesn't immediately close it
			setTimeout(function()
			{
				document.addEventListener('click', tmpCloseHandler, true);
				document.addEventListener('touchstart', tmpCloseHandler, true);
			}, 0);

			// Store the handler so closeBreadcrumbDropdown can clean it up
			this._breadcrumbCloseHandler = tmpCloseHandler;
		}
	}

	/**
	 * Close the breadcrumb overflow dropdown.
	 */
	closeBreadcrumbDropdown()
	{
		let tmpDropdown = document.getElementById('RetoldRemote-BreadcrumbDropdown');
		if (tmpDropdown)
		{
			tmpDropdown.classList.remove('open');
		}

		if (this._breadcrumbCloseHandler)
		{
			document.removeEventListener('click', this._breadcrumbCloseHandler, true);
			document.removeEventListener('touchstart', this._breadcrumbCloseHandler, true);
			this._breadcrumbCloseHandler = null;
		}
	}

	/**
	 * Toggle the filter bar visibility.
	 * If hidden, show it and focus the search box.
	 * If visible, hide it.
	 */
	toggleFilterBar()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.FilterBarVisible = !tmpRemote.FilterBarVisible;

		// When hiding the filter bar, also close the advanced filter panel
		if (!tmpRemote.FilterBarVisible)
		{
			tmpRemote.FilterPanelOpen = false;
		}

		let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
		if (tmpGalleryView)
		{
			tmpGalleryView.renderGallery();
		}

		this.updateFilterIcon();

		// If we just opened the bar, focus the search input
		if (tmpRemote.FilterBarVisible)
		{
			setTimeout(() =>
			{
				let tmpSearch = document.getElementById('RetoldRemote-Gallery-Search');
				if (tmpSearch)
				{
					tmpSearch.focus();
				}
			}, 50);
		}
	}

	/**
	 * Update the filter icon in the top bar to reflect active filter state.
	 */
	updateFilterIcon()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-FilterBtn');
		if (!tmpBtn)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		let tmpActiveChipCount = tmpFilterSort ? tmpFilterSort.getActiveFilterChips().length : 0;
		let tmpBarVisible = tmpRemote.FilterBarVisible || false;

		// Reset classes
		tmpBtn.classList.remove('filter-active', 'filter-bar-open');

		if (tmpActiveChipCount > 0)
		{
			// Active filters: show funnel icon with badge
			tmpBtn.classList.add('filter-active');
			tmpBtn.innerHTML = '&#9683;<span class="retold-remote-topbar-filter-badge">' + tmpActiveChipCount + '</span>';
			tmpBtn.title = tmpActiveChipCount + ' active filter' + (tmpActiveChipCount > 1 ? 's' : '') + ' (/)';
		}
		else if (tmpBarVisible)
		{
			// Bar open but no filters: show open-state icon
			tmpBtn.classList.add('filter-bar-open');
			tmpBtn.innerHTML = '&#9698;';
			tmpBtn.title = 'Hide filter bar (/)';
		}
		else
		{
			// Default: no filters, bar hidden
			tmpBtn.innerHTML = '&#9698;';
			tmpBtn.title = 'Toggle filter bar (/)';
		}
	}

	/**
	 * Update the info display with folder summary.
	 * Also updates the AI Sort button visibility.
	 *
	 * On narrow screens, summary segments degrade progressively:
	 *   Priority 3 (hidden first): folder/file type counts (folders, docs, other)
	 *   Priority 2 (hidden next): primary media counts (images, videos, audio)
	 *   Priority 1 (hidden last): folder name from breadcrumb location
	 *   Always visible: cursor position (e.g. "3/6")
	 */
	updateInfo()
	{
		this.updateAISortButton();
		let tmpInfoEl = document.getElementById('RetoldRemote-TopBar-Info');
		if (!tmpInfoEl)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpSummary = tmpRemote.FolderSummary;

		if (tmpRemote.ActiveMode === 'viewer')
		{
			let tmpItems = tmpRemote.GalleryItems || [];
			let tmpIndex = tmpRemote.GalleryCursorIndex || 0;
			let tmpItem = tmpItems[tmpIndex];
			if (tmpItem)
			{
				let tmpPos = (tmpIndex + 1) + '/' + tmpItems.length;
				tmpInfoEl.innerHTML = '<span>' + tmpPos + '</span>'
					+ '<span class="retold-remote-topbar-info-sep retold-remote-topbar-info-priority-1"> \u00b7 </span>'
					+ '<span class="retold-remote-topbar-info-priority-1">' + this._escapeHTML(tmpItem.Name) + '</span>';
			}
			return;
		}

		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpIndex = tmpRemote.GalleryCursorIndex || 0;
		let tmpCursorText = '';

		if (tmpItems.length > 0)
		{
			tmpCursorText = (tmpIndex + 1) + '/' + tmpItems.length;
		}

		if (!tmpSummary)
		{
			tmpInfoEl.textContent = tmpCursorText;
			return;
		}

		// Build segments with priority levels for progressive hiding
		// Priority 2: primary media counts (hidden at medium squish)
		let tmpMediaParts = [];
		if (tmpSummary.Images > 0) tmpMediaParts.push(tmpSummary.Images + ' images');
		if (tmpSummary.Videos > 0) tmpMediaParts.push(tmpSummary.Videos + ' videos');
		if (tmpSummary.Audio > 0) tmpMediaParts.push(tmpSummary.Audio + ' audio');

		// Priority 3: secondary counts (hidden first)
		let tmpExtraParts = [];
		if (tmpSummary.Folders > 0) tmpExtraParts.push(tmpSummary.Folders + ' folders');
		if (tmpSummary.Documents > 0) tmpExtraParts.push(tmpSummary.Documents + ' docs');
		if (tmpSummary.Other > 0) tmpExtraParts.push(tmpSummary.Other + ' other');

		let tmpHTML = '';

		// Always-visible: cursor position
		if (tmpCursorText)
		{
			tmpHTML += '<span>' + tmpCursorText + '</span>';
		}

		// Priority 3: folder/secondary counts (hidden first on narrow screens)
		if (tmpExtraParts.length > 0)
		{
			let tmpSep = tmpHTML ? '<span class="retold-remote-topbar-info-sep retold-remote-topbar-info-priority-3"> \u00b7 </span>' : '';
			tmpHTML += tmpSep + '<span class="retold-remote-topbar-info-priority-3">' + tmpExtraParts.join(' \u00b7 ') + '</span>';
		}

		// Priority 2: primary media counts (hidden next)
		if (tmpMediaParts.length > 0)
		{
			let tmpSep = tmpHTML ? '<span class="retold-remote-topbar-info-sep retold-remote-topbar-info-priority-2"> \u00b7 </span>' : '';
			tmpHTML += tmpSep + '<span class="retold-remote-topbar-info-priority-2">' + tmpMediaParts.join(' \u00b7 ') + '</span>';
		}

		tmpInfoEl.innerHTML = tmpHTML || '';
	}

	/**
	 * Minimal HTML escaping for display text.
	 */
	_escapeHTML(pText)
	{
		if (!pText) return '';
		return pText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	// -- AI Sort ----------------------------------------------------------

	/**
	 * Trigger AI sort for the current folder.
	 */
	triggerAISort()
	{
		let tmpAISortManager = this.pict.providers['RetoldRemote-AISortManager'];
		if (!tmpAISortManager)
		{
			return;
		}

		let tmpCurrentPath = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';

		// Show generating state
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-AISortBtn');
		if (tmpBtn)
		{
			tmpBtn.classList.add('generating');
			tmpBtn.textContent = '...';
		}

		tmpAISortManager.generateSortPlan(tmpCurrentPath,
			(pError, pResult) =>
			{
				// Reset button state
				if (tmpBtn)
				{
					tmpBtn.classList.remove('generating');
					tmpBtn.textContent = 'Ai';
				}
			});
	}

	/**
	 * Update the AI Sort button visibility.
	 * Shows only when browsing a folder (gallery mode).
	 */
	updateAISortButton()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-AISortBtn');
		if (!tmpBtn)
		{
			return;
		}

		let tmpAISortManager = this.pict.providers['RetoldRemote-AISortManager'];
		if (tmpAISortManager && tmpAISortManager.isAvailable())
		{
			tmpBtn.style.display = '';
		}
		else
		{
			tmpBtn.style.display = 'none';
		}
	}

	// -- Collections Panel ------------------------------------------------

	/**
	 * Toggle the collections panel.
	 */
	toggleCollections()
	{
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpManager)
		{
			tmpManager.togglePanel();
		}
	}

	/**
	 * Update the collections toggle button icon/state.
	 */
	updateCollectionsIcon()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-CollectionsBtn');
		if (!tmpBtn)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];

		// On mobile, "open" means the collections sidebar tab is active
		let tmpIsOpen = tmpRemote.CollectionsPanelOpen;
		let tmpLayoutView = this.pict.views['ContentEditor-Layout'];
		if (tmpLayoutView && tmpLayoutView.isMobileDrawer())
		{
			let tmpActiveTab = document.querySelector('.content-editor-sidebar-tab.active');
			tmpIsOpen = tmpActiveTab && tmpActiveTab.getAttribute('data-tab') === 'collections';
		}

		if (tmpIsOpen)
		{
			tmpBtn.classList.add('panel-open');
			if (tmpIconProvider && typeof tmpIconProvider.getIcon === 'function')
			{
				tmpBtn.innerHTML = tmpIconProvider.getIcon('bookmark-filled', 16);
			}
		}
		else
		{
			tmpBtn.classList.remove('panel-open');
			if (tmpIconProvider && typeof tmpIconProvider.getIcon === 'function')
			{
				tmpBtn.innerHTML = tmpIconProvider.getIcon('bookmark', 16);
			}
		}
	}

	// -- Favorites --------------------------------------------------------

	/**
	 * Toggle the current file in/out of favorites.
	 */
	toggleFavorite()
	{
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpManager)
		{
			tmpManager.toggleFavorite();
		}
	}

	/**
	 * Update the favorites heart button to reflect current favorited state.
	 */
	updateFavoritesIcon()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-FavoritesBtn');
		if (!tmpBtn)
		{
			return;
		}

		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpManager && tmpManager.isFavorited())
		{
			tmpBtn.classList.add('is-favorited');
			tmpBtn.innerHTML = '\u2665'; // ♥ filled heart
			tmpBtn.title = 'Remove from favorites (h)';
		}
		else
		{
			tmpBtn.classList.remove('is-favorited');
			tmpBtn.innerHTML = '\u2661'; // ♡ outline heart
			tmpBtn.title = 'Add to favorites (h)';
		}
	}

	/**
	 * Add current file/folder to a collection.
	 * Quick-add: single click adds to last-used collection.
	 * If no last-used collection, opens the picker dropdown.
	 *
	 * @param {Event} pEvent - Click event
	 */
	addToCollection(pEvent)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (!tmpManager)
		{
			return;
		}

		// Quick-add: if we have an active or last-used collection, add directly
		let tmpQuickGUID = tmpManager.getQuickAddTargetGUID();
		if (tmpQuickGUID)
		{
			let tmpAdded = tmpManager.addCurrentFileToCollection(tmpQuickGUID);
			if (tmpAdded)
			{
				return;
			}
		}

		// Fall through to picker dropdown
		this.showAddToCollectionDropdown(pEvent);
	}

	/**
	 * Show the add-to-collection picker dropdown.
	 *
	 * @param {Event} [pEvent] - Optional click event for positioning
	 */
	showAddToCollectionDropdown(pEvent)
	{
		let tmpSelf = this;
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];

		// Remove any existing dropdown
		this._closeAddToCollectionDropdown();

		let tmpBtn = document.getElementById('RetoldRemote-TopBar-AddToCollectionBtn');
		if (!tmpBtn)
		{
			return;
		}

		// Ensure we have the latest collections
		tmpManager.fetchCollections(() =>
		{
			let tmpCollections = tmpRemote.Collections || [];

			let tmpDropdown = document.createElement('div');
			tmpDropdown.className = 'retold-remote-addcoll-dropdown';
			tmpDropdown.id = 'RetoldRemote-AddToCollection-Dropdown';

			// "New Collection" option
			let tmpNewItem = document.createElement('button');
			tmpNewItem.className = 'retold-remote-addcoll-dropdown-item retold-remote-addcoll-dropdown-new';
			tmpNewItem.textContent = '+ New Collection...';
			tmpNewItem.onclick = () =>
			{
				tmpSelf._closeAddToCollectionDropdown();
				let tmpName = prompt('Collection name:');
				if (tmpName && tmpName.trim())
				{
					tmpManager.createCollection(tmpName.trim(), (pError, pCollection) =>
					{
						if (!pError && pCollection)
						{
							tmpManager.addPendingOrCurrentToCollection(pCollection.GUID);
						}
					});
				}
				else
				{
					// User cancelled — clear any pending clip context
					tmpManager.clearPendingClipContext();
				}
			};
			tmpDropdown.appendChild(tmpNewItem);

			// Existing collections
			for (let i = 0; i < tmpCollections.length; i++)
			{
				let tmpCollection = tmpCollections[i];
				let tmpItem = document.createElement('button');
				tmpItem.className = 'retold-remote-addcoll-dropdown-item';
				tmpItem.textContent = tmpCollection.Name || 'Untitled';
				tmpItem.onclick = () =>
				{
					tmpSelf._closeAddToCollectionDropdown();
					tmpManager.addPendingOrCurrentToCollection(tmpCollection.GUID);
				};
				tmpDropdown.appendChild(tmpItem);
			}

			// Position relative to the button
			tmpBtn.style.position = 'relative';
			tmpBtn.appendChild(tmpDropdown);

			// Close on outside click
			setTimeout(() =>
			{
				document.addEventListener('click', tmpSelf._boundCloseDropdown = (pClickEvent) =>
				{
					if (!tmpDropdown.contains(pClickEvent.target) && pClickEvent.target !== tmpBtn)
					{
						tmpSelf._closeAddToCollectionDropdown();
					}
				});
			}, 10);
		});
	}

	/**
	 * Close the add-to-collection dropdown.
	 */
	_closeAddToCollectionDropdown()
	{
		let tmpDropdown = document.getElementById('RetoldRemote-AddToCollection-Dropdown');
		if (tmpDropdown)
		{
			tmpDropdown.remove();
		}
		if (this._boundCloseDropdown)
		{
			document.removeEventListener('click', this._boundCloseDropdown);
			this._boundCloseDropdown = null;
		}

		// Clear any pending clip context that was never consumed
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpManager)
		{
			tmpManager.clearPendingClipContext();
		}
	}
}

RetoldRemoteTopBarView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteTopBarView;
