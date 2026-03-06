/**
 * CollectionManager — Favorites Mixin
 *
 * Manages the Favorites collection: a special system collection
 * (CollectionType === 'favorites') that powers the heart toggle button.
 *
 * Mixed into CollectionManagerProvider.prototype via Object.assign().
 * All methods have access to this._getRemote(), this._getToast(), etc.
 *
 * @license MIT
 */

module.exports =
{
	// -- Favorites Methods ------------------------------------------------

	/**
	 * Ensure the favorites collection exists.
	 * If FavoritesGUID is set, loads it.  Otherwise searches existing
	 * collections for CollectionType === 'favorites'.  If not found,
	 * creates one with a well-known GUID.
	 *
	 * @param {Function} [fCallback] - Optional callback(pError)
	 */
	ensureFavoritesCollection: function ensureFavoritesCollection(fCallback)
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
	},

	/**
	 * Load the favorites collection and rebuild the path set.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {Function} [fCallback] - Optional callback(pError)
	 */
	_loadFavoritesCollection: function _loadFavoritesCollection(pGUID, fCallback)
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
	},

	/**
	 * Rebuild the FavoritesPathSet from a collection's Items array.
	 *
	 * @param {Object} pCollection - Collection object with Items array
	 */
	_rebuildFavoritesPathSet: function _rebuildFavoritesPathSet(pCollection)
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
	},

	/**
	 * Check if a file path is in favorites.
	 *
	 * @param {string} [pPath] - File path (defaults to resolved current file)
	 * @returns {boolean} True if favorited
	 */
	isFavorited: function isFavorited(pPath)
	{
		let tmpRemote = this._getRemote();
		let tmpFilePath = pPath || this._resolveCurrentFilePath();
		return !!(tmpRemote.FavoritesPathSet[tmpFilePath]);
	},

	/**
	 * Toggle a file in/out of favorites.
	 *
	 * @param {string} [pPath] - File path (defaults to resolved current file)
	 */
	toggleFavorite: function toggleFavorite(pPath)
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
	},

	/**
	 * Render the favorites pane if the favorites tab is active.
	 */
	_renderFavoritesPane: function _renderFavoritesPane()
	{
		let tmpLayoutView = this.pict.views['ContentEditor-Layout'];
		if (tmpLayoutView && typeof tmpLayoutView.renderFavoritesList === 'function')
		{
			tmpLayoutView.renderFavoritesList();
		}
	}
};
