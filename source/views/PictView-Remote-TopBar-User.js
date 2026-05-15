const libPictView = require('pict-view');

/**
 * PictView-Remote-TopBar-User — slot view rendered into Theme-TopBar's
 * UserView slot. Hosts the action buttons (AI sort, regions browser,
 * add-to-collection, favorites, collections toggle, filter toggle,
 * distraction-free toggle) and the gear button that toggles the
 * hidden settings panel.
 *
 * Re-render via PictApplication.renderTopBar() whenever filter state,
 * favorite state, AI-sort availability, or collections-open state
 * changes.
 */

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-TopBar-User",

	DefaultRenderable: "RetoldRemote-TopBar-User-Display",
	DefaultDestinationAddress: "#Theme-TopBar-User",

	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-user
		{
			display: flex;
			align-items: center;
			height: 100%;
			gap: 6px;
			padding: 0 12px;
			color: var(--theme-color-text-on-brand, var(--theme-color-text-primary, #E0E0E0));
		}
		.retold-remote-user .pict-icon { font-size: 1.1em; }
		.retold-remote-user-btn-gear
		{
			background: transparent;
			color: var(--theme-color-text-on-brand, var(--theme-color-text-secondary, #B8AFA4));
			border: 1px solid var(--theme-color-border-default, #5E5549);
			border-radius: 4px;
			height: 30px;
			padding: 0 8px;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			box-sizing: border-box;
		}
		.retold-remote-user-btn-gear:hover
		{
			color: var(--theme-color-text-on-brand, var(--theme-color-text-primary, #E0E0E0));
			border-color: var(--theme-color-brand-primary, #8A7F72);
			background: var(--theme-color-background-hover, rgba(255, 255, 255, 0.05));
		}
		.retold-remote-user-btn-gear .pict-icon { font-size: 1.25em; }
	`,

	Templates:
	[
		{
			Hash: "RetoldRemote-TopBar-User-Template",
			Template: /*html*/`
<div class="retold-remote-user">
	<div class="retold-remote-topbar-actions">
		<button class="retold-remote-topbar-df-toggle" id="RetoldRemote-TopBar-DFToggle"
			onclick="pict.views['RetoldRemote-TopBar-User'].toggleDistractionFree()"
			title="Distraction-free mode (d)"></button>
		<button class="retold-remote-topbar-aisort-btn" id="RetoldRemote-TopBar-AISortBtn"
			onclick="pict.views['RetoldRemote-TopBar-User'].triggerAISort()"
			title="AI Sort (generate sort plan for current folder)"
			style="display:none;">Ai</button>
		<button class="retold-remote-topbar-btn retold-remote-topbar-regions-btn" id="RetoldRemote-TopBar-RegionsBtn"
			onclick="pict.views['RetoldRemote-RegionsBrowser'] && pict.views['RetoldRemote-RegionsBrowser'].open()"
			title="Browse all regions by folder">&#9635;</button>
		<button class="retold-remote-topbar-btn retold-remote-topbar-addcoll-btn" id="RetoldRemote-TopBar-AddToCollectionBtn"
			onclick="pict.views['RetoldRemote-TopBar-User'].addToCollection(event)"
			title="Add to collection">&#9733;</button>
		<button class="retold-remote-topbar-btn retold-remote-topbar-favorites-btn" id="RetoldRemote-TopBar-FavoritesBtn"
			onclick="pict.views['RetoldRemote-TopBar-User'].toggleFavorite()"
			title="Toggle favorite (h)">&#9825;</button>
		<button class="retold-remote-topbar-sidebar-toggle retold-remote-topbar-collections-btn" id="RetoldRemote-TopBar-CollectionsBtn"
			onclick="pict.views['RetoldRemote-TopBar-User'].toggleCollections()"
			title="Toggle Collections panel (b)">&#9733;</button>
		<button class="retold-remote-topbar-filter-btn" id="RetoldRemote-TopBar-FilterBtn"
			onclick="pict.views['RetoldRemote-TopBar-User'].toggleFilterBar()"
			title="Toggle filter bar (/)">&#9698;</button>
	</div>
	<button class="retold-remote-user-btn-gear"
		onclick="pict.views['ContentEditor-Layout'].toggleSettingsPanel()"
		title="Settings" aria-label="Settings">{~I:Settings~}</button>
</div>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: "RetoldRemote-TopBar-User-Display",
			TemplateHash: "RetoldRemote-TopBar-User-Template",
			DestinationAddress: "#Theme-TopBar-User",
			RenderMethod: "replace"
		}
	]
};

class RetoldRemoteTopBarUserView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent)
	{
		this.pict.CSSMap.injectCSS();
		this.updateDFToggleIcon();
		this.updateFavoritesIcon();
		this.updateFilterIcon();
		this.updateAISortButton();
		this.updateCollectionsIcon();
		return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
	}

	updateDFToggleIcon()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-DFToggle');
		if (!tmpBtn)
		{
			return;
		}

		tmpBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
			+ '<polyline points="15 3 21 3 21 9" />'
			+ '<polyline points="9 21 3 21 3 15" />'
			+ '<polyline points="21 15 21 21 15 21" />'
			+ '<polyline points="3 9 3 3 9 3" />'
			+ '</svg>';
	}

	toggleDistractionFree()
	{
		let tmpNav = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNav && tmpNav._toggleDistractionFree)
		{
			tmpNav._toggleDistractionFree();
		}
	}

	// -- Filter bar --------------------------------------------------------

	toggleFilterBar()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.FilterBarVisible = !tmpRemote.FilterBarVisible;

		if (!tmpRemote.FilterBarVisible)
		{
			tmpRemote.FilterPanelOpen = false;
		}

		let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
		if (tmpGalleryView)
		{
			tmpGalleryView.renderGallery();
		}

		this.updateFilterIcon();

		if (tmpRemote.FilterBarVisible)
		{
			setTimeout(() =>
			{
				let tmpSearch = document.getElementById('RetoldRemote-Gallery-Search');
				if (tmpSearch)
				{
					tmpSearch.focus();
				}
			}, 50);
		}
	}

	updateFilterIcon()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-FilterBtn');
		if (!tmpBtn)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		let tmpActiveChipCount = tmpFilterSort ? tmpFilterSort.getActiveFilterChips().length : 0;
		let tmpBarVisible = tmpRemote.FilterBarVisible || false;

		tmpBtn.classList.remove('filter-active', 'filter-bar-open');

		if (tmpActiveChipCount > 0)
		{
			tmpBtn.classList.add('filter-active');
			tmpBtn.innerHTML = '&#9683;<span class="retold-remote-topbar-filter-badge">' + tmpActiveChipCount + '</span>';
			tmpBtn.title = tmpActiveChipCount + ' active filter' + (tmpActiveChipCount > 1 ? 's' : '') + ' (/)';
		}
		else if (tmpBarVisible)
		{
			tmpBtn.classList.add('filter-bar-open');
			tmpBtn.innerHTML = '&#9698;';
			tmpBtn.title = 'Hide filter bar (/)';
		}
		else
		{
			tmpBtn.innerHTML = '&#9698;';
			tmpBtn.title = 'Toggle filter bar (/)';
		}
	}

	// -- AI Sort -----------------------------------------------------------

	triggerAISort()
	{
		let tmpAISortManager = this.pict.providers['RetoldRemote-AISortManager'];
		if (!tmpAISortManager)
		{
			return;
		}

		let tmpCurrentPath = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';

		let tmpBtn = document.getElementById('RetoldRemote-TopBar-AISortBtn');
		if (tmpBtn)
		{
			tmpBtn.classList.add('generating');
			tmpBtn.textContent = '...';
		}

		tmpAISortManager.generateSortPlan(tmpCurrentPath,
			(pError, pResult) =>
			{
				if (tmpBtn)
				{
					tmpBtn.classList.remove('generating');
					tmpBtn.textContent = 'Ai';
				}
			});
	}

	updateAISortButton()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-AISortBtn');
		if (!tmpBtn)
		{
			return;
		}

		let tmpAISortManager = this.pict.providers['RetoldRemote-AISortManager'];
		if (tmpAISortManager && tmpAISortManager.isAvailable())
		{
			tmpBtn.style.display = '';
		}
		else
		{
			tmpBtn.style.display = 'none';
		}
	}

	// -- Collections Panel -------------------------------------------------

	toggleCollections()
	{
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpManager)
		{
			tmpManager.togglePanel();
		}
	}

	updateCollectionsIcon()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-CollectionsBtn');
		if (!tmpBtn)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];

		let tmpIsOpen = tmpRemote.CollectionsPanelOpen;
		// On mobile (sidebar in drawer mode), "open" means the collections tab is active
		let tmpLayoutView = this.pict.views['ContentEditor-Layout'];
		if (tmpLayoutView && typeof tmpLayoutView.isMobileDrawer === 'function' && tmpLayoutView.isMobileDrawer())
		{
			let tmpActiveTab = document.querySelector('.content-editor-sidebar-tab.active');
			tmpIsOpen = tmpActiveTab && tmpActiveTab.getAttribute('data-tab') === 'collections';
		}

		if (tmpIsOpen)
		{
			tmpBtn.classList.add('panel-open');
			if (tmpIconProvider && typeof tmpIconProvider.getIcon === 'function')
			{
				tmpBtn.innerHTML = tmpIconProvider.getIcon('bookmark-filled', 16);
			}
		}
		else
		{
			tmpBtn.classList.remove('panel-open');
			if (tmpIconProvider && typeof tmpIconProvider.getIcon === 'function')
			{
				tmpBtn.innerHTML = tmpIconProvider.getIcon('bookmark', 16);
			}
		}
	}

	// -- Favorites ---------------------------------------------------------

	toggleFavorite()
	{
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpManager)
		{
			tmpManager.toggleFavorite();
		}
	}

	updateFavoritesIcon()
	{
		let tmpBtn = document.getElementById('RetoldRemote-TopBar-FavoritesBtn');
		if (!tmpBtn)
		{
			return;
		}

		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpManager && tmpManager.isFavorited())
		{
			tmpBtn.classList.add('is-favorited');
			tmpBtn.innerHTML = '♥';
			tmpBtn.title = 'Remove from favorites (h)';
		}
		else
		{
			tmpBtn.classList.remove('is-favorited');
			tmpBtn.innerHTML = '♡';
			tmpBtn.title = 'Add to favorites (h)';
		}
	}

	addToCollection(pEvent)
	{
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (!tmpManager)
		{
			return;
		}

		let tmpQuickGUID = tmpManager.getQuickAddTargetGUID();
		if (tmpQuickGUID)
		{
			let tmpAdded = tmpManager.addCurrentFileToCollection(tmpQuickGUID);
			if (tmpAdded)
			{
				return;
			}
		}

		this.showAddToCollectionDropdown(pEvent);
	}

	showAddToCollectionDropdown(pEvent)
	{
		let tmpSelf = this;
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];

		this._closeAddToCollectionDropdown();

		let tmpBtn = document.getElementById('RetoldRemote-TopBar-AddToCollectionBtn');
		if (!tmpBtn)
		{
			return;
		}

		tmpManager.fetchCollections(() =>
		{
			let tmpCollections = tmpRemote.Collections || [];

			let tmpDropdown = document.createElement('div');
			tmpDropdown.className = 'retold-remote-addcoll-dropdown';
			tmpDropdown.id = 'RetoldRemote-AddToCollection-Dropdown';

			let tmpNewItem = document.createElement('button');
			tmpNewItem.className = 'retold-remote-addcoll-dropdown-item retold-remote-addcoll-dropdown-new';
			tmpNewItem.textContent = '+ New Collection...';
			tmpNewItem.onclick = () =>
			{
				tmpSelf._closeAddToCollectionDropdown();
				let tmpModal = tmpSelf.pict.views['Pict-Section-Modal'];
				if (tmpModal && typeof tmpModal.show === 'function')
				{
					tmpModal.show(
					{
						title: 'New Collection',
						content: '<p>Collection name:</p>'
							+ '<input type="text" id="retold-remote-newcoll-input" class="pict-input" autofocus>',
						buttons:
						[
							{ Hash: 'cancel', Label: 'Cancel' },
							{ Hash: 'ok',     Label: 'Create', Style: 'primary' }
						]
					}).then((pChoice) =>
					{
						if (pChoice !== 'ok')
						{
							tmpManager.clearPendingClipContext();
							return;
						}
						let tmpInput = document.getElementById('retold-remote-newcoll-input');
						let tmpName = tmpInput ? (tmpInput.value || '').trim() : '';
						if (!tmpName)
						{
							tmpManager.clearPendingClipContext();
							return;
						}
						tmpManager.createCollection(tmpName, (pError, pCollection) =>
						{
							if (!pError && pCollection)
							{
								tmpManager.addPendingOrCurrentToCollection(pCollection.GUID);
							}
						});
					});
				}
			};
			tmpDropdown.appendChild(tmpNewItem);

			for (let i = 0; i < tmpCollections.length; i++)
			{
				let tmpCollection = tmpCollections[i];
				let tmpItem = document.createElement('button');
				tmpItem.className = 'retold-remote-addcoll-dropdown-item';
				tmpItem.textContent = tmpCollection.Name || 'Untitled';
				tmpItem.onclick = () =>
				{
					tmpSelf._closeAddToCollectionDropdown();
					tmpManager.addPendingOrCurrentToCollection(tmpCollection.GUID);
				};
				tmpDropdown.appendChild(tmpItem);
			}

			tmpBtn.style.position = 'relative';
			tmpBtn.appendChild(tmpDropdown);

			setTimeout(() =>
			{
				document.addEventListener('click', tmpSelf._boundCloseDropdown = (pClickEvent) =>
				{
					if (!tmpDropdown.contains(pClickEvent.target) && pClickEvent.target !== tmpBtn)
					{
						tmpSelf._closeAddToCollectionDropdown();
					}
				});
			}, 10);
		});
	}

	_closeAddToCollectionDropdown()
	{
		let tmpDropdown = document.getElementById('RetoldRemote-AddToCollection-Dropdown');
		if (tmpDropdown)
		{
			tmpDropdown.remove();
		}
		if (this._boundCloseDropdown)
		{
			document.removeEventListener('click', this._boundCloseDropdown);
			this._boundCloseDropdown = null;
		}

		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpManager)
		{
			tmpManager.clearPendingClipContext();
		}
	}
}

module.exports = RetoldRemoteTopBarUserView;
module.exports.default_configuration = _ViewConfiguration;
