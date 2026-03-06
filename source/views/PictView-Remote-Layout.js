const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "ContentEditor-Layout",

	DefaultRenderable: "RetoldRemote-Layout-Shell",
	DefaultDestinationAddress: "#ContentEditor-Application-Container",

	AutoRender: false,

	CSS: ``,

	Templates:
	[
		{
			Hash: "RetoldRemote-Layout-Shell",
			Template: /*html*/`
				<div id="ContentEditor-TopBar-Container"></div>
				<div class="content-editor-body">
					<div class="content-editor-sidebar-wrap" style="width: 250px;">
						<div class="content-editor-sidebar-inner">
							<div class="content-editor-sidebar-tabs">
								<button class="content-editor-sidebar-tab active" data-tab="files" onclick="pict.views['ContentEditor-Layout'].switchSidebarTab('files')">Files</button>
								<button class="content-editor-sidebar-tab" data-tab="favorites" onclick="pict.views['ContentEditor-Layout'].switchSidebarTab('favorites')">Favorites</button>
								<button class="content-editor-sidebar-tab" data-tab="info" onclick="pict.views['ContentEditor-Layout'].switchSidebarTab('info')">Info</button>
								<button class="content-editor-sidebar-tab" data-tab="settings" onclick="pict.views['ContentEditor-Layout'].switchSidebarTab('settings')">Settings</button>
								<button class="content-editor-sidebar-tab content-editor-sidebar-tab-collections" data-tab="collections" onclick="pict.views['ContentEditor-Layout'].switchSidebarTab('collections')" style="display:none;">Collections</button>
							</div>
							<div class="content-editor-sidebar-pane" data-pane="files" id="ContentEditor-Sidebar-Container"></div>
							<div class="content-editor-sidebar-pane" data-pane="favorites" id="RetoldRemote-Favorites-Container" style="display:none">
								<div id="RetoldRemote-Favorites-Body"></div>
							</div>
							<div class="content-editor-sidebar-pane" data-pane="info" id="RetoldRemote-Info-Container" style="display:none"></div>
							<div class="content-editor-sidebar-pane" data-pane="settings" id="RetoldRemote-Settings-Container" style="display:none"></div>
							<div class="content-editor-sidebar-pane" data-pane="collections" id="RetoldRemote-Collections-MobilePane" style="display:none"></div>
						</div>
						<div class="content-editor-resize-handle"></div>
					</div>
					<div id="RetoldRemote-Content-Container">
						<div id="RetoldRemote-Gallery-Container"></div>
						<div id="RetoldRemote-Viewer-Container"></div>
					</div>
					<div class="retold-remote-collections-wrap collapsed" id="RetoldRemote-Collections-Wrap" style="width: 300px;">
						<div class="retold-remote-collections-resize-handle"></div>
						<div class="retold-remote-collections-inner">
							<div id="RetoldRemote-Collections-Container"></div>
						</div>
					</div>
				</div>
			`
		}
	],

	Renderables:
	[
		{
			RenderableHash: "RetoldRemote-Layout-Shell",
			TemplateHash: "RetoldRemote-Layout-Shell",
			DestinationAddress: "#ContentEditor-Application-Container"
		}
	]
};

