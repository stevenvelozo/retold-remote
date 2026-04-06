/**
 * Viewer mode keyboard handler.
 *
 * @param {GalleryNavigationProvider} pGalleryNav - The provider instance
 * @param {KeyboardEvent} pEvent - The keyboard event
 */
function handleViewerKey(pGalleryNav, pEvent)
{
	let tmpRemote = pGalleryNav.pict.AppData.RetoldRemote;

	// Video action menu mode — intercept keys for menu options
	if (tmpRemote.VideoMenuActive && tmpRemote.CurrentViewerMediaType === 'video')
	{
		switch (pEvent.key)
		{
			case 'Escape':
				pEvent.preventDefault();
				pGalleryNav.closeViewer();
				return;

			case 'ArrowRight':
			case 'j':
				pEvent.preventDefault();
				pGalleryNav.nextFile();
				return;

			case 'ArrowLeft':
			case 'k':
				pEvent.preventDefault();
				pGalleryNav.prevFile();
				return;

			case 'e':
				pEvent.preventDefault();
				let tmpVEX = pGalleryNav.pict.views['RetoldRemote-VideoExplorer'];
				if (tmpVEX)
				{
					tmpVEX.showExplorer(tmpRemote.CurrentViewerFile);
				}
				return;

			case ' ':
			case 'Enter':
				pEvent.preventDefault();
				let tmpViewer = pGalleryNav.pict.views['RetoldRemote-MediaViewer'];
				if (tmpViewer)
				{
					tmpViewer.playVideo();
				}
				return;

			case 't':
				pEvent.preventDefault();
				let tmpMediaViewer = pGalleryNav.pict.views['RetoldRemote-MediaViewer'];
				if (tmpMediaViewer)
				{
					tmpMediaViewer.loadVideoMenuFrame();
				}
				return;

			case 'v':
				pEvent.preventDefault();
				pGalleryNav._streamWithVLC();
				return;

			case 'a':
				pEvent.preventDefault();
				{
					let tmpMenuCollMgr = pGalleryNav.pict.providers['RetoldRemote-CollectionManager'];
					if (tmpMenuCollMgr)
					{
						let tmpMenuQuickGUID = tmpMenuCollMgr.getQuickAddTargetGUID();
						if (tmpMenuQuickGUID)
						{
							tmpMenuCollMgr.addCurrentFileToCollection(tmpMenuQuickGUID);
						}
						else
						{
							let tmpMenuTopBar = pGalleryNav.pict.views['ContentEditor-TopBar'];
							if (tmpMenuTopBar && typeof tmpMenuTopBar.showAddToCollectionDropdown === 'function')
							{
								tmpMenuTopBar.showAddToCollectionDropdown();
							}
						}
					}
				}
				return;

			case 'b':
				pEvent.preventDefault();
				{
					let tmpMenuCollManager = pGalleryNav.pict.providers['RetoldRemote-CollectionManager'];
					if (tmpMenuCollManager)
					{
						tmpMenuCollManager.togglePanel();
					}
				}
				return;

			case 'h':
				pEvent.preventDefault();
				{
					let tmpMenuFavManager = pGalleryNav.pict.providers['RetoldRemote-CollectionManager'];
					if (tmpMenuFavManager)
					{
						tmpMenuFavManager.toggleFavorite();
					}
				}
				return;
		}
		return;
	}

	switch (pEvent.key)
	{
		case 'Escape':
			pEvent.preventDefault();
			pGalleryNav.closeViewer();
			break;

		case 'ArrowRight':
		case 'j':
			pEvent.preventDefault();
			pGalleryNav.nextFile();
			break;

		case 'ArrowLeft':
		case 'k':
			pEvent.preventDefault();
			pGalleryNav.prevFile();
			break;

		case 'f':
			pEvent.preventDefault();
			pGalleryNav._toggleDistractionFree();
			break;

		case 'i':
			pEvent.preventDefault();
			pGalleryNav._toggleFileInfo();
			break;

		case ' ':
			pEvent.preventDefault();
			pGalleryNav._togglePlayPause();
			break;

		case '+':
		case '=':
			pEvent.preventDefault();
			pGalleryNav._zoomIn();
			break;

		case '-':
			pEvent.preventDefault();
			pGalleryNav._zoomOut();
			break;

		case '0':
			pEvent.preventDefault();
			pGalleryNav._zoomReset();
			break;

		case 'z':
			pEvent.preventDefault();
			pGalleryNav._cycleFitMode();
			break;

		case 's':
			pEvent.preventDefault();
			{
				let tmpMediaViewer = pGalleryNav.pict.views['RetoldRemote-MediaViewer'];
				if (tmpMediaViewer)
				{
					let tmpViewerMediaType = tmpRemote.CurrentViewerMediaType;
					if (tmpViewerMediaType === 'document')
					{
						// Toggle region selection for EPUB or PDF
						if (typeof tmpMediaViewer.ebookToggleRegionSelect === 'function' && tmpMediaViewer._activeRendition)
						{
							tmpMediaViewer.ebookToggleRegionSelect();
						}
						else if (typeof tmpMediaViewer.pdfToggleRegionSelect === 'function' && tmpMediaViewer._pdfDocument)
						{
							tmpMediaViewer.pdfToggleRegionSelect();
						}
					}
				}
			}
			break;

		case 'Enter':
			pEvent.preventDefault();
			pGalleryNav._streamWithVLC();
			break;

		case 'v':
			pEvent.preventDefault();
			pGalleryNav._streamWithVLC();
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
						// Quick-add the currently viewed file
						tmpCollMgr.addCurrentFileToCollection(tmpQuickGUID);
					}
					else
					{
						// No active or last-used collection — open the picker
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

		case 'd':
			pEvent.preventDefault();
			pGalleryNav._toggleDistractionFree();
			break;

		case 'e':
			pEvent.preventDefault();
			{
				let tmpMediaType = tmpRemote.CurrentViewerMediaType;
				if (tmpMediaType === 'video')
				{
					let tmpVEX = pGalleryNav.pict.views['RetoldRemote-VideoExplorer'];
					if (tmpVEX)
					{
						tmpVEX.showExplorer(tmpRemote.CurrentViewerFile);
					}
				}
				else if (tmpMediaType === 'audio')
				{
					let tmpAEX = pGalleryNav.pict.views['RetoldRemote-AudioExplorer'];
					if (tmpAEX)
					{
						tmpAEX.showExplorer(tmpRemote.CurrentViewerFile);
					}
				}
				else if (tmpMediaType === 'image')
				{
					let tmpIEX = pGalleryNav.pict.views['RetoldRemote-ImageExplorer'];
					if (tmpIEX)
					{
						tmpIEX.showExplorer(tmpRemote.CurrentViewerFile);
					}
				}
			}
			break;

		case '1':
			pEvent.preventDefault();
			pGalleryNav.switchViewerType('image');
			break;

		case '2':
			pEvent.preventDefault();
			pGalleryNav.switchViewerType('video');
			break;

		case '3':
			pEvent.preventDefault();
			pGalleryNav.switchViewerType('audio');
			break;

		case '4':
			pEvent.preventDefault();
			pGalleryNav.switchViewerType('text');
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

module.exports = handleViewerKey;
