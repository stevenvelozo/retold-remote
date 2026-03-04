/**
 * Gallery mode keyboard handler.
 *
 * @param {GalleryNavigationProvider} pGalleryNav - The provider instance
 * @param {KeyboardEvent} pEvent - The keyboard event
 */
function handleGalleryKey(pGalleryNav, pEvent)
{
	let tmpRemote = pGalleryNav.pict.AppData.RetoldRemote;
	let tmpItems = tmpRemote.GalleryItems || [];
	let tmpIndex = tmpRemote.GalleryCursorIndex || 0;

	switch (pEvent.key)
	{
		case 'ArrowRight':
			pEvent.preventDefault();
			pGalleryNav.moveCursor(Math.min(tmpIndex + 1, tmpItems.length - 1));
			break;

		case 'ArrowLeft':
			pEvent.preventDefault();
			pGalleryNav.moveCursor(Math.max(tmpIndex - 1, 0));
			break;

		case 'ArrowDown':
			pEvent.preventDefault();
			pGalleryNav.moveCursor(Math.min(tmpIndex + pGalleryNav._columnsPerRow, tmpItems.length - 1));
			break;

		case 'ArrowUp':
			pEvent.preventDefault();
			pGalleryNav.moveCursor(Math.max(tmpIndex - pGalleryNav._columnsPerRow, 0));
			break;

		case 'Enter':
			pEvent.preventDefault();
			pGalleryNav.openCurrent();
			break;

		case 'Escape':
			pEvent.preventDefault();
			pGalleryNav.navigateUp();
			break;

		case 'g':
			pEvent.preventDefault();
			pGalleryNav._toggleViewMode();
			break;

		case 'x':
			pEvent.preventDefault();
			pGalleryNav._clearAllFilters();
			break;

		case 'Home':
			pEvent.preventDefault();
			pGalleryNav.moveCursor(0);
			break;

		case 'End':
			pEvent.preventDefault();
			pGalleryNav.moveCursor(tmpItems.length - 1);
			break;

		case '1':
			pEvent.preventDefault();
			pGalleryNav.openCurrentAs('image');
			break;

		case '2':
			pEvent.preventDefault();
			pGalleryNav.openCurrentAs('video');
			break;

		case '3':
			pEvent.preventDefault();
			pGalleryNav.openCurrentAs('audio');
			break;

		case '4':
			pEvent.preventDefault();
			pGalleryNav.openCurrentAs('text');
			break;

		case 'f':
			pEvent.preventDefault();
			{
				// Ensure the filter bar is visible first
				pGalleryNav._showFilterBar();
				let tmpGalleryView = pGalleryNav.pict.views['RetoldRemote-Gallery'];
				if (tmpGalleryView)
				{
					tmpGalleryView.toggleFilterPanel();
				}
			}
			break;

		case 's':
			pEvent.preventDefault();
			{
				// Ensure the filter bar is visible first
				pGalleryNav._showFilterBar();
				setTimeout(() =>
				{
					let tmpSortSelect = document.getElementById('RetoldRemote-Gallery-Sort');
					if (tmpSortSelect)
					{
						tmpSortSelect.focus();
					}
				}, 50);
			}
			break;

		case 'c':
			pEvent.preventDefault();
			pGalleryNav._toggleSettingsPanel();
			break;

		case 'd':
			pEvent.preventDefault();
			pGalleryNav._toggleDistractionFree();
			break;

		case 'e':
			pEvent.preventDefault();
			{
				let tmpItem = tmpItems[tmpIndex];
				if (tmpItem && tmpItem.Type !== 'folder' && tmpItem.Type !== 'archive')
				{
					let tmpFilterSort = pGalleryNav.pict.providers['RetoldRemote-GalleryFilterSort'];
					let tmpCat = tmpFilterSort ? tmpFilterSort.getCategory(tmpItem.Extension) : '';
					if (tmpCat === 'video')
					{
						let tmpVEX = pGalleryNav.pict.views['RetoldRemote-VideoExplorer'];
						if (tmpVEX)
						{
							tmpVEX.showExplorer(tmpItem.Path);
						}
					}
				}
			}
			break;

	}
}

module.exports = handleGalleryKey;
