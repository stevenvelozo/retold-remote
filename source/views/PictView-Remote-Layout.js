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
		#ContentEditor-Sidebar-Container .pict-fb-breadcrumbs
		{
			color: var(--retold-text-muted);
			background: var(--retold-bg-secondary);
			border-bottom-color: var(--retold-border);
		}
		#ContentEditor-Sidebar-Container .pict-fb-breadcrumb-link
		{
			color: var(--retold-accent);
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
								<button class="content-editor-sidebar-tab" data-tab="settings" onclick="pict.views['ContentEditor-Layout'].switchSidebarTab('settings')">Settings</button>
							</div>
							<div class="content-editor-sidebar-pane" data-pane="files" id="ContentEditor-Sidebar-Container"></div>
							<div class="content-editor-sidebar-pane" data-pane="settings" id="RetoldRemote-Settings-Container" style="display:none"></div>
						</div>
						<div class="content-editor-resize-handle"></div>
					</div>
					<div id="RetoldRemote-Content-Container">
						<div id="RetoldRemote-Gallery-Container"></div>
						<div id="RetoldRemote-Viewer-Container"></div>
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
		if (tmpRemote && tmpRemote.SidebarWidth)
		{
			let tmpWrap = document.querySelector('.content-editor-sidebar-wrap');
			if (tmpWrap && !tmpWrap.classList.contains('collapsed'))
			{
				tmpWrap.style.width = tmpRemote.SidebarWidth + 'px';
			}
		}

		// Listen for hash changes (browser back/forward)
		let tmpSelf = this;
		window.addEventListener('hashchange', () =>
		{
			tmpSelf.pict.PictApplication.resolveHash();
		});
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
		tmpRemote.SidebarCollapsed = tmpWrap.classList.contains('collapsed');
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
		let tmpStartWidth = 0;

		function onMouseDown(pEvent)
		{
			tmpSelf._sidebarDragging = true;
			tmpStartX = pEvent.clientX;
			tmpStartWidth = tmpWrap.offsetWidth;
			tmpHandle.classList.add('dragging');
			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
			pEvent.preventDefault();
		}

		function onMouseMove(pEvent)
		{
			if (!tmpSelf._sidebarDragging) return;
			let tmpNewWidth = tmpStartWidth + (pEvent.clientX - tmpStartX);
			tmpNewWidth = Math.max(150, Math.min(tmpNewWidth, 600));
			tmpWrap.style.width = tmpNewWidth + 'px';
		}

		function onMouseUp()
		{
			tmpSelf._sidebarDragging = false;
			tmpHandle.classList.remove('dragging');
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);

			// Persist width
			let tmpRemote = tmpSelf.pict.AppData.RetoldRemote;
			tmpRemote.SidebarWidth = tmpWrap.offsetWidth;
			tmpSelf.pict.PictApplication.saveSettings();

			// Recalculate gallery columns
			let tmpNavProvider = tmpSelf.pict.providers['RetoldRemote-GalleryNavigation'];
			if (tmpNavProvider)
			{
				tmpNavProvider.recalculateColumns();
			}
		}

		tmpHandle.addEventListener('mousedown', onMouseDown);

		// Double-click on resize handle collapses the sidebar
		tmpHandle.addEventListener('dblclick', function (pEvent)
		{
			pEvent.preventDefault();
			tmpSelf.toggleSidebar();
		});
	}
}

RetoldRemoteLayoutView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteLayoutView;
