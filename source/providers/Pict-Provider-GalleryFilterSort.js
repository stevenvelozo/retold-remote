const libPictProvider = require('pict-provider');

const _ImageExtensions = { 'png': true, 'jpg': true, 'jpeg': true, 'gif': true, 'webp': true, 'svg': true, 'bmp': true, 'ico': true, 'avif': true, 'tiff': true, 'tif': true };
const _VideoExtensions = { 'mp4': true, 'webm': true, 'mov': true, 'mkv': true, 'avi': true, 'wmv': true, 'flv': true, 'm4v': true };
const _AudioExtensions = { 'mp3': true, 'wav': true, 'ogg': true, 'flac': true, 'aac': true, 'm4a': true, 'wma': true };
const _DocumentExtensions = { 'pdf': true, 'epub': true, 'mobi': true };

const _DefaultProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-GalleryFilterSort',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0,
	AutoSolveWithApp: false
};

class GalleryFilterSortProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	// ──────────────────────────────────────────────
	// Pipeline
	// ──────────────────────────────────────────────

	/**
	 * Run the full filter+sort pipeline.
	 * Reads from RawFileList, applies all active filters and sort,
	 * writes result into GalleryItems, resets cursor, and re-renders.
	 */
	applyFilterSort()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (!tmpRemote)
		{
			return;
		}

		let tmpItems = (tmpRemote.RawFileList || []).slice();

		// 1. Text search
		tmpItems = this._applySearch(tmpItems, tmpRemote.SearchQuery);

		// 2. Media type filter
		let tmpFilterState = tmpRemote.FilterState || {};
		tmpItems = this._applyMediaTypeFilter(tmpItems, tmpFilterState.MediaType || 'all');

		// 3. Extension filter
		tmpItems = this._applyExtensionFilter(tmpItems, tmpFilterState.Extensions || []);

		// 4. Size range filter
		tmpItems = this._applySizeFilter(tmpItems, tmpFilterState.SizeMin, tmpFilterState.SizeMax);

		// 5. Date range filter
		tmpItems = this._applyDateFilter(tmpItems, tmpFilterState);

		// 6. Sort
		tmpItems = this._sortItems(tmpItems, tmpRemote.SortField || 'folder-first', tmpRemote.SortDirection || 'asc');

		// Write result
		tmpRemote.GalleryItems = tmpItems;

		// Restore cursor position if we have a saved one for this folder
		let tmpCurrentLocation = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';
		let tmpSavedIndex = tmpRemote.FolderCursorHistory && tmpRemote.FolderCursorHistory[tmpCurrentLocation];
		if (typeof tmpSavedIndex === 'number' && tmpSavedIndex < tmpItems.length)
		{
			tmpRemote.GalleryCursorIndex = tmpSavedIndex;
		}
		else
		{
			tmpRemote.GalleryCursorIndex = 0;
		}

		// Re-render gallery
		let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
		if (tmpGalleryView)
		{
			tmpGalleryView.renderGallery();
		}
	}

	// ──────────────────────────────────────────────
	// Filter stages
	// ──────────────────────────────────────────────

	/**
	 * Search filter: substring match on item Name.
	 */
	_applySearch(pItems, pQuery)
	{
		if (!pQuery)
		{
			return pItems;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpCaseSensitive = tmpRemote.SearchCaseSensitive || false;
		let tmpRegex = tmpRemote.SearchRegex || false;

		if (tmpRegex)
		{
			// Regex mode
			let tmpRegexObj;
			try
			{
				tmpRegexObj = new RegExp(pQuery, tmpCaseSensitive ? '' : 'i');
			}
			catch (pError)
			{
				// Invalid regex — store error for UI feedback and return all items
				tmpRemote._searchRegexError = pError.message;
				return pItems;
			}

			tmpRemote._searchRegexError = null;
			return pItems.filter((pItem) =>
			{
				return tmpRegexObj.test(pItem.Name);
			});
		}

		// Plain text mode
		tmpRemote._searchRegexError = null;

		if (tmpCaseSensitive)
		{
			return pItems.filter((pItem) =>
			{
				return pItem.Name.includes(pQuery);
			});
		}

		// Default: case-insensitive substring match
		let tmpQuery = pQuery.toLowerCase();
		return pItems.filter((pItem) =>
		{
			return pItem.Name.toLowerCase().includes(tmpQuery);
		});
	}

	/**
	 * Media type filter: by category. Folders always pass.
	 */
	_applyMediaTypeFilter(pItems, pMediaType)
	{
		if (pMediaType === 'all')
		{
			return pItems;
		}

		return pItems.filter((pItem) =>
		{
			if (pItem.Type === 'folder' || pItem.Type === 'archive')
			{
				return true;
			}

			let tmpCategory = this.getCategory((pItem.Extension || '').toLowerCase());

			if (pMediaType === 'images') return tmpCategory === 'image';
			if (pMediaType === 'video') return tmpCategory === 'video';
			if (pMediaType === 'audio') return tmpCategory === 'audio';
			if (pMediaType === 'documents') return tmpCategory === 'document';
			return true;
		});
	}

	/**
	 * Extension filter: only matching extensions pass. Folders always pass.
	 * An empty array means "all extensions".
	 */
	_applyExtensionFilter(pItems, pExtensions)
	{
		if (!pExtensions || pExtensions.length === 0)
		{
			return pItems;
		}

		// Build a fast lookup set
		let tmpExtSet = {};
		for (let i = 0; i < pExtensions.length; i++)
		{
			tmpExtSet[pExtensions[i].toLowerCase()] = true;
		}

		return pItems.filter((pItem) =>
		{
			if (pItem.Type === 'folder' || pItem.Type === 'archive')
			{
				return true;
			}
			let tmpExt = (pItem.Extension || '').replace(/^\./, '').toLowerCase();
			return tmpExtSet[tmpExt] === true;
		});
	}

	/**
	 * File size range filter. Folders always pass.
	 */
	_applySizeFilter(pItems, pMin, pMax)
	{
		if (pMin === null && pMax === null)
		{
			return pItems;
		}

		return pItems.filter((pItem) =>
		{
			if (pItem.Type === 'folder' || pItem.Type === 'archive')
			{
				return true;
			}
			let tmpSize = pItem.Size || 0;
			if (pMin !== null && tmpSize < pMin)
			{
				return false;
			}
			if (pMax !== null && tmpSize > pMax)
			{
				return false;
			}
			return true;
		});
	}

	/**
	 * Date range filter on Modified and/or Created fields. Folders always pass.
	 */
	_applyDateFilter(pItems, pDateFilters)
	{
		let tmpModAfter = pDateFilters.DateModifiedAfter ? new Date(pDateFilters.DateModifiedAfter).getTime() : null;
		let tmpModBefore = pDateFilters.DateModifiedBefore ? new Date(pDateFilters.DateModifiedBefore + 'T23:59:59').getTime() : null;
		let tmpCreatedAfter = pDateFilters.DateCreatedAfter ? new Date(pDateFilters.DateCreatedAfter).getTime() : null;
		let tmpCreatedBefore = pDateFilters.DateCreatedBefore ? new Date(pDateFilters.DateCreatedBefore + 'T23:59:59').getTime() : null;

		if (tmpModAfter === null && tmpModBefore === null && tmpCreatedAfter === null && tmpCreatedBefore === null)
		{
			return pItems;
		}

		return pItems.filter((pItem) =>
		{
			if (pItem.Type === 'folder' || pItem.Type === 'archive')
			{
				return true;
			}

			if (tmpModAfter !== null || tmpModBefore !== null)
			{
				let tmpMod = pItem.Modified ? new Date(pItem.Modified).getTime() : 0;
				if (tmpModAfter !== null && tmpMod < tmpModAfter) return false;
				if (tmpModBefore !== null && tmpMod > tmpModBefore) return false;
			}

			if (tmpCreatedAfter !== null || tmpCreatedBefore !== null)
			{
				let tmpCreated = pItem.Created ? new Date(pItem.Created).getTime() : 0;
				if (tmpCreatedAfter !== null && tmpCreated < tmpCreatedAfter) return false;
				if (tmpCreatedBefore !== null && tmpCreated > tmpCreatedBefore) return false;
			}

			return true;
		});
	}

	// ──────────────────────────────────────────────
	// Sort
	// ──────────────────────────────────────────────

	/**
	 * Sort items by the specified field and direction.
	 */
	_sortItems(pItems, pSortField, pSortDirection)
	{
		let tmpDirection = (pSortDirection === 'desc') ? -1 : 1;

		return pItems.slice().sort((pA, pB) =>
		{
			// 'folder-first' mode: containers (folders + archives) always sort before files
			if (pSortField === 'folder-first')
			{
				let tmpAIsContainer = (pA.Type === 'folder' || pA.Type === 'archive');
				let tmpBIsContainer = (pB.Type === 'folder' || pB.Type === 'archive');
				if (tmpAIsContainer && !tmpBIsContainer) return -1;
				if (!tmpAIsContainer && tmpBIsContainer) return 1;
				// Both same type: sort by name ascending
				let tmpNameA = (pA.Name || '').toLowerCase();
				let tmpNameB = (pB.Name || '').toLowerCase();
				if (tmpNameA < tmpNameB) return -1 * tmpDirection;
				if (tmpNameA > tmpNameB) return 1 * tmpDirection;
				return 0;
			}

			if (pSortField === 'name')
			{
				let tmpNameA = (pA.Name || '').toLowerCase();
				let tmpNameB = (pB.Name || '').toLowerCase();
				if (tmpNameA < tmpNameB) return -1 * tmpDirection;
				if (tmpNameA > tmpNameB) return 1 * tmpDirection;
				return 0;
			}

			if (pSortField === 'modified')
			{
				let tmpDateA = pA.Modified ? new Date(pA.Modified).getTime() : 0;
				let tmpDateB = pB.Modified ? new Date(pB.Modified).getTime() : 0;
				if (tmpDateA !== tmpDateB) return (tmpDateA - tmpDateB) * tmpDirection;
				// Tiebreaker: name ascending
				let tmpNameA = (pA.Name || '').toLowerCase();
				let tmpNameB = (pB.Name || '').toLowerCase();
				return tmpNameA < tmpNameB ? -1 : (tmpNameA > tmpNameB ? 1 : 0);
			}

			if (pSortField === 'created')
			{
				let tmpDateA = pA.Created ? new Date(pA.Created).getTime() : 0;
				let tmpDateB = pB.Created ? new Date(pB.Created).getTime() : 0;
				if (tmpDateA !== tmpDateB) return (tmpDateA - tmpDateB) * tmpDirection;
				// Tiebreaker: name ascending
				let tmpNameA = (pA.Name || '').toLowerCase();
				let tmpNameB = (pB.Name || '').toLowerCase();
				return tmpNameA < tmpNameB ? -1 : (tmpNameA > tmpNameB ? 1 : 0);
			}

			return 0;
		});
	}

	// ──────────────────────────────────────────────
	// Category helper
	// ──────────────────────────────────────────────

	/**
	 * Get the media category for an extension string (with or without leading dot).
	 *
	 * @param {string} pExtension - e.g. '.png' or 'png'
	 * @returns {string} 'image', 'video', 'audio', 'document', or 'other'
	 */
	getCategory(pExtension)
	{
		let tmpExt = (pExtension || '').replace(/^\./, '').toLowerCase();
		if (_ImageExtensions[tmpExt]) return 'image';
		if (_VideoExtensions[tmpExt]) return 'video';
		if (_AudioExtensions[tmpExt]) return 'audio';
		if (_DocumentExtensions[tmpExt]) return 'document';
		return 'other';
	}

	// ──────────────────────────────────────────────
	// Extension helpers for the filter panel
	// ──────────────────────────────────────────────

	/**
	 * Get the unique set of file extensions present in RawFileList.
	 * Returns an array of { ext, category, count } grouped by category.
	 *
	 * @returns {Array}
	 */
	getAvailableExtensions()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpRaw = tmpRemote ? tmpRemote.RawFileList : [];
		let tmpExtMap = {};

		for (let i = 0; i < tmpRaw.length; i++)
		{
			let tmpItem = tmpRaw[i];
			if (tmpItem.Type === 'folder' || tmpItem.Type === 'archive')
			{
				continue;
			}
			let tmpExt = (tmpItem.Extension || '').replace(/^\./, '').toLowerCase();
			if (!tmpExt)
			{
				continue;
			}
			if (!tmpExtMap[tmpExt])
			{
				tmpExtMap[tmpExt] =
				{
					ext: tmpExt,
					category: this.getCategory(tmpExt),
					count: 0
				};
			}
			tmpExtMap[tmpExt].count++;
		}

		// Convert to array and sort by category then extension
		let tmpCategoryOrder = { 'image': 0, 'video': 1, 'audio': 2, 'document': 3, 'other': 4 };
		let tmpResult = Object.values(tmpExtMap);
		tmpResult.sort((pA, pB) =>
		{
			let tmpCatA = tmpCategoryOrder[pA.category] || 99;
			let tmpCatB = tmpCategoryOrder[pB.category] || 99;
			if (tmpCatA !== tmpCatB) return tmpCatA - tmpCatB;
			return pA.ext < pB.ext ? -1 : (pA.ext > pB.ext ? 1 : 0);
		});

		return tmpResult;
	}

	// ──────────────────────────────────────────────
	// Filter chips
	// ──────────────────────────────────────────────

	/**
	 * Return an array of { key, label } for each non-default filter currently active.
	 */
	getActiveFilterChips()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (!tmpRemote)
		{
			return [];
		}

		let tmpChips = [];
		let tmpFilterState = tmpRemote.FilterState || {};

		// Media type
		if (tmpFilterState.MediaType && tmpFilterState.MediaType !== 'all')
		{
			let tmpLabels = { 'images': 'Images', 'video': 'Video', 'audio': 'Audio', 'documents': 'Docs' };
			tmpChips.push({ key: 'mediaType', label: tmpLabels[tmpFilterState.MediaType] || tmpFilterState.MediaType });
		}

		// Extensions
		let tmpExtensions = tmpFilterState.Extensions || [];
		if (tmpExtensions.length > 0)
		{
			for (let i = 0; i < tmpExtensions.length; i++)
			{
				tmpChips.push({ key: 'ext:' + tmpExtensions[i], label: '.' + tmpExtensions[i] });
			}
		}

		// Size
		if (tmpFilterState.SizeMin !== null && tmpFilterState.SizeMin !== undefined)
		{
			tmpChips.push({ key: 'sizeMin', label: '\u2265 ' + this._formatSizeKB(tmpFilterState.SizeMin) });
		}
		if (tmpFilterState.SizeMax !== null && tmpFilterState.SizeMax !== undefined)
		{
			tmpChips.push({ key: 'sizeMax', label: '\u2264 ' + this._formatSizeKB(tmpFilterState.SizeMax) });
		}

		// Dates
		if (tmpFilterState.DateModifiedAfter)
		{
			tmpChips.push({ key: 'dateModifiedAfter', label: 'Modified after ' + tmpFilterState.DateModifiedAfter });
		}
		if (tmpFilterState.DateModifiedBefore)
		{
			tmpChips.push({ key: 'dateModifiedBefore', label: 'Modified before ' + tmpFilterState.DateModifiedBefore });
		}
		if (tmpFilterState.DateCreatedAfter)
		{
			tmpChips.push({ key: 'dateCreatedAfter', label: 'Created after ' + tmpFilterState.DateCreatedAfter });
		}
		if (tmpFilterState.DateCreatedBefore)
		{
			tmpChips.push({ key: 'dateCreatedBefore', label: 'Created before ' + tmpFilterState.DateCreatedBefore });
		}

		// Search query
		if (tmpRemote.SearchQuery)
		{
			let tmpSearchLabel = 'Search: "' + tmpRemote.SearchQuery + '"';
			let tmpSearchFlags = [];
			if (tmpRemote.SearchCaseSensitive) tmpSearchFlags.push('Aa');
			if (tmpRemote.SearchRegex) tmpSearchFlags.push('.*');
			if (tmpSearchFlags.length > 0)
			{
				tmpSearchLabel += ' [' + tmpSearchFlags.join(', ') + ']';
			}
			tmpChips.push({ key: 'search', label: tmpSearchLabel });
		}

		return tmpChips;
	}

	/**
	 * Format bytes into a human-readable KB/MB string for chip labels.
	 */
	_formatSizeKB(pBytes)
	{
		if (pBytes >= 1048576)
		{
			return (pBytes / 1048576).toFixed(1) + ' MB';
		}
		return Math.round(pBytes / 1024) + ' KB';
	}

	/**
	 * Remove a specific filter by key.
	 *
	 * @param {string} pKey - e.g. 'mediaType', 'ext:png', 'sizeMin', 'dateModifiedAfter', 'search'
	 */
	removeFilter(pKey)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (!tmpRemote)
		{
			return;
		}

		let tmpFilterState = tmpRemote.FilterState;

		if (pKey === 'mediaType')
		{
			tmpFilterState.MediaType = 'all';
			tmpRemote.GalleryFilter = 'all';
		}
		else if (pKey.startsWith('ext:'))
		{
			let tmpExt = pKey.substring(4);
			tmpFilterState.Extensions = (tmpFilterState.Extensions || []).filter((e) => e !== tmpExt);
		}
		else if (pKey === 'sizeMin')
		{
			tmpFilterState.SizeMin = null;
		}
		else if (pKey === 'sizeMax')
		{
			tmpFilterState.SizeMax = null;
		}
		else if (pKey === 'dateModifiedAfter')
		{
			tmpFilterState.DateModifiedAfter = null;
		}
		else if (pKey === 'dateModifiedBefore')
		{
			tmpFilterState.DateModifiedBefore = null;
		}
		else if (pKey === 'dateCreatedAfter')
		{
			tmpFilterState.DateCreatedAfter = null;
		}
		else if (pKey === 'dateCreatedBefore')
		{
			tmpFilterState.DateCreatedBefore = null;
		}
		else if (pKey === 'search')
		{
			tmpRemote.SearchQuery = '';
			tmpRemote._searchRegexError = null;
		}
	}

	/**
	 * Reset all filters to defaults.
	 */
	clearAllFilters()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (!tmpRemote)
		{
			return;
		}

		tmpRemote.SearchQuery = '';
		tmpRemote.SearchCaseSensitive = false;
		tmpRemote.SearchRegex = false;
		tmpRemote._searchRegexError = null;
		tmpRemote.GalleryFilter = 'all';
		tmpRemote.FilterState =
		{
			MediaType: 'all',
			Extensions: [],
			SizeMin: null,
			SizeMax: null,
			DateModifiedAfter: null,
			DateModifiedBefore: null,
			DateCreatedAfter: null,
			DateCreatedBefore: null
		};
	}

	// ──────────────────────────────────────────────
	// Presets
	// ──────────────────────────────────────────────

	/**
	 * Save current filter+sort config as a named preset.
	 *
	 * @param {string} pName
	 */
	savePreset(pName)
	{
		if (!pName)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (!tmpRemote)
		{
			return;
		}

		let tmpPreset =
		{
			Name: pName,
			FilterState: JSON.parse(JSON.stringify(tmpRemote.FilterState)),
			SortField: tmpRemote.SortField,
			SortDirection: tmpRemote.SortDirection
		};

		tmpRemote.FilterPresets = tmpRemote.FilterPresets || [];
		tmpRemote.FilterPresets.push(tmpPreset);
	}

	/**
	 * Load a saved preset and apply its filter+sort config.
	 *
	 * @param {number} pIndex - index into FilterPresets array
	 */
	loadPreset(pIndex)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (!tmpRemote || !tmpRemote.FilterPresets)
		{
			return;
		}

		let tmpPreset = tmpRemote.FilterPresets[pIndex];
		if (!tmpPreset)
		{
			return;
		}

		tmpRemote.FilterState = JSON.parse(JSON.stringify(tmpPreset.FilterState));
		tmpRemote.GalleryFilter = tmpRemote.FilterState.MediaType || 'all';
		tmpRemote.SortField = tmpPreset.SortField || 'folder-first';
		tmpRemote.SortDirection = tmpPreset.SortDirection || 'asc';
	}

	/**
	 * Delete a saved preset.
	 *
	 * @param {number} pIndex - index into FilterPresets array
	 */
	deletePreset(pIndex)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (!tmpRemote || !tmpRemote.FilterPresets)
		{
			return;
		}

		tmpRemote.FilterPresets.splice(pIndex, 1);
	}
}

GalleryFilterSortProvider.default_configuration = _DefaultProviderConfiguration;

module.exports = GalleryFilterSortProvider;
