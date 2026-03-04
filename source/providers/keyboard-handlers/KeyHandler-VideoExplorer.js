/**
 * Video explorer mode keyboard handler.
 *
 * @param {GalleryNavigationProvider} pGalleryNav - The provider instance
 * @param {KeyboardEvent} pEvent - The keyboard event
 */
function handleVideoExplorerKey(pGalleryNav, pEvent)
{
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
	}
}

module.exports = handleVideoExplorerKey;
