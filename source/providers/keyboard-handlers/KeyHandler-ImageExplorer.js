/**
 * Image explorer mode keyboard handler.
 *
 * @param {GalleryNavigationProvider} pGalleryNav - The provider instance
 * @param {KeyboardEvent} pEvent - The keyboard event
 */
function handleImageExplorerKey(pGalleryNav, pEvent)
{
	let tmpIEX = pGalleryNav.pict.views['RetoldRemote-ImageExplorer'];
	if (!tmpIEX)
	{
		return;
	}

	switch (pEvent.key)
	{
		case 'Escape':
			pEvent.preventDefault();
			tmpIEX.goBack();
			break;
		case '+':
		case '=':
			pEvent.preventDefault();
			tmpIEX.zoomIn();
			break;
		case '-':
		case '_':
			pEvent.preventDefault();
			tmpIEX.zoomOut();
			break;
		case '0':
			pEvent.preventDefault();
			tmpIEX.zoomHome();
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
						tmpCollMgr.addCurrentFileToCollection(tmpQuickGUID);
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

module.exports = handleImageExplorerKey;
