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
			pEvent.preventDefault();
			{
				let tmpRemote = pGalleryNav.pict.AppData.RetoldRemote;
				let tmpCollMgr = pGalleryNav.pict.providers['RetoldRemote-CollectionManager'];
				if (tmpCollMgr)
				{
					if (tmpRemote.LastUsedCollectionGUID)
					{
						tmpCollMgr.addAudioSnippetToCollection(tmpRemote.LastUsedCollectionGUID);
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
	}
}

module.exports = handleAudioExplorerKey;
