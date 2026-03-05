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
					tmpToast.show('Collection created: ' + (pData.Name || pName));
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
					tmpToast.show('Collection deleted');
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
					tmpToast.show('Added ' + pItems.length + ' item' + (pItems.length > 1 ? 's' : '') + ' to ' + tmpCollectionName);
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
					tmpToast.show('Copied ' + pItemIDs.length + ' item' + (pItemIDs.length > 1 ? 's' : ''));
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

	// -- Convenience Methods ----------------------------------------------

	/**
	 * Add the currently viewed file to a collection.
	 * If pGUID is not provided, uses the last-used collection.
	 *
	 * @param {string} [pGUID] - Collection GUID (omit for quick-add to last-used)
	 * @returns {boolean} true if the add was initiated
	 */
	addCurrentFileToCollection(pGUID)
	{
		let tmpRemote = this._getRemote();
		let tmpFilePath = this.pict.AppData.ContentEditor.CurrentFile;

		if (!tmpFilePath)
		{
			return false;
		}

		let tmpTargetGUID = pGUID || tmpRemote.LastUsedCollectionGUID;
		if (!tmpTargetGUID)
		{
			return false;
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

		let tmpItem =
		{
			Type: 'video-frame',
			Path: tmpVEX._currentPath,
			FrameTimestamp: tmpFrame.Timestamp,
			Label: tmpFrame.TimestampFormatted || '',
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

		let tmpFilePath = tmpRemote.CurrentViewerFile;
		if (!tmpFilePath)
		{
			return false;
		}

		let tmpItem =
		{
			Type: 'video-clip',
			Path: tmpFilePath,
			VideoStart: pStartTime,
			VideoEnd: pEndTime,
			Label: this._formatTimestamp(pStartTime) + ' - ' + this._formatTimestamp(pEndTime),
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

		let tmpItem =
		{
			Type: 'video-clip', // reuse video-clip type for audio time ranges
			Path: tmpAEX._currentPath,
			VideoStart: tmpStart,
			VideoEnd: tmpEnd,
			Label: this._formatTimestamp(tmpStart) + ' - ' + this._formatTimestamp(tmpEnd),
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
					tmpToast.show('Sort plan created: ' + (pData.Name || pName));
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
						tmpToast.show('Moved ' + pData.TotalMoved + ' files (' + pData.TotalFailed + ' failed)');
					}
					else
					{
						tmpToast.show('Successfully moved ' + pData.TotalMoved + ' files');
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
					tmpToast.show('Failed to execute operations: ' + pError.message);
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
				tmpToast.show('No batch to undo');
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
					tmpToast.show('Undo complete: ' + pData.TotalReversed + ' files restored');
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to undo operations: ' + pError.message);
				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.show('Failed to undo: ' + pError.message);
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
