const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-Gallery",

	DefaultRenderable: "RetoldRemote-Gallery-Grid",
	DefaultDestinationAddress: "#RetoldRemote-Gallery-Container",

	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-gallery-header
		{
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 8px;
			flex-wrap: wrap;
		}
		.retold-remote-gallery-filter
		{
			display: flex;
			gap: 4px;
		}
		.retold-remote-gallery-filter-btn
		{
			padding: 3px 10px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.72rem;
			cursor: pointer;
			transition: color 0.15s, border-color 0.15s, background 0.15s;
			font-family: inherit;
		}
		.retold-remote-gallery-filter-btn:hover
		{
			color: var(--retold-text-secondary);
			border-color: var(--retold-scrollbar-hover);
		}
		.retold-remote-gallery-filter-btn.active
		{
			color: var(--retold-accent);
			border-color: var(--retold-accent);
			background: rgba(128, 128, 128, 0.1);
		}
		.retold-remote-gallery-filter-toggle
		{
			position: relative;
		}
		.retold-remote-gallery-filter-toggle.has-filters
		{
			color: var(--retold-accent);
			border-color: var(--retold-accent);
		}
		.retold-remote-gallery-filter-count
		{
			display: inline-block;
			min-width: 14px;
			height: 14px;
			line-height: 14px;
			padding: 0 3px;
			border-radius: 7px;
			background: var(--retold-accent);
			color: var(--retold-bg-tertiary);
			font-size: 0.58rem;
			font-weight: 700;
			text-align: center;
			margin-left: 4px;
		}
		/* Sort dropdown */
		.retold-remote-gallery-sort
		{
			display: flex;
			align-items: center;
		}
		.retold-remote-gallery-sort-select
		{
			padding: 3px 6px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-muted);
			font-size: 0.72rem;
			cursor: pointer;
			font-family: inherit;
		}
		.retold-remote-gallery-sort-select:focus
		{
			outline: none;
			border-color: var(--retold-accent);
		}
		.retold-remote-gallery-search
		{
			flex: 1;
			max-width: 300px;
			padding: 4px 10px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-primary);
			font-size: 0.78rem;
			font-family: inherit;
		}
		.retold-remote-gallery-search:focus
		{
			outline: none;
			border-color: var(--retold-accent);
		}
		.retold-remote-gallery-search::placeholder
		{
			color: var(--retold-text-placeholder);
		}
		/* Filter chips */
		.retold-remote-filter-chips
		{
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-bottom: 8px;
			align-items: center;
		}
		.retold-remote-filter-chip
		{
			display: inline-flex;
			align-items: center;
			gap: 4px;
			padding: 2px 8px;
			border: 1px solid var(--retold-border-light);
			border-radius: 12px;
			background: rgba(128, 128, 128, 0.08);
			color: var(--retold-text-secondary);
			font-size: 0.68rem;
		}
		.retold-remote-filter-chip-remove
		{
			background: none;
			border: none;
			color: var(--retold-text-muted);
			font-size: 0.82rem;
			cursor: pointer;
			padding: 0 2px;
			line-height: 1;
		}
		.retold-remote-filter-chip-remove:hover
		{
			color: var(--retold-danger);
		}
		.retold-remote-filter-chip-clear
		{
			background: none;
			border: none;
			color: var(--retold-text-dim);
			font-size: 0.68rem;
			cursor: pointer;
			padding: 2px 4px;
		}
		.retold-remote-filter-chip-clear:hover
		{
			color: var(--retold-danger);
		}
		/* Filter panel */
		.retold-remote-filter-panel
		{
			margin-bottom: 12px;
			padding: 12px;
			border: 1px solid var(--retold-border);
			border-radius: 6px;
			background: var(--retold-bg-panel);
		}
		.retold-remote-filter-panel-grid
		{
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 12px 24px;
		}
		.retold-remote-filter-section
		{
			margin-bottom: 0;
		}
		.retold-remote-filter-section-title
		{
			font-size: 0.68rem;
			font-weight: 600;
			color: var(--retold-text-muted);
			text-transform: uppercase;
			letter-spacing: 0.5px;
			margin-bottom: 6px;
		}
		.retold-remote-filter-ext-list
		{
			display: flex;
			flex-wrap: wrap;
			gap: 2px 10px;
		}
		.retold-remote-filter-ext-item
		{
			display: flex;
			align-items: center;
			gap: 4px;
			font-size: 0.72rem;
			color: var(--retold-text-secondary);
			cursor: pointer;
		}
		.retold-remote-filter-ext-item input
		{
			accent-color: var(--retold-accent);
		}
		.retold-remote-filter-ext-count
		{
			color: var(--retold-text-dim);
			font-size: 0.65rem;
		}
		.retold-remote-filter-row
		{
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.retold-remote-filter-input
		{
			padding: 3px 6px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-secondary);
			font-size: 0.72rem;
			width: 100px;
			font-family: inherit;
		}
		.retold-remote-filter-input:focus
		{
			outline: none;
			border-color: var(--retold-accent);
		}
		.retold-remote-filter-label
		{
			color: var(--retold-text-dim);
			font-size: 0.68rem;
		}
		.retold-remote-filter-actions
		{
			grid-column: 1 / -1;
			display: flex;
			gap: 8px;
			align-items: center;
			padding-top: 8px;
			border-top: 1px solid var(--retold-border);
			margin-top: 8px;
		}
		.retold-remote-filter-preset-row
		{
			display: flex;
			gap: 6px;
			align-items: center;
			flex-wrap: wrap;
		}
		.retold-remote-filter-preset-select
		{
			padding: 3px 6px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-secondary);
			font-size: 0.72rem;
			min-width: 100px;
			font-family: inherit;
		}
		.retold-remote-filter-preset-input
		{
			padding: 3px 6px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-secondary);
			font-size: 0.72rem;
			width: 120px;
			font-family: inherit;
		}
		.retold-remote-filter-preset-input:focus
		{
			outline: none;
			border-color: var(--retold-accent);
		}
		.retold-remote-filter-btn-sm
		{
			padding: 2px 8px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.68rem;
			cursor: pointer;
			font-family: inherit;
		}
		.retold-remote-filter-btn-sm:hover
		{
			color: var(--retold-text-secondary);
			border-color: var(--retold-scrollbar-hover);
		}
		/* Grid layout */
		.retold-remote-grid
		{
			display: grid;
			gap: 12px;
		}
		.retold-remote-grid.size-small
		{
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		}
		.retold-remote-grid.size-medium
		{
			grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		}
		.retold-remote-grid.size-large
		{
			grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		}
		/* Tile */
		.retold-remote-tile
		{
			background: var(--retold-bg-tertiary);
			border: 2px solid transparent;
			border-radius: 6px;
			cursor: pointer;
			overflow: hidden;
			transition: border-color 0.15s, transform 0.1s;
		}
		.retold-remote-tile:hover
		{
			border-color: var(--retold-border-light);
		}
		.retold-remote-tile.selected
		{
			border-color: var(--retold-accent);
			box-shadow: 0 0 0 1px rgba(128, 128, 128, 0.3);
		}
		.retold-remote-tile-thumb
		{
			position: relative;
			width: 100%;
			padding-bottom: 75%; /* 4:3 aspect ratio */
			background: var(--retold-bg-thumb);
			overflow: hidden;
		}
		.retold-remote-tile-thumb img
		{
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
		.retold-remote-tile-thumb-icon
		{
			position: absolute;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			font-size: 2rem;
			color: var(--retold-text-placeholder);
		}
		.retold-remote-tile-badge
		{
			position: absolute;
			top: 6px;
			right: 6px;
			padding: 1px 6px;
			border-radius: 3px;
			font-size: 0.6rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		.retold-remote-tile-badge-image { background: rgba(102, 194, 184, 0.8); color: #fff; }
		.retold-remote-tile-badge-video { background: rgba(180, 102, 194, 0.8); color: #fff; }
		.retold-remote-tile-badge-audio { background: rgba(194, 160, 102, 0.8); color: #fff; }
		.retold-remote-tile-badge-document { background: rgba(194, 102, 102, 0.8); color: #fff; }
		.retold-remote-tile-badge-folder { background: rgba(102, 140, 194, 0.8); color: #fff; }
		.retold-remote-tile-duration
		{
			position: absolute;
			bottom: 6px;
			right: 6px;
			padding: 1px 6px;
			border-radius: 3px;
			background: rgba(0, 0, 0, 0.7);
			font-size: 0.65rem;
			color: var(--retold-text-primary);
		}
		.retold-remote-tile-label
		{
			padding: 6px 8px 2px 8px;
			font-size: 0.75rem;
			font-weight: 500;
			color: var(--retold-text-secondary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.retold-remote-tile-meta
		{
			padding: 0 8px 6px 8px;
			font-size: 0.65rem;
			color: var(--retold-text-dim);
		}
		/* List mode */
		.retold-remote-list
		{
			display: flex;
			flex-direction: column;
			gap: 2px;
		}
		.retold-remote-list-row
		{
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 6px 12px;
			border-radius: 4px;
			cursor: pointer;
			transition: background 0.1s;
		}
		.retold-remote-list-row:hover
		{
			background: var(--retold-bg-hover);
		}
		.retold-remote-list-row.selected
		{
			background: var(--retold-bg-selected);
		}
		.retold-remote-list-icon
		{
			flex-shrink: 0;
			width: 24px;
			text-align: center;
			color: var(--retold-text-dim);
		}
		.retold-remote-list-name
		{
			flex: 1;
			font-size: 0.82rem;
			color: var(--retold-text-secondary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.retold-remote-list-size
		{
			flex-shrink: 0;
			width: 80px;
			text-align: right;
			font-size: 0.72rem;
			color: var(--retold-text-dim);
		}
		.retold-remote-list-date
		{
			flex-shrink: 0;
			width: 140px;
			text-align: right;
			font-size: 0.72rem;
			color: var(--retold-text-dim);
		}
		/* Empty state */
		.retold-remote-empty
		{
			text-align: center;
			padding: 60px 20px;
			color: var(--retold-text-dim);
		}
		.retold-remote-empty-icon
		{
			font-size: 3rem;
			margin-bottom: 12px;
		}
		/* Help panel flyout */
		#RetoldRemote-Help-Panel
		{
			position: fixed;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			z-index: 9999;
		}
		.retold-remote-help-backdrop
		{
			position: absolute;
			top: 0;
			left: 0;
			width: 100%;
			height: 100%;
			background: rgba(0, 0, 0, 0.5);
			display: flex;
			align-items: flex-start;
			justify-content: flex-end;
		}
		.retold-remote-help-flyout
		{
			width: 340px;
			max-height: calc(100vh - 32px);
			margin: 16px;
			background: var(--retold-bg-panel);
			border: 1px solid var(--retold-border);
			border-radius: 8px;
			overflow-y: auto;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
			animation: retold-help-slide-in 0.15s ease-out;
		}
		@keyframes retold-help-slide-in
		{
			from { transform: translateX(20px); opacity: 0; }
			to { transform: translateX(0); opacity: 1; }
		}
		.retold-remote-help-header
		{
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 14px 16px 10px 16px;
			border-bottom: 1px solid var(--retold-border);
		}
		.retold-remote-help-title
		{
			font-size: 0.88rem;
			font-weight: 600;
			color: var(--retold-text-primary);
		}
		.retold-remote-help-close
		{
			background: none;
			border: none;
			color: var(--retold-text-dim);
			font-size: 1.2rem;
			cursor: pointer;
			padding: 0 4px;
			line-height: 1;
		}
		.retold-remote-help-close:hover
		{
			color: var(--retold-danger);
		}
		.retold-remote-help-section
		{
			padding: 12px 16px 8px 16px;
		}
		.retold-remote-help-section + .retold-remote-help-section
		{
			border-top: 1px solid var(--retold-border);
		}
		.retold-remote-help-section-title
		{
			font-size: 0.65rem;
			font-weight: 600;
			color: var(--retold-accent);
			text-transform: uppercase;
			letter-spacing: 0.8px;
			margin-bottom: 8px;
		}
		.retold-remote-help-row
		{
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 3px 0;
		}
		.retold-remote-help-key
		{
			display: inline-block;
			min-width: 72px;
			padding: 2px 8px;
			border: 1px solid var(--retold-border-light);
			border-radius: 4px;
			background: rgba(255, 255, 255, 0.04);
			color: var(--retold-text-secondary);
			font-family: var(--retold-font-mono, monospace);
			font-size: 0.72rem;
			text-align: center;
			white-space: nowrap;
		}
		.retold-remote-help-desc
		{
			color: var(--retold-text-muted);
			font-size: 0.74rem;
		}
		.retold-remote-help-footer
		{
			padding: 10px 16px;
			border-top: 1px solid var(--retold-border);
			font-size: 0.68rem;
			color: var(--retold-text-dim);
			text-align: center;
		}
		.retold-remote-help-footer strong
		{
			color: var(--retold-accent);
		}
	`,

	Templates: [],
	Renderables: []
};

class RetoldRemoteGalleryView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._intersectionObserver = null;
	}

	// ──────────────────────────────────────────────
	// Gallery rendering
	// ──────────────────────────────────────────────

	/**
	 * Render the gallery based on current state.
	 * GalleryItems is already filtered+sorted by the pipeline provider.
	 */
	renderGallery()
	{
		let tmpContainer = document.getElementById('RetoldRemote-Gallery-Container');
		if (!tmpContainer)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpViewMode = tmpRemote.ViewMode || 'list';
		let tmpThumbnailSize = tmpRemote.ThumbnailSize || 'medium';
		let tmpCursorIndex = tmpRemote.GalleryCursorIndex || 0;

		// Build header with type filters, sort, filter toggle, and search
		let tmpHTML = this._buildHeaderHTML(tmpRemote.FilterState ? tmpRemote.FilterState.MediaType : 'all');

		// Build collapsible filter panel
		tmpHTML += this._buildFilterPanelHTML();

		// Build filter chips bar
		tmpHTML += this._buildFilterChipsHTML();

		if (tmpItems.length === 0)
		{
			tmpHTML += '<div class="retold-remote-empty">';
			let tmpEmptyIconProvider = this.pict.providers['RetoldRemote-Icons'];
			tmpHTML += '<div class="retold-remote-empty-icon"><span class="retold-remote-icon retold-remote-icon-xl">' + (tmpEmptyIconProvider ? tmpEmptyIconProvider.getIcon('gallery-empty', 96) : '') + '</span></div>';
			tmpHTML += '<div>Empty folder</div>';
			tmpHTML += '</div>';
			tmpContainer.innerHTML = tmpHTML;
			return;
		}

		// Items are already filtered+sorted by the pipeline
		if (tmpViewMode === 'gallery')
		{
			tmpHTML += this._buildGridHTML(tmpItems, tmpThumbnailSize, tmpCursorIndex);
		}
		else
		{
			tmpHTML += this._buildListHTML(tmpItems, tmpCursorIndex);
		}

		tmpContainer.innerHTML = tmpHTML;

		// Set up lazy loading for thumbnail images
		this._setupLazyLoading();

		// Recalculate column count for keyboard navigation
		let tmpNavProvider = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNavProvider)
		{
			tmpNavProvider.recalculateColumns();
		}
	}

	// ──────────────────────────────────────────────
	// Header
	// ──────────────────────────────────────────────

	/**
	 * Build the gallery header with type filters, sort dropdown, filter toggle, and search.
	 */
	_buildHeaderHTML(pActiveFilter)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpFilters = [
			{ key: 'all', label: 'All' },
			{ key: 'images', label: 'Images' },
			{ key: 'video', label: 'Video' },
			{ key: 'audio', label: 'Audio' },
			{ key: 'documents', label: 'Docs' }
		];

		let tmpHTML = '<div class="retold-remote-gallery-header">';

		// Media type filter buttons
		tmpHTML += '<div class="retold-remote-gallery-filter">';
		for (let i = 0; i < tmpFilters.length; i++)
		{
			let tmpFilter = tmpFilters[i];
			let tmpActiveClass = (tmpFilter.key === pActiveFilter) ? ' active' : '';
			tmpHTML += '<button class="retold-remote-gallery-filter-btn' + tmpActiveClass + '" '
				+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].setFilter(\'' + tmpFilter.key + '\')">'
				+ tmpFilter.label + '</button>';
		}
		tmpHTML += '</div>';

		// Sort dropdown
		tmpHTML += '<div class="retold-remote-gallery-sort">';
		tmpHTML += '<select class="retold-remote-gallery-sort-select" id="RetoldRemote-Gallery-Sort" '
			+ 'onchange="pict.views[\'RetoldRemote-Gallery\'].onSortChange(this.value)">';
		let tmpSortOptions = [
			{ value: 'folder-first:asc', label: 'Folders first' },
			{ value: 'name:asc', label: 'Name A\u2013Z' },
			{ value: 'name:desc', label: 'Name Z\u2013A' },
			{ value: 'modified:desc', label: 'Newest modified' },
			{ value: 'modified:asc', label: 'Oldest modified' },
			{ value: 'created:desc', label: 'Newest created' },
			{ value: 'created:asc', label: 'Oldest created' }
		];
		let tmpCurrentSort = (tmpRemote.SortField || 'folder-first') + ':' + (tmpRemote.SortDirection || 'asc');
		for (let i = 0; i < tmpSortOptions.length; i++)
		{
			let tmpSelected = (tmpSortOptions[i].value === tmpCurrentSort) ? ' selected' : '';
			tmpHTML += '<option value="' + tmpSortOptions[i].value + '"' + tmpSelected + '>'
				+ tmpSortOptions[i].label + '</option>';
		}
		tmpHTML += '</select>';
		tmpHTML += '</div>';

		// Filter panel toggle button
		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		let tmpActiveChipCount = tmpFilterSort ? tmpFilterSort.getActiveFilterChips().length : 0;
		// Don't count search chip in the toggle badge since it's obvious from the search input
		let tmpBadgeCount = tmpActiveChipCount;
		let tmpHasFiltersClass = tmpBadgeCount > 0 ? ' has-filters' : '';
		tmpHTML += '<button class="retold-remote-gallery-filter-btn retold-remote-gallery-filter-toggle' + tmpHasFiltersClass + '" '
			+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].toggleFilterPanel()">'
			+ '\u2699 Filters';
		if (tmpBadgeCount > 0)
		{
			tmpHTML += '<span class="retold-remote-gallery-filter-count">' + tmpBadgeCount + '</span>';
		}
		tmpHTML += '</button>';

		// Search input
		let tmpSearchValue = tmpRemote.SearchQuery || '';
		tmpHTML += '<input type="text" class="retold-remote-gallery-search" id="RetoldRemote-Gallery-Search" '
			+ 'placeholder="Search files... (/)" '
			+ 'value="' + this._escapeHTML(tmpSearchValue) + '" '
			+ 'oninput="pict.views[\'RetoldRemote-Gallery\'].onSearchInput(this.value)">';
		tmpHTML += '</div>';

		return tmpHTML;
	}

	// ──────────────────────────────────────────────
	// Filter panel (collapsible)
	// ──────────────────────────────────────────────

	/**
	 * Build the collapsible advanced filter panel HTML.
	 */
	_buildFilterPanelHTML()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (!tmpRemote.FilterPanelOpen)
		{
			return '';
		}

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		let tmpAvailableExtensions = tmpFilterSort ? tmpFilterSort.getAvailableExtensions() : [];
		let tmpFilterState = tmpRemote.FilterState || {};

		let tmpHTML = '<div class="retold-remote-filter-panel">';
		tmpHTML += '<div class="retold-remote-filter-panel-grid">';

		// Extension filter: checkboxes for each extension in the current folder
		tmpHTML += '<div class="retold-remote-filter-section">';
		tmpHTML += '<div class="retold-remote-filter-section-title">File Type</div>';
		tmpHTML += '<div class="retold-remote-filter-ext-list">';
		let tmpActiveExtensions = tmpFilterState.Extensions || [];
		for (let i = 0; i < tmpAvailableExtensions.length; i++)
		{
			let tmpExt = tmpAvailableExtensions[i];
			// If Extensions is empty, all are selected
			let tmpChecked = (tmpActiveExtensions.length === 0 || tmpActiveExtensions.indexOf(tmpExt.ext) >= 0);
			tmpHTML += '<label class="retold-remote-filter-ext-item">';
			tmpHTML += '<input type="checkbox" ' + (tmpChecked ? 'checked ' : '')
				+ 'onchange="pict.views[\'RetoldRemote-Gallery\'].onExtensionToggle(\'' + tmpExt.ext + '\', this.checked)">';
			tmpHTML += ' .' + tmpExt.ext + ' <span class="retold-remote-filter-ext-count">(' + tmpExt.count + ')</span>';
			tmpHTML += '</label>';
		}
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		// Size range
		tmpHTML += '<div class="retold-remote-filter-section">';
		tmpHTML += '<div class="retold-remote-filter-section-title">File Size</div>';
		tmpHTML += '<div class="retold-remote-filter-row">';
		let tmpMinKB = (tmpFilterState.SizeMin !== null && tmpFilterState.SizeMin !== undefined) ? Math.round(tmpFilterState.SizeMin / 1024) : '';
		let tmpMaxKB = (tmpFilterState.SizeMax !== null && tmpFilterState.SizeMax !== undefined) ? Math.round(tmpFilterState.SizeMax / 1024) : '';
		tmpHTML += '<input type="number" class="retold-remote-filter-input" placeholder="Min KB" '
			+ 'value="' + tmpMinKB + '" '
			+ 'onchange="pict.views[\'RetoldRemote-Gallery\'].onSizeFilterChange(\'min\', this.value)">';
		tmpHTML += '<span class="retold-remote-filter-label">to</span>';
		tmpHTML += '<input type="number" class="retold-remote-filter-input" placeholder="Max KB" '
			+ 'value="' + tmpMaxKB + '" '
			+ 'onchange="pict.views[\'RetoldRemote-Gallery\'].onSizeFilterChange(\'max\', this.value)">';
		tmpHTML += '<span class="retold-remote-filter-label">KB</span>';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		// Modified date range
		tmpHTML += '<div class="retold-remote-filter-section">';
		tmpHTML += '<div class="retold-remote-filter-section-title">Modified Date</div>';
		tmpHTML += '<div class="retold-remote-filter-row">';
		tmpHTML += '<input type="date" class="retold-remote-filter-input" '
			+ 'value="' + (tmpFilterState.DateModifiedAfter || '') + '" '
			+ 'onchange="pict.views[\'RetoldRemote-Gallery\'].onDateFilterChange(\'DateModifiedAfter\', this.value)">';
		tmpHTML += '<span class="retold-remote-filter-label">to</span>';
		tmpHTML += '<input type="date" class="retold-remote-filter-input" '
			+ 'value="' + (tmpFilterState.DateModifiedBefore || '') + '" '
			+ 'onchange="pict.views[\'RetoldRemote-Gallery\'].onDateFilterChange(\'DateModifiedBefore\', this.value)">';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		// Presets
		tmpHTML += '<div class="retold-remote-filter-section">';
		tmpHTML += '<div class="retold-remote-filter-section-title">Presets</div>';
		tmpHTML += this._buildPresetControlsHTML();
		tmpHTML += '</div>';

		// Actions row
		tmpHTML += '<div class="retold-remote-filter-actions">';
		tmpHTML += '<button class="retold-remote-filter-btn-sm" onclick="pict.views[\'RetoldRemote-Gallery\'].clearAllFilters()">Clear All Filters</button>';
		tmpHTML += '</div>';

		tmpHTML += '</div>'; // end grid
		tmpHTML += '</div>'; // end panel

		return tmpHTML;
	}

	/**
	 * Build preset controls (save/load/delete).
	 */
	_buildPresetControlsHTML()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpPresets = tmpRemote.FilterPresets || [];

		let tmpHTML = '<div class="retold-remote-filter-preset-row">';

		// Load preset dropdown
		if (tmpPresets.length > 0)
		{
			tmpHTML += '<select class="retold-remote-filter-preset-select" id="RetoldRemote-Filter-PresetSelect" '
				+ 'onchange="pict.views[\'RetoldRemote-Gallery\'].loadFilterPreset(this.value)">';
			tmpHTML += '<option value="">Load preset...</option>';
			for (let i = 0; i < tmpPresets.length; i++)
			{
				tmpHTML += '<option value="' + i + '">' + this._escapeHTML(tmpPresets[i].Name) + '</option>';
			}
			tmpHTML += '</select>';
			tmpHTML += '<button class="retold-remote-filter-btn-sm" onclick="pict.views[\'RetoldRemote-Gallery\'].deleteSelectedPreset()">\u2715</button>';
		}

		// Save new preset
		tmpHTML += '<input type="text" class="retold-remote-filter-preset-input" id="RetoldRemote-Filter-PresetName" '
			+ 'placeholder="Preset name...">';
		tmpHTML += '<button class="retold-remote-filter-btn-sm" onclick="pict.views[\'RetoldRemote-Gallery\'].saveFilterPreset()">Save</button>';

		tmpHTML += '</div>';
		return tmpHTML;
	}

	// ──────────────────────────────────────────────
	// Filter chips
	// ──────────────────────────────────────────────

	/**
	 * Build filter chips bar showing all active filters.
	 */
	_buildFilterChipsHTML()
	{
		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (!tmpFilterSort)
		{
			return '';
		}

		let tmpChips = tmpFilterSort.getActiveFilterChips();
		if (tmpChips.length === 0)
		{
			return '';
		}

		let tmpHTML = '<div class="retold-remote-filter-chips">';
		for (let i = 0; i < tmpChips.length; i++)
		{
			let tmpChip = tmpChips[i];
			tmpHTML += '<span class="retold-remote-filter-chip">'
				+ this._escapeHTML(tmpChip.label)
				+ ' <button class="retold-remote-filter-chip-remove" '
				+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].removeFilterChip(\'' + this._escapeHTML(tmpChip.key) + '\')">&times;</button>'
				+ '</span>';
		}
		tmpHTML += '<button class="retold-remote-filter-chip-clear" onclick="pict.views[\'RetoldRemote-Gallery\'].clearAllFilters()">Clear all</button>';
		tmpHTML += '</div>';
		return tmpHTML;
	}

	// ──────────────────────────────────────────────
	// Grid and list HTML builders
	// ──────────────────────────────────────────────

	/**
	 * Build the grid view HTML.
	 */
	_buildGridHTML(pItems, pThumbnailSize, pCursorIndex)
	{
		let tmpHTML = '<div class="retold-remote-grid size-' + pThumbnailSize + '">';
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];

		for (let i = 0; i < pItems.length; i++)
		{
			let tmpItem = pItems[i];
			let tmpSelectedClass = (i === pCursorIndex) ? ' selected' : '';
			let tmpExtension = (tmpItem.Extension || '').toLowerCase();
			let tmpCategory = this._getCategory(tmpExtension, tmpItem.Type);

			tmpHTML += '<div class="retold-remote-tile' + tmpSelectedClass + '" '
				+ 'data-index="' + i + '" '
				+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].onTileClick(' + i + ')" '
				+ 'ondblclick="pict.views[\'RetoldRemote-Gallery\'].onTileDoubleClick(' + i + ')">';

			// Thumbnail area
			tmpHTML += '<div class="retold-remote-tile-thumb">';

			if (tmpItem.Type === 'folder')
			{
				tmpHTML += '<div class="retold-remote-tile-thumb-icon"><span class="retold-remote-icon retold-remote-icon-md">' + (tmpIconProvider ? tmpIconProvider.getIcon('folder', 48) : '') + '</span></div>';
				tmpHTML += '<span class="retold-remote-tile-badge retold-remote-tile-badge-folder">Folder</span>';
			}
			else if (tmpCategory === 'image' && tmpProvider)
			{
				let tmpThumbURL = tmpProvider.getThumbnailURL(tmpItem.Path, 400, 300);
				if (tmpThumbURL)
				{
					tmpHTML += '<img data-src="' + tmpThumbURL + '" alt="' + this._escapeHTML(tmpItem.Name) + '" loading="lazy">';
				}
				else
				{
					tmpHTML += '<div class="retold-remote-tile-thumb-icon"><span class="retold-remote-icon retold-remote-icon-md">' + (tmpIconProvider ? tmpIconProvider.getIcon('file-image', 48) : '') + '</span></div>';
				}
				tmpHTML += '<span class="retold-remote-tile-badge retold-remote-tile-badge-image">' + tmpExtension + '</span>';
			}
			else if (tmpCategory === 'video')
			{
				if (tmpProvider)
				{
					let tmpThumbURL = tmpProvider.getThumbnailURL(tmpItem.Path, 400, 300);
					if (tmpThumbURL)
					{
						tmpHTML += '<img data-src="' + tmpThumbURL + '" alt="' + this._escapeHTML(tmpItem.Name) + '" loading="lazy">';
					}
					else
					{
						tmpHTML += '<div class="retold-remote-tile-thumb-icon"><span class="retold-remote-icon retold-remote-icon-md">' + (tmpIconProvider ? tmpIconProvider.getIcon('file-video', 48) : '') + '</span></div>';
					}
				}
				else
				{
					tmpHTML += '<div class="retold-remote-tile-thumb-icon"><span class="retold-remote-icon retold-remote-icon-md">' + (tmpIconProvider ? tmpIconProvider.getIcon('file-video', 48) : '') + '</span></div>';
				}
				tmpHTML += '<span class="retold-remote-tile-badge retold-remote-tile-badge-video">Video</span>';
			}
			else if (tmpCategory === 'audio')
			{
				tmpHTML += '<div class="retold-remote-tile-thumb-icon"><span class="retold-remote-icon retold-remote-icon-md">' + (tmpIconProvider ? tmpIconProvider.getIcon('file-audio', 48) : '') + '</span></div>';
				tmpHTML += '<span class="retold-remote-tile-badge retold-remote-tile-badge-audio">Audio</span>';
			}
			else if (tmpCategory === 'document')
			{
				tmpHTML += '<div class="retold-remote-tile-thumb-icon"><span class="retold-remote-icon retold-remote-icon-md">' + (tmpIconProvider ? tmpIconProvider.getIconForEntry(tmpItem, 48) : '') + '</span></div>';
				tmpHTML += '<span class="retold-remote-tile-badge retold-remote-tile-badge-document">' + tmpExtension + '</span>';
			}
			else
			{
				tmpHTML += '<div class="retold-remote-tile-thumb-icon"><span class="retold-remote-icon retold-remote-icon-md">' + (tmpIconProvider ? tmpIconProvider.getIconForEntry(tmpItem, 48) : '') + '</span></div>';
			}

			tmpHTML += '</div>'; // end thumb

			// Label
			tmpHTML += '<div class="retold-remote-tile-label" title="' + this._escapeHTML(tmpItem.Name) + '">' + this._escapeHTML(tmpItem.Name) + '</div>';

			// Meta
			if (tmpItem.Type === 'file' && tmpItem.Size !== undefined)
			{
				tmpHTML += '<div class="retold-remote-tile-meta">' + this._formatFileSize(tmpItem.Size) + '</div>';
			}
			else if (tmpItem.Type === 'folder')
			{
				tmpHTML += '<div class="retold-remote-tile-meta">Folder</div>';
			}

			tmpHTML += '</div>'; // end tile
		}

		tmpHTML += '</div>'; // end grid

		return tmpHTML;
	}

	/**
	 * Build the list view HTML.
	 */
	_buildListHTML(pItems, pCursorIndex)
	{
		let tmpHTML = '<div class="retold-remote-list">';
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];

		for (let i = 0; i < pItems.length; i++)
		{
			let tmpItem = pItems[i];
			let tmpSelectedClass = (i === pCursorIndex) ? ' selected' : '';
			let tmpIcon = '';
			if (tmpIconProvider)
			{
				tmpIcon = '<span class="retold-remote-icon retold-remote-icon-sm">' + tmpIconProvider.getIconForEntry(tmpItem, 16) + '</span>';
			}

			tmpHTML += '<div class="retold-remote-list-row' + tmpSelectedClass + '" '
				+ 'data-index="' + i + '" '
				+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].onTileClick(' + i + ')" '
				+ 'ondblclick="pict.views[\'RetoldRemote-Gallery\'].onTileDoubleClick(' + i + ')">';

			tmpHTML += '<div class="retold-remote-list-icon">' + tmpIcon + '</div>';
			tmpHTML += '<div class="retold-remote-list-name">' + this._escapeHTML(tmpItem.Name) + '</div>';

			if (tmpItem.Type === 'file' && tmpItem.Size !== undefined)
			{
				tmpHTML += '<div class="retold-remote-list-size">' + this._formatFileSize(tmpItem.Size) + '</div>';
			}
			else
			{
				tmpHTML += '<div class="retold-remote-list-size"></div>';
			}

			if (tmpItem.Modified)
			{
				tmpHTML += '<div class="retold-remote-list-date">' + new Date(tmpItem.Modified).toLocaleDateString() + '</div>';
			}
			else
			{
				tmpHTML += '<div class="retold-remote-list-date"></div>';
			}

			tmpHTML += '</div>';
		}

		tmpHTML += '</div>';

		return tmpHTML;
	}

	// ──────────────────────────────────────────────
	// Lazy loading
	// ──────────────────────────────────────────────

	/**
	 * Set up IntersectionObserver for lazy-loading thumbnail images.
	 */
	_setupLazyLoading()
	{
		if (this._intersectionObserver)
		{
			this._intersectionObserver.disconnect();
		}

		let tmpImages = document.querySelectorAll('.retold-remote-tile-thumb img[data-src]');
		if (tmpImages.length === 0)
		{
			return;
		}

		this._intersectionObserver = new IntersectionObserver(
			(pEntries) =>
			{
				for (let i = 0; i < pEntries.length; i++)
				{
					if (pEntries[i].isIntersecting)
					{
						let tmpImg = pEntries[i].target;
						tmpImg.src = tmpImg.getAttribute('data-src');
						tmpImg.removeAttribute('data-src');
						this._intersectionObserver.unobserve(tmpImg);
					}
				}
			},
			{ rootMargin: '200px' }
		);

		for (let i = 0; i < tmpImages.length; i++)
		{
			this._intersectionObserver.observe(tmpImages[i]);
		}
	}

	// ──────────────────────────────────────────────
	// Event handlers
	// ──────────────────────────────────────────────

	/**
	 * Handle single click on a tile (select it).
	 */
	onTileClick(pIndex)
	{
		let tmpNavProvider = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNavProvider)
		{
			tmpNavProvider.moveCursor(pIndex);
		}
	}

	/**
	 * Handle double click on a tile (open it).
	 */
	onTileDoubleClick(pIndex)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.GalleryCursorIndex = pIndex;

		let tmpNavProvider = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNavProvider)
		{
			tmpNavProvider.openCurrent();
		}
	}

	/**
	 * Set the media type filter (via type filter buttons).
	 */
	setFilter(pFilter)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.GalleryFilter = pFilter;
		tmpRemote.FilterState.MediaType = pFilter;

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.applyFilterSort();
		}
	}

	/**
	 * Handle search input.
	 */
	onSearchInput(pValue)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.SearchQuery = (pValue || '').toLowerCase();

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.applyFilterSort();
		}
	}

	/**
	 * Handle sort dropdown change.
	 */
	onSortChange(pValue)
	{
		let tmpParts = pValue.split(':');
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.SortField = tmpParts[0];
		tmpRemote.SortDirection = tmpParts[1] || 'asc';

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.applyFilterSort();
		}

		// Persist sort preference
		if (this.pict.PictApplication && this.pict.PictApplication.saveSettings)
		{
			this.pict.PictApplication.saveSettings();
		}
	}

	/**
	 * Toggle the advanced filter panel.
	 */
	toggleFilterPanel()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.FilterPanelOpen = !tmpRemote.FilterPanelOpen;
		this.renderGallery();

		if (this.pict.PictApplication && this.pict.PictApplication.saveSettings)
		{
			this.pict.PictApplication.saveSettings();
		}
	}

	/**
	 * Handle extension checkbox toggle.
	 */
	onExtensionToggle(pExtension, pChecked)
	{
		let tmpFilterState = this.pict.AppData.RetoldRemote.FilterState;
		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];

		if (pChecked)
		{
			if (tmpFilterState.Extensions.length > 0)
			{
				tmpFilterState.Extensions.push(pExtension);
			}
			// If empty (all selected), adding back is a no-op
		}
		else
		{
			// If removing from "all", populate the full list minus this one
			if (tmpFilterState.Extensions.length === 0 && tmpFilterSort)
			{
				let tmpAll = tmpFilterSort.getAvailableExtensions();
				tmpFilterState.Extensions = tmpAll.map((e) => e.ext).filter((e) => e !== pExtension);
			}
			else
			{
				tmpFilterState.Extensions = tmpFilterState.Extensions.filter((e) => e !== pExtension);
			}
		}

		if (tmpFilterSort)
		{
			tmpFilterSort.applyFilterSort();
		}
	}

	/**
	 * Handle size filter change.
	 */
	onSizeFilterChange(pWhich, pValueKB)
	{
		let tmpFilterState = this.pict.AppData.RetoldRemote.FilterState;
		let tmpBytes = (pValueKB && pValueKB !== '') ? parseInt(pValueKB, 10) * 1024 : null;

		if (pWhich === 'min')
		{
			tmpFilterState.SizeMin = tmpBytes;
		}
		else
		{
			tmpFilterState.SizeMax = tmpBytes;
		}

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.applyFilterSort();
		}
	}

	/**
	 * Handle date filter change.
	 */
	onDateFilterChange(pField, pValue)
	{
		let tmpFilterState = this.pict.AppData.RetoldRemote.FilterState;
		tmpFilterState[pField] = pValue || null;

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.applyFilterSort();
		}
	}

	/**
	 * Remove a filter chip.
	 */
	removeFilterChip(pKey)
	{
		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.removeFilter(pKey);
			tmpFilterSort.applyFilterSort();
		}
	}

	/**
	 * Clear all filters.
	 */
	clearAllFilters()
	{
		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.clearAllFilters();
			tmpFilterSort.applyFilterSort();
		}
	}

	/**
	 * Save the current filter config as a named preset.
	 */
	saveFilterPreset()
	{
		let tmpInput = document.getElementById('RetoldRemote-Filter-PresetName');
		if (!tmpInput || !tmpInput.value.trim())
		{
			return;
		}

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.savePreset(tmpInput.value.trim());
		}

		if (this.pict.PictApplication && this.pict.PictApplication.saveSettings)
		{
			this.pict.PictApplication.saveSettings();
		}

		this.renderGallery();
	}

	/**
	 * Load a filter preset from the dropdown.
	 */
	loadFilterPreset(pIndex)
	{
		if (pIndex === '' || pIndex === null || pIndex === undefined)
		{
			return;
		}

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.loadPreset(parseInt(pIndex, 10));
			tmpFilterSort.applyFilterSort();
		}

		if (this.pict.PictApplication && this.pict.PictApplication.saveSettings)
		{
			this.pict.PictApplication.saveSettings();
		}
	}

	/**
	 * Delete the currently selected preset from the dropdown.
	 */
	deleteSelectedPreset()
	{
		let tmpSelect = document.getElementById('RetoldRemote-Filter-PresetSelect');
		if (!tmpSelect || tmpSelect.value === '')
		{
			return;
		}

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.deletePreset(parseInt(tmpSelect.value, 10));
		}

		if (this.pict.PictApplication && this.pict.PictApplication.saveSettings)
		{
			this.pict.PictApplication.saveSettings();
		}

		this.renderGallery();
	}

	// ──────────────────────────────────────────────
	// Utilities
	// ──────────────────────────────────────────────

	/**
	 * Get the media category for a file.
	 */
	_getCategory(pExtension, pType)
	{
		if (pType === 'folder') return 'folder';
		// Delegate to the filter/sort provider if available
		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			return tmpFilterSort.getCategory(pExtension);
		}
		// Fallback
		let tmpExt = (pExtension || '').replace(/^\./, '').toLowerCase();
		if (tmpExt === 'png' || tmpExt === 'jpg' || tmpExt === 'jpeg' || tmpExt === 'gif' || tmpExt === 'webp') return 'image';
		if (tmpExt === 'mp4' || tmpExt === 'webm' || tmpExt === 'mov') return 'video';
		if (tmpExt === 'mp3' || tmpExt === 'wav' || tmpExt === 'ogg') return 'audio';
		if (tmpExt === 'pdf') return 'document';
		return 'other';
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

RetoldRemoteGalleryView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteGalleryView;
