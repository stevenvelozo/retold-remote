const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-SubimagesPanel",
	DefaultRenderable: "RetoldRemote-SubimagesPanel",
	DefaultDestinationAddress: "#RetoldRemote-Subimages-Container",
	AutoRender: false,

	CSS: ``
};

/**
 * Subimages Panel — sidebar tab showing labeled subimage regions
 * for the currently viewed image file.
 *
 * Regions are fetched from the SubimageService API and displayed
 * as a list with label, dimensions, and action buttons.
 */
class RetoldRemoteSubimagesPanelView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this._regions = [];
		this._currentPath = '';
	}

	/**
	 * Render the subimages panel for the current file.
	 */
	render()
	{
		let tmpContainer = document.getElementById('RetoldRemote-Subimages-Container');
		if (!tmpContainer)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpFilePath = tmpRemote.CurrentViewerFile;
		let tmpMediaType = tmpRemote.CurrentViewerMediaType;

		// Show for images and documents (EPUB, PDF, CBZ pages)
		if (!tmpFilePath)
		{
			tmpContainer.innerHTML = '<div style="padding:12px;color:var(--retold-text-dim);font-size:0.82rem;">View a file to see its regions.</div>';
			this._regions = [];
			this._currentPath = '';
			return;
		}

		// If the file changed, fetch regions
		if (tmpFilePath !== this._currentPath)
		{
			this._currentPath = tmpFilePath;
			this._fetchAndRender(tmpFilePath, tmpContainer);
			return;
		}

		// Re-render with cached regions (e.g. after add/delete)
		this._renderRegionList(tmpContainer);
	}

	/**
	 * Force a refresh from the server for the current file.
	 */
	refresh()
	{
		this._currentPath = '';
		this.render();
	}

	/**
	 * Fetch regions from the server and render.
	 *
	 * @param {string} pFilePath - Relative file path
	 * @param {HTMLElement} pContainer - The container to render into
	 */
	_fetchAndRender(pFilePath, pContainer)
	{
		let tmpSelf = this;
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(pFilePath) : encodeURIComponent(pFilePath);

		pContainer.innerHTML = '<div style="padding:12px;color:var(--retold-text-dim);font-size:0.82rem;">Loading\u2026</div>';

		fetch('/api/media/subimage-regions?path=' + tmpPathParam)
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				if (pResult && pResult.Success)
				{
					tmpSelf._regions = pResult.Regions || [];
				}
				else
				{
					tmpSelf._regions = [];
				}
				tmpSelf._renderRegionList(pContainer);
			})
			.catch(() =>
			{
				tmpSelf._regions = [];
				tmpSelf._renderRegionList(pContainer);
			});
	}

	/**
	 * Render the region list into the container.
	 *
	 * @param {HTMLElement} pContainer - The container element
	 */
	_renderRegionList(pContainer)
	{
		if (!pContainer)
		{
			pContainer = document.getElementById('RetoldRemote-Subimages-Container');
		}
		if (!pContainer)
		{
			return;
		}

		// Also sync the regions to the image explorer if it's open
		let tmpIEX = this.pict.views['RetoldRemote-ImageExplorer'];
		if (tmpIEX && tmpIEX._currentPath === this._currentPath)
		{
			tmpIEX._savedRegions = this._regions;
		}

		let tmpFmt = this.pict.providers['RetoldRemote-FormattingUtilities'];
		let tmpFileName = (this._currentPath || '').replace(/^.*\//, '');

		let tmpHTML = '<div class="retold-remote-subimages-panel">';

		// Header
		tmpHTML += '<div style="padding:8px 10px;font-size:0.78rem;color:var(--retold-text-dim);border-bottom:1px solid var(--retold-border);">';
		tmpHTML += tmpFmt.escapeHTML(tmpFileName);
		tmpHTML += ' &mdash; ' + this._regions.length + ' region' + (this._regions.length !== 1 ? 's' : '');
		tmpHTML += '</div>';

		if (this._regions.length === 0)
		{
			tmpHTML += '<div style="padding:16px 12px;color:var(--retold-text-dim);font-size:0.8rem;text-align:center;">';
			tmpHTML += 'No regions yet.<br>Use selection tools in the viewer to create regions.';
			tmpHTML += '</div>';
		}
		else
		{
			for (let i = 0; i < this._regions.length; i++)
			{
				let tmpRegion = this._regions[i];
				let tmpLabel = tmpRegion.Label || '(unlabeled)';
				let tmpIsText = (tmpRegion.Type === 'text-selection');

				// Build description based on region type
				let tmpDesc = '';
				if (tmpIsText)
				{
					let tmpPreview = (tmpRegion.SelectedText || '').substring(0, 60);
					if ((tmpRegion.SelectedText || '').length > 60) tmpPreview += '\u2026';
					tmpDesc = tmpPreview || '(no text)';
					if (tmpRegion.PageNumber)
					{
						tmpDesc = 'p.' + tmpRegion.PageNumber + ' \u2014 ' + tmpDesc;
					}
					else if (tmpRegion.ChapterTitle)
					{
						tmpDesc = tmpRegion.ChapterTitle;
					}
				}
				else
				{
					tmpDesc = (tmpRegion.Width || 0) + ' \u00d7 ' + (tmpRegion.Height || 0) + ' px';
					if (tmpRegion.PageNumber)
					{
						tmpDesc = 'p.' + tmpRegion.PageNumber + ' \u2014 ' + tmpDesc;
					}
					else if (tmpRegion.X !== null && tmpRegion.Y !== null)
					{
						tmpDesc += ' at ' + tmpRegion.X + ', ' + tmpRegion.Y;
					}
				}

				// Type icon
				let tmpTypeIcon = tmpIsText ? '\uD83D\uDCDD' : '\uD83D\uDD32';

				tmpHTML += '<div class="retold-remote-subimages-item" data-region-id="' + tmpRegion.ID + '">';

				// Region info
				tmpHTML += '<div class="retold-remote-subimages-item-info">';
				tmpHTML += '<div class="retold-remote-subimages-item-label">' + tmpTypeIcon + ' ' + tmpFmt.escapeHTML(tmpLabel) + '</div>';
				tmpHTML += '<div class="retold-remote-subimages-item-dims">' + tmpFmt.escapeHTML(tmpDesc) + '</div>';
				tmpHTML += '</div>';

				// Actions
				tmpHTML += '<div class="retold-remote-subimages-item-actions">';
				tmpHTML += '<button onclick="pict.views[\'RetoldRemote-SubimagesPanel\'].navigateToRegion(\'' + tmpRegion.ID + '\')" title="Navigate to region" style="font-size:0.7rem;padding:2px 6px;">&#128270;</button>';
				tmpHTML += '<button onclick="pict.views[\'RetoldRemote-SubimagesPanel\'].addRegionToCollection(\'' + tmpRegion.ID + '\')" title="Add to collection" style="font-size:0.7rem;padding:2px 6px;">&#10010;</button>';
				tmpHTML += '<button onclick="pict.views[\'RetoldRemote-SubimagesPanel\'].deleteRegion(\'' + tmpRegion.ID + '\')" title="Delete region" style="font-size:0.7rem;padding:2px 6px;">&#128465;</button>';
				tmpHTML += '</div>';

				tmpHTML += '</div>';
			}
		}

		tmpHTML += '</div>';
		pContainer.innerHTML = tmpHTML;
	}

	/**
	 * Navigate to a specific region — handles images, EPUB, and PDF.
	 *
	 * @param {string} pRegionID - The region ID
	 */
	navigateToRegion(pRegionID)
	{
		let tmpRegion = null;
		for (let i = 0; i < this._regions.length; i++)
		{
			if (this._regions[i].ID === pRegionID)
			{
				tmpRegion = this._regions[i];
				break;
			}
		}
		if (!tmpRegion)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpMediaViewer = this.pict.views['RetoldRemote-MediaViewer'];

		// EPUB: navigate to CFI location
		if (tmpRegion.CFI && tmpMediaViewer && tmpMediaViewer._activeRendition)
		{
			tmpMediaViewer._activeRendition.display(tmpRegion.CFI);
			return;
		}

		// PDF: navigate to page
		if (tmpRegion.PageNumber && tmpMediaViewer && typeof tmpMediaViewer._renderPdfPage === 'function')
		{
			tmpMediaViewer._renderPdfPage(tmpRegion.PageNumber);
			return;
		}

		// Image: use image explorer
		let tmpIEX = this.pict.views['RetoldRemote-ImageExplorer'];
		if (tmpRemote.ActiveMode === 'image-explorer' && tmpIEX)
		{
			tmpIEX.zoomToRegion(pRegionID);
		}
		else if (tmpIEX && this._currentPath)
		{
			tmpIEX.showExplorer(this._currentPath);
			setTimeout(() =>
			{
				tmpIEX.zoomToRegion(pRegionID);
			}, 800);
		}
	}

	/**
	 * Add a subimage region to the active collection.
	 *
	 * @param {string} pRegionID - The region ID to add
	 */
	addRegionToCollection(pRegionID)
	{
		let tmpRegion = null;
		for (let i = 0; i < this._regions.length; i++)
		{
			if (this._regions[i].ID === pRegionID)
			{
				tmpRegion = this._regions[i];
				break;
			}
		}

		if (!tmpRegion)
		{
			return;
		}

		let tmpCollMgr = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpCollMgr)
		{
			let tmpGUID = tmpCollMgr.getQuickAddTargetGUID();
			if (tmpGUID)
			{
				tmpCollMgr.addSubimageToCollection(tmpGUID, tmpRegion, this._currentPath);
			}
			else
			{
				let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
				if (tmpTopBar && typeof tmpTopBar.showAddToCollectionDropdown === 'function')
				{
					tmpTopBar.showAddToCollectionDropdown();
				}
			}
		}
	}

	/**
	 * Delete a subimage region.
	 *
	 * @param {string} pRegionID - The region ID to delete
	 */
	deleteRegion(pRegionID)
	{
		let tmpIEX = this.pict.views['RetoldRemote-ImageExplorer'];
		if (tmpIEX && tmpIEX._currentPath === this._currentPath)
		{
			// Delegate to the explorer which handles the API call and overlay removal
			tmpIEX.deleteRegion(pRegionID);
		}
		else
		{
			// Delete directly via API
			let tmpSelf = this;
			let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
			let tmpPathParam = tmpProvider ? tmpProvider._getPathParam(this._currentPath) : encodeURIComponent(this._currentPath);

			fetch('/api/media/subimage-regions/' + encodeURIComponent(pRegionID) + '?path=' + tmpPathParam,
			{
				method: 'DELETE'
			})
				.then((pResponse) => pResponse.json())
				.then((pResult) =>
				{
					if (pResult && pResult.Success)
					{
						tmpSelf._regions = pResult.Regions || [];
						tmpSelf._renderRegionList();

						let tmpToast = tmpSelf.pict.providers['RetoldRemote-ToastNotification'];
						if (tmpToast)
						{
							tmpToast.showToast('Region deleted');
						}
					}
				})
				.catch(() => {});
		}
	}
}

RetoldRemoteSubimagesPanelView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteSubimagesPanelView;
