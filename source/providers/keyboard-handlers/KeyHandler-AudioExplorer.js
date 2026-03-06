/**
 * Audio explorer mode keyboard handler.
 *
 * @param {GalleryNavigationProvider} pGalleryNav - The provider instance
 * @param {KeyboardEvent} pEvent - The keyboard event
 */
function handleAudioExplorerKey(pGalleryNav, pEvent)
{
	let tmpAEX = pGalleryNav.pict.views['RetoldRemote-AudioExplorer'];
	if (!tmpAEX)
	{
		return;
	}

	switch (pEvent.key)
	{
		case 'Escape':
			pEvent.preventDefault();
			if (tmpAEX._selectionStart >= 0)
			{
				tmpAEX.clearSelection();
			}
			else
			{
				tmpAEX.goBack();
			}
			break;
		case '+':
		case '=':
			pEvent.preventDefault();
			tmpAEX.zoomIn();
			break;
		case '-':
		case '_':
			pEvent.preventDefault();
			tmpAEX.zoomOut();
			break;
		case '0':
			pEvent.preventDefault();
			tmpAEX.zoomToFit();
			break;
		case 'z':
		case 'Z':
			pEvent.preventDefault();
			tmpAEX.zoomToSelection();
			break;
		case ' ':
			pEvent.preventDefault();
			tmpAEX.playSelection();
			break;

		case 'a':
		case 's':
			pEvent.preventDefault();
			{
				let tmpCollMgr = pGalleryNav.pict.providers['RetoldRemote-CollectionManager'];
				if (tmpCollMgr)
				{
					let tmpQuickGUID = tmpCollMgr.getQuickAddTargetGUID();
					if (tmpQuickGUID)
					{
						tmpCollMgr.addAudioSnippetToCollection(tmpQuickGUID);
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
	}
}

module.exports = handleAudioExplorerKey;
