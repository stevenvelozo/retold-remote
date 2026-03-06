/**
 * Retold Remote -- Collection Manager Provider
 *
 * Client-side state management and API communication for the
 * collections feature.  Provides methods for CRUD operations on
 * collections and their items, plus panel state management.
 *
 * All collection state lives on pict.AppData.RetoldRemote and is
 * mutated directly followed by explicit render calls -- matching the
 * existing retold-remote state management pattern.
 *
 * Large method groups are broken out into mixin modules and mixed into
 * the prototype via Object.assign():
 *
 *   CollectionManager-Favorites.js     — favorites heart toggle
 *   CollectionManager-AddItems.js      — add file/frame/clip helpers
 *   CollectionManager-OperationPlan.js — sort-plan create/execute/undo
 *
 * @license MIT
 */
const libPictProvider = require('pict-provider');

const _CollectionManagerFavorites = require('./CollectionManager-Favorites');
const _CollectionManagerAddItems = require('./CollectionManager-AddItems');
const _CollectionManagerOperationPlan = require('./CollectionManager-OperationPlan');

const _DefaultProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-CollectionManager',
	AutoInitialize: true,
	AutoSolveWithApp: false
};

class CollectionManagerProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	// -- State Accessors --------------------------------------------------

	/**
	 * Shortcut to the RetoldRemote AppData namespace.
	 */
	_getRemote()
	{
		return this.pict.AppData.RetoldRemote;
	}

	/**
	 * Get the collections panel view.
	 */
	_getPanelView()
	{
		return this.pict.views['RetoldRemote-CollectionsPanel'];
	}

	/**
	 * Get the toast notification provider.
	 */
	_getToast()
	{
		return this.pict.providers['RetoldRemote-ToastNotification'];
	}

	// -- Pending Clip Context ---------------------------------------------

	/**
	 * Set a pending clip context for the next add-to-collection action.
	 *
	 * When a segment save triggers the "create/pick collection" dropdown,
	 * the specific segment data (start/end times, type) would be lost
	 * because the dropdown generically calls addCurrentFileToCollection().
	 * This stores the clip data so the dropdown callback can use it.
	 *
	 * @param {object} pContext - { Type: 'video-clip'|'audio-clip', Start: number, End: number }
	 */
	setPendingClipContext(pContext)
	{
		this._pendingClipContext = pContext || null;
	}

	/**
	 * Clear any pending clip context (called after use or on navigation).
	 */
	clearPendingClipContext()
	{
		this._pendingClipContext = null;
	}

	/**
	 * Add the pending clip (or current file) to a collection.
	 *
	 * If a pending clip context exists (from a segment save that triggered
	 * the dropdown), dispatches to the appropriate clip-add method.
	 * Otherwise falls back to addCurrentFileToCollection().
	 *
	 * @param {string} pGUID - Collection GUID
	 * @returns {boolean} true if the add was initiated
	 */
	addPendingOrCurrentToCollection(pGUID)
	{
		if (this._pendingClipContext)
		{
			let tmpCtx = this._pendingClipContext;
			this._pendingClipContext = null;

			if (tmpCtx.Type === 'video-clip')
			{
				return this.addVideoClipToCollection(pGUID, tmpCtx.Start, tmpCtx.End);
			}
			else if (tmpCtx.Type === 'audio-clip')
			{
				return this.addAudioClipToCollection(pGUID, tmpCtx.Start, tmpCtx.End);
			}
		}

		return this.addCurrentFileToCollection(pGUID);
	}

	/**
	 * Return the GUID of the collection that quick-add actions should
	 * target.  If a collection is currently open in the side panel,
	 * prefer it over the sticky last-used GUID.
	 *
	 * @returns {string|null} Collection GUID, or null if none available
	 */
	getQuickAddTargetGUID()
	{
		let tmpRemote = this._getRemote();

		// If a collection is currently open (detail view), prefer it
		if (tmpRemote.ActiveCollectionGUID && tmpRemote.CollectionsPanelMode === 'detail')
		{
			return tmpRemote.ActiveCollectionGUID;
		}

		return tmpRemote.LastUsedCollectionGUID || null;
	}

	// -- API Methods ------------------------------------------------------

	/**
	 * Fetch all collections (summaries) from the server.
	 *
	 * @param {Function} [fCallback] - Optional callback(pError, pCollections)
	 */
	fetchCollections(fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		fetch('/api/collections')
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();
				tmpRemote.Collections = Array.isArray(pData) ? pData : [];

				let tmpPanel = tmpSelf._getPanelView();
				if (tmpPanel && tmpRemote.CollectionsPanelOpen)
				{
					tmpPanel.renderContent();
				}

				return tmpCallback(null, tmpRemote.Collections);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to fetch collections: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Fetch a single collection with all its items.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {Function} [fCallback] - Optional callback(pError, pCollection)
	 */
	fetchCollection(pGUID, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		fetch('/api/collections/' + encodeURIComponent(pGUID))
			.then((pResponse) =>
			{
				if (!pResponse.ok)
				{
					throw new Error('Collection not found');
				}
				return pResponse.json();
			})
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();
				tmpRemote.ActiveCollectionGUID = pGUID;
				tmpRemote.ActiveCollection = pData;

				let tmpPanel = tmpSelf._getPanelView();
				if (tmpPanel)
				{
					tmpPanel.renderContent();
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to fetch collection: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Create a new collection.
	 *
	 * @param {string} pName - Collection name
	 * @param {Function} [fCallback] - Optional callback(pError, pCollection)
	 */
	createCollection(pName, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};
		let tmpGUID = this.fable.getUUID();

		fetch('/api/collections/' + encodeURIComponent(tmpGUID),
		{
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ Name: pName || 'Untitled Collection' })
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();
				tmpRemote.LastUsedCollectionGUID = tmpGUID;

				// Refresh the list
				tmpSelf.fetchCollections();

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Collection created: ' + (pData.Name || pName));
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to create collection: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Update an existing collection's metadata.
	 *
	 * @param {object} pCollection - Collection object with GUID and updated fields
	 * @param {Function} [fCallback] - Optional callback(pError, pCollection)
	 */
	updateCollection(pCollection, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		if (!pCollection || !pCollection.GUID)
		{
			return tmpCallback(new Error('Collection must have a GUID'));
		}

		fetch('/api/collections/' + encodeURIComponent(pCollection.GUID),
		{
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(pCollection)
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();

				// Update in-memory active collection if it's the same one
				if (tmpRemote.ActiveCollectionGUID === pCollection.GUID)
				{
					tmpRemote.ActiveCollection = pData;
				}

				// Refresh the list
				tmpSelf.fetchCollections();

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to update collection: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Delete a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {Function} [fCallback] - Optional callback(pError)
	 */
	deleteCollection(pGUID, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		fetch('/api/collections/' + encodeURIComponent(pGUID),
		{
			method: 'DELETE'
		})
			.then((pResponse) => pResponse.json())
			.then(() =>
			{
				let tmpRemote = tmpSelf._getRemote();

				// If we deleted the active collection, go back to list
				if (tmpRemote.ActiveCollectionGUID === pGUID)
				{
					tmpRemote.ActiveCollectionGUID = null;
					tmpRemote.ActiveCollection = null;
					tmpRemote.CollectionsPanelMode = 'list';
				}

				// If we deleted the last-used collection, clear it
				if (tmpRemote.LastUsedCollectionGUID === pGUID)
				{
					tmpRemote.LastUsedCollectionGUID = null;
				}

				// Refresh the list
				tmpSelf.fetchCollections();

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Collection deleted');
				}

				return tmpCallback(null);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to delete collection: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Add item(s) to a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {Array} pItems - Array of item objects (each with Type, Path, etc.)
	 * @param {Function} [fCallback] - Optional callback(pError, pCollection)
	 */
	addItemsToCollection(pGUID, pItems, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		fetch('/api/collections/' + encodeURIComponent(pGUID) + '/items',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ Items: pItems })
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();
				tmpRemote.LastUsedCollectionGUID = pGUID;

				// Update in-memory active collection if it's the same one
				if (tmpRemote.ActiveCollectionGUID === pGUID)
				{
					tmpRemote.ActiveCollection = pData;
				}

				// Refresh the summary list
				tmpSelf.fetchCollections();

				let tmpPanel = tmpSelf._getPanelView();
				if (tmpPanel && tmpRemote.CollectionsPanelMode === 'detail' && tmpRemote.ActiveCollectionGUID === pGUID)
				{
					tmpPanel.renderContent();
				}

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					let tmpCollectionName = pData.Name || 'collection';
					tmpToast.showToast('Added ' + pItems.length + ' item' + (pItems.length > 1 ? 's' : '') + ' to ' + tmpCollectionName);
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to add items to collection: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Remove an item from a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {string} pItemID - Item ID within the collection
	 * @param {Function} [fCallback] - Optional callback(pError, pCollection)
	 */
	removeItemFromCollection(pGUID, pItemID, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		fetch('/api/collections/' + encodeURIComponent(pGUID) + '/items/' + encodeURIComponent(pItemID),
		{
			method: 'DELETE'
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();

				// Update in-memory active collection if it's the same one
				if (tmpRemote.ActiveCollectionGUID === pGUID)
				{
					tmpRemote.ActiveCollection = pData;
				}

				// Refresh the summary list
				tmpSelf.fetchCollections();

				let tmpPanel = tmpSelf._getPanelView();
				if (tmpPanel && tmpRemote.CollectionsPanelMode === 'detail' && tmpRemote.ActiveCollectionGUID === pGUID)
				{
					tmpPanel.renderContent();
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to remove item from collection: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Reorder items in a collection (manual sort).
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {Array} pItemOrder - Array of item IDs in desired order
	 * @param {Function} [fCallback] - Optional callback(pError, pCollection)
	 */
	reorderItems(pGUID, pItemOrder, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		fetch('/api/collections/' + encodeURIComponent(pGUID) + '/reorder',
		{
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ItemOrder: pItemOrder })
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();

				if (tmpRemote.ActiveCollectionGUID === pGUID)
				{
					tmpRemote.ActiveCollection = pData;
				}

				let tmpPanel = tmpSelf._getPanelView();
				if (tmpPanel && tmpRemote.CollectionsPanelMode === 'detail')
				{
					tmpPanel.renderContent();
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to reorder items: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Copy items from one collection to another.
	 *
	 * @param {string} pSourceGUID - Source collection GUID
	 * @param {string} pTargetGUID - Target collection GUID
	 * @param {Array} pItemIDs - Array of item IDs to copy
	 * @param {Function} [fCallback] - Optional callback(pError, pTargetCollection)
	 */
	copyItems(pSourceGUID, pTargetGUID, pItemIDs, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		fetch('/api/collections/copy-items',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(
			{
				SourceGUID: pSourceGUID,
				TargetGUID: pTargetGUID,
				ItemIDs: pItemIDs
			})
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				// Refresh the list
				tmpSelf.fetchCollections();

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Copied ' + pItemIDs.length + ' item' + (pItemIDs.length > 1 ? 's' : ''));
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to copy items: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	// -- Panel State Methods ----------------------------------------------

	/**
	 * Toggle the collections panel open/closed.
	 */
	togglePanel()
	{
		let tmpRemote = this._getRemote();

		// On mobile, delegate to the sidebar collections tab instead of the right-side panel
		let tmpLayoutView = this.pict.views['ContentEditor-Layout'];
		if (tmpLayoutView && tmpLayoutView.isMobileDrawer())
		{
			// Check if collections tab is already active
			let tmpActiveTab = document.querySelector('.content-editor-sidebar-tab.active');
			let tmpIsCollectionsActive = tmpActiveTab && tmpActiveTab.getAttribute('data-tab') === 'collections';

			if (tmpIsCollectionsActive)
			{
				// Switch back to files tab
				tmpLayoutView.switchSidebarTab('files');
			}
			else
			{
				// Open sidebar if collapsed, then switch to collections tab
				if (tmpRemote.SidebarCollapsed)
				{
					tmpLayoutView.toggleSidebar();
				}
				tmpLayoutView.switchSidebarTab('collections');
			}

			// Update topbar button state
			let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
			if (tmpTopBar && typeof tmpTopBar.updateCollectionsIcon === 'function')
			{
				tmpTopBar.updateCollectionsIcon();
			}
			return;
		}

		tmpRemote.CollectionsPanelOpen = !tmpRemote.CollectionsPanelOpen;

		let tmpWrap = document.getElementById('RetoldRemote-Collections-Wrap');
		if (tmpWrap)
		{
			if (tmpRemote.CollectionsPanelOpen)
			{
				tmpWrap.classList.remove('collapsed');
				// Restore saved width
				if (tmpRemote.CollectionsPanelWidth)
				{
					tmpWrap.style.width = tmpRemote.CollectionsPanelWidth + 'px';
				}
				// Fetch latest collections when opening
				this.fetchCollections();
			}
			else
			{
				tmpWrap.classList.add('collapsed');
			}
		}

		// Update topbar button state
		let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBar && typeof tmpTopBar.updateCollectionsIcon === 'function')
		{
			tmpTopBar.updateCollectionsIcon();
		}

		// Persist setting
		this.pict.PictApplication.saveSettings();

		// Recalculate gallery columns after panel animation
		let tmpSelf = this;
		setTimeout(() =>
		{
			let tmpGalleryNav = tmpSelf.pict.providers['RetoldRemote-GalleryNavigation'];
			if (tmpGalleryNav && typeof tmpGalleryNav.recalculateColumns === 'function')
			{
				tmpGalleryNav.recalculateColumns();
			}
		}, 250);
	}

	/**
	 * Open the collections panel.
	 */
	openPanel()
	{
		let tmpRemote = this._getRemote();
		if (!tmpRemote.CollectionsPanelOpen)
		{
			this.togglePanel();
		}
	}

	/**
	 * Close the collections panel.
	 */
	closePanel()
	{
		let tmpRemote = this._getRemote();
		if (tmpRemote.CollectionsPanelOpen)
		{
			this.togglePanel();
		}
	}

	// -- Path Resolution --------------------------------------------------

	/**
	 * Resolve the current file path from multiple state sources.
	 *
	 * Checks in order:
	 *   1. ContentEditor.CurrentFile (set when viewing a file)
	 *   2. RetoldRemote.CurrentViewerFile (set in viewer mode)
	 *   3. Gallery cursor item Path (the highlighted item in gallery mode)
	 *
	 * @returns {string} File path or empty string
	 */
	_resolveCurrentFilePath()
	{
		// 1. Content editor current file (most authoritative)
		let tmpPath = this.pict.AppData.ContentEditor.CurrentFile;
		if (tmpPath)
		{
			return tmpPath;
		}

		let tmpRemote = this._getRemote();

		// 2. Viewer state (set when the media viewer is showing a file)
		if (tmpRemote.CurrentViewerFile)
		{
			return tmpRemote.CurrentViewerFile;
		}

		// 3. Gallery cursor item (the highlighted item when browsing)
		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpIndex = tmpRemote.GalleryCursorIndex || 0;
		if (tmpItems.length > 0 && tmpItems[tmpIndex] && tmpItems[tmpIndex].Path)
		{
			return tmpItems[tmpIndex].Path;
		}

		return '';
	}

	/**
	 * Resolve the current item from multiple state sources.
	 *
	 * Like _resolveCurrentFilePath() but returns an object with { Path, Type }
	 * so callers can detect when the cursor is on a folder.
	 *
	 * @returns {Object|null} Item with Path and Type, or null
	 */
	_resolveCurrentItem()
	{
		// 1. Content editor current file (always a file)
		let tmpPath = this.pict.AppData.ContentEditor.CurrentFile;
		if (tmpPath)
		{
			return { Path: tmpPath, Type: 'file' };
		}

		let tmpRemote = this._getRemote();

		// 2. Viewer state (always a file)
		if (tmpRemote.CurrentViewerFile)
		{
			return { Path: tmpRemote.CurrentViewerFile, Type: 'file' };
		}

		// 3. Gallery cursor item (could be a folder)
		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpIndex = tmpRemote.GalleryCursorIndex || 0;
		if (tmpItems.length > 0 && tmpItems[tmpIndex])
		{
			return {
				Path: tmpItems[tmpIndex].Path || '',
				Type: tmpItems[tmpIndex].Type || 'file'
			};
		}

		return null;
	}

	// -- Sorting & Search -------------------------------------------------

	/**
	 * Sort a collection's Items array in place (client-side mirror of server logic).
	 *
	 * @param {Array} pItems - Items array
	 * @param {string} pSortMode - "manual" | "name" | "modified" | "type"
	 * @param {string} pSortDirection - "asc" | "desc"
	 * @returns {Array} The same array, sorted
	 */
	_sortItems(pItems, pSortMode, pSortDirection)
	{
		if (!Array.isArray(pItems) || pItems.length < 2)
		{
			return pItems;
		}

		let tmpDirection = (pSortDirection === 'desc') ? -1 : 1;

		switch (pSortMode)
		{
			case 'name':
				pItems.sort((a, b) =>
				{
					let tmpA = (a.Label || a.Path || '').toLowerCase();
					let tmpB = (b.Label || b.Path || '').toLowerCase();
					// Sort by filename portion only (after last /)
					let tmpSlashA = tmpA.lastIndexOf('/');
					let tmpSlashB = tmpB.lastIndexOf('/');
					if (tmpSlashA >= 0) tmpA = tmpA.substring(tmpSlashA + 1);
					if (tmpSlashB >= 0) tmpB = tmpB.substring(tmpSlashB + 1);
					return tmpDirection * tmpA.localeCompare(tmpB);
				});
				break;

			case 'type':
				pItems.sort((a, b) =>
				{
					let tmpA = (a.Type || '').toLowerCase();
					let tmpB = (b.Type || '').toLowerCase();
					return tmpDirection * tmpA.localeCompare(tmpB);
				});
				break;

			case 'modified':
				pItems.sort((a, b) =>
				{
					let tmpA = a.AddedAt || '';
					let tmpB = b.AddedAt || '';
					return tmpDirection * tmpA.localeCompare(tmpB);
				});
				break;

			case 'manual':
			default:
				pItems.sort((a, b) =>
				{
					return tmpDirection * ((a.SortOrder || 0) - (b.SortOrder || 0));
				});
				break;
		}

		return pItems;
	}

	/**
	 * Sort the active collection's items in place and re-render the panel.
	 * Saves the sort preference to the server in the background.
	 *
	 * @param {string} pSortMode - Sort mode (or null to keep current)
	 * @param {string} pSortDirection - Sort direction (or null to keep current)
	 */
	sortActiveCollection(pSortMode, pSortDirection)
	{
		let tmpRemote = this._getRemote();
		let tmpCollection = tmpRemote.ActiveCollection;

		if (!tmpCollection)
		{
			return;
		}

		// Update sort preferences
		if (typeof pSortMode === 'string')
		{
			tmpCollection.SortMode = pSortMode;
		}
		if (typeof pSortDirection === 'string')
		{
			tmpCollection.SortDirection = pSortDirection;
		}

		// Sort items locally
		this._sortItems(tmpCollection.Items || [], tmpCollection.SortMode, tmpCollection.SortDirection);

		// Re-render the panel immediately
		let tmpPanel = this._getPanelView();
		if (tmpPanel)
		{
			tmpPanel.renderContent();
		}

		// Save sort preference to server in background (no re-render needed)
		fetch('/api/collections/' + encodeURIComponent(tmpCollection.GUID),
		{
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ GUID: tmpCollection.GUID, SortMode: tmpCollection.SortMode, SortDirection: tmpCollection.SortDirection })
		})
		.catch((pError) =>
		{
			this.log.error('Failed to save sort preference: ' + pError.message);
		});
	}

	/**
	 * Search the loaded collections by name/description/tags (client-side filter).
	 *
	 * @param {string} pQuery - Search query
	 * @returns {Array} Filtered collection summaries
	 */
	searchCollections(pQuery)
	{
		let tmpRemote = this._getRemote();
		let tmpQuery = (pQuery || '').toLowerCase();

		if (!tmpQuery)
		{
			return tmpRemote.Collections;
		}

		return tmpRemote.Collections.filter((pCollection) =>
		{
			let tmpName = (pCollection.Name || '').toLowerCase();
			let tmpDesc = (pCollection.Description || '').toLowerCase();
			let tmpTags = (pCollection.Tags || []).join(' ').toLowerCase();
			return tmpName.indexOf(tmpQuery) >= 0 ||
				tmpDesc.indexOf(tmpQuery) >= 0 ||
				tmpTags.indexOf(tmpQuery) >= 0;
		});
	}
}

// -- Mix in method groups from sub-modules --------------------------------
Object.assign(CollectionManagerProvider.prototype, _CollectionManagerFavorites);
Object.assign(CollectionManagerProvider.prototype, _CollectionManagerAddItems);
Object.assign(CollectionManagerProvider.prototype, _CollectionManagerOperationPlan);

CollectionManagerProvider.default_configuration = _DefaultProviderConfiguration;

module.exports = CollectionManagerProvider;
