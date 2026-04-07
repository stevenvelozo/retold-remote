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

// Chunked rendering tuning constants
const _CHUNKED_RENDER_THRESHOLD = 500;  // Below this, render synchronously in one shot
const _CHUNK_FIRST_SIZE = 250;          // First chunk — appears within one frame
const _CHUNK_SUBSEQUENT_SIZE = 500;     // Later chunks — larger for throughput

// Thumbnail concurrency cap
const _MAX_THUMBNAIL_CONCURRENCY = 8;

class RetoldRemoteGalleryView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._intersectionObserver = null;

		// Chunked render state
		this._activeRenderFrame = null;   // requestAnimationFrame id
		this._activeRenderToken = 0;      // incremented to invalidate in-flight chunked renders

		// Thumbnail loading queue
		this._thumbnailQueue = [];
		this._thumbnailInFlight = 0;
	}

	/**
	 * Paint an immediate loading overlay in the gallery container.
	 * Called by the application's loadFileList() before the fetch starts
	 * so the user sees instant feedback when they click a folder.
	 *
	 * @param {string} pPath - Path being loaded (for display)
	 */
	showLoadingState(pPath)
	{
		let tmpContainer = document.getElementById('RetoldRemote-Gallery-Container');
		if (!tmpContainer)
		{
			return;
		}

		let tmpFmt = this.pict.providers['RetoldRemote-FormattingUtilities'];
		let tmpEscaped = tmpFmt ? tmpFmt.escapeHTML(pPath || '') : (pPath || '');

		let tmpHTML = '<div class="retold-remote-gallery-loading">';
		tmpHTML += '<div class="retold-remote-gallery-loading-spinner"></div>';
		tmpHTML += '<div class="retold-remote-gallery-loading-text">Loading folder\u2026</div>';
		if (tmpEscaped)
		{
			tmpHTML += '<div class="retold-remote-gallery-loading-path">' + tmpEscaped + '</div>';
		}
		tmpHTML += '</div>';

		tmpContainer.innerHTML = tmpHTML;
	}

	/**
	 * Cancel any chunked render currently in flight.
	 * Call this before starting a new render, or when navigating away.
	 */
	cancelActiveRender()
	{
		if (this._activeRenderFrame !== null)
		{
			cancelAnimationFrame(this._activeRenderFrame);
			this._activeRenderFrame = null;
		}
		// Bump the token so any in-flight chunked render from a closure bails out
		this._activeRenderToken++;
	}

	// ──────────────────────────────────────────────
	// Gallery rendering
	// ──────────────────────────────────────────────

	/**
	 * Render the gallery based on current state.
	 * GalleryItems is already filtered+sorted by the pipeline provider.
	 *
	 * For folders with more than _CHUNKED_RENDER_THRESHOLD items, the render
	 * is split into chunks scheduled via requestAnimationFrame so the UI
	 * stays responsive. Smaller folders use the synchronous fast path.
	 */
	renderGallery()
	{
		let tmpContainer = document.getElementById('RetoldRemote-Gallery-Container');
		if (!tmpContainer)
		{
			return;
		}

		// Cancel any chunked render already in flight — fast folder-to-folder
		// navigation should not stack up render work.
		this.cancelActiveRender();

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
			this._restoreSearchFocus(tmpSearchHadFocus, tmpSearchSelStart, tmpSearchSelEnd);
			return;
		}

		// SMALL FOLDER FAST PATH: for ≤ _CHUNKED_RENDER_THRESHOLD items, render
		// everything synchronously in a single innerHTML assignment. This
		// preserves the existing behavior for normal-sized folders.
		if (tmpItems.length <= _CHUNKED_RENDER_THRESHOLD)
		{
			if (tmpViewMode === 'gallery')
			{
				tmpHTML += this._buildGridHTML(tmpItems, tmpThumbnailSize, tmpCursorIndex);
			}
			else
			{
				tmpHTML += this._buildListHTML(tmpItems, tmpCursorIndex);
			}

			tmpContainer.innerHTML = tmpHTML;
			this._restoreSearchFocus(tmpSearchHadFocus, tmpSearchSelStart, tmpSearchSelEnd);
			this._setupLazyLoading();

			let tmpNavProvider = this.pict.providers['RetoldRemote-GalleryNavigation'];
			if (tmpNavProvider)
			{
				tmpNavProvider.recalculateColumns();
			}

			let tmpTopBarView = this.pict.views['ContentEditor-TopBar'];
			if (tmpTopBarView && tmpTopBarView.updateFilterIcon)
			{
				tmpTopBarView.updateFilterIcon();
			}
			return;
		}

		// LARGE FOLDER CHUNKED PATH: paint the scaffolding now, then fill the
		// items container in chunks via requestAnimationFrame so the main
		// thread stays responsive.
		let tmpItemsContainerID = 'RetoldRemote-GalleryItemsContainer';
		let tmpProgressID = 'RetoldRemote-GalleryProgress';

		if (tmpViewMode === 'gallery')
		{
			tmpHTML += '<div class="retold-remote-grid size-' + tmpThumbnailSize + '" id="' + tmpItemsContainerID + '"></div>';
		}
		else
		{
			tmpHTML += '<div class="retold-remote-list" id="' + tmpItemsContainerID + '"></div>';
		}

		tmpHTML += '<div class="retold-remote-gallery-progress" id="' + tmpProgressID + '">'
			+ '<span class="retold-remote-gallery-progress-spinner"></span>'
			+ '<span class="retold-remote-gallery-progress-text">Rendering 0 / ' + tmpItems.length.toLocaleString() + '\u2026</span>'
			+ '</div>';

		tmpContainer.innerHTML = tmpHTML;
		this._restoreSearchFocus(tmpSearchHadFocus, tmpSearchSelStart, tmpSearchSelEnd);

		// Update the top bar filter icon state right away (doesn't need items)
		let tmpTopBarView = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBarView && tmpTopBarView.updateFilterIcon)
		{
			tmpTopBarView.updateFilterIcon();
		}

		// Start the chunked fill
		this._renderGalleryChunked(tmpItems, tmpViewMode, tmpThumbnailSize, tmpCursorIndex,
			tmpItemsContainerID, tmpProgressID);
	}

	/**
	 * Restore search input focus and selection range after a full re-render.
	 */
	_restoreSearchFocus(pHadFocus, pSelStart, pSelEnd)
	{
		if (!pHadFocus)
		{
			return;
		}
		let tmpNewSearch = document.getElementById('RetoldRemote-Gallery-Search');
		if (tmpNewSearch)
		{
			tmpNewSearch.focus();
			tmpNewSearch.setSelectionRange(pSelStart, pSelEnd);
		}
	}

	/**
	 * Render the gallery items into the scaffolding container in chunks,
	 * scheduling each chunk with requestAnimationFrame so the main thread
	 * stays responsive. Updates the progress strip between chunks.
	 *
	 * @param {Array}  pItems             - Items to render
	 * @param {string} pViewMode          - 'gallery' or 'list'
	 * @param {string} pThumbnailSize     - 'small' | 'medium' | 'large'
	 * @param {number} pCursorIndex       - Currently selected index
	 * @param {string} pItemsContainerID  - DOM id of the inner items container
	 * @param {string} pProgressID        - DOM id of the progress strip
	 */
	_renderGalleryChunked(pItems, pViewMode, pThumbnailSize, pCursorIndex, pItemsContainerID, pProgressID)
	{
		let tmpSelf = this;
		let tmpToken = ++this._activeRenderToken;
		let tmpTotal = pItems.length;
		let tmpOffset = 0;

		let _renderNextChunk = function ()
		{
			// If another render started while we were waiting, bail out
			if (tmpToken !== tmpSelf._activeRenderToken)
			{
				return;
			}

			let tmpItemsContainer = document.getElementById(pItemsContainerID);
			if (!tmpItemsContainer)
			{
				// Container was replaced (e.g., navigated away) — stop rendering
				return;
			}

			// First chunk is smaller so it paints within one frame; later chunks
			// are larger for throughput
			let tmpChunkSize = (tmpOffset === 0) ? _CHUNK_FIRST_SIZE : _CHUNK_SUBSEQUENT_SIZE;
			let tmpEnd = Math.min(tmpOffset + tmpChunkSize, tmpTotal);
			let tmpSlice = pItems.slice(tmpOffset, tmpEnd);

			let tmpChunkHTML;
			if (pViewMode === 'gallery')
			{
				tmpChunkHTML = tmpSelf._buildGridItemsHTML(tmpSlice, pCursorIndex, tmpOffset);
			}
			else
			{
				tmpChunkHTML = tmpSelf._buildListItemsHTML(tmpSlice, pCursorIndex, tmpOffset);
			}

			tmpItemsContainer.insertAdjacentHTML('beforeend', tmpChunkHTML);

			tmpOffset = tmpEnd;

			// Update progress strip
			let tmpProgressEl = document.getElementById(pProgressID);
			if (tmpProgressEl)
			{
				let tmpProgressText = tmpProgressEl.querySelector('.retold-remote-gallery-progress-text');
				if (tmpProgressText)
				{
					tmpProgressText.textContent = 'Rendering ' + tmpOffset.toLocaleString() + ' / ' + tmpTotal.toLocaleString() + '\u2026';
				}
			}

			if (tmpOffset < tmpTotal)
			{
				// Incrementally wire up lazy loading for the chunk just appended
				// so thumbnails start loading while later chunks are still rendering
				tmpSelf._observeNewThumbnails();
				tmpSelf._activeRenderFrame = requestAnimationFrame(_renderNextChunk);
			}
			else
			{
				// Final chunk rendered — tear down progress strip and finalize
				tmpSelf._activeRenderFrame = null;

				if (tmpProgressEl && tmpProgressEl.parentElement)
				{
					tmpProgressEl.parentElement.removeChild(tmpProgressEl);
				}

				tmpSelf._setupLazyLoading();

				let tmpNavProvider = tmpSelf.pict.providers['RetoldRemote-GalleryNavigation'];
				if (tmpNavProvider)
				{
					tmpNavProvider.recalculateColumns();
				}
			}
		};

		// Kick off the first chunk on the next frame — gives the browser time
		// to paint the scaffolding + progress strip first
		this._activeRenderFrame = requestAnimationFrame(_renderNextChunk);
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
	 * Build the grid view HTML — full wrapper + all items.
	 * Used by the synchronous fast path for small folders.
	 */
	_buildGridHTML(pItems, pThumbnailSize, pCursorIndex)
	{
		let tmpHTML = '<div class="retold-remote-grid size-' + pThumbnailSize + '">';
		tmpHTML += this._buildGridItemsHTML(pItems, pCursorIndex, 0);
		tmpHTML += '</div>';
		return tmpHTML;
	}

	/**
	 * Build the per-item HTML for a grid view slice.
	 *
	 * @param {Array}  pItems      - The items to render (may be a slice of the full list)
	 * @param {number} pCursorIndex - Index of the currently-selected item in the FULL list
	 * @param {number} pStartIndex  - Index of pItems[0] within the full list (for data-index and click handlers)
	 */
	_buildGridItemsHTML(pItems, pCursorIndex, pStartIndex)
	{
		let tmpStartIndex = pStartIndex || 0;
		let tmpHTML = '';
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpFmt = this.pict.providers['RetoldRemote-FormattingUtilities'];

		for (let i = 0; i < pItems.length; i++)
		{
			let tmpItem = pItems[i];
			let tmpAbsoluteIndex = tmpStartIndex + i;
			let tmpSelectedClass = (tmpAbsoluteIndex === pCursorIndex) ? ' selected' : '';
			let tmpExtension = (tmpItem.Extension || '').toLowerCase();
			let tmpCategory = this._getCategory(tmpExtension, tmpItem.Type);

			tmpHTML += '<div class="retold-remote-tile' + tmpSelectedClass + '" '
				+ 'data-index="' + tmpAbsoluteIndex + '" '
				+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].onTileClick(' + tmpAbsoluteIndex + ')" '
				+ 'ondblclick="pict.views[\'RetoldRemote-Gallery\'].onTileDoubleClick(' + tmpAbsoluteIndex + ')">';

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
					tmpHTML += '<img data-src="' + tmpThumbURL + '" alt="' + tmpFmt.escapeHTML(tmpItem.Name) + '" loading="lazy">';
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
						tmpHTML += '<img data-src="' + tmpThumbURL + '" alt="' + tmpFmt.escapeHTML(tmpItem.Name) + '" loading="lazy">';
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
			tmpHTML += '<div class="retold-remote-tile-label" title="' + tmpFmt.escapeHTML(tmpItem.Name) + '">' + tmpFmt.escapeHTML(tmpItem.Name) + '</div>';

			// Meta
			if (tmpItem.Type === 'file' && tmpItem.Size !== undefined)
			{
				tmpHTML += '<div class="retold-remote-tile-meta">' + tmpFmt.formatFileSize(tmpItem.Size) + '</div>';
			}
			else if (tmpItem.Type === 'folder')
			{
				tmpHTML += '<div class="retold-remote-tile-meta">Folder</div>';
			}
			else if (tmpItem.Type === 'archive')
			{
				tmpHTML += '<div class="retold-remote-tile-meta">Archive' + (tmpItem.Size ? ' \u00b7 ' + tmpFmt.formatFileSize(tmpItem.Size) : '') + '</div>';
			}

			tmpHTML += '</div>'; // end tile
		}

		return tmpHTML;
	}

	/**
	 * Build the list view HTML — full wrapper + all items.
	 * Used by the synchronous fast path for small folders.
	 */
	_buildListHTML(pItems, pCursorIndex)
	{
		let tmpHTML = '<div class="retold-remote-list">';
		tmpHTML += this._buildListItemsHTML(pItems, pCursorIndex, 0);
		tmpHTML += '</div>';
		return tmpHTML;
	}

	/**
	 * Build the per-item HTML for a list view slice.
	 *
	 * @param {Array}  pItems       - The items to render (may be a slice of the full list)
	 * @param {number} pCursorIndex - Index of the currently-selected item in the FULL list
	 * @param {number} pStartIndex  - Index of pItems[0] within the full list
	 */
	_buildListItemsHTML(pItems, pCursorIndex, pStartIndex)
	{
		let tmpStartIndex = pStartIndex || 0;
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpShowExt = tmpRemote.ListShowExtension !== false;
		let tmpShowSize = tmpRemote.ListShowSize !== false;
		let tmpShowDate = tmpRemote.ListShowDate !== false;

		let tmpHTML = '';
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpFmt = this.pict.providers['RetoldRemote-FormattingUtilities'];

		for (let i = 0; i < pItems.length; i++)
		{
			let tmpItem = pItems[i];
			let tmpAbsoluteIndex = tmpStartIndex + i;
			let tmpSelectedClass = (tmpAbsoluteIndex === pCursorIndex) ? ' selected' : '';
			let tmpIcon = '';
			if (tmpIconProvider)
			{
				tmpIcon = '<span class="retold-remote-icon retold-remote-icon-sm">' + tmpIconProvider.getIconForEntry(tmpItem, 16) + '</span>';
			}

			tmpHTML += '<div class="retold-remote-list-row' + tmpSelectedClass + '" '
				+ 'data-index="' + tmpAbsoluteIndex + '" '
				+ 'onclick="pict.views[\'RetoldRemote-Gallery\'].onTileClick(' + tmpAbsoluteIndex + ')" '
				+ 'ondblclick="pict.views[\'RetoldRemote-Gallery\'].onTileDoubleClick(' + tmpAbsoluteIndex + ')">';

			tmpHTML += '<div class="retold-remote-list-icon">' + tmpIcon + '</div>';
			tmpHTML += '<div class="retold-remote-list-name" title="' + tmpFmt.escapeHTML(tmpItem.Name) + '"'
				+ ' ontouchstart="pict.views[\'RetoldRemote-Gallery\']._onNameTouchStart(event, \'' + tmpFmt.escapeHTML(tmpItem.Name).replace(/'/g, '\\&#39;') + '\')"'
				+ ' ontouchend="pict.views[\'RetoldRemote-Gallery\']._onNameTouchEnd(event)"'
				+ ' ontouchcancel="pict.views[\'RetoldRemote-Gallery\']._onNameTouchEnd(event)"'
				+ '>' + tmpFmt.escapeHTML(tmpItem.Name) + '</div>';

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
					tmpHTML += '<div class="retold-remote-list-size">' + tmpFmt.formatFileSize(tmpItem.Size) + '</div>';
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
					tmpHTML += '<div class="retold-remote-list-date">' + tmpFmt.formatShortDate(tmpItem.Modified) + '</div>';
				}
				else
				{
					tmpHTML += '<div class="retold-remote-list-date"></div>';
				}
			}

			tmpHTML += '</div>';
		}

		return tmpHTML;
	}

	// ──────────────────────────────────────────────
	// Lazy loading
	// ──────────────────────────────────────────────

	/**
	 * Set up IntersectionObserver for lazy-loading thumbnail images.
	 * Uses a bounded concurrency queue so we don't stampede the server
	 * with hundreds of parallel thumbnail requests on the initial render.
	 */
	_setupLazyLoading()
	{
		if (this._intersectionObserver)
		{
			this._intersectionObserver.disconnect();
		}

		// Reset the concurrency queue. Any in-flight loads from the previous
		// render will finish on their own; they just won't trigger queue drain
		// because the counter is reset.
		this._thumbnailQueue = [];
		this._thumbnailInFlight = 0;

		let tmpSelf = this;
		this._intersectionObserver = new IntersectionObserver(
			(pEntries) =>
			{
				for (let i = 0; i < pEntries.length; i++)
				{
					if (pEntries[i].isIntersecting)
					{
						let tmpImg = pEntries[i].target;
						tmpSelf._intersectionObserver.unobserve(tmpImg);
						tmpSelf._enqueueThumbnail(tmpImg);
					}
				}
			},
			{ rootMargin: '100px' }
		);

		// Observe every img[data-src] currently in the DOM. Chunked renders
		// also call _observeNewThumbnails() incrementally so thumbnails start
		// loading while later chunks are still being built.
		this._observeNewThumbnails();
	}

	/**
	 * Observe any img[data-src] nodes that are not yet being watched by
	 * the IntersectionObserver. Called incrementally from the chunked
	 * render after each chunk is appended, so visible thumbnails in the
	 * first chunk can start loading while later chunks render.
	 */
	_observeNewThumbnails()
	{
		if (!this._intersectionObserver)
		{
			return;
		}
		// Query only images still carrying data-src (new ones from the latest
		// chunk, or ones that haven't intersected yet)
		let tmpImages = document.querySelectorAll('.retold-remote-tile-thumb img[data-src]:not([data-observed])');
		for (let i = 0; i < tmpImages.length; i++)
		{
			tmpImages[i].setAttribute('data-observed', '1');
			this._intersectionObserver.observe(tmpImages[i]);
		}
	}

	/**
	 * Enqueue a thumbnail for lazy-loading with bounded concurrency.
	 * Dispatches immediately if under the concurrency cap.
	 *
	 * @param {HTMLImageElement} pImg - The img element to load
	 */
	_enqueueThumbnail(pImg)
	{
		this._thumbnailQueue.push(pImg);
		this._drainThumbnailQueue();
	}

	/**
	 * Dispatch pending thumbnails until the in-flight count hits the cap.
	 */
	_drainThumbnailQueue()
	{
		let tmpSelf = this;
		while (this._thumbnailInFlight < _MAX_THUMBNAIL_CONCURRENCY && this._thumbnailQueue.length > 0)
		{
			let tmpImg = this._thumbnailQueue.shift();
			let tmpSrc = tmpImg.getAttribute('data-src');
			if (!tmpSrc)
			{
				// Already loaded or cleared — skip
				continue;
			}

			this._thumbnailInFlight++;

			let _finish = function ()
			{
				tmpSelf._thumbnailInFlight--;
				tmpSelf._drainThumbnailQueue();
			};

			tmpImg.addEventListener('load', _finish, { once: true });
			tmpImg.addEventListener('error', _finish, { once: true });

			tmpImg.src = tmpSrc;
			tmpImg.removeAttribute('data-src');
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
