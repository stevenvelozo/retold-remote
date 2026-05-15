const libPictView = require('pict-view');

/**
 * ContentEditor-Layout — retold-remote's application chrome.
 *
 * Overrides retold-content-system's ContentEditor-Layout. Built on
 * pict-section-modal's shell() API; everything other than the
 * upload/operation overlays lives in shell panels.
 *
 * Panel layout:
 *
 *   ┌────────────────────────────────────────────────────────────┐
 *   │ #Theme-TopBar  (top, fixed, 48px) — BrandMark + Nav + User │
 *   ├──────────┬──────────────────────────────┬──────────────────┤
 *   │ #RR-     │ #RR-Content-Container        │ #RR-Collections  │
 *   │ Sidebar- │  (gallery + viewer)          │ -Container       │
 *   │ Host     │                              │ (right, collaps) │
 *   │ (left,   │                              │                  │
 *   │ tabs,    │                              │                  │
 *   │ drawer   │                              │                  │
 *   │ <900px)  │                              │                  │
 *   └──────────┴──────────────────────────────┴──────────────────┘
 *
 * Plus #RetoldRemote-Settings-Panel — a Hidden panel that overlays from
 * the right when the gear button in the user slot toggles it. No edge
 * affordance: collapsed = display:none. Gear is the only way in.
 */

const _ViewConfiguration =
{
	ViewIdentifier: "ContentEditor-Layout",

	DefaultRenderable: "RetoldRemote-Layout-Shell",
	DefaultDestinationAddress: "#ContentEditor-Application-Container",

	AutoRender: false,

	CSS: /*css*/`
		/* height: 100% (not 100vh) so Theme-Scale's CSS zoom on <html>
		   doesn't push panels off-screen. */
		#ContentEditor-Application-Container
		{
			height: 100%;
			min-height: 0;
			overflow: hidden;
		}
		html, body { height: 100%; margin: 0; padding: 0; }
		.pict-modal-shell-host { height: 100%; }
		.pict-modal-shell        { background: var(--theme-color-background-primary, var(--retold-bg-primary, #1E1E1E)); }
		.pict-modal-shell-panel  { background: var(--theme-color-background-panel,   var(--retold-bg-panel,   #202020)); }
		.pict-modal-shell-center { background: var(--theme-color-background-primary, var(--retold-bg-primary, #1E1E1E)); }

		/* Gallery + viewer host inside the shell center. */
		#RetoldRemote-Content-Container
		{
			height: 100%;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		#RetoldRemote-Gallery-Container,
		#RetoldRemote-Viewer-Container
		{
			flex: 1;
			min-height: 0;
		}

		/* The Collections panel's inner div (set up by addPanel) needs to
		   stretch fully so the CollectionsPanel view can flex its rows. */
		#RetoldRemote-Collections-Container
		{
			height: 100%;
			min-height: 0;
			display: flex;
			flex-direction: column;
		}

		/* Settings panel destination — themed surface. */
		#RetoldRemote-Settings-Panel
		{
			height: 100%;
			min-height: 0;
			overflow-y: auto;
			background: var(--theme-color-background-panel, var(--retold-bg-panel, #202020));
			color: var(--theme-color-text-primary, var(--retold-text-primary, #E0E0E0));
			border-left: 1px solid var(--theme-color-border-default, var(--retold-border-default, #333));
		}
	`,

	Templates:
	[
		{
			Hash: "RetoldRemote-Layout-Shell",
			// Minimal template: the shell takes over the mount div and
			// builds its own DOM. The operation-status overlay is rendered
			// here as a sibling so it floats above the shell.
			Template: /*html*/`
<div id="RetoldRemote-Layout-Mount" style="height:100%"></div>
<div class="retold-remote-operation-status" id="RetoldRemote-OperationStatus-Container"></div>
`
		}
	],

	Renderables:
	[
		{
			RenderableHash: "RetoldRemote-Layout-Shell",
			TemplateHash: "RetoldRemote-Layout-Shell",
			DestinationAddress: "#ContentEditor-Application-Container",
			RenderMethod: "replace"
		}
	]
};

