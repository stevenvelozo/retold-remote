/**
 * Sidebar file list keyboard handler.
 *
 * @param {GalleryNavigationProvider} pGalleryNav - The provider instance
 * @param {KeyboardEvent} pEvent - The keyboard event
 */
function handleSidebarKey(pGalleryNav, pEvent)
{
	let tmpRows = document.querySelectorAll('#Pict-FileBrowser-DetailRows .pict-fb-detail-row');
	let tmpCount = tmpRows.length;

	if (tmpCount === 0)
	{
		// Nothing in the sidebar, bail back to gallery
		pGalleryNav._blurSidebar();
		return;
	}

	switch (pEvent.key)
	{
		case 'ArrowDown':
			pEvent.preventDefault();
			pGalleryNav._moveSidebarCursor(Math.min(pGalleryNav._sidebarCursorIndex + 1, tmpCount - 1));
			break;

		case 'ArrowUp':
			pEvent.preventDefault();
			pGalleryNav._moveSidebarCursor(Math.max(pGalleryNav._sidebarCursorIndex - 1, 0));
			break;

		case 'Home':
			pEvent.preventDefault();
			pGalleryNav._moveSidebarCursor(0);
			break;

		case 'End':
			pEvent.preventDefault();
			pGalleryNav._moveSidebarCursor(tmpCount - 1);
			break;

		case 'Enter':
			pEvent.preventDefault();
			{
				// Click the focused row to open it (folder or file)
				let tmpRow = tmpRows[pGalleryNav._sidebarCursorIndex];
				if (tmpRow)
				{
					// Fire the dblclick handler which opens folders / selects files
					let tmpDblClickHandler = tmpRow.getAttribute('ondblclick');
					if (tmpDblClickHandler)
					{
						new Function(tmpDblClickHandler).call(tmpRow);
					}
				}
			}
			break;

		case 'Escape':
			pEvent.preventDefault();
			pGalleryNav._blurSidebar();
			break;
	}
}

module.exports = handleSidebarKey;
