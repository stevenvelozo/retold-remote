const libPictView = require('pict-view');

/**
 * PictView-Remote-Sidebar — the tabbed sidebar (Files / Favorites /
 * Info / Regions / Collections-mobile). Rendered into the
 * #RetoldRemote-Sidebar-Host destination of the shell's left panel.
 *
 * The tab strip + pane containers are emitted by the template. The
 * actual contents of each pane are rendered by other views into the
 * pane's destination div:
 *
 *   Files       → #ContentEditor-Sidebar-Container   (pict-section-filebrowser)
 *   Favorites   → #RetoldRemote-Favorites-Body       (rendered inline by this view)
 *   Info        → #RetoldRemote-Info-Container       (RetoldRemote-FileInfoPanel)
 *   Regions     → #RetoldRemote-Subimages-Container  (RetoldRemote-SubimagesPanel)
 *   Collections → #RetoldRemote-Collections-MobilePane (Collections panel content
 *                                                       relocated on narrow widths)
 *
 * The Settings tab is intentionally absent — settings live in the
 * hidden overlay panel triggered by the gear button in the topbar.
 */

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-Sidebar",

	DefaultRenderable: "RetoldRemote-Sidebar-Display",
	DefaultDestinationAddress: "#RetoldRemote-Sidebar-Host",

	AutoRender: false,

	CSS: /*css*/`
		#RetoldRemote-Sidebar-Host
		{
			height: 100%;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		.content-editor-sidebar-inner
		{
			flex: 1;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		/* Tab strip + pane styles still live in retold-remote.css. */
	`,

	Templates:
	[
		{
			Hash: "RetoldRemote-Sidebar-Template",
			Template: /*html*/`
<div class="content-editor-sidebar-inner">
	<div class="content-editor-sidebar-tabs">
		<button class="content-editor-sidebar-tab active" data-tab="files"
			onclick="pict.views['RetoldRemote-Sidebar'].switchTab('files')">Files</button>
		<button class="content-editor-sidebar-tab" data-tab="favorites"
			onclick="pict.views['RetoldRemote-Sidebar'].switchTab('favorites')">Favorites</button>
		<button class="content-editor-sidebar-tab" data-tab="info"
			onclick="pict.views['RetoldRemote-Sidebar'].switchTab('info')">Info</button>
		<button class="content-editor-sidebar-tab" data-tab="subimages"
			onclick="pict.views['RetoldRemote-Sidebar'].switchTab('subimages')">Regions</button>
		<button class="content-editor-sidebar-tab content-editor-sidebar-tab-collections" data-tab="collections"
			onclick="pict.views['RetoldRemote-Sidebar'].switchTab('collections')"
			style="display:none;">Collections</button>
	</div>
	<div class="content-editor-sidebar-pane" data-pane="files" id="ContentEditor-Sidebar-Container"></div>
	<div class="content-editor-sidebar-pane" data-pane="favorites" id="RetoldRemote-Favorites-Container" style="display:none">
		<div id="RetoldRemote-Favorites-Body"></div>
	</div>
	<div class="content-editor-sidebar-pane" data-pane="info" id="RetoldRemote-Info-Container" style="display:none"></div>
	<div class="content-editor-sidebar-pane" data-pane="subimages" id="RetoldRemote-Subimages-Container" style="display:none"></div>
	<div class="content-editor-sidebar-pane" data-pane="collections" id="RetoldRemote-Collections-MobilePane" style="display:none"></div>
</div>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: "RetoldRemote-Sidebar-Display",
			TemplateHash: "RetoldRemote-Sidebar-Template",
			DestinationAddress: "#RetoldRemote-Sidebar-Host",
			RenderMethod: "replace"
		}
	]
};

class RetoldRemoteSidebarView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent)
	{
		this.pict.CSSMap.injectCSS();
		return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
	}

	/**
	 * Activate one of the sidebar tabs (files / favorites / info /
	 * subimages / collections). Shows the corresponding pane, hides
	 * the others, and triggers any lazy-render needed for the pane.
	 */
	switchTab(pTab)
	{
		let tmpTabs = document.querySelectorAll('.content-editor-sidebar-tab');
		tmpTabs.forEach((pEl) =>
		{
			pEl.classList.toggle('active', pEl.getAttribute('data-tab') === pTab);
		});

		let tmpPanes = document.querySelectorAll('.content-editor-sidebar-pane');
		tmpPanes.forEach((pEl) =>
		{
			pEl.style.display = (pEl.getAttribute('data-pane') === pTab) ? '' : 'none';
		});

		if (pTab === 'subimages')
		{
			let tmpSubimagesView = this.pict.views['RetoldRemote-SubimagesPanel'];
			if (tmpSubimagesView)
			{
				tmpSubimagesView.render();
			}
		}

		if (pTab === 'favorites')
		{
			this.renderFavoritesList();
		}

		if (pTab === 'info')
		{
			let tmpInfoView = this.pict.views['RetoldRemote-FileInfoPanel'];
			if (tmpInfoView)
			{
				tmpInfoView.render();
			}
		}

		if (pTab === 'collections')
		{
			let tmpCollContainer = document.getElementById('RetoldRemote-Collections-Container');
			let tmpMobilePane = document.getElementById('RetoldRemote-Collections-MobilePane');
			if (tmpCollContainer && tmpMobilePane && !tmpMobilePane.contains(tmpCollContainer))
			{
				tmpMobilePane.appendChild(tmpCollContainer);
			}
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

	/**
	 * Re-render whichever sidebar tab owns file-scoped state when the
	 * currently-viewed file changes. Called from viewers that mutate
	 * tmpRemote.CurrentViewerFile and from the gallery clear path.
	 */
	notifyCurrentFileChanged(pFilePath)
	{
		let tmpActiveTab = document.querySelector('.content-editor-sidebar-tab.active');
		if (!tmpActiveTab)
		{
			return;
		}
		let tmpTab = tmpActiveTab.getAttribute('data-tab');

		if (tmpTab === 'subimages')
		{
			let tmpSubimagesView = this.pict.views['RetoldRemote-SubimagesPanel'];
			if (tmpSubimagesView)
			{
				tmpSubimagesView.render();
			}
		}
		else if (tmpTab === 'info')
		{
			let tmpInfoView = this.pict.views['RetoldRemote-FileInfoPanel'];
			if (tmpInfoView)
			{
				tmpInfoView.render();
			}
		}
	}

	/**
	 * Render the favorites list into the Favorites sidebar pane.
	 * Reads from AppData.RetoldRemote.FavoritesCollection.
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

		if (!tmpCollection || !Array.isArray(tmpCollection.Items) || tmpCollection.Items.length === 0)
		{
			tmpBody.innerHTML = '<div class="retold-remote-favorites-empty">'
				+ '<div style="font-size:1.5rem; margin-bottom:8px; opacity:0.4;">♡</div>'
				+ 'No favorites yet.<br>Tap ♡ or press <b>h</b> to favorite files.'
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

			let tmpIcon = '';
			if (tmpIconProvider)
			{
				tmpIcon = tmpIconProvider.getIconForEntry({ Type: tmpItem.Type === 'folder' ? 'folder' : 'file', Extension: tmpExt }, 16);
			}

			let tmpEscapedPath = tmpPath.replace(/'/g, "\\'");

			tmpHTML += '<div class="retold-remote-favorites-item" onclick="pict.PictApplication.navigateToFile(\'' + tmpEscapedPath + '\')">';
			tmpHTML += '<span class="retold-remote-favorites-item-icon">' + tmpIcon + '</span>';
			tmpHTML += '<span class="retold-remote-favorites-item-name" title="' + tmpPath + '">' + tmpName + '</span>';
			tmpHTML += '<button class="retold-remote-favorites-item-remove" onclick="event.stopPropagation(); pict.providers[\'RetoldRemote-CollectionManager\'].toggleFavorite(\'' + tmpEscapedPath + '\')" title="Remove from favorites">×</button>';
			tmpHTML += '</div>';
		}

		tmpBody.innerHTML = tmpHTML;
	}
}

module.exports = RetoldRemoteSidebarView;
module.exports.default_configuration = _ViewConfiguration;
