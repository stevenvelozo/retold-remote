/**
 * Retold Remote -- Collections Panel View
 *
 * Right-side flyout panel for managing user-defined collections.
 * Mirrors the left sidebar architecture: flex child inside
 * .content-editor-body, with collapse/expand, resize handle,
 * and mobile responsive bottom-drawer mode.
 *
 * Three modes:
 *   list   — browseable list of all collections
 *   detail — items inside a selected collection
 *   edit   — metadata editing for a collection
 *
 * @license MIT
 */
const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-CollectionsPanel",
	DefaultRenderable: "RetoldRemote-CollectionsPanel",
	DefaultDestinationAddress: "#RetoldRemote-Collections-Container",
	AutoRender: false,

	CSS: ``,

	Templates:
	[
		{
			Hash: "RetoldRemote-CollectionsPanel",
			Template: /*html*/`<div class="retold-remote-collections-panel" id="RetoldRemote-CollectionsPanel-Root"></div>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: "RetoldRemote-CollectionsPanel",
			TemplateHash: "RetoldRemote-CollectionsPanel",
			DestinationAddress: "#RetoldRemote-Collections-Container"
		}
	]
};

class RetoldRemoteCollectionsPanelView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._draggedItemId = null;
	}

	onAfterRender()
	{
		super.onAfterRender();
		this.renderContent();
	}

	/**
	 * Main render dispatch — renders the appropriate mode content
	 * into the panel root.
	 */
	renderContent()
	{
		let tmpRoot = document.getElementById('RetoldRemote-CollectionsPanel-Root');
		if (!tmpRoot)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;

		switch (tmpRemote.CollectionsPanelMode)
		{
			case 'detail':
				this._renderDetailMode(tmpRoot);
				break;
			case 'edit':
				this._renderEditMode(tmpRoot);
				break;
			case 'list':
			default:
				this._renderListMode(tmpRoot);
				break;
		}
	}

	// -- List Mode --------------------------------------------------------

	_renderListMode(pRoot)
	{
		let tmpSelf = this;
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];

		pRoot.innerHTML = '';

		// Header
		let tmpHeader = document.createElement('div');
		tmpHeader.className = 'retold-remote-collections-header';

		let tmpTitle = document.createElement('div');
		tmpTitle.className = 'retold-remote-collections-header-title';
		tmpTitle.textContent = 'Collections';

		let tmpNewBtn = document.createElement('button');
		tmpNewBtn.className = 'retold-remote-collections-header-btn';
		tmpNewBtn.title = 'New Collection';
		tmpNewBtn.textContent = '+';
		tmpNewBtn.onclick = () =>
		{
			let tmpName = prompt('Collection name:');
			if (tmpName && tmpName.trim())
			{
				tmpManager.createCollection(tmpName.trim(), (pError, pCollection) =>
				{
					if (!pError && pCollection)
					{
						// Open the newly created collection
						tmpRemote.CollectionsPanelMode = 'detail';
						tmpManager.fetchCollection(pCollection.GUID);
					}
				});
			}
		};

		tmpHeader.appendChild(tmpTitle);
		tmpHeader.appendChild(tmpNewBtn);
		pRoot.appendChild(tmpHeader);

		// Search
		let tmpSearchWrap = document.createElement('div');
		tmpSearchWrap.className = 'retold-remote-collections-search';

		let tmpSearchInput = document.createElement('input');
		tmpSearchInput.type = 'text';
		tmpSearchInput.placeholder = 'Search collections...';
		tmpSearchInput.value = tmpRemote.CollectionSearchQuery || '';
		tmpSearchInput.oninput = (pEvent) =>
		{
			tmpRemote.CollectionSearchQuery = pEvent.target.value;
			tmpSelf._renderCollectionCards(pRoot.querySelector('.retold-remote-collections-body'));
		};

		tmpSearchWrap.appendChild(tmpSearchInput);
		pRoot.appendChild(tmpSearchWrap);

		// Body (scrollable list)
		let tmpBody = document.createElement('div');
		tmpBody.className = 'retold-remote-collections-body';
		pRoot.appendChild(tmpBody);

		this._renderCollectionCards(tmpBody);
	}

	_renderCollectionCards(pBody)
	{
		if (!pBody)
		{
			return;
		}

		let tmpSelf = this;
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];

		pBody.innerHTML = '';

		let tmpCollections = tmpManager.searchCollections(tmpRemote.CollectionSearchQuery);

		if (!tmpCollections || tmpCollections.length === 0)
		{
			let tmpEmpty = document.createElement('div');
			tmpEmpty.className = 'retold-remote-collections-empty';
			tmpEmpty.textContent = tmpRemote.CollectionSearchQuery ? 'No collections match your search.' : 'No collections yet. Click + to create one.';
			pBody.appendChild(tmpEmpty);
			return;
		}

		for (let i = 0; i < tmpCollections.length; i++)
		{
			let tmpCollection = tmpCollections[i];

			let tmpCard = document.createElement('div');
			tmpCard.className = 'retold-remote-collection-card';
			tmpCard.onclick = () =>
			{
				tmpRemote.CollectionsPanelMode = 'detail';
				tmpManager.fetchCollection(tmpCollection.GUID);
			};

			// Icon
			let tmpIconDiv = document.createElement('div');
			tmpIconDiv.className = 'retold-remote-collection-card-icon';
			if (tmpIconProvider && typeof tmpIconProvider.getIcon === 'function')
			{
				tmpIconDiv.innerHTML = tmpIconProvider.getIcon('bookmark', 18);
			}
			else
			{
				tmpIconDiv.textContent = '\u2630';
			}

			// Info
			let tmpInfoDiv = document.createElement('div');
			tmpInfoDiv.className = 'retold-remote-collection-card-info';

			let tmpNameDiv = document.createElement('div');
			tmpNameDiv.className = 'retold-remote-collection-card-name';
			tmpNameDiv.textContent = tmpCollection.Name || 'Untitled';

			let tmpMetaDiv = document.createElement('div');
			tmpMetaDiv.className = 'retold-remote-collection-card-meta';
			tmpMetaDiv.textContent = tmpCollection.ItemCount + ' item' + (tmpCollection.ItemCount !== 1 ? 's' : '');

			tmpInfoDiv.appendChild(tmpNameDiv);
			tmpInfoDiv.appendChild(tmpMetaDiv);

			tmpCard.appendChild(tmpIconDiv);
			tmpCard.appendChild(tmpInfoDiv);
			pBody.appendChild(tmpCard);
		}
	}

	// -- Detail Mode ------------------------------------------------------

	_renderDetailMode(pRoot)
	{
		let tmpSelf = this;
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		let tmpCollection = tmpRemote.ActiveCollection;

		pRoot.innerHTML = '';

		if (!tmpCollection)
		{
			pRoot.innerHTML = '<div class="retold-remote-collections-empty">Loading...</div>';
			return;
		}

		// Header with back button and collection name
		let tmpHeader = document.createElement('div');
		tmpHeader.className = 'retold-remote-collections-header';

		let tmpBackBtn = document.createElement('button');
		tmpBackBtn.className = 'retold-remote-collections-header-btn';
		tmpBackBtn.title = 'Back to list';
		tmpBackBtn.textContent = '\u2190';
		tmpBackBtn.onclick = () =>
		{
			tmpRemote.CollectionsPanelMode = 'list';
			tmpRemote.ActiveCollectionGUID = null;
			tmpRemote.ActiveCollection = null;
			tmpSelf.renderContent();
		};

		let tmpTitle = document.createElement('div');
		tmpTitle.className = 'retold-remote-collections-header-title';
		tmpTitle.textContent = tmpCollection.Name || 'Untitled';

		let tmpEditBtn = document.createElement('button');
		tmpEditBtn.className = 'retold-remote-collections-header-btn';
		tmpEditBtn.title = 'Edit collection';
		tmpEditBtn.textContent = '\u270E';
		tmpEditBtn.onclick = () =>
		{
			tmpRemote.CollectionsPanelMode = 'edit';
			tmpSelf.renderContent();
		};

		tmpHeader.appendChild(tmpBackBtn);
		tmpHeader.appendChild(tmpTitle);
		tmpHeader.appendChild(tmpEditBtn);
		pRoot.appendChild(tmpHeader);

		// Check if this is an operation-plan collection
		let tmpIsOperationPlan = (tmpCollection.CollectionType === 'operation-plan');

		if (tmpIsOperationPlan)
		{
			// Operation plan controls: summary + execute/undo buttons
			let tmpOpControls = document.createElement('div');
			tmpOpControls.className = 'retold-remote-collections-detail-controls retold-remote-collections-op-controls';

			// Count pending, completed, failed, skipped
			let tmpItems = tmpCollection.Items || [];
			let tmpPending = 0;
			let tmpCompleted = 0;
			let tmpFailed = 0;
			let tmpSkipped = 0;
			for (let i = 0; i < tmpItems.length; i++)
			{
				let tmpStatus = tmpItems[i].OperationStatus;
				if (tmpStatus === 'completed') tmpCompleted++;
				else if (tmpStatus === 'failed') tmpFailed++;
				else if (tmpStatus === 'skipped') tmpSkipped++;
				else if (tmpItems[i].Operation) tmpPending++;
			}

			let tmpSummary = document.createElement('div');
			tmpSummary.className = 'retold-remote-collections-op-summary';
			let tmpSummaryParts = [];
			if (tmpPending > 0) tmpSummaryParts.push(tmpPending + ' pending');
			if (tmpCompleted > 0) tmpSummaryParts.push(tmpCompleted + ' done');
			if (tmpFailed > 0) tmpSummaryParts.push(tmpFailed + ' failed');
			if (tmpSkipped > 0) tmpSummaryParts.push(tmpSkipped + ' skipped');
			tmpSummary.textContent = tmpSummaryParts.join(' \u00b7 ') || 'No operations';
			tmpOpControls.appendChild(tmpSummary);

			let tmpBtnRow = document.createElement('div');
			tmpBtnRow.className = 'retold-remote-collections-op-buttons';

			if (tmpPending > 0)
			{
				let tmpExecBtn = document.createElement('button');
				tmpExecBtn.className = 'retold-remote-collections-op-execute-btn';
				tmpExecBtn.textContent = 'Execute ' + tmpPending + ' Move' + (tmpPending > 1 ? 's' : '');
				tmpExecBtn.onclick = () =>
				{
					tmpExecBtn.disabled = true;
					tmpExecBtn.textContent = 'Moving...';
					tmpManager.executeCollectionOperations(tmpCollection.GUID);
				};
				tmpBtnRow.appendChild(tmpExecBtn);
			}

			if (tmpCollection.OperationBatchGUID && tmpCompleted > 0)
			{
				let tmpUndoBtn = document.createElement('button');
				tmpUndoBtn.className = 'retold-remote-collections-op-undo-btn';
				tmpUndoBtn.textContent = 'Undo';
				tmpUndoBtn.onclick = () =>
				{
					tmpUndoBtn.disabled = true;
					tmpUndoBtn.textContent = 'Undoing...';
					tmpManager.undoCollectionOperations(tmpCollection.GUID);
				};
				tmpBtnRow.appendChild(tmpUndoBtn);
			}

			tmpOpControls.appendChild(tmpBtnRow);
			pRoot.appendChild(tmpOpControls);
		}
		else
		{
			// Standard sort controls for bookmark collections
			let tmpControls = document.createElement('div');
			tmpControls.className = 'retold-remote-collections-detail-controls';

			let tmpSortSelect = document.createElement('select');
			tmpSortSelect.className = 'retold-remote-collections-sort-select';

			let tmpSortOptions = [
				{ value: 'manual', label: 'Manual' },
				{ value: 'name', label: 'Name' },
				{ value: 'modified', label: 'Date Added' },
				{ value: 'type', label: 'Type' }
			];

			for (let i = 0; i < tmpSortOptions.length; i++)
			{
				let tmpOpt = document.createElement('option');
				tmpOpt.value = tmpSortOptions[i].value;
				tmpOpt.textContent = tmpSortOptions[i].label;
				if (tmpCollection.SortMode === tmpSortOptions[i].value)
				{
					tmpOpt.selected = true;
				}
				tmpSortSelect.appendChild(tmpOpt);
			}

			tmpSortSelect.onchange = (pEvent) =>
			{
				tmpManager.sortActiveCollection(pEvent.target.value, null);
			};

			let tmpDirBtn = document.createElement('button');
			tmpDirBtn.className = 'retold-remote-collections-sort-dir';
			tmpDirBtn.textContent = tmpCollection.SortDirection === 'desc' ? '\u2193' : '\u2191';
			tmpDirBtn.title = tmpCollection.SortDirection === 'desc' ? 'Descending' : 'Ascending';
			tmpDirBtn.onclick = () =>
			{
				let tmpNewDir = (tmpRemote.ActiveCollection.SortDirection === 'desc') ? 'asc' : 'desc';
				tmpManager.sortActiveCollection(null, tmpNewDir);
			};

			let tmpExportBtn = document.createElement('button');
			tmpExportBtn.className = 'retold-remote-collections-export-btn';
			tmpExportBtn.textContent = '\u21e9 Export';
			tmpExportBtn.title = 'Export collection to a folder';
			tmpExportBtn.onclick = () =>
			{
				tmpSelf._showExportDialog(tmpCollection.GUID, tmpCollection.Name);
			};

			tmpControls.appendChild(tmpSortSelect);
			tmpControls.appendChild(tmpDirBtn);
			tmpControls.appendChild(tmpExportBtn);
			pRoot.appendChild(tmpControls);
		}

		// Item list
		let tmpBody = document.createElement('div');
		tmpBody.className = 'retold-remote-collections-body';
		pRoot.appendChild(tmpBody);

		if (tmpIsOperationPlan)
		{
			this._renderOperationItemList(tmpBody, tmpCollection);
		}
		else
		{
			this._renderItemList(tmpBody, tmpCollection);
		}
	}

	_renderItemList(pBody, pCollection)
	{
		let tmpSelf = this;
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		let tmpItems = pCollection.Items || [];

		pBody.innerHTML = '';

		if (tmpItems.length === 0)
		{
			let tmpEmpty = document.createElement('div');
			tmpEmpty.className = 'retold-remote-collections-empty';
			tmpEmpty.textContent = 'No items yet. Browse files and add them to this collection.';
			pBody.appendChild(tmpEmpty);
			return;
		}

		for (let i = 0; i < tmpItems.length; i++)
		{
			let tmpItem = tmpItems[i];
			let tmpRow = document.createElement('div');
			tmpRow.className = 'retold-remote-collection-item';
			tmpRow.setAttribute('data-item-id', tmpItem.ID);

			// Drag handle (for manual sort)
			if (pCollection.SortMode === 'manual')
			{
				let tmpDrag = document.createElement('div');
				tmpDrag.className = 'retold-remote-collection-item-drag';
				tmpDrag.textContent = '\u2630';
				tmpDrag.draggable = true;

				tmpDrag.ondragstart = (pEvent) =>
				{
					tmpSelf._draggedItemId = tmpItem.ID;
					tmpRow.classList.add('dragging');
					pEvent.dataTransfer.effectAllowed = 'move';
				};

				tmpDrag.ondragend = () =>
				{
					tmpRow.classList.remove('dragging');
					tmpSelf._draggedItemId = null;
					// Remove all drag-over classes
					let tmpAllItems = pBody.querySelectorAll('.retold-remote-collection-item');
					for (let j = 0; j < tmpAllItems.length; j++)
					{
						tmpAllItems[j].classList.remove('drag-over');
					}
				};

				tmpRow.appendChild(tmpDrag);
			}

			// Drop target events
			tmpRow.ondragover = (pEvent) =>
			{
				pEvent.preventDefault();
				pEvent.dataTransfer.dropEffect = 'move';
				tmpRow.classList.add('drag-over');
			};
			tmpRow.ondragleave = () =>
			{
				tmpRow.classList.remove('drag-over');
			};
			tmpRow.ondrop = (pEvent) =>
			{
				pEvent.preventDefault();
				tmpRow.classList.remove('drag-over');

				if (tmpSelf._draggedItemId && tmpSelf._draggedItemId !== tmpItem.ID)
				{
					// Build new order: move dragged item before this item
					let tmpCurrentItems = pCollection.Items || [];
					let tmpNewOrder = [];
					for (let j = 0; j < tmpCurrentItems.length; j++)
					{
						if (tmpCurrentItems[j].ID === tmpSelf._draggedItemId)
						{
							continue;
						}
						if (tmpCurrentItems[j].ID === tmpItem.ID)
						{
							tmpNewOrder.push(tmpSelf._draggedItemId);
						}
						tmpNewOrder.push(tmpCurrentItems[j].ID);
					}
					tmpManager.reorderItems(pCollection.GUID, tmpNewOrder);
				}
			};

			// Item icon/thumbnail
			let tmpIconDiv = document.createElement('div');
			tmpIconDiv.className = 'retold-remote-collection-item-icon';

			let tmpPath = tmpItem.Path || '';
			let tmpExt = tmpPath.replace(/^.*\./, '').toLowerCase();
			let tmpMediaType = this.pict.PictApplication._getMediaType(tmpExt);

			if (tmpItem.Type === 'video-frame' && tmpItem.FrameCacheKey && tmpItem.FrameFilename)
			{
				// Show the actual video frame thumbnail
				let tmpImg = document.createElement('img');
				tmpImg.src = '/api/media/video-frame/' + encodeURIComponent(tmpItem.FrameCacheKey) + '/' + encodeURIComponent(tmpItem.FrameFilename);
				tmpImg.alt = '';
				tmpImg.loading = 'lazy';
				tmpIconDiv.appendChild(tmpImg);
			}
			else if (tmpItem.Type === 'image-crop' && tmpItem.CropRegion)
			{
				// Show the source image thumbnail for crop items
				let tmpImg = document.createElement('img');
				let tmpMediaProvider = this.pict.providers['RetoldRemote-Provider'];
				if (tmpMediaProvider)
				{
					tmpImg.src = tmpMediaProvider.getThumbnailURL(tmpPath, 48, 48);
				}
				tmpImg.alt = '';
				tmpImg.loading = 'lazy';
				tmpIconDiv.appendChild(tmpImg);
			}
			else if (tmpMediaType === 'image' && tmpItem.Type === 'file')
			{
				let tmpImg = document.createElement('img');
				let tmpMediaProvider = this.pict.providers['RetoldRemote-Provider'];
				if (tmpMediaProvider)
				{
					tmpImg.src = tmpMediaProvider.getThumbnailURL(tmpPath, 48, 48);
				}
				tmpImg.alt = '';
				tmpImg.loading = 'lazy';
				tmpIconDiv.appendChild(tmpImg);
			}
			else
			{
				tmpIconDiv.textContent = this._getTypeIcon(tmpItem.Type, tmpMediaType);
			}

			// Item name
			let tmpNameDiv = document.createElement('div');
			tmpNameDiv.className = 'retold-remote-collection-item-name';
			tmpNameDiv.textContent = tmpItem.Label || tmpPath.split('/').pop() || tmpPath;
			tmpNameDiv.title = tmpPath;

			// Type badge
			let tmpTypeDiv = document.createElement('div');
			tmpTypeDiv.className = 'retold-remote-collection-item-type';
			tmpTypeDiv.textContent = tmpItem.Type || 'file';

			// Remove button
			let tmpRemoveBtn = document.createElement('button');
			tmpRemoveBtn.className = 'retold-remote-collection-item-remove';
			tmpRemoveBtn.title = 'Remove from collection';
			tmpRemoveBtn.textContent = '\u00d7';
			tmpRemoveBtn.onclick = (pEvent) =>
			{
				pEvent.stopPropagation();
				tmpManager.removeItemFromCollection(pCollection.GUID, tmpItem.ID);
			};

			// Click to navigate — use the centralized collection-item router
			let tmpItemIndex = i;
			tmpRow.onclick = () =>
			{
				if (tmpItem.Type === 'folder' || tmpItem.Type === 'folder-contents')
				{
					tmpSelf.pict.PictApplication.loadFileList(tmpItem.Path);
				}
				else
				{
					let tmpNav = tmpSelf.pict.providers['RetoldRemote-GalleryNavigation'];
					if (tmpNav)
					{
						tmpNav._navigateToCollectionItem(tmpItem, tmpItemIndex);
					}
				}
			};

			tmpRow.appendChild(tmpIconDiv);
			tmpRow.appendChild(tmpNameDiv);
			tmpRow.appendChild(tmpTypeDiv);
			tmpRow.appendChild(tmpRemoveBtn);
			pBody.appendChild(tmpRow);
		}
	}

	// -- Operation Plan Item Rendering ------------------------------------

	_renderOperationItemList(pBody, pCollection)
	{
		let tmpSelf = this;
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		let tmpItems = pCollection.Items || [];

		pBody.innerHTML = '';

		if (tmpItems.length === 0)
		{
			let tmpEmpty = document.createElement('div');
			tmpEmpty.className = 'retold-remote-collections-empty';
			tmpEmpty.textContent = 'No items in this sort plan.';
			pBody.appendChild(tmpEmpty);
			return;
		}

		for (let i = 0; i < tmpItems.length; i++)
		{
			let tmpItem = tmpItems[i];
			let tmpRow = document.createElement('div');
			tmpRow.className = 'retold-remote-collection-op-item';

			// Status color
			let tmpStatus = tmpItem.OperationStatus || 'pending';
			tmpRow.classList.add('op-status-' + tmpStatus);

			// Status indicator
			let tmpStatusDiv = document.createElement('div');
			tmpStatusDiv.className = 'retold-remote-collection-op-status';
			if (tmpStatus === 'completed')
			{
				tmpStatusDiv.textContent = '\u2713';
				tmpStatusDiv.title = 'Completed';
			}
			else if (tmpStatus === 'failed')
			{
				tmpStatusDiv.textContent = '\u2717';
				tmpStatusDiv.title = tmpItem.OperationError || 'Failed';
			}
			else if (tmpStatus === 'skipped')
			{
				tmpStatusDiv.textContent = '\u2014';
				tmpStatusDiv.title = 'Skipped';
			}
			else
			{
				tmpStatusDiv.textContent = '\u25CB';
				tmpStatusDiv.title = 'Pending';
			}

			// Source path (filename only, full path in tooltip)
			let tmpSourceDiv = document.createElement('div');
			tmpSourceDiv.className = 'retold-remote-collection-op-source';
			let tmpSourcePath = tmpItem.Path || '';
			tmpSourceDiv.textContent = tmpSourcePath.split('/').pop() || tmpSourcePath;
			tmpSourceDiv.title = tmpSourcePath;

			// Arrow
			let tmpArrow = document.createElement('div');
			tmpArrow.className = 'retold-remote-collection-op-arrow';
			tmpArrow.textContent = '\u2192';

			// Destination path (editable)
			let tmpDestDiv = document.createElement('div');
			tmpDestDiv.className = 'retold-remote-collection-op-dest';
			let tmpDestPath = tmpItem.DestinationPath || '';
			tmpDestDiv.textContent = tmpDestPath || '(no destination)';
			tmpDestDiv.title = tmpDestPath;

			// Make destination editable on click (only for pending items)
			if (tmpStatus === 'pending')
			{
				tmpDestDiv.style.cursor = 'pointer';
				tmpDestDiv.onclick = (pEvent) =>
				{
					pEvent.stopPropagation();
					tmpSelf._startEditDestination(tmpDestDiv, tmpItem, pCollection);
				};
			}

			// Operation badge
			let tmpOpBadge = document.createElement('div');
			tmpOpBadge.className = 'retold-remote-collection-op-badge';
			tmpOpBadge.textContent = (tmpItem.Operation || 'move').toUpperCase();

			// Skip/remove button (only for pending items)
			let tmpSkipBtn = document.createElement('button');
			tmpSkipBtn.className = 'retold-remote-collection-item-remove';
			tmpSkipBtn.title = 'Skip this operation';
			tmpSkipBtn.textContent = '\u00d7';

			if (tmpStatus === 'pending')
			{
				tmpSkipBtn.onclick = (pEvent) =>
				{
					pEvent.stopPropagation();
					tmpManager.skipItemOperation(tmpItem.ID);
				};
			}
			else
			{
				tmpSkipBtn.style.visibility = 'hidden';
			}

			// Error message (if failed)
			if (tmpStatus === 'failed' && tmpItem.OperationError)
			{
				let tmpErrorDiv = document.createElement('div');
				tmpErrorDiv.className = 'retold-remote-collection-op-error';
				tmpErrorDiv.textContent = tmpItem.OperationError;
				tmpRow.appendChild(tmpErrorDiv);
			}

			tmpRow.appendChild(tmpStatusDiv);
			tmpRow.appendChild(tmpSourceDiv);
			tmpRow.appendChild(tmpArrow);
			tmpRow.appendChild(tmpDestDiv);
			tmpRow.appendChild(tmpOpBadge);
			tmpRow.appendChild(tmpSkipBtn);
			pBody.appendChild(tmpRow);
		}
	}

	/**
	 * Start inline editing of an operation item's destination path.
	 */
	_startEditDestination(pDestDiv, pItem, pCollection)
	{
		let tmpSelf = this;
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];

		let tmpInput = document.createElement('input');
		tmpInput.type = 'text';
		tmpInput.className = 'retold-remote-collection-op-dest-input';
		tmpInput.value = pItem.DestinationPath || '';

		let tmpFinishEdit = () =>
		{
			let tmpNewDest = tmpInput.value.trim();
			if (tmpNewDest && tmpNewDest !== pItem.DestinationPath)
			{
				tmpManager.setItemDestination(pItem.ID, tmpNewDest);
			}
			pDestDiv.textContent = tmpNewDest || pItem.DestinationPath || '(no destination)';
			pDestDiv.title = tmpNewDest || pItem.DestinationPath || '';
		};

		tmpInput.onblur = tmpFinishEdit;
		tmpInput.onkeydown = (pEvent) =>
		{
			if (pEvent.key === 'Enter')
			{
				pEvent.preventDefault();
				tmpInput.blur();
			}
			else if (pEvent.key === 'Escape')
			{
				pEvent.preventDefault();
				pDestDiv.textContent = pItem.DestinationPath || '(no destination)';
				pDestDiv.title = pItem.DestinationPath || '';
			}
		};

		pDestDiv.textContent = '';
		pDestDiv.appendChild(tmpInput);
		tmpInput.focus();
		tmpInput.select();
	}

	// -- Edit Mode --------------------------------------------------------

	_renderEditMode(pRoot)
	{
		let tmpSelf = this;
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		let tmpCollection = tmpRemote.ActiveCollection;

		pRoot.innerHTML = '';

		if (!tmpCollection)
		{
			pRoot.innerHTML = '<div class="retold-remote-collections-empty">No collection selected.</div>';
			return;
		}

		// Header
		let tmpHeader = document.createElement('div');
		tmpHeader.className = 'retold-remote-collections-header';

		let tmpBackBtn = document.createElement('button');
		tmpBackBtn.className = 'retold-remote-collections-header-btn';
		tmpBackBtn.title = 'Back to detail';
		tmpBackBtn.textContent = '\u2190';
		tmpBackBtn.onclick = () =>
		{
			tmpRemote.CollectionsPanelMode = 'detail';
			tmpSelf.renderContent();
		};

		let tmpTitle = document.createElement('div');
		tmpTitle.className = 'retold-remote-collections-header-title';
		tmpTitle.textContent = 'Edit Collection';

		tmpHeader.appendChild(tmpBackBtn);
		tmpHeader.appendChild(tmpTitle);
		pRoot.appendChild(tmpHeader);

		// Edit form
		let tmpBody = document.createElement('div');
		tmpBody.className = 'retold-remote-collections-body';

		let tmpForm = document.createElement('div');
		tmpForm.className = 'retold-remote-collections-edit';

		// Name
		tmpForm.appendChild(this._createEditGroup('Name', 'input', tmpCollection.Name || '', 'edit-name'));

		// Description
		tmpForm.appendChild(this._createEditGroup('Description (Markdown)', 'textarea', tmpCollection.Description || '', 'edit-description'));

		// Cover Image
		let tmpCoverGroup = this._createEditGroup('Cover Image Path', 'input', tmpCollection.CoverImage || '', 'edit-cover');

		// "Use current file" button
		let tmpCurrentFile = this.pict.AppData.ContentEditor.CurrentFile;
		if (tmpCurrentFile)
		{
			let tmpUseCurrent = document.createElement('button');
			tmpUseCurrent.className = 'retold-remote-collections-edit-btn';
			tmpUseCurrent.textContent = 'Use current file';
			tmpUseCurrent.style.marginTop = '4px';
			tmpUseCurrent.style.fontSize = '0.72rem';
			tmpUseCurrent.onclick = () =>
			{
				let tmpInput = document.getElementById('retold-remote-edit-cover');
				if (tmpInput)
				{
					tmpInput.value = tmpCurrentFile;
				}
			};
			tmpCoverGroup.appendChild(tmpUseCurrent);
		}
		tmpForm.appendChild(tmpCoverGroup);

		// Tags
		tmpForm.appendChild(this._createEditGroup('Tags (comma-separated)', 'input', (tmpCollection.Tags || []).join(', '), 'edit-tags'));

		// Action buttons
		let tmpActions = document.createElement('div');
		tmpActions.className = 'retold-remote-collections-edit-actions';

		let tmpSaveBtn = document.createElement('button');
		tmpSaveBtn.className = 'retold-remote-collections-edit-btn retold-remote-collections-edit-btn-primary';
		tmpSaveBtn.textContent = 'Save';
		tmpSaveBtn.onclick = () =>
		{
			let tmpNameInput = document.getElementById('retold-remote-edit-name');
			let tmpDescInput = document.getElementById('retold-remote-edit-description');
			let tmpCoverInput = document.getElementById('retold-remote-edit-cover');
			let tmpTagsInput = document.getElementById('retold-remote-edit-tags');

			let tmpUpdated =
			{
				GUID: tmpCollection.GUID,
				Name: tmpNameInput ? tmpNameInput.value : tmpCollection.Name,
				Description: tmpDescInput ? tmpDescInput.value : tmpCollection.Description,
				CoverImage: tmpCoverInput ? tmpCoverInput.value : tmpCollection.CoverImage,
				Tags: tmpTagsInput ? tmpTagsInput.value.split(',').map((t) => t.trim()).filter((t) => t) : tmpCollection.Tags
			};

			tmpManager.updateCollection(tmpUpdated, (pError) =>
			{
				if (!pError)
				{
					tmpRemote.CollectionsPanelMode = 'detail';
					tmpManager.fetchCollection(tmpCollection.GUID);

					let tmpToast = tmpManager._getToast();
					if (tmpToast)
					{
						tmpToast.show('Collection saved');
					}
				}
			});
		};

		let tmpCancelBtn = document.createElement('button');
		tmpCancelBtn.className = 'retold-remote-collections-edit-btn';
		tmpCancelBtn.textContent = 'Cancel';
		tmpCancelBtn.onclick = () =>
		{
			tmpRemote.CollectionsPanelMode = 'detail';
			tmpSelf.renderContent();
		};

		tmpActions.appendChild(tmpSaveBtn);
		tmpActions.appendChild(tmpCancelBtn);
		tmpForm.appendChild(tmpActions);

		// Delete button
		let tmpDeleteBtn = document.createElement('button');
		tmpDeleteBtn.className = 'retold-remote-collections-edit-btn retold-remote-collections-edit-btn-danger';
		tmpDeleteBtn.textContent = 'Delete Collection';
		tmpDeleteBtn.onclick = () =>
		{
			if (confirm('Delete this collection? This cannot be undone.'))
			{
				tmpManager.deleteCollection(tmpCollection.GUID);
			}
		};
		tmpForm.appendChild(tmpDeleteBtn);

		tmpBody.appendChild(tmpForm);
		pRoot.appendChild(tmpBody);
	}

	/**
	 * Create a labelled form group (label + input/textarea).
	 */
	_createEditGroup(pLabel, pType, pValue, pId)
	{
		let tmpGroup = document.createElement('div');
		tmpGroup.className = 'retold-remote-collections-edit-group';

		let tmpLabel = document.createElement('div');
		tmpLabel.className = 'retold-remote-collections-edit-label';
		tmpLabel.textContent = pLabel;

		let tmpInput;
		if (pType === 'textarea')
		{
			tmpInput = document.createElement('textarea');
			tmpInput.className = 'retold-remote-collections-edit-textarea';
		}
		else
		{
			tmpInput = document.createElement('input');
			tmpInput.className = 'retold-remote-collections-edit-input';
			tmpInput.type = 'text';
		}

		tmpInput.value = pValue;
		tmpInput.id = 'retold-remote-' + pId;

		tmpGroup.appendChild(tmpLabel);
		tmpGroup.appendChild(tmpInput);
		return tmpGroup;
	}

	// -- Helpers ----------------------------------------------------------

	/**
	 * Get a text icon character for an item type.
	 */
	_getTypeIcon(pType, pMediaType)
	{
		switch (pType)
		{
			case 'folder':
			case 'folder-contents':
				return '\uD83D\uDCC1';
			case 'subfile':
				return '\uD83D\uDDC4';
			case 'image-crop':
				return '\u2702';
			case 'audio-clip':
				return '\uD83C\uDFB5';
			case 'video-clip':
			case 'video-frame':
				return '\uD83C\uDFAC';
			default:
				break;
		}

		switch (pMediaType)
		{
			case 'image':
				return '\uD83D\uDDBC';
			case 'video':
				return '\uD83C\uDFAC';
			case 'audio':
				return '\uD83C\uDFB5';
			case 'document':
				return '\uD83D\uDCC4';
			default:
				return '\uD83D\uDCC4';
		}
	}

	// -- Export Dialog -------------------------------------------------------

	/**
	 * Show the export dialog for a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {string} pCollectionName - Collection name (for default folder)
	 */
	_showExportDialog(pGUID, pCollectionName)
	{
		let tmpSelf = this;

		// Build a default folder name from the collection name
		let tmpDefaultFolder = (pCollectionName || 'collection-export')
			.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
			.replace(/\s+/g, '_')
			.substring(0, 80);

		// Use the current browsed folder as a prefix if available
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpCurrentFolder = tmpRemote.CurrentBrowsedFolder || '';
		let tmpDefaultPath = tmpCurrentFolder
			? tmpCurrentFolder.replace(/\/+$/, '') + '/' + tmpDefaultFolder
			: tmpDefaultFolder;

		// Create a simple inline prompt in the collections detail area
		let tmpRoot = document.getElementById('RetoldRemote-Collections-Detail');
		if (!tmpRoot)
		{
			return;
		}

		// Find or create the export dialog container
		let tmpExistingDialog = document.getElementById('RetoldRemote-ExportDialog');
		if (tmpExistingDialog)
		{
			tmpExistingDialog.parentElement.removeChild(tmpExistingDialog);
		}

		let tmpDialog = document.createElement('div');
		tmpDialog.id = 'RetoldRemote-ExportDialog';
		tmpDialog.style.cssText = 'padding:10px;border-top:1px solid var(--retold-border);background:var(--retold-bg-secondary,#21252b);';

		tmpDialog.innerHTML =
			'<div style="font-size:0.78rem;color:var(--retold-text);margin-bottom:6px;">Export to folder (within content root):</div>'
			+ '<input type="text" id="RetoldRemote-ExportPath" value="' + tmpDefaultPath.replace(/"/g, '&quot;') + '" '
			+ 'style="width:100%;box-sizing:border-box;background:var(--retold-bg-input,#1e1e1e);color:var(--retold-text);border:1px solid var(--retold-border);border-radius:4px;padding:4px 8px;font-size:0.78rem;font-family:inherit;margin-bottom:6px;">'
			+ '<div style="display:flex;gap:6px;">'
			+ '<button id="RetoldRemote-ExportConfirmBtn" style="flex:1;padding:4px 8px;font-size:0.75rem;">Export</button>'
			+ '<button id="RetoldRemote-ExportCancelBtn" style="padding:4px 8px;font-size:0.75rem;">Cancel</button>'
			+ '</div>'
			+ '<div id="RetoldRemote-ExportStatus" style="font-size:0.72rem;color:var(--retold-text-dim);margin-top:6px;display:none;"></div>';

		tmpRoot.appendChild(tmpDialog);

		// Focus the path input
		let tmpPathInput = document.getElementById('RetoldRemote-ExportPath');
		if (tmpPathInput)
		{
			tmpPathInput.focus();
			tmpPathInput.select();
		}

		// Cancel handler
		document.getElementById('RetoldRemote-ExportCancelBtn').onclick = () =>
		{
			tmpDialog.parentElement.removeChild(tmpDialog);
		};

		// Export handler
		document.getElementById('RetoldRemote-ExportConfirmBtn').onclick = () =>
		{
			let tmpDestPath = tmpPathInput ? tmpPathInput.value.trim() : '';
			if (!tmpDestPath)
			{
				return;
			}

			let tmpBtn = document.getElementById('RetoldRemote-ExportConfirmBtn');
			let tmpStatus = document.getElementById('RetoldRemote-ExportStatus');
			if (tmpBtn) tmpBtn.disabled = true;
			if (tmpBtn) tmpBtn.textContent = 'Exporting\u2026';
			if (tmpStatus) tmpStatus.style.display = '';
			if (tmpStatus) tmpStatus.textContent = 'Exporting\u2026';

			fetch('/api/collections/' + encodeURIComponent(pGUID) + '/export',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ DestinationPath: tmpDestPath })
			})
				.then((pResponse) => pResponse.json())
				.then((pResult) =>
				{
					if (pResult && pResult.Success)
					{
						let tmpMsg = 'Exported ' + pResult.ExportedCount + ' of ' + pResult.TotalItems + ' items';
						if (pResult.ErrorCount > 0)
						{
							tmpMsg += ' (' + pResult.ErrorCount + ' errors)';
						}
						tmpMsg += ' to ' + pResult.DestinationPath;

						if (tmpStatus) tmpStatus.textContent = tmpMsg;
						if (tmpBtn) tmpBtn.textContent = 'Done';

						let tmpToast = tmpSelf.pict.providers['RetoldRemote-ToastNotification'];
						if (tmpToast)
						{
							tmpToast.showToast(tmpMsg);
						}

						// Auto-dismiss after a moment
						setTimeout(() =>
						{
							if (tmpDialog.parentElement)
							{
								tmpDialog.parentElement.removeChild(tmpDialog);
							}
						}, 3000);
					}
					else
					{
						let tmpErrMsg = (pResult && pResult.Error) || 'Export failed';
						if (tmpStatus) tmpStatus.textContent = tmpErrMsg;
						if (tmpStatus) tmpStatus.style.color = '#e06c75';
						if (tmpBtn) tmpBtn.textContent = 'Retry';
						if (tmpBtn) tmpBtn.disabled = false;
					}
				})
				.catch((pError) =>
				{
					if (tmpStatus) tmpStatus.textContent = 'Request failed: ' + pError.message;
					if (tmpStatus) tmpStatus.style.color = '#e06c75';
					if (tmpBtn) tmpBtn.textContent = 'Retry';
					if (tmpBtn) tmpBtn.disabled = false;
				});
		};

		// Enter key in input triggers export
		if (tmpPathInput)
		{
			tmpPathInput.onkeydown = (pEvent) =>
			{
				if (pEvent.key === 'Enter')
				{
					document.getElementById('RetoldRemote-ExportConfirmBtn').click();
				}
				if (pEvent.key === 'Escape')
				{
					tmpDialog.parentElement.removeChild(tmpDialog);
				}
			};
		}
	}
}

RetoldRemoteCollectionsPanelView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteCollectionsPanelView;