class RetoldRemoteLayoutView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._sidebarDragging = false;
		this._collectionsDragging = false;
	}

	onAfterRender()
	{
		super.onAfterRender();

		// Inject all view CSS into the page
		this.pict.CSSMap.injectCSS();

		// Set up sidebar resize handle
		this._setupResizeHandle();

		// Restore sidebar state from settings
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (tmpRemote && tmpRemote.SidebarCollapsed)
		{
			let tmpWrap = document.querySelector('.content-editor-sidebar-wrap');
			if (tmpWrap)
			{
				tmpWrap.classList.add('collapsed');
			}
		}
		if (!this.isMobileDrawer() && tmpRemote && tmpRemote.SidebarWidth)
		{
			let tmpWrap = document.querySelector('.content-editor-sidebar-wrap');
			if (tmpWrap && !tmpWrap.classList.contains('collapsed'))
			{
				tmpWrap.style.width = tmpRemote.SidebarWidth + 'px';
			}
		}
		if (this.isMobileDrawer() && tmpRemote && tmpRemote.SidebarDrawerHeight)
		{
			let tmpWrap = document.querySelector('.content-editor-sidebar-wrap');
			if (tmpWrap && !tmpWrap.classList.contains('collapsed'))
			{
				tmpWrap.style.height = tmpRemote.SidebarDrawerHeight + 'px';
			}
		}

		// Restore collections panel state from settings
		if (tmpRemote && tmpRemote.CollectionsPanelOpen)
		{
			let tmpCollWrap = document.getElementById('RetoldRemote-Collections-Wrap');
			if (tmpCollWrap)
			{
				tmpCollWrap.classList.remove('collapsed');
				if (tmpRemote.CollectionsPanelWidth)
				{
					tmpCollWrap.style.width = tmpRemote.CollectionsPanelWidth + 'px';
				}
			}
		}

		// Set up collections panel resize handle
		this._setupCollectionsResizeHandle();

		// Listen for hash changes (browser back/forward)
		let tmpSelf = this;
		window.addEventListener('hashchange', () =>
		{
			tmpSelf.pict.PictApplication.resolveHash();
		});
	}

	/**
	 * Detect if we are in mobile drawer mode (narrow viewport).
	 */
	isMobileDrawer()
	{
		return window.innerWidth <= 600;
	}

	toggleSidebar()
	{
		let tmpWrap = document.querySelector('.content-editor-sidebar-wrap');
		if (!tmpWrap)
		{
			return;
		}

		tmpWrap.classList.toggle('collapsed');

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpIsCollapsed = tmpWrap.classList.contains('collapsed');
		tmpRemote.SidebarCollapsed = tmpIsCollapsed;

		// Restore saved dimensions when opening
		if (!tmpIsCollapsed)
		{
			if (this.isMobileDrawer())
			{
				let tmpHeight = tmpRemote.SidebarDrawerHeight || Math.round(window.innerHeight * 0.33);
				tmpWrap.style.height = tmpHeight + 'px';
			}
			else if (tmpRemote.SidebarWidth)
			{
				tmpWrap.style.width = tmpRemote.SidebarWidth + 'px';
			}
		}

		this.pict.PictApplication.saveSettings();

		// Recalculate gallery columns after sidebar resize
		let tmpNavProvider = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNavProvider)
		{
			setTimeout(() => tmpNavProvider.recalculateColumns(), 250);
		}
	}

	switchSidebarTab(pTab)
	{
		// Update tab buttons
		let tmpTabs = document.querySelectorAll('.content-editor-sidebar-tab');
		tmpTabs.forEach((pEl) =>
		{
			pEl.classList.toggle('active', pEl.getAttribute('data-tab') === pTab);
		});

		// Update panes
		let tmpPanes = document.querySelectorAll('.content-editor-sidebar-pane');
		tmpPanes.forEach((pEl) =>
		{
			pEl.style.display = (pEl.getAttribute('data-pane') === pTab) ? '' : 'none';
		});

		// Render settings panel on demand
		if (pTab === 'settings')
		{
			let tmpSettingsView = this.pict.views['RetoldRemote-SettingsPanel'];
			if (tmpSettingsView)
			{
				tmpSettingsView.render();
			}
		}

		// Favorites tab: render the favorites list
		if (pTab === 'favorites')
		{
			this.renderFavoritesList();
		}

		// Info tab: render the file info panel
		if (pTab === 'info')
		{
			let tmpInfoView = this.pict.views['RetoldRemote-FileInfoPanel'];
			if (tmpInfoView)
			{
				tmpInfoView.render();
			}
		}

		// Collections tab: move the collections container into the mobile pane
		if (pTab === 'collections')
		{
			let tmpCollContainer = document.getElementById('RetoldRemote-Collections-Container');
			let tmpMobilePane = document.getElementById('RetoldRemote-Collections-MobilePane');
			if (tmpCollContainer && tmpMobilePane && !tmpMobilePane.contains(tmpCollContainer))
			{
				tmpMobilePane.appendChild(tmpCollContainer);
			}
			// Render and fetch collections
			let tmpCollView = this.pict.views['RetoldRemote-CollectionsPanel'];
			if (tmpCollView)
			{
				tmpCollView.render();
			}
			let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
			if (tmpManager)
			{
				tmpManager.fetchCollections();
			}
		}
		else
		{
			// Return collections container to its original home when leaving collections tab
			let tmpCollContainer = document.getElementById('RetoldRemote-Collections-Container');
			let tmpOrigParent = document.querySelector('.retold-remote-collections-inner');
			if (tmpCollContainer && tmpOrigParent && !tmpOrigParent.contains(tmpCollContainer))
			{
				tmpOrigParent.appendChild(tmpCollContainer);
			}
		}

	}

	_setupResizeHandle()
	{
		let tmpSelf = this;
		let tmpHandle = document.querySelector('.content-editor-resize-handle');
		let tmpWrap = document.querySelector('.content-editor-sidebar-wrap');

		if (!tmpHandle || !tmpWrap)
		{
			return;
		}

		let tmpStartX = 0;
		let tmpStartY = 0;
		let tmpStartWidth = 0;
		let tmpStartHeight = 0;

		function getClientPos(pEvent)
		{
			if (pEvent.touches && pEvent.touches.length > 0)
			{
				return { x: pEvent.touches[0].clientX, y: pEvent.touches[0].clientY };
			}
			return { x: pEvent.clientX, y: pEvent.clientY };
		}

		function onDragStart(pEvent)
		{
			tmpSelf._sidebarDragging = true;
			let tmpPos = getClientPos(pEvent);
			tmpStartX = tmpPos.x;
			tmpStartY = tmpPos.y;
			tmpStartWidth = tmpWrap.offsetWidth;
			tmpStartHeight = tmpWrap.offsetHeight;
			tmpHandle.classList.add('dragging');

			document.addEventListener('mousemove', onDragMove);
			document.addEventListener('mouseup', onDragEnd);
			document.addEventListener('touchmove', onDragMove, { passive: false });
			document.addEventListener('touchend', onDragEnd);
			pEvent.preventDefault();
		}

		function onDragMove(pEvent)
		{
			if (!tmpSelf._sidebarDragging)
			{
				return;
			}

			let tmpPos = getClientPos(pEvent);

			if (tmpSelf.isMobileDrawer())
			{
				// Vertical resize (top drawer)
				let tmpNewHeight = tmpStartHeight + (tmpPos.y - tmpStartY);
				let tmpMaxHeight = Math.round(window.innerHeight * 0.7);
				tmpNewHeight = Math.max(80, Math.min(tmpNewHeight, tmpMaxHeight));
				tmpWrap.style.height = tmpNewHeight + 'px';
			}
			else
			{
				// Horizontal resize (sidebar)
				let tmpNewWidth = tmpStartWidth + (tmpPos.x - tmpStartX);
				tmpNewWidth = Math.max(150, Math.min(tmpNewWidth, 600));
				tmpWrap.style.width = tmpNewWidth + 'px';
			}

			pEvent.preventDefault();
		}

		function onDragEnd()
		{
			tmpSelf._sidebarDragging = false;
			tmpHandle.classList.remove('dragging');

			document.removeEventListener('mousemove', onDragMove);
			document.removeEventListener('mouseup', onDragEnd);
			document.removeEventListener('touchmove', onDragMove);
			document.removeEventListener('touchend', onDragEnd);

			// Persist dimensions
			let tmpRemote = tmpSelf.pict.AppData.RetoldRemote;
			if (tmpSelf.isMobileDrawer())
			{
				tmpRemote.SidebarDrawerHeight = tmpWrap.offsetHeight;
			}
			else
			{
				tmpRemote.SidebarWidth = tmpWrap.offsetWidth;
			}
			tmpSelf.pict.PictApplication.saveSettings();

			// Recalculate gallery columns
			let tmpNavProvider = tmpSelf.pict.providers['RetoldRemote-GalleryNavigation'];
			if (tmpNavProvider)
			{
				tmpNavProvider.recalculateColumns();
			}
		}

		tmpHandle.addEventListener('mousedown', onDragStart);
		tmpHandle.addEventListener('touchstart', onDragStart, { passive: false });

		// Double-click/tap on resize handle collapses the sidebar
		tmpHandle.addEventListener('dblclick', function (pEvent)
		{
			pEvent.preventDefault();
			tmpSelf.toggleSidebar();
		});
	}

	/**
	 * Toggle the right-side collections panel open/closed.
	 */
	toggleCollectionsPanel()
	{
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpManager)
		{
			tmpManager.togglePanel();
		}
	}

	/**
	 * Render the favorites list into the Favorites sidebar pane.
	 */
	renderFavoritesList()
	{
		let tmpBody = document.getElementById('RetoldRemote-Favorites-Body');
		if (!tmpBody)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpCollection = tmpRemote.FavoritesCollection;
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpSelf = this;

		if (!tmpCollection || !Array.isArray(tmpCollection.Items) || tmpCollection.Items.length === 0)
		{
			tmpBody.innerHTML = '<div class="retold-remote-favorites-empty">'
				+ '<div style="font-size:1.5rem; margin-bottom:8px; opacity:0.4;">\u2661</div>'
				+ 'No favorites yet.<br>Tap \u2661 or press <b>h</b> to favorite files.'
				+ '</div>';
			return;
		}

		let tmpHTML = '';

		for (let i = 0; i < tmpCollection.Items.length; i++)
		{
			let tmpItem = tmpCollection.Items[i];
			let tmpPath = tmpItem.Path || '';
			let tmpName = tmpPath.split('/').pop() || tmpPath;
			let tmpExt = tmpName.lastIndexOf('.') >= 0 ? tmpName.substring(tmpName.lastIndexOf('.')) : '';

			// Get icon for the file
			let tmpIcon = '';
			if (tmpIconProvider)
			{
				tmpIcon = tmpIconProvider.getIconForEntry({ Type: tmpItem.Type === 'folder' ? 'folder' : 'file', Extension: tmpExt }, 16);
			}

			// Escape single quotes in path for onclick handlers
			let tmpEscapedPath = tmpPath.replace(/'/g, "\\'");

			tmpHTML += '<div class="retold-remote-favorites-item" onclick="pict.PictApplication.navigateToFile(\'' + tmpEscapedPath + '\')">';
			tmpHTML += '<span class="retold-remote-favorites-item-icon">' + tmpIcon + '</span>';
			tmpHTML += '<span class="retold-remote-favorites-item-name" title="' + tmpPath + '">' + tmpName + '</span>';
			tmpHTML += '<button class="retold-remote-favorites-item-remove" onclick="event.stopPropagation(); pict.providers[\'RetoldRemote-CollectionManager\'].toggleFavorite(\'' + tmpEscapedPath + '\')" title="Remove from favorites">\u00d7</button>';
			tmpHTML += '</div>';
		}

		tmpBody.innerHTML = tmpHTML;
	}

	/**
	 * Set up the resize handle for the collections panel (right side).
	 * Dragging LEFT increases width, dragging RIGHT decreases width.
	 */
	_setupCollectionsResizeHandle()
	{
		let tmpHandle = document.querySelector('.retold-remote-collections-resize-handle');
		let tmpWrap = document.getElementById('RetoldRemote-Collections-Wrap');
		if (!tmpHandle || !tmpWrap)
		{
			return;
		}

		let tmpSelf = this;
		let tmpStartX = 0;
		let tmpStartWidth = 0;

		function onDragStart(pEvent)
		{
			if (tmpWrap.classList.contains('collapsed'))
			{
				return;
			}

			pEvent.preventDefault();
			tmpSelf._collectionsDragging = true;
			tmpHandle.classList.add('dragging');

			let tmpClientX = pEvent.touches ? pEvent.touches[0].clientX : pEvent.clientX;
			tmpStartX = tmpClientX;
			tmpStartWidth = tmpWrap.getBoundingClientRect().width;

			document.addEventListener('mousemove', onDragMove);
			document.addEventListener('mouseup', onDragEnd);
			document.addEventListener('touchmove', onDragMove, { passive: false });
			document.addEventListener('touchend', onDragEnd);
		}

		function onDragMove(pEvent)
		{
			if (!tmpSelf._collectionsDragging)
			{
				return;
			}
			pEvent.preventDefault();

			let tmpClientX = pEvent.touches ? pEvent.touches[0].clientX : pEvent.clientX;
			// Dragging left (negative deltaX) increases width
			let tmpDelta = tmpStartX - tmpClientX;
			let tmpNewWidth = Math.max(150, Math.min(600, tmpStartWidth + tmpDelta));
			tmpWrap.style.width = tmpNewWidth + 'px';
		}

		function onDragEnd()
		{
			if (!tmpSelf._collectionsDragging)
			{
				return;
			}

			tmpSelf._collectionsDragging = false;
			tmpHandle.classList.remove('dragging');

			let tmpRemote = tmpSelf.pict.AppData.RetoldRemote;
			tmpRemote.CollectionsPanelWidth = tmpWrap.getBoundingClientRect().width;
			tmpSelf.pict.PictApplication.saveSettings();

			document.removeEventListener('mousemove', onDragMove);
			document.removeEventListener('mouseup', onDragEnd);
			document.removeEventListener('touchmove', onDragMove);
			document.removeEventListener('touchend', onDragEnd);

			// Recalculate gallery columns
			let tmpGalleryNav = tmpSelf.pict.providers['RetoldRemote-GalleryNavigation'];
			if (tmpGalleryNav && typeof tmpGalleryNav.recalculateColumns === 'function')
			{
				tmpGalleryNav.recalculateColumns();
			}
		}

		tmpHandle.addEventListener('mousedown', onDragStart);
		tmpHandle.addEventListener('touchstart', onDragStart, { passive: false });

		// Double-click collapses the collections panel
		tmpHandle.addEventListener('dblclick', function (pEvent)
		{
			pEvent.preventDefault();
			tmpSelf.toggleCollectionsPanel();
		});
	}
}

RetoldRemoteLayoutView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteLayoutView;
