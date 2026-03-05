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
				tmpVEX.goBack();
			}
			break;

		case 'a':
			pEvent.preventDefault();
			{
				let tmpCollMgr = pGalleryNav.pict.providers['RetoldRemote-CollectionManager'];
				if (tmpCollMgr)
				{
					if (tmpRemote.LastUsedCollectionGUID)
					{
						tmpCollMgr.addVideoFrameToCollection(tmpRemote.LastUsedCollectionGUID);
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

module.exports = handleVideoExplorerKey;