class RetoldRemoteLayoutView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this._shell = null;
		this._shellPanelsBuilt = false;
	}

	onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent)
	{
		this.pict.CSSMap.injectCSS();

		if (!this._shellPanelsBuilt)
		{
			this._buildShell();
			this._shellPanelsBuilt = true;
		}

		this._wireHashChangeListener();

		return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
	}

	_buildShell()
	{
		let tmpModalSection = this.pict.views['Pict-Section-Modal'];
		if (!tmpModalSection || typeof tmpModalSection.shell !== 'function')
		{
			this.pict.log.warn('ContentEditor-Layout: pict-section-modal.shell not available');
			return;
		}

		let tmpMount = document.getElementById('RetoldRemote-Layout-Mount');
		if (!tmpMount)
		{
			this.pict.log.warn('ContentEditor-Layout: #RetoldRemote-Layout-Mount not in DOM yet');
			return;
		}

		let tmpRemote = (this.pict.AppData && this.pict.AppData.RetoldRemote) || {};
		let tmpIsMobile = (typeof window !== 'undefined' && window.innerWidth <= 600);

		this._shell = tmpModalSection.shell(tmpMount, { PersistenceKey: 'retold-remote' });

		// Top — theme chrome. Theme-TopBar fills it with BrandMark on the
		// left, host-supplied NavView (RetoldRemote-TopBar-Nav) for the
		// breadcrumb + folder summary, and host-supplied UserView
		// (RetoldRemote-TopBar-User) with action buttons + gear.
		this._shell.addPanel(
		{
			Hash: 'topbar',
			Side: 'top',
			Mode: 'fixed',
			Size: 48,
			ContentDestinationId: 'Theme-TopBar',
			ContentView: 'Theme-TopBar'
		});

		// Left — sidebar with tab strip (Files / Favorites / Info /
		// Regions / Collections-mobile). Hosted by RetoldRemote-Sidebar.
		this._shell.addPanel(
		{
			Hash: 'sidebar',
			Side: 'left',
			Mode: 'resizable',
			Size: (typeof tmpRemote.SidebarWidth === 'number' && tmpRemote.SidebarWidth > 0) ? tmpRemote.SidebarWidth : 250,
			MinSize: 150,
			MaxSize: 600,
			Collapsed: !!tmpRemote.SidebarCollapsed,
			Title: 'Files',
			ContentDestinationId: 'RetoldRemote-Sidebar-Host',
			ContentView: 'RetoldRemote-Sidebar',
			ResponsiveDrawer: 900
		});

		// Right — Collections panel. Starts collapsed; opened via the
		// toggle button in the topbar's User slot.
		this._shell.addPanel(
		{
			Hash: 'collections',
			Side: 'right',
			Mode: 'resizable',
			Size: (typeof tmpRemote.CollectionsPanelWidth === 'number' && tmpRemote.CollectionsPanelWidth > 0) ? tmpRemote.CollectionsPanelWidth : 300,
			MinSize: 240,
			MaxSize: 600,
			Collapsed: !tmpRemote.CollectionsPanelOpen,
			Title: 'Collections',
			ContentDestinationId: 'RetoldRemote-Collections-Container',
			ContentView: 'RetoldRemote-CollectionsPanel'
		});

		// Right (overlay, Hidden) — settings panel. Hidden:true means no
		// edge affordance when collapsed; the gear button in the User
		// slot is the only way to reveal it. Overlay floats above the
		// collections panel rather than pushing it aside.
		this._shell.addPanel(
		{
			Hash: 'settings',
			Side: 'right',
			Mode: 'resizable',
			Position: 'overlay',
			Size: 360,
			MinSize: 280,
			MaxSize: 540,
			Hidden: true,
			Collapsed: true,
			ContentDestinationId: 'RetoldRemote-Settings-Panel',
			ContentView: 'RetoldRemote-SettingsPanel'
		});

		// Center — gallery / viewer workspace.
		this._shell.center({ ContentDestinationId: 'RetoldRemote-Content-Container' });
		// The center destination gets its inner divs after creation so
		// that the gallery + viewer views have stable host elements.
		let tmpCenterEl = this._shell.getCenterEl();
		if (tmpCenterEl)
		{
			let tmpContentEl = document.getElementById('RetoldRemote-Content-Container') || tmpCenterEl;
			if (!document.getElementById('RetoldRemote-Gallery-Container'))
			{
				tmpContentEl.innerHTML = '<div id="RetoldRemote-Gallery-Container"></div>'
					+ '<div id="RetoldRemote-Viewer-Container"></div>';
			}
		}
	}

	// ─────────────────────────────────────────────
	// Panel accessors used by other views (e.g. the gear button in
	// TopBar-User → toggleSettingsPanel())
	// ─────────────────────────────────────────────

	getSidebarPanel()
	{
		return this._shell ? this._shell.getPanel('sidebar') : null;
	}

	getCollectionsPanel()
	{
		return this._shell ? this._shell.getPanel('collections') : null;
	}

	getSettingsPanel()
	{
		return this._shell ? this._shell.getPanel('settings') : null;
	}

	getTopbarPanel()
	{
		return this._shell ? this._shell.getPanel('topbar') : null;
	}

	toggleSidebar()
	{
		let tmpPanel = this.getSidebarPanel();
		if (tmpPanel) { tmpPanel.toggle(); }

		// Recalculate gallery columns after sidebar resize
		let tmpNavProvider = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNavProvider)
		{
			setTimeout(() => tmpNavProvider.recalculateColumns(), 250);
		}
	}

	toggleCollectionsPanel()
	{
		let tmpManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpManager)
		{
			tmpManager.togglePanel();
		}
	}

	toggleSettingsPanel()
	{
		let tmpPanel = this.getSettingsPanel();
		if (tmpPanel) { tmpPanel.toggle(); }
	}

	/**
	 * Mobile-drawer detection retained for compatibility with the
	 * collections-toggle icon logic and a couple of viewer callers.
	 * The shell now owns the actual drawer behavior (ResponsiveDrawer:
	 * 900 on the sidebar panel), so this just reports the same boolean.
	 */
	isMobileDrawer()
	{
		return typeof window !== 'undefined' && window.innerWidth <= 900;
	}

	/**
	 * Forward to the sidebar view's switchTab. Kept on the Layout
	 * surface for backwards compatibility with viewers / providers
	 * that call ContentEditor-Layout.switchSidebarTab().
	 */
	switchSidebarTab(pTab)
	{
		let tmpSidebar = this.pict.views['RetoldRemote-Sidebar'];
		if (tmpSidebar && typeof tmpSidebar.switchTab === 'function')
		{
			tmpSidebar.switchTab(pTab);
		}
	}

	/**
	 * Forward the file-changed notification so the sidebar can refresh
	 * file-scoped panes (Info / Regions). Called by viewers when the
	 * current file changes.
	 */
	notifyCurrentFileChanged(pFilePath)
	{
		let tmpSidebar = this.pict.views['RetoldRemote-Sidebar'];
		if (tmpSidebar && typeof tmpSidebar.notifyCurrentFileChanged === 'function')
		{
			tmpSidebar.notifyCurrentFileChanged(pFilePath);
		}
	}

	/**
	 * Re-render the favorites list (called after favorites mutations).
	 */
	renderFavoritesList()
	{
		let tmpSidebar = this.pict.views['RetoldRemote-Sidebar'];
		if (tmpSidebar && typeof tmpSidebar.renderFavoritesList === 'function')
		{
			tmpSidebar.renderFavoritesList();
		}
	}

	_wireHashChangeListener()
	{
		if (this._hashListenerWired) { return; }
		this._hashListenerWired = true;
		let tmpSelf = this;
		window.addEventListener('hashchange', () =>
		{
			if (tmpSelf.pict.PictApplication && typeof tmpSelf.pict.PictApplication.resolveHash === 'function')
			{
				tmpSelf.pict.PictApplication.resolveHash();
			}
		});
	}
}

RetoldRemoteLayoutView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteLayoutView;
