/**
 * Video explorer mode keyboard handler.
 *
 * @param {GalleryNavigationProvider} pGalleryNav - The provider instance
 * @param {KeyboardEvent} pEvent - The keyboard event
 */
function handleVideoExplorerKey(pGalleryNav, pEvent)
{
	let tmpRemote = pGalleryNav.pict.AppData.RetoldRemote;

	switch (pEvent.key)
	{
		case 'Escape':
			pEvent.preventDefault();
			let tmpVEX = pGalleryNav.pict.views['RetoldRemote-VideoExplorer'];
			if (tmpVEX)
			{
				// If a frame preview overlay is open, close it instead of leaving the explorer
				if (tmpVEX._previewKeyHandler)
				{
					tmpVEX.closeFramePreview();
				}
				else
				{
					tmpVEX.goBack();
				}
			}
			break;

		case 'a':
			pEvent.preventDefault();
			{
				let tmpCollMgr = pGalleryNav.pict.providers['RetoldRemote-CollectionManager'];
				if (tmpCollMgr)
				{
					let tmpQuickGUID = tmpCollMgr.getQuickAddTargetGUID();
					if (tmpQuickGUID)
					{
						tmpCollMgr.addVideoFrameToCollection(tmpQuickGUID);
					}
					else
					{
						let tmpTopBar = pGalleryNav.pict.views['ContentEditor-TopBar'];
						if (tmpTopBar && typeof tmpTopBar.showAddToCollectionDropdown === 'function')
						{
							tmpTopBar.showAddToCollectionDropdown();
						}
					}
				}
			}
			break;

		case 's':
			pEvent.preventDefault();
			{
				// Add the selected time range (subsection) to a collection
				let tmpSelVEX = pGalleryNav.pict.views['RetoldRemote-VideoExplorer'];
				if (!tmpSelVEX || tmpSelVEX._selectionStartTime < 0 || tmpSelVEX._selectionEndTime < 0)
				{
					// No selection active \u2014 do nothing
					break;
				}
				let tmpSelCollMgr = pGalleryNav.pict.providers['RetoldRemote-CollectionManager'];
				if (tmpSelCollMgr)
				{
					let tmpStart = Math.min(tmpSelVEX._selectionStartTime, tmpSelVEX._selectionEndTime);
					let tmpEnd = Math.max(tmpSelVEX._selectionStartTime, tmpSelVEX._selectionEndTime);
					let tmpSelQuickGUID = tmpSelCollMgr.getQuickAddTargetGUID();
					if (tmpSelQuickGUID)
					{
						tmpSelCollMgr.addVideoClipToCollection(tmpSelQuickGUID, tmpStart, tmpEnd);
					}
					else
					{
						let tmpSelTopBar = pGalleryNav.pict.views['ContentEditor-TopBar'];
						if (tmpSelTopBar && typeof tmpSelTopBar.showAddToCollectionDropdown === 'function')
						{
							tmpSelTopBar.showAddToCollectionDropdown();
						}
					}
				}
			}
			break;

		case '[':
			pEvent.preventDefault();
			{
				// Set selection start marker at currently selected frame's timestamp
				let tmpStartVEX = pGalleryNav.pict.views['RetoldRemote-VideoExplorer'];
				if (tmpStartVEX && tmpStartVEX._frameData && tmpStartVEX._frameData.Frames
					&& tmpStartVEX._selectedFrameIndex >= 0
					&& tmpStartVEX._frameData.Frames[tmpStartVEX._selectedFrameIndex])
				{
					let tmpTimestamp = tmpStartVEX._frameData.Frames[tmpStartVEX._selectedFrameIndex].Timestamp;
					tmpStartVEX.setSelectionStart(tmpTimestamp);
				}
			}
			break;

		case ']':
			pEvent.preventDefault();
			{
				// Set selection end marker at currently selected frame's timestamp
				let tmpEndVEX = pGalleryNav.pict.views['RetoldRemote-VideoExplorer'];
				if (tmpEndVEX && tmpEndVEX._frameData && tmpEndVEX._frameData.Frames
					&& tmpEndVEX._selectedFrameIndex >= 0
					&& tmpEndVEX._frameData.Frames[tmpEndVEX._selectedFrameIndex])
				{
					let tmpTimestamp = tmpEndVEX._frameData.Frames[tmpEndVEX._selectedFrameIndex].Timestamp;
					tmpEndVEX.setSelectionEnd(tmpTimestamp);
				}
			}
			break;

		case 'b':
			pEvent.preventDefault();
			{
				let tmpCollManager = pGalleryNav.pict.providers['RetoldRemote-CollectionManager'];
				if (tmpCollManager)
				{
					tmpCollManager.togglePanel();
				}
			}
			break;

		case 'h':
			pEvent.preventDefault();
			{
				let tmpFavCollManager = pGalleryNav.pict.providers['RetoldRemote-CollectionManager'];
				if (tmpFavCollManager)
				{
					tmpFavCollManager.toggleFavorite();
				}
			}
			break;

		case 'v':
			pEvent.preventDefault();
			pGalleryNav._streamWithVLC();
			break;

		case ' ':
			pEvent.preventDefault();
			{
				let tmpPlayVEX = pGalleryNav.pict.views['RetoldRemote-VideoExplorer'];
				if (tmpPlayVEX)
				{
					tmpPlayVEX.playInBrowser();
				}
			}
			break;
	}
}

module.exports = handleVideoExplorerKey;
