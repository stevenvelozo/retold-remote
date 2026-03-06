/**
 * CollectionManager — Add Items Mixin
 *
 * Convenience methods for adding various media types to collections.
 * Handles context detection (video explorer, audio explorer, viewer,
 * gallery cursor) and builds the correct item objects.
 *
 * Mixed into CollectionManagerProvider.prototype via Object.assign().
 * All methods have access to this._getRemote(), this._getToast(), etc.
 *
 * @license MIT
 */

module.exports =
{
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
	addCurrentFileToCollection: function addCurrentFileToCollection(pGUID)
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
	},

	/**
	 * Add a video frame from the video explorer to a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @returns {boolean} true if the add was initiated
	 */
	addVideoFrameToCollection: function addVideoFrameToCollection(pGUID)
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
	},

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
	addVideoClipToCollection: function addVideoClipToCollection(pGUID, pStartTime, pEndTime)
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
	},

	/**
	 * Add an audio snippet (selected range) from the audio explorer.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @returns {boolean} true if the add was initiated
	 */
	addAudioSnippetToCollection: function addAudioSnippetToCollection(pGUID)
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
	},

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
	addAudioClipToCollection: function addAudioClipToCollection(pGUID, pStartTime, pEndTime)
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
	},

	/**
	 * Format a timestamp in seconds to a human-readable string.
	 *
	 * @param {number} pSeconds - Timestamp in seconds
	 * @returns {string} Formatted string like "1:23" or "1:01:23"
	 */
	_formatTimestamp: function _formatTimestamp(pSeconds)
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
	},

	/**
	 * Add the currently browsed folder to a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {string} pMode - "folder" (add folder reference) or "contents" (add folder contents wildcard)
	 */
	addCurrentFolderToCollection: function addCurrentFolderToCollection(pGUID, pMode)
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
	},

	/**
	 * Show a small inline dropdown prompting the user to choose between
	 * adding a folder reference or the folder's contents.
	 *
	 * @param {Function} pCallback - Called with ('folder') or ('contents')
	 */
	showFolderChoicePrompt: function showFolderChoicePrompt(pCallback)
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
	},

	/**
	 * Close the folder choice prompt dropdown.
	 */
	closeFolderChoicePrompt: function closeFolderChoicePrompt()
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
};
