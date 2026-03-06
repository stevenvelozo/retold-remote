const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-Gallery",

	DefaultRenderable: "RetoldRemote-Gallery-Grid",
	DefaultDestinationAddress: "#RetoldRemote-Gallery-Container",

	AutoRender: false,

	CSS: ``,

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

		// Capture search input focus state before re-render so we can restore it
		let tmpSearchEl = document.getElementById('RetoldRemote-Gallery-Search');
		let tmpSearchHadFocus = tmpSearchEl && (document.activeElement === tmpSearchEl);
		let tmpSearchSelStart = tmpSearchHadFocus ? tmpSearchEl.selectionStart : 0;
		let tmpSearchSelEnd = tmpSearchHadFocus ? tmpSearchEl.selectionEnd : 0;

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

			// Restore search focus even on empty results
			if (tmpSearchHadFocus)
			{
				let tmpNewSearch = document.getElementById('RetoldRemote-Gallery-Search');
				if (tmpNewSearch)
				{
					tmpNewSearch.focus();
					tmpNewSearch.setSelectionRange(tmpSearchSelStart, tmpSearchSelEnd);
				}
			}
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

		// Restore search input focus and cursor position after re-render
		if (tmpSearchHadFocus)
		{
			let tmpNewSearch = document.getElementById('RetoldRemote-Gallery-Search');
			if (tmpNewSearch)
			{
				tmpNewSearch.focus();
				tmpNewSearch.setSelectionRange(tmpSearchSelStart, tmpSearchSelEnd);
			}
		}

		// Set up lazy loading for thumbnail images
		this._setupLazyLoading();

		// Recalculate column count for keyboard navigation
		let tmpNavProvider = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNavProvider)
		{
			tmpNavProvider.recalculateColumns();
		}

		// Update the top bar filter icon state
		let tmpTopBarView = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBarView && tmpTopBarView.updateFilterIcon)
		{
			tmpTopBarView.updateFilterIcon();
		}
	}

	// ──────────────────────────────────────────────
	// Header
	// ──────────────────────────────────────────────

	/**
	 * Build the gallery header with type filters, sort dropdown, filter toggle, and search.
	 * The filter bar is hidden by default; toggled via / key or the top bar filter icon.
	 */
	_buildHeaderHTML(pActiveFilter)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;

		// If the filter bar is not visible, don't render the header
		if (!tmpRemote.FilterBarVisible)
		{
			return '';
		}

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
			+ 'value="' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpSearchValue) + '" '
			+ 'oninput="pict.views[\'RetoldRemote-Gallery\'].onSearchInput(this.value)">';

		// Case sensitivity and regex checkboxes
		let tmpCaseSensitive = tmpRemote.SearchCaseSensitive || false;
		let tmpRegex = tmpRemote.SearchRegex || false;
		tmpHTML += '<div class="retold-remote-gallery-search-options">';
		tmpHTML += '<label class="retold-remote-gallery-search-option' + (tmpCaseSensitive ? ' active' : '') + '">'
			+ '<input type="checkbox" ' + (tmpCaseSensitive ? 'checked ' : '')
			+ 'onchange="pict.views[\'RetoldRemote-Gallery\'].onSearchCaseSensitiveChange(this.checked)">'
			+ 'Aa</label>';
		tmpHTML += '<label class="retold-remote-gallery-search-option' + (tmpRegex ? ' active' : '') + '">'
			+ '<input type="checkbox" ' + (tmpRegex ? 'checked ' : '')
			+ 'onchange="pict.views[\'RetoldRemote-Gallery\'].onSearchRegexChange(this.checked)">'
			+ '.*</label>';
		if (tmpRemote._searchRegexError)
		{
			tmpHTML += '<span class="retold-remote-gallery-search-regex-error" title="' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpRemote._searchRegexError) + '">invalid regex</span>';
		}
		tmpHTML += '</div>';
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

		// List columns visibility (only relevant in list mode)
		tmpHTML += '<div class="retold-remote-filter-section">';
		tmpHTML += '<div class="retold-remote-filter-section-title">List Columns</div>';
		tmpHTML += '<div class="retold-remote-filter-col-toggles">';
		let tmpShowExt = tmpRemote.ListShowExtension !== false;
		let tmpShowSize = tmpRemote.ListShowSize !== false;
		let tmpShowDate = tmpRemote.ListShowDate !== false;
		tmpHTML += '<button class="retold-remote-filter-col-toggle' + (tmpShowExt ? ' active' : '') + '" '
			+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].toggleListColumn(\'ListShowExtension\')">'
			+ 'Ext</button>';
		tmpHTML += '<button class="retold-remote-filter-col-toggle' + (tmpShowSize ? ' active' : '') + '" '
			+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].toggleListColumn(\'ListShowSize\')">'
			+ 'Size</button>';
		tmpHTML += '<button class="retold-remote-filter-col-toggle' + (tmpShowDate ? ' active' : '') + '" '
			+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].toggleListColumn(\'ListShowDate\')">'
			+ 'Date</button>';
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
				tmpHTML += '<option value="' + i + '">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpPresets[i].Name) + '</option>';
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
				+ this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpChip.label)
				+ ' <button class="retold-remote-filter-chip-remove" '
				+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].removeFilterChip(\'' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpChip.key) + '\')">&times;</button>'
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
			else if (tmpItem.Type === 'archive')
			{
				tmpHTML += '<div class="retold-remote-tile-thumb-icon"><span class="retold-remote-icon retold-remote-icon-md">' + (tmpIconProvider ? tmpIconProvider.getIcon('file-archive', 48) : '') + '</span></div>';
				tmpHTML += '<span class="retold-remote-tile-badge retold-remote-tile-badge-folder">Archive</span>';
			}
			else if (tmpCategory === 'image' && tmpProvider)
			{
				let tmpThumbURL = tmpProvider.getThumbnailURL(tmpItem.Path, 400, 300);
				if (tmpThumbURL)
				{
					tmpHTML += '<img data-src="' + tmpThumbURL + '" alt="' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpItem.Name) + '" loading="lazy">';
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
						tmpHTML += '<img data-src="' + tmpThumbURL + '" alt="' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpItem.Name) + '" loading="lazy">';
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
			tmpHTML += '<div class="retold-remote-tile-label" title="' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpItem.Name) + '">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpItem.Name) + '</div>';

			// Meta
			if (tmpItem.Type === 'file' && tmpItem.Size !== undefined)
			{
				tmpHTML += '<div class="retold-remote-tile-meta">' + this.pict.providers['RetoldRemote-FormattingUtilities'].formatFileSize(tmpItem.Size) + '</div>';
			}
			else if (tmpItem.Type === 'folder')
			{
				tmpHTML += '<div class="retold-remote-tile-meta">Folder</div>';
			}
			else if (tmpItem.Type === 'archive')
			{
				tmpHTML += '<div class="retold-remote-tile-meta">Archive' + (tmpItem.Size ? ' · ' + this.pict.providers['RetoldRemote-FormattingUtilities'].formatFileSize(tmpItem.Size) : '') + '</div>';
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
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpShowExt = tmpRemote.ListShowExtension !== false;
		let tmpShowSize = tmpRemote.ListShowSize !== false;
		let tmpShowDate = tmpRemote.ListShowDate !== false;

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
			tmpHTML += '<div class="retold-remote-list-name" title="' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpItem.Name) + '"'
				+ ' ontouchstart="pict.views[\'RetoldRemote-Gallery\']._onNameTouchStart(event, \'' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpItem.Name).replace(/'/g, '\\&#39;') + '\')"'
				+ ' ontouchend="pict.views[\'RetoldRemote-Gallery\']._onNameTouchEnd(event)"'
				+ ' ontouchcancel="pict.views[\'RetoldRemote-Gallery\']._onNameTouchEnd(event)"'
				+ '>' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpItem.Name) + '</div>';

			// Extension column
			if (tmpShowExt)
			{
				let tmpExt = '';
				if (tmpItem.Type === 'file' || tmpItem.Type === 'archive')
				{
					tmpExt = (tmpItem.Extension || '').replace(/^\./, '').toLowerCase();
				}
				else if (tmpItem.Type === 'folder')
				{
					tmpExt = '';
				}
				tmpHTML += '<div class="retold-remote-list-ext">' + tmpExt + '</div>';
			}

			// Size column
			if (tmpShowSize)
			{
				if ((tmpItem.Type === 'file' || tmpItem.Type === 'archive') && tmpItem.Size !== undefined)
				{
					tmpHTML += '<div class="retold-remote-list-size">' + this.pict.providers['RetoldRemote-FormattingUtilities'].formatFileSize(tmpItem.Size) + '</div>';
				}
				else
				{
					tmpHTML += '<div class="retold-remote-list-size"></div>';
				}
			}

			// Date column
			if (tmpShowDate)
			{
				if (tmpItem.Modified)
				{
					tmpHTML += '<div class="retold-remote-list-date">' + this.pict.providers['RetoldRemote-FormattingUtilities'].formatShortDate(tmpItem.Modified) + '</div>';
				}
				else
				{
					tmpHTML += '<div class="retold-remote-list-date"></div>';
				}
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
		tmpRemote.SearchQuery = pValue || '';

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.applyFilterSort();
		}
	}

	/**
	 * Handle case-sensitive checkbox change.
	 */
	onSearchCaseSensitiveChange(pChecked)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.SearchCaseSensitive = pChecked;

		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.applyFilterSort();
		}
	}

	/**
	 * Handle regex checkbox change.
	 */
	onSearchRegexChange(pChecked)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.SearchRegex = pChecked;

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
	// List column visibility
	// ──────────────────────────────────────────────

	/**
	 * Toggle a list column on or off.
	 */
	toggleListColumn(pColumnKey)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpCurrent = tmpRemote[pColumnKey];
		// Default is true (shown), so undefined/true -> false, false -> true
		tmpRemote[pColumnKey] = (tmpCurrent === false) ? true : false;

		this.renderGallery();

		if (this.pict.PictApplication && this.pict.PictApplication.saveSettings)
		{
			this.pict.PictApplication.saveSettings();
		}
	}

	// ──────────────────────────────────────────────
	// Long-press tooltip for file names
	// ──────────────────────────────────────────────

	/**
	 * Handle touch start on a file name for long-press tooltip.
	 */
	_onNameTouchStart(pEvent, pName)
	{
		let tmpSelf = this;
		// Clear any existing timer
		this._clearLongPressTimer();

		this._longPressTimer = setTimeout(function()
		{
			tmpSelf._showLongPressTooltip(pEvent, pName);
		}, 500);
	}

	/**
	 * Handle touch end / cancel — dismiss tooltip and timer.
	 */
	_onNameTouchEnd(pEvent)
	{
		this._clearLongPressTimer();
		this._hideLongPressTooltip();
	}

	_clearLongPressTimer()
	{
		if (this._longPressTimer)
		{
			clearTimeout(this._longPressTimer);
			this._longPressTimer = null;
		}
	}

	_showLongPressTooltip(pEvent, pName)
	{
		this._hideLongPressTooltip();

		let tmpTooltip = document.createElement('div');
		tmpTooltip.className = 'retold-remote-longpress-tooltip';
		tmpTooltip.textContent = pName;

		// Position near the touch point
		let tmpTouch = pEvent.touches && pEvent.touches[0];
		if (tmpTouch)
		{
			tmpTooltip.style.left = Math.min(tmpTouch.clientX, window.innerWidth - 20) + 'px';
			tmpTooltip.style.top = (tmpTouch.clientY - 50) + 'px';
		}

		document.body.appendChild(tmpTooltip);
		this._longPressTooltipEl = tmpTooltip;

		// Prevent the default context menu
		pEvent.preventDefault();
	}

	_hideLongPressTooltip()
	{
		if (this._longPressTooltipEl)
		{
			if (this._longPressTooltipEl.parentNode)
			{
				this._longPressTooltipEl.parentNode.removeChild(this._longPressTooltipEl);
			}
			this._longPressTooltipEl = null;
		}
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
		if (pType === 'archive') return 'archive';
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
}

RetoldRemoteGalleryView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteGalleryView;
