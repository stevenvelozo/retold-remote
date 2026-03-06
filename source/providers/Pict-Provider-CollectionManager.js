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
 * @license MIT
 */
const libPictProvider = require('pict-provider');

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

	// -- Favorites Methods ------------------------------------------------

	/**
	 * Ensure the favorites collection exists.
	 * If FavoritesGUID is set, loads it.  Otherwise searches existing
	 * collections for CollectionType === 'favorites'.  If not found,
	 * creates one with a well-known GUID.
	 *
	 * @param {Function} [fCallback] - Optional callback(pError)
	 */
	ensureFavoritesCollection(fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};
		let tmpRemote = this._getRemote();

		// If we already have a GUID, just load it
		if (tmpRemote.FavoritesGUID)
		{
			return this._loadFavoritesCollection(tmpRemote.FavoritesGUID, tmpCallback);
		}

		// Search existing collections for a favorites-type collection
		let tmpCollections = tmpRemote.Collections || [];
		for (let i = 0; i < tmpCollections.length; i++)
		{
			if (tmpCollections[i].CollectionType === 'favorites')
			{
				tmpRemote.FavoritesGUID = tmpCollections[i].GUID;
				this.pict.PictApplication.saveSettings();
				return this._loadFavoritesCollection(tmpCollections[i].GUID, tmpCallback);
			}
		}

		// Not found — create one
		let tmpGUID = 'favorites-default';

		fetch('/api/collections/' + encodeURIComponent(tmpGUID),
		{
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ Name: 'Favorites', CollectionType: 'favorites', Icon: 'heart' })
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				tmpRemote.FavoritesGUID = tmpGUID;
				tmpSelf.pict.PictApplication.saveSettings();
				tmpSelf._loadFavoritesCollection(tmpGUID, tmpCallback);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to create favorites collection: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Load the favorites collection and rebuild the path set.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {Function} [fCallback] - Optional callback(pError)
	 */
	_loadFavoritesCollection(pGUID, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		fetch('/api/collections/' + encodeURIComponent(pGUID))
			.then((pResponse) =>
			{
				if (!pResponse.ok)
				{
					throw new Error('Favorites collection not found');
				}
				return pResponse.json();
			})
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();
				tmpRemote.FavoritesCollection = pData;
				tmpSelf._rebuildFavoritesPathSet(pData);

				// Update heart icon in topbar
				let tmpTopBar = tmpSelf.pict.views['ContentEditor-TopBar'];
				if (tmpTopBar && typeof tmpTopBar.updateFavoritesIcon === 'function')
				{
					tmpTopBar.updateFavoritesIcon();
				}

				// Update favorites pane if visible
				tmpSelf._renderFavoritesPane();

				return tmpCallback(null);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to load favorites collection: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Rebuild the FavoritesPathSet from a collection's Items array.
	 *
	 * @param {Object} pCollection - Collection object with Items array
	 */
	_rebuildFavoritesPathSet(pCollection)
	{
		let tmpRemote = this._getRemote();
		tmpRemote.FavoritesPathSet = {};

		if (!pCollection || !Array.isArray(pCollection.Items))
		{
			return;
		}

		for (let i = 0; i < pCollection.Items.length; i++)
		{
			let tmpItem = pCollection.Items[i];
			if (tmpItem.Path)
			{
				tmpRemote.FavoritesPathSet[tmpItem.Path] = tmpItem.ID;
			}
		}
	}

	/**
	 * Check if a file path is in favorites.
	 *
	 * @param {string} [pPath] - File path (defaults to resolved current file)
	 * @returns {boolean} True if favorited
	 */
	isFavorited(pPath)
	{
		let tmpRemote = this._getRemote();
		let tmpFilePath = pPath || this._resolveCurrentFilePath();
		return !!(tmpRemote.FavoritesPathSet[tmpFilePath]);
	}

	/**
	 * Toggle a file in/out of favorites.
	 *
	 * @param {string} [pPath] - File path (defaults to resolved current file)
	 */
	toggleFavorite(pPath)
	{
		let tmpSelf = this;
		let tmpRemote = this._getRemote();
		let tmpFilePath = pPath || this._resolveCurrentFilePath();

		if (!tmpFilePath)
		{
			return;
		}

		if (!tmpRemote.FavoritesGUID)
		{
			// Favorites collection not ready yet
			return;
		}

		if (this.isFavorited(tmpFilePath))
		{
			// Remove from favorites
			let tmpItemID = tmpRemote.FavoritesPathSet[tmpFilePath];
			this.removeItemFromCollection(tmpRemote.FavoritesGUID, tmpItemID, (pError, pData) =>
			{
				if (!pError && pData)
				{
					tmpRemote.FavoritesCollection = pData;
					tmpSelf._rebuildFavoritesPathSet(pData);
				}

				// Update heart icon
				let tmpTopBar = tmpSelf.pict.views['ContentEditor-TopBar'];
				if (tmpTopBar && typeof tmpTopBar.updateFavoritesIcon === 'function')
				{
					tmpTopBar.updateFavoritesIcon();
				}

				tmpSelf._renderFavoritesPane();

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Removed from favorites');
				}
			});
		}
		else
		{
			// Check if the current item is a folder
			let tmpCurrentItem = this._resolveCurrentItem();
			if (tmpCurrentItem && (tmpCurrentItem.Type === 'folder' || tmpCurrentItem.Type === 'archive'))
			{
				// Prompt user to choose folder reference vs folder contents
				this.showFolderChoicePrompt((pChoice) =>
				{
					let tmpFolderItem =
					{
						Type: (pChoice === 'contents') ? 'folder-contents' : 'folder',
						Path: tmpFilePath,
						Label: '',
						Note: ''
					};

					tmpSelf.addItemsToCollection(tmpRemote.FavoritesGUID, [tmpFolderItem], (pError, pData) =>
					{
						if (!pError && pData)
						{
							tmpRemote.FavoritesCollection = pData;
							tmpSelf._rebuildFavoritesPathSet(pData);
						}

						let tmpTopBar = tmpSelf.pict.views['ContentEditor-TopBar'];
						if (tmpTopBar && typeof tmpTopBar.updateFavoritesIcon === 'function')
						{
							tmpTopBar.updateFavoritesIcon();
						}

						tmpSelf._renderFavoritesPane();

						let tmpToast = tmpSelf._getToast();
						if (tmpToast)
						{
							tmpToast.showToast('Added to favorites');
						}
					});
				});
				return;
			}

			// Add to favorites — build item using same logic as addCurrentFileToCollection
			let tmpItem =
			{
				Type: 'file',
				Path: tmpFilePath,
				Label: '',
				Note: ''
			};

			// Detect archive subfile
			let tmpArchiveMatch = tmpFilePath.match(/^(.*?\.(zip|7z|rar|tar|tgz|cbz|cbr|tar\.gz|tar\.bz2|tar\.xz))\/(.*)/i);
			if (tmpArchiveMatch)
			{
				tmpItem.Type = 'subfile';
				tmpItem.ArchivePath = tmpArchiveMatch[1];
			}

			// Include hash if available
			let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
			if (tmpProvider)
			{
				let tmpHash = tmpProvider.getHashForPath(tmpFilePath);
				if (tmpHash)
				{
					tmpItem.Hash = tmpHash;
				}
			}

			this.addItemsToCollection(tmpRemote.FavoritesGUID, [tmpItem], (pError, pData) =>
			{
				if (!pError && pData)
				{
					tmpRemote.FavoritesCollection = pData;
					tmpSelf._rebuildFavoritesPathSet(pData);
				}

				// Update heart icon
				let tmpTopBar = tmpSelf.pict.views['ContentEditor-TopBar'];
				if (tmpTopBar && typeof tmpTopBar.updateFavoritesIcon === 'function')
				{
					tmpTopBar.updateFavoritesIcon();
				}

				tmpSelf._renderFavoritesPane();

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Added to favorites');
				}
			});
		}
	}

	/**
	 * Render the favorites pane if the favorites tab is active.
	 */
	_renderFavoritesPane()
	{
		let tmpLayoutView = this.pict.views['ContentEditor-Layout'];
		if (tmpLayoutView && typeof tmpLayoutView.renderFavoritesList === 'function')
		{
			tmpLayoutView.renderFavoritesList();
		}
	}

	// -- Convenience Methods ----------------------------------------------

	/**
	 * Add the currently viewed file to a collection.
	 * If pGUID is not provided, uses the last-used collection.
	 *
	 * Context-aware: in the video explorer, adds a video-frame item with
	 * the selected frame timestamp.  In the audio explorer, adds an audio
	 * snippet.  Otherwise adds a file/subfile item.
	 *
	 * @param {string} [pGUID] - Collection GUID (omit for quick-add to last-used)
	 * @returns {boolean} true if the add was initiated
	 */
	addCurrentFileToCollection(pGUID)
	{
		let tmpRemote = this._getRemote();
		let tmpTargetGUID = pGUID || tmpRemote.LastUsedCollectionGUID;
		if (!tmpTargetGUID)
		{
			return false;
		}

		// If the video explorer is active, delegate to addVideoFrameToCollection
		if (tmpRemote.ActiveMode === 'video-explorer')
		{
			return this.addVideoFrameToCollection(tmpTargetGUID);
		}

		// If the audio explorer is active, delegate to addAudioSnippetToCollection
		if (tmpRemote.ActiveMode === 'audio-explorer')
		{
			return this.addAudioSnippetToCollection(tmpTargetGUID);
		}

		let tmpCurrentItem = this._resolveCurrentItem();

		if (!tmpCurrentItem || !tmpCurrentItem.Path)
		{
			return false;
		}

		let tmpFilePath = tmpCurrentItem.Path;

		// Check if the current item is a folder — prompt for folder vs contents
		if (tmpCurrentItem.Type === 'folder' || tmpCurrentItem.Type === 'archive')
		{
			let tmpSelf = this;
			this.showFolderChoicePrompt((pChoice) =>
			{
				let tmpFolderItem =
				{
					Type: (pChoice === 'contents') ? 'folder-contents' : 'folder',
					Path: tmpFilePath,
					Label: '',
					Note: ''
				};
				tmpSelf.addItemsToCollection(tmpTargetGUID, [tmpFolderItem]);
			});
			return true;
		}

		// Build the item — detect archive subfiles and video timestamp context
		let tmpItem =
		{
			Type: 'file',
			Path: tmpFilePath,
			Label: '',
			Note: ''
		};

		// Detect archive subfile — path contains an archive extension followed by /
		let tmpArchiveMatch = tmpFilePath.match(/^(.*?\.(zip|7z|rar|tar|tgz|cbz|cbr|tar\.gz|tar\.bz2|tar\.xz))\/(.*)/i);
		if (tmpArchiveMatch)
		{
			tmpItem.Type = 'subfile';
			tmpItem.ArchivePath = tmpArchiveMatch[1];
		}

		// If we're viewing a video with the player active, capture current timestamp as video-frame
		if (tmpRemote.ActiveMode === 'viewer' && tmpRemote.CurrentViewerMediaType === 'video' && !tmpRemote.VideoMenuActive)
		{
			let tmpVideo = document.getElementById('RetoldRemote-VideoPlayer');
			if (tmpVideo && !isNaN(tmpVideo.currentTime) && tmpVideo.currentTime > 0)
			{
				tmpItem.Type = 'video-frame';
				tmpItem.FrameTimestamp = Math.round(tmpVideo.currentTime * 100) / 100;
			}
		}

		// If we have a hash for this file, include it
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		if (tmpProvider)
		{
			let tmpHash = tmpProvider.getHashForPath(tmpFilePath);
			if (tmpHash)
			{
				tmpItem.Hash = tmpHash;
			}
		}

		this.addItemsToCollection(tmpTargetGUID, [tmpItem]);
		return true;
	}

	/**
	 * Add a video frame from the video explorer to a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @returns {boolean} true if the add was initiated
	 */
	addVideoFrameToCollection(pGUID)
	{
		let tmpRemote = this._getRemote();
		let tmpTargetGUID = pGUID || tmpRemote.LastUsedCollectionGUID;
		if (!tmpTargetGUID)
		{
			return false;
		}

		let tmpVEX = this.pict.views['RetoldRemote-VideoExplorer'];
		if (!tmpVEX || !tmpVEX._currentPath || !tmpVEX._frameData)
		{
			return false;
		}

		let tmpFrameIndex = tmpVEX._selectedFrameIndex;
		if (tmpFrameIndex < 0)
		{
			// No frame selected — use first frame
			tmpFrameIndex = 0;
		}

		let tmpFrame = tmpVEX._frameData.Frames[tmpFrameIndex];
		if (!tmpFrame)
		{
			return false;
		}

		let tmpFileName = tmpVEX._currentPath.replace(/^.*\//, '');
		let tmpTimestamp = tmpFrame.TimestampFormatted || this._formatTimestamp(tmpFrame.Timestamp);
		let tmpItem =
		{
			Type: 'video-frame',
			Path: tmpVEX._currentPath,
			FrameTimestamp: tmpFrame.Timestamp,
			FrameCacheKey: tmpVEX._frameData.CacheKey || null,
			FrameFilename: tmpFrame.Filename || null,
			Label: tmpFileName + ' @ ' + tmpTimestamp,
			Note: ''
		};

		this.addItemsToCollection(tmpTargetGUID, [tmpItem]);
		return true;
	}

	/**
	 * Add a video clip (time range) to a collection from the video player.
	 *
	 * Uses the current playback position and a duration offset, or explicit
	 * start/end timestamps.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {number} pStartTime - Start time in seconds
	 * @param {number} pEndTime - End time in seconds
	 * @returns {boolean} true if the add was initiated
	 */
	addVideoClipToCollection(pGUID, pStartTime, pEndTime)
	{
		let tmpRemote = this._getRemote();
		let tmpTargetGUID = pGUID || tmpRemote.LastUsedCollectionGUID;
		if (!tmpTargetGUID)
		{
			return false;
		}

		// Resolve file path: check video explorer first, then fall back to viewer file
		let tmpFilePath = null;
		if (tmpRemote.ActiveMode === 'video-explorer')
		{
			let tmpVEX = this.pict.views['RetoldRemote-VideoExplorer'];
			if (tmpVEX && tmpVEX._currentPath)
			{
				tmpFilePath = tmpVEX._currentPath;
			}
		}
		if (!tmpFilePath)
		{
			tmpFilePath = tmpRemote.CurrentViewerFile;
		}
		if (!tmpFilePath)
		{
			return false;
		}

		let tmpFileName = tmpFilePath.replace(/^.*\//, '');
		let tmpItem =
		{
			Type: 'video-clip',
			Path: tmpFilePath,
			VideoStart: pStartTime,
			VideoEnd: pEndTime,
			Label: tmpFileName + ': ' + this._formatTimestamp(pStartTime) + ' \u2013 ' + this._formatTimestamp(pEndTime),
			Note: ''
		};

		this.addItemsToCollection(tmpTargetGUID, [tmpItem]);
		return true;
	}

	/**
	 * Add an audio snippet (selected range) from the audio explorer.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @returns {boolean} true if the add was initiated
	 */
	addAudioSnippetToCollection(pGUID)
	{
		let tmpRemote = this._getRemote();
		let tmpTargetGUID = pGUID || tmpRemote.LastUsedCollectionGUID;
		if (!tmpTargetGUID)
		{
			return false;
		}

		let tmpAEX = this.pict.views['RetoldRemote-AudioExplorer'];
		if (!tmpAEX || !tmpAEX._currentPath || !tmpAEX._waveformData)
		{
			return false;
		}

		let tmpDuration = tmpAEX._waveformData.Duration || 0;
		if (tmpDuration <= 0)
		{
			return false;
		}

		// Convert normalized selection (0..1) to seconds
		let tmpStart = 0;
		let tmpEnd = tmpDuration;
		if (tmpAEX._selectionStart >= 0 && tmpAEX._selectionEnd >= 0)
		{
			tmpStart = Math.round(tmpAEX._selectionStart * tmpDuration * 100) / 100;
			tmpEnd = Math.round(tmpAEX._selectionEnd * tmpDuration * 100) / 100;
		}

		let tmpFileName = tmpAEX._currentPath.replace(/^.*\//, '');
		let tmpItem =
		{
			Type: 'audio-clip',
			Path: tmpAEX._currentPath,
			AudioStart: tmpStart,
			AudioEnd: tmpEnd,
			Label: tmpFileName + ': ' + this._formatTimestamp(tmpStart) + ' \u2013 ' + this._formatTimestamp(tmpEnd),
			Note: ''
		};

		this.addItemsToCollection(tmpTargetGUID, [tmpItem]);
		return true;
	}

	/**
	 * Add an audio clip with explicit start/end timestamps in seconds.
	 *
	 * Unlike addAudioSnippetToCollection (which reads normalized selection
	 * from the explorer view), this accepts absolute second values —
	 * used by the pending-clip-context mechanism when saving a segment
	 * triggers the collection picker dropdown.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {number} pStartTime - Start time in seconds
	 * @param {number} pEndTime - End time in seconds
	 * @returns {boolean} true if the add was initiated
	 */
	addAudioClipToCollection(pGUID, pStartTime, pEndTime)
	{
		let tmpRemote = this._getRemote();
		let tmpTargetGUID = pGUID || tmpRemote.LastUsedCollectionGUID;
		if (!tmpTargetGUID)
		{
			return false;
		}

		// Resolve file path: check audio explorer first, then fall back to viewer file
		let tmpFilePath = null;
		if (tmpRemote.ActiveMode === 'audio-explorer')
		{
			let tmpAEX = this.pict.views['RetoldRemote-AudioExplorer'];
			if (tmpAEX && tmpAEX._currentPath)
			{
				tmpFilePath = tmpAEX._currentPath;
			}
		}
		if (!tmpFilePath)
		{
			tmpFilePath = tmpRemote.CurrentViewerFile;
		}
		if (!tmpFilePath)
		{
			return false;
		}

		let tmpFileName = tmpFilePath.replace(/^.*\//, '');
		let tmpItem =
		{
			Type: 'audio-clip',
			Path: tmpFilePath,
			AudioStart: pStartTime,
			AudioEnd: pEndTime,
			Label: tmpFileName + ': ' + this._formatTimestamp(pStartTime) + ' \u2013 ' + this._formatTimestamp(pEndTime),
			Note: ''
		};

		this.addItemsToCollection(tmpTargetGUID, [tmpItem]);
		return true;
	}

	/**
	 * Format a timestamp in seconds to a human-readable string.
	 *
	 * @param {number} pSeconds - Timestamp in seconds
	 * @returns {string} Formatted string like "1:23" or "1:01:23"
	 */
	_formatTimestamp(pSeconds)
	{
		if (typeof pSeconds !== 'number' || isNaN(pSeconds))
		{
			return '0:00';
		}

		let tmpTotalSeconds = Math.floor(pSeconds);
		let tmpHours = Math.floor(tmpTotalSeconds / 3600);
		let tmpMinutes = Math.floor((tmpTotalSeconds % 3600) / 60);
		let tmpSecs = tmpTotalSeconds % 60;

		if (tmpHours > 0)
		{
			return tmpHours + ':' + (tmpMinutes < 10 ? '0' : '') + tmpMinutes + ':' + (tmpSecs < 10 ? '0' : '') + tmpSecs;
		}
		return tmpMinutes + ':' + (tmpSecs < 10 ? '0' : '') + tmpSecs;
	}

	/**
	 * Add the currently browsed folder to a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {string} pMode - "folder" (add folder reference) or "contents" (add folder contents wildcard)
	 */
	addCurrentFolderToCollection(pGUID, pMode)
	{
		let tmpRemote = this._getRemote();
		let tmpCurrentPath = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';

		if (!tmpCurrentPath || !pGUID)
		{
			return;
		}

		let tmpItem =
		{
			Type: (pMode === 'contents') ? 'folder-contents' : 'folder',
			Path: tmpCurrentPath,
			Label: '',
			Note: ''
		};

		this.addItemsToCollection(pGUID, [tmpItem]);
	}

	/**
	 * Show a small inline dropdown prompting the user to choose between
	 * adding a folder reference or the folder's contents.
	 *
	 * @param {Function} pCallback - Called with ('folder') or ('contents')
	 */
	showFolderChoicePrompt(pCallback)
	{
		let tmpSelf = this;

		// Remove any existing folder choice dropdown
		this.closeFolderChoicePrompt();

		// Anchor to the add-to-collection button (star) or favorites button (heart)
		let tmpAnchor = document.getElementById('RetoldRemote-TopBar-AddToCollectionBtn')
			|| document.getElementById('RetoldRemote-TopBar-FavoritesBtn');

		// Build the dropdown
		let tmpDropdown = document.createElement('div');
		tmpDropdown.className = 'retold-remote-addcoll-dropdown';
		tmpDropdown.id = 'RetoldRemote-FolderChoice-Dropdown';

		// Header
		let tmpHeader = document.createElement('div');
		tmpHeader.className = 'retold-remote-addcoll-dropdown-item';
		tmpHeader.style.fontWeight = '600';
		tmpHeader.style.cursor = 'default';
		tmpHeader.style.color = 'var(--retold-text-muted)';
		tmpHeader.style.fontSize = '0.75rem';
		tmpHeader.textContent = 'This is a folder:';
		tmpDropdown.appendChild(tmpHeader);

		// Option 1: Add folder reference
		let tmpFolderBtn = document.createElement('button');
		tmpFolderBtn.className = 'retold-remote-addcoll-dropdown-item';
		tmpFolderBtn.textContent = '\uD83D\uDCC1 Add Folder';
		tmpFolderBtn.onclick = function()
		{
			tmpSelf.closeFolderChoicePrompt();
			pCallback('folder');
		};
		tmpDropdown.appendChild(tmpFolderBtn);

		// Option 2: Add folder contents
		let tmpContentsBtn = document.createElement('button');
		tmpContentsBtn.className = 'retold-remote-addcoll-dropdown-item';
		tmpContentsBtn.textContent = '\uD83D\uDCC2 Add Folder Contents';
		tmpContentsBtn.onclick = function()
		{
			tmpSelf.closeFolderChoicePrompt();
			pCallback('contents');
		};
		tmpDropdown.appendChild(tmpContentsBtn);

		if (tmpAnchor)
		{
			tmpAnchor.style.position = 'relative';
			tmpAnchor.appendChild(tmpDropdown);
		}
		else
		{
			// Fallback: position fixed near top-right
			tmpDropdown.style.position = 'fixed';
			tmpDropdown.style.top = '50px';
			tmpDropdown.style.right = '20px';
			document.body.appendChild(tmpDropdown);
		}

		// Close on outside click (deferred so the current click doesn't immediately close it)
		setTimeout(function()
		{
			tmpSelf._boundCloseFolderChoice = function(pClickEvent)
			{
				if (!tmpDropdown.contains(pClickEvent.target) && pClickEvent.target !== tmpAnchor)
				{
					tmpSelf.closeFolderChoicePrompt();
				}
			};
			document.addEventListener('click', tmpSelf._boundCloseFolderChoice);

			// Close on Escape key
			tmpSelf._boundCloseFolderChoiceKey = function(pKeyEvent)
			{
				if (pKeyEvent.key === 'Escape')
				{
					tmpSelf.closeFolderChoicePrompt();
				}
			};
			document.addEventListener('keydown', tmpSelf._boundCloseFolderChoiceKey);
		}, 10);
	}

	/**
	 * Close the folder choice prompt dropdown.
	 */
	closeFolderChoicePrompt()
	{
		let tmpDropdown = document.getElementById('RetoldRemote-FolderChoice-Dropdown');
		if (tmpDropdown)
		{
			tmpDropdown.remove();
		}
		if (this._boundCloseFolderChoice)
		{
			document.removeEventListener('click', this._boundCloseFolderChoice);
			this._boundCloseFolderChoice = null;
		}
		if (this._boundCloseFolderChoiceKey)
		{
			document.removeEventListener('keydown', this._boundCloseFolderChoiceKey);
			this._boundCloseFolderChoiceKey = null;
		}
	}

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

	// -- Operation Plan Methods -------------------------------------------

	/**
	 * Create an operation-plan collection with pre-populated items.
	 *
	 * @param {string} pName - Plan name
	 * @param {Array} pItems - Items with Operation and DestinationPath set
	 * @param {Function} [fCallback] - Optional callback(pError, pCollection)
	 */
	createOperationPlan(pName, pItems, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};
		let tmpGUID = this.fable.getUUID();

		let tmpCollectionData =
		{
			Name: pName || 'Sort Plan',
			CollectionType: 'operation-plan',
			Items: pItems || []
		};

		fetch('/api/collections/' + encodeURIComponent(tmpGUID),
		{
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(tmpCollectionData)
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();

				// Open the panel and navigate to this collection
				tmpRemote.ActiveCollectionGUID = tmpGUID;
				tmpRemote.ActiveCollection = pData;
				tmpRemote.CollectionsPanelMode = 'detail';

				if (!tmpRemote.CollectionsPanelOpen)
				{
					tmpSelf.togglePanel();
				}
				else
				{
					let tmpPanel = tmpSelf._getPanelView();
					if (tmpPanel)
					{
						tmpPanel.renderContent();
					}
				}

				// Refresh the list
				tmpSelf.fetchCollections();

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Sort plan created: ' + (pData.Name || pName));
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to create operation plan: ' + pError.message);
				return tmpCallback(pError);
			});
	}

	/**
	 * Execute all pending operations in a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {Function} [fCallback] - Optional callback(pError, pResult)
	 */
	executeCollectionOperations(pGUID, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		fetch('/api/collections/' + encodeURIComponent(pGUID) + '/execute',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();

				if (pData.Collection && tmpRemote.ActiveCollectionGUID === pGUID)
				{
					tmpRemote.ActiveCollection = pData.Collection;
				}

				let tmpPanel = tmpSelf._getPanelView();
				if (tmpPanel)
				{
					tmpPanel.renderContent();
				}

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					if (pData.TotalFailed > 0)
					{
						tmpToast.showToast('Moved ' + pData.TotalMoved + ' files (' + pData.TotalFailed + ' failed)');
					}
					else
					{
						tmpToast.showToast('Successfully moved ' + pData.TotalMoved + ' files');
					}
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to execute operations: ' + pError.message);
				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Failed to execute operations: ' + pError.message);
				}
				return tmpCallback(pError);
			});
	}

	/**
	 * Undo the last batch of operations for a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {Function} [fCallback] - Optional callback(pError, pResult)
	 */
	undoCollectionOperations(pGUID, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};
		let tmpRemote = this._getRemote();

		let tmpCollection = tmpRemote.ActiveCollection;
		if (!tmpCollection || !tmpCollection.OperationBatchGUID)
		{
			let tmpToast = tmpSelf._getToast();
			if (tmpToast)
			{
				tmpToast.showToast('No batch to undo');
			}
			return tmpCallback(new Error('No batch to undo'));
		}

		fetch('/api/files/undo-batch',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ BatchGUID: tmpCollection.OperationBatchGUID })
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				// Reset operation statuses back to pending
				if (tmpCollection.Items)
				{
					for (let i = 0; i < tmpCollection.Items.length; i++)
					{
						if (tmpCollection.Items[i].OperationStatus === 'completed')
						{
							tmpCollection.Items[i].OperationStatus = 'pending';
						}
					}
				}
				tmpCollection.OperationBatchGUID = null;

				// Save updated collection
				tmpSelf.updateCollection(tmpCollection);

				let tmpPanel = tmpSelf._getPanelView();
				if (tmpPanel)
				{
					tmpPanel.renderContent();
				}

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Undo complete: ' + pData.TotalReversed + ' files restored');
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to undo operations: ' + pError.message);
				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Failed to undo: ' + pError.message);
				}
				return tmpCallback(pError);
			});
	}

	/**
	 * Update a single item's destination path in the active collection.
	 *
	 * @param {string} pItemID - Item ID
	 * @param {string} pNewDestPath - New destination path
	 */
	setItemDestination(pItemID, pNewDestPath)
	{
		let tmpRemote = this._getRemote();
		let tmpCollection = tmpRemote.ActiveCollection;

		if (!tmpCollection || !tmpCollection.Items)
		{
			return;
		}

		for (let i = 0; i < tmpCollection.Items.length; i++)
		{
			if (tmpCollection.Items[i].ID === pItemID)
			{
				tmpCollection.Items[i].DestinationPath = pNewDestPath;
				break;
			}
		}

		// Save to server in background
		this.updateCollection(tmpCollection);
	}

	/**
	 * Skip an item's operation (set status to 'skipped').
	 *
	 * @param {string} pItemID - Item ID
	 */
	skipItemOperation(pItemID)
	{
		let tmpRemote = this._getRemote();
		let tmpCollection = tmpRemote.ActiveCollection;

		if (!tmpCollection || !tmpCollection.Items)
		{
			return;
		}

		for (let i = 0; i < tmpCollection.Items.length; i++)
		{
			if (tmpCollection.Items[i].ID === pItemID)
			{
				tmpCollection.Items[i].OperationStatus = 'skipped';
				break;
			}
		}

		let tmpPanel = this._getPanelView();
		if (tmpPanel)
		{
			tmpPanel.renderContent();
		}

		// Save to server in background
		this.updateCollection(tmpCollection);
	}
}

CollectionManagerProvider.default_configuration = _DefaultProviderConfiguration;

module.exports = CollectionManagerProvider;
