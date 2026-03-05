const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "ContentEditor-Layout",

	DefaultRenderable: "RetoldRemote-Layout-Shell",
	DefaultDestinationAddress: "#ContentEditor-Application-Container",

	AutoRender: false,

	CSS: /*css*/`
		#ContentEditor-Application-Container
		{
			display: flex;
			flex-direction: column;
			height: 100vh;
			height: 100dvh;
			background: var(--retold-bg-primary);
			color: var(--retold-text-primary);
			font-family: var(--retold-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
		}
		#ContentEditor-TopBar-Container
		{
			flex-shrink: 0;
		}
		.content-editor-body
		{
			display: flex;
			flex: 1;
			min-height: 0;
			overflow: hidden;
		}
		/* Sidebar */
		.content-editor-sidebar-wrap
		{
			display: flex;
			flex-shrink: 0;
			position: relative;
			transition: width 0.2s ease;
		}
		.content-editor-sidebar-inner
		{
			display: flex;
			flex-direction: column;
			flex: 1;
			min-width: 0;
			min-height: 0;
			overflow: hidden;
		}
		.content-editor-sidebar-tabs
		{
			display: flex;
			flex-shrink: 0;
			border-bottom: 1px solid var(--retold-border);
			background: var(--retold-bg-secondary);
		}
		.content-editor-sidebar-tab
		{
			flex: 1;
			padding: 7px 0;
			border: none;
			background: transparent;
			font-size: 0.78rem;
			font-weight: 600;
			color: var(--retold-text-muted);
			cursor: pointer;
			border-bottom: 2px solid transparent;
			transition: color 0.15s, border-color 0.15s;
			font-family: inherit;
		}
		.content-editor-sidebar-tab:hover
		{
			color: var(--retold-text-secondary);
		}
		.content-editor-sidebar-tab.active
		{
			color: var(--retold-accent);
			border-bottom-color: var(--retold-accent);
		}
		.content-editor-sidebar-pane
		{
			flex: 1;
			overflow-y: auto;
			overflow-x: hidden;
			min-width: 0;
			min-height: 0;
		}
		#ContentEditor-Sidebar-Container
		{
			background: var(--retold-bg-tertiary);
		}
		/* Collapsed state */
		.content-editor-sidebar-wrap.collapsed
		{
			width: 0 !important;
		}
		.content-editor-sidebar-wrap.collapsed .content-editor-sidebar-inner
		{
			visibility: hidden;
		}
		.content-editor-sidebar-wrap.collapsed .content-editor-resize-handle
		{
			display: none;
		}
		/* Resize handle */
		.content-editor-resize-handle
		{
			flex-shrink: 0;
			width: 5px;
			cursor: col-resize;
			background: transparent;
			border-right: 1px solid var(--retold-border);
			transition: background 0.15s;
		}
		.content-editor-resize-handle:hover,
		.content-editor-resize-handle.dragging
		{
			background: var(--retold-accent);
			border-right-color: var(--retold-accent);
		}
		/* File browser overrides for sidebar */
		#ContentEditor-Sidebar-Container .pict-filebrowser
		{
			border: none;
			border-radius: 0;
			background: transparent;
			color: var(--retold-text-secondary);
		}
		#ContentEditor-Sidebar-Container .pict-filebrowser-browse-pane
		{
			display: none;
		}
		#ContentEditor-Sidebar-Container .pict-filebrowser-view-pane
		{
			display: none;
		}
		#ContentEditor-Sidebar-Container .pict-fb-detail-col-size,
		#ContentEditor-Sidebar-Container .pict-fb-detail-col-modified,
		#ContentEditor-Sidebar-Container .pict-fb-detail-size,
		#ContentEditor-Sidebar-Container .pict-fb-detail-modified
		{
			display: none;
		}
		#ContentEditor-Sidebar-Container .pict-fb-detail-header
		{
			display: none;
		}
		/* Hide the ugly white + button from the breadcrumb bar */
		#ContentEditor-Sidebar-Container .pict-fb-breadcrumb-addfolder
		{
			display: none;
		}
		/* Subtle add-folder button at bottom of file list */
		.retold-remote-sidebar-addfolder
		{
			display: block;
			width: 100%;
			padding: 8px 12px;
			margin-top: 4px;
			border: 1px dashed var(--retold-border);
			border-radius: 4px;
			background: transparent;
			color: var(--retold-text-dim);
			font-size: 0.72rem;
			font-family: inherit;
			cursor: pointer;
			text-align: center;
			transition: color 0.15s, border-color 0.15s, background 0.15s;
		}
		.retold-remote-sidebar-addfolder:hover
		{
			color: var(--retold-text-muted);
			border-color: var(--retold-text-dim);
			background: rgba(128, 128, 128, 0.06);
		}
		#ContentEditor-Sidebar-Container .pict-fb-detail-row
		{
			color: var(--retold-text-secondary);
			border-bottom-color: var(--retold-border);
		}
		#ContentEditor-Sidebar-Container .pict-fb-detail-row:hover
		{
			background: var(--retold-bg-hover);
			color: var(--retold-text-primary);
		}
		#ContentEditor-Sidebar-Container .pict-fb-detail-row.selected
		{
			background: var(--retold-bg-selected);
			color: var(--retold-accent);
		}
		#ContentEditor-Sidebar-Container .pict-fb-detail-row.sidebar-focused
		{
			outline: 2px solid var(--retold-accent);
			outline-offset: -2px;
			background: var(--retold-bg-hover);
			color: var(--retold-text-primary);
		}
		.content-editor-sidebar-inner.keyboard-focused
		{
			box-shadow: inset 0 0 0 1px var(--retold-accent);
		}
		#ContentEditor-Sidebar-Container .pict-fb-breadcrumb-bar
		{
			background: var(--retold-bg-secondary);
			border-bottom-color: var(--retold-border);
		}
		#ContentEditor-Sidebar-Container .pict-fb-breadcrumb
		{
			color: var(--retold-text-muted);
			background: transparent;
			border-bottom: none;
		}
		#ContentEditor-Sidebar-Container .pict-fb-breadcrumb-link
		{
			color: var(--retold-accent);
		}
		#ContentEditor-Sidebar-Container .pict-fb-breadcrumb-segment
		{
			color: var(--retold-accent);
		}
		#ContentEditor-Sidebar-Container .pict-fb-breadcrumb-segment:hover
		{
			background: var(--retold-bg-hover);
		}
		#ContentEditor-Sidebar-Container .pict-fb-breadcrumb-separator
		{
			color: var(--retold-text-dim);
		}
		#ContentEditor-Sidebar-Container .pict-fb-breadcrumb-current
		{
			color: var(--retold-text-primary);
		}
		/* Insert button: hidden by default, visible on row hover for ALL files */
		#ContentEditor-Sidebar-Container .pict-fb-insert-btn
		{
			display: none;
			background: var(--retold-bg-hover);
			color: var(--retold-text-muted);
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			font-size: 0.72rem;
			padding: 1px 6px;
		}
		#ContentEditor-Sidebar-Container .pict-fb-insert-btn:hover
		{
			background: var(--retold-accent);
			color: var(--retold-bg-primary);
			border-color: var(--retold-accent);
		}
		#ContentEditor-Sidebar-Container .pict-fb-detail-row:hover .pict-fb-insert-btn
		{
			display: inline-block;
		}
		/* Main content area */
		#RetoldRemote-Content-Container
		{
			flex: 1;
			overflow-y: auto;
			position: relative;
		}
		#RetoldRemote-Gallery-Container
		{
			padding: 12px;
			padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
			min-height: 100%;
		}
		#RetoldRemote-Viewer-Container
		{
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: var(--retold-bg-viewer);
			display: none;
		}
		/* Also hide the editor container from the parent */
		#ContentEditor-Editor-Container
		{
			display: none;
		}

		/* ---- Favorites Pane ---- */
		.retold-remote-favorites-item
		{
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px 12px;
			border-bottom: 1px solid var(--retold-border);
			cursor: pointer;
			transition: background 0.15s;
			min-height: 36px;
		}
		.retold-remote-favorites-item:hover
		{
			background: var(--retold-bg-hover);
		}
		.retold-remote-favorites-item-icon
		{
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
		}
		.retold-remote-favorites-item-name
		{
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 0.82rem;
			color: var(--retold-text-secondary);
		}
		.retold-remote-favorites-item-remove
		{
			flex-shrink: 0;
			display: inline-flex;
			align-items: center;
			justify-content: center;
			width: 24px;
			height: 24px;
			border: none;
			border-radius: 4px;
			background: transparent;
			color: var(--retold-text-dim);
			font-size: 0.82rem;
			cursor: pointer;
			opacity: 0;
			transition: opacity 0.15s, color 0.15s, background 0.15s;
		}
		.retold-remote-favorites-item:hover .retold-remote-favorites-item-remove
		{
			opacity: 1;
		}
		.retold-remote-favorites-item-remove:hover
		{
			color: #e74c3c;
			background: rgba(231, 76, 60, 0.15);
		}
		.retold-remote-favorites-empty
		{
			padding: 24px 16px;
			text-align: center;
			color: var(--retold-text-dim);
			font-size: 0.82rem;
		}

		/* ---- Right-side Collections Panel ---- */
		.retold-remote-collections-wrap
		{
			display: flex;
			flex-shrink: 0;
			position: relative;
			transition: width 0.2s ease;
			border-left: 1px solid var(--retold-border);
		}
		.retold-remote-collections-wrap.collapsed
		{
			width: 0 !important;
			border-left: none;
		}
		.retold-remote-collections-wrap.collapsed .retold-remote-collections-inner
		{
			visibility: hidden;
		}
		.retold-remote-collections-wrap.collapsed .retold-remote-collections-resize-handle
		{
			display: none;
		}
		.retold-remote-collections-inner
		{
			display: flex;
			flex-direction: column;
			flex: 1;
			min-width: 0;
			min-height: 0;
			overflow: hidden;
			background: var(--retold-bg-primary);
		}
		.retold-remote-collections-resize-handle
		{
			position: absolute;
			left: 0;
			top: 0;
			bottom: 0;
			width: 5px;
			cursor: col-resize;
			z-index: 10;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.retold-remote-collections-resize-handle:hover
		{
			background: var(--retold-accent);
			opacity: 0.3;
		}

		/* ============================================================
		   MOBILE: Sidebar becomes a top drawer
		   ============================================================ */
		@media (max-width: 600px)
		{
			.content-editor-body
			{
				flex-direction: column;
			}

			/* Sidebar becomes a top section with a height instead of width */
			.content-editor-sidebar-wrap
			{
				width: 100% !important;
				height: 33vh;
				height: 33dvh;
				transition: height 0.2s ease;
				flex-direction: column;
			}

			.content-editor-sidebar-wrap.collapsed
			{
				width: 100% !important;
				height: 0 !important;
			}

			/* Resize handle becomes horizontal bar at the bottom of the drawer */
			.content-editor-resize-handle
			{
				width: 100%;
				height: 8px;
				cursor: row-resize;
				border-right: none;
				border-bottom: 1px solid var(--retold-border);
				display: flex;
				align-items: center;
				justify-content: center;
			}

			.content-editor-resize-handle::after
			{
				content: '';
				display: block;
				width: 36px;
				height: 3px;
				border-radius: 2px;
				background: var(--retold-text-placeholder);
				opacity: 0.5;
			}

			.content-editor-resize-handle:hover::after,
			.content-editor-resize-handle.dragging::after
			{
				background: var(--retold-accent);
				opacity: 1;
			}

			/* Sidebar inner fills the drawer */
			.content-editor-sidebar-inner
			{
				flex: 1;
				min-height: 0;
			}

			/* Content takes remaining space */
			#RetoldRemote-Content-Container
			{
				flex: 1;
				min-height: 0;
			}

			/* Gallery: don't force min-height on small screens */
			#RetoldRemote-Gallery-Container
			{
				min-height: auto;
			}

			/* Show collections tab on mobile */
			.content-editor-sidebar-tab-collections
			{
				display: block !important;
			}

			/* Collections right-side panel: hidden on mobile (content moves to sidebar tab) */
			.retold-remote-collections-wrap,
			.retold-remote-collections-wrap.collapsed
			{
				display: none !important;
				height: 0 !important;
			}
		}
	`,

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
								<button class="content-editor-sidebar-tab" data-tab="settings" onclick="pict.views['ContentEditor-Layout'].switchSidebarTab('settings')">Settings</button>
								<button class="content-editor-sidebar-tab content-editor-sidebar-tab-collections" data-tab="collections" onclick="pict.views['ContentEditor-Layout'].switchSidebarTab('collections')" style="display:none;">Collections</button>
							</div>
							<div class="content-editor-sidebar-pane" data-pane="files" id="ContentEditor-Sidebar-Container"></div>
							<div class="content-editor-sidebar-pane" data-pane="favorites" id="RetoldRemote-Favorites-Container" style="display:none">
								<div id="RetoldRemote-Favorites-Body"></div>
							</div>
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
