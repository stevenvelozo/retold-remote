const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "ContentEditor-TopBar",

	DefaultRenderable: "RetoldRemote-TopBar",
	DefaultDestinationAddress: "#ContentEditor-TopBar-Container",

	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-topbar
		{
			display: flex;
			align-items: center;
			height: 40px;
			padding: 0 16px;
			background: var(--retold-bg-secondary);
			border-bottom: 1px solid var(--retold-border);
			gap: 16px;
		}
		.retold-remote-topbar-sidebar-toggle
		{
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			padding: 0;
			margin: 0;
			border: 1px solid var(--retold-border);
			border-radius: 4px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 1rem;
			line-height: 1;
			cursor: pointer;
			transition: color 0.15s, border-color 0.15s, background 0.15s;
			font-family: inherit;
			-webkit-tap-highlight-color: transparent;
		}
		.retold-remote-topbar-sidebar-toggle:hover,
		.retold-remote-topbar-sidebar-toggle:active,
		.retold-remote-topbar-df-toggle:hover,
		.retold-remote-topbar-df-toggle:active
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
			background: rgba(128, 128, 128, 0.1);
		}
		.retold-remote-topbar-df-toggle
		{
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			padding: 0;
			margin: 0;
			border: 1px solid var(--retold-border);
			border-radius: 4px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 1rem;
			line-height: 1;
			cursor: pointer;
			transition: color 0.15s, border-color 0.15s, background 0.15s;
			font-family: inherit;
			-webkit-tap-highlight-color: transparent;
		}
		.retold-remote-topbar-location
		{
			position: relative;
			flex: 1;
			font-size: 0.82rem;
			color: var(--retold-text-muted);
			white-space: nowrap;
			text-align: center;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: visible;
			min-width: 0;
		}
		.retold-remote-topbar-location-inner
		{
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.retold-remote-topbar-location-crumb
		{
			color: var(--retold-accent);
			cursor: pointer;
			text-decoration: none;
		}
		.retold-remote-topbar-location-crumb:hover
		{
			text-decoration: underline;
		}
		.retold-remote-topbar-home-crumb
		{
			cursor: pointer;
			display: inline-flex;
			align-items: center;
			vertical-align: middle;
			opacity: 0.8;
		}
		.retold-remote-topbar-home-crumb:hover
		{
			opacity: 1;
		}
		.retold-remote-topbar-sep
		{
			color: var(--retold-text-placeholder);
			margin: 0 3px;
		}
		/* Breadcrumb overflow hamburger */
		.retold-remote-topbar-breadcrumb-overflow
		{
			position: relative;
			display: inline-flex;
			align-items: center;
			vertical-align: middle;
		}
		.retold-remote-topbar-overflow-btn
		{
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 28px;
			height: 28px;
			padding: 0;
			margin: 0;
			border: 1px solid var(--retold-border);
			border-radius: 4px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.9rem;
			line-height: 1;
			cursor: pointer;
			transition: color 0.15s, border-color 0.15s, background 0.15s;
			font-family: inherit;
			-webkit-tap-highlight-color: transparent;
		}
		.retold-remote-topbar-overflow-btn:hover,
		.retold-remote-topbar-overflow-btn:active
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
			background: rgba(128, 128, 128, 0.1);
		}
		.retold-remote-topbar-overflow-dropdown
		{
			display: none;
			position: absolute;
			top: 100%;
			left: 0;
			margin-top: 4px;
			min-width: 200px;
			max-width: 300px;
			background: var(--retold-bg-secondary);
			border: 1px solid var(--retold-border);
			border-radius: 6px;
			box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
			z-index: 1000;
			overflow: hidden;
		}
		.retold-remote-topbar-overflow-dropdown.open
		{
			display: block;
		}
		.retold-remote-topbar-overflow-item
		{
			display: flex;
			align-items: center;
			gap: 8px;
			width: 100%;
			padding: 12px 16px;
			border: none;
			border-bottom: 1px solid var(--retold-border);
			background: transparent;
			color: var(--retold-text-primary);
			font-size: 0.9rem;
			text-align: left;
			cursor: pointer;
			font-family: inherit;
			-webkit-tap-highlight-color: transparent;
			min-height: 44px;
			box-sizing: border-box;
		}
		.retold-remote-topbar-overflow-item:last-child
		{
			border-bottom: none;
		}
		.retold-remote-topbar-overflow-item:hover,
		.retold-remote-topbar-overflow-item:active
		{
			background: rgba(128, 128, 128, 0.12);
			color: var(--retold-accent);
		}
		.retold-remote-topbar-overflow-item-icon
		{
			display: inline-flex;
			align-items: center;
			flex-shrink: 0;
			opacity: 0.7;
		}
		.retold-remote-topbar-overflow-item-label
		{
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.retold-remote-topbar-info
		{
			flex-shrink: 0;
			font-size: 0.75rem;
			color: var(--retold-text-dim);
		}
		.retold-remote-topbar-actions
		{
			flex-shrink: 0;
			display: flex;
			gap: 8px;
		}
		.retold-remote-topbar-btn
		{
			padding: 4px 10px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.75rem;
			cursor: pointer;
			transition: color 0.15s, border-color 0.15s;
			font-family: inherit;
		}
		.retold-remote-topbar-btn:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
		.retold-remote-topbar-filter-btn
		{
			position: relative;
			padding: 4px 8px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.82rem;
			cursor: pointer;
			transition: color 0.15s, border-color 0.15s, background 0.15s;
			font-family: inherit;
			line-height: 1;
		}
		.retold-remote-topbar-filter-btn:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
		.retold-remote-topbar-filter-btn.filter-active
		{
			color: var(--retold-accent);
			border-color: var(--retold-accent);
			background: rgba(128, 128, 128, 0.1);
		}
		.retold-remote-topbar-filter-btn.filter-bar-open
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-text-muted);
			background: rgba(128, 128, 128, 0.06);
		}
		.retold-remote-topbar-filter-badge
		{
			position: absolute;
			top: -4px;
			right: -4px;
			min-width: 14px;
			height: 14px;
			line-height: 14px;
			padding: 0 3px;
			border-radius: 7px;
			background: var(--retold-accent);
			color: var(--retold-bg-tertiary);
			font-size: 0.55rem;
			font-weight: 700;
			text-align: center;
		}
	`,

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
	 * When more than one folder deep, shows a hamburger button to the
	 * left of the home icon with a dropdown listing the intermediate
	 * path segments.  The breadcrumb itself shows only
	 * [home] / [current folder].
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

		// Build the home icon for the root crumb
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpHomeIcon = tmpIconProvider ? tmpIconProvider.getIcon('home', 16) : '/';
		let tmpHomeCrumb = '<span class="retold-remote-topbar-home-crumb" onclick="pict.PictApplication.loadFileList(\'\')" title="Home">' + tmpHomeIcon + '</span>';

		if (!tmpCurrentLocation)
		{
			tmpLocationEl.innerHTML = '<span class="retold-remote-topbar-location-inner">' + tmpHomeCrumb + '</span>';
			return;
		}

		let tmpParts = tmpCurrentLocation.split('/').filter((p) => p);

		// Shallow path (1 level): home / folder — no hamburger needed
		if (tmpParts.length <= 1)
		{
			let tmpInner = tmpHomeCrumb;
			for (let i = 0; i < tmpParts.length; i++)
			{
				let tmpPath = tmpParts.slice(0, i + 1).join('/');
				tmpInner += '<span class="retold-remote-topbar-sep">/</span>';
				tmpInner += '<span class="retold-remote-topbar-location-crumb" onclick="pict.PictApplication.loadFileList(\'' + tmpPath + '\')">' + tmpParts[i] + '</span>';
			}
			tmpLocationEl.innerHTML = '<span class="retold-remote-topbar-location-inner">' + tmpInner + '</span>';
			return;
		}

		// Deep path (2+ levels): show hamburger with intermediate folders
		let tmpFolderIcon = tmpIconProvider ? tmpIconProvider.getIcon('folder', 16) : '';
		let tmpHomeIconSmall = tmpIconProvider ? tmpIconProvider.getIcon('home', 16) : '/';

		// Build dropdown items: home first, then each intermediate folder
		let tmpDropdownHTML = '';

		// Home item
		tmpDropdownHTML += '<button class="retold-remote-topbar-overflow-item" onclick="pict.PictApplication.loadFileList(\'\'); pict.views[\'ContentEditor-TopBar\'].closeBreadcrumbDropdown();">';
		tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-icon">' + tmpHomeIconSmall + '</span>';
		tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-label">Home</span>';
		tmpDropdownHTML += '</button>';

		// Intermediate folders (all except the last segment, which is shown in the breadcrumb)
		for (let i = 0; i < tmpParts.length - 1; i++)
		{
			let tmpPath = tmpParts.slice(0, i + 1).join('/');
			tmpDropdownHTML += '<button class="retold-remote-topbar-overflow-item" onclick="pict.PictApplication.loadFileList(\'' + tmpPath + '\'); pict.views[\'ContentEditor-TopBar\'].closeBreadcrumbDropdown();">';
			tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-icon">' + tmpFolderIcon + '</span>';
			tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-label">' + tmpParts[i] + '</span>';
			tmpDropdownHTML += '</button>';
		}

		// Assemble: [hamburger + dropdown] [inner: home / current folder]
		let tmpLastPart = tmpParts[tmpParts.length - 1];
		let tmpLastPath = tmpParts.join('/');

		let tmpHTML = '';
		// The overflow wrapper sits outside the truncation inner
		tmpHTML += '<span class="retold-remote-topbar-breadcrumb-overflow">';
		tmpHTML += '<button class="retold-remote-topbar-overflow-btn" onclick="pict.views[\'ContentEditor-TopBar\'].toggleBreadcrumbDropdown()" title="Navigate to parent folders">&#9776;</button>';
		tmpHTML += '<div class="retold-remote-topbar-overflow-dropdown" id="RetoldRemote-BreadcrumbDropdown">';
		tmpHTML += tmpDropdownHTML;
		tmpHTML += '</div>';
		tmpHTML += '</span>';
		// The visible crumbs: home / current-folder
		tmpHTML += '<span class="retold-remote-topbar-location-inner">';
		tmpHTML += tmpHomeCrumb;
		tmpHTML += '<span class="retold-remote-topbar-sep">/</span>';
		tmpHTML += '<span class="retold-remote-topbar-location-crumb" onclick="pict.PictApplication.loadFileList(\'' + tmpLastPath + '\')">' + tmpLastPart + '</span>';
		tmpHTML += '</span>';

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
				let tmpBtn = tmpDropdown.parentElement && tmpDropdown.parentElement.querySelector('.retold-remote-topbar-overflow-btn');
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
	 */
	updateInfo()
	{
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
				tmpInfoEl.textContent = tmpPos + ' \u00b7 ' + tmpItem.Name;
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

		let tmpParts = [];
		if (tmpCursorText) tmpParts.push(tmpCursorText);
		if (tmpSummary.Folders > 0) tmpParts.push(tmpSummary.Folders + ' folders');
		if (tmpSummary.Images > 0) tmpParts.push(tmpSummary.Images + ' images');
		if (tmpSummary.Videos > 0) tmpParts.push(tmpSummary.Videos + ' videos');
		if (tmpSummary.Audio > 0) tmpParts.push(tmpSummary.Audio + ' audio');
		if (tmpSummary.Documents > 0) tmpParts.push(tmpSummary.Documents + ' docs');
		if (tmpSummary.Other > 0) tmpParts.push(tmpSummary.Other + ' other');

		tmpInfoEl.textContent = tmpParts.join(' \u00b7 ');
	}
}

RetoldRemoteTopBarView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteTopBarView;
