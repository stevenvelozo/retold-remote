const libPictView = require('pict-view');

/**
 * Regions Browser — folder-scoped listing of saved subimage regions
 * across all files.
 *
 * Opened from the topbar &#9635; button. Shows a folder tree on the left
 * and a list of files with their regions on the right. Click a region
 * to close the browser and jump to it.
 *
 * Backing data: GET /api/media/subimage-regions?folder=<prefix>
 * Returns { Success, Folder, Files: [{ Path, Regions }] }
 *
 * Scales via a server-side in-memory cache keyed on a full enumeration
 * of the Bibliograph subimage-regions source. The folder prefix is
 * applied as a client-visible filter; the cache is invalidated on every
 * mutation so updates are near-instantaneous in the typical case.
 */
const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-RegionsBrowser",
	DefaultRenderable: "RetoldRemote-RegionsBrowser",
	DefaultDestinationAddress: "#RetoldRemote-RegionsBrowser-Overlay",
	AutoRender: false,

	CSS: `
		#RetoldRemote-RegionsBrowser-Overlay
		{
			position: fixed;
			top: 0; left: 0; right: 0; bottom: 0;
			background: rgba(0, 0, 0, 0.85);
			z-index: 10000;
			display: none;
			flex-direction: column;
		}
		#RetoldRemote-RegionsBrowser-Overlay.active { display: flex; }
		.rrrb-header
		{
			display: flex;
			align-items: center;
			gap: 12px;
			padding: 8px 14px;
			background: var(--retold-bg-panel, #282c34);
			border-bottom: 1px solid var(--retold-border, #3e4451);
			color: var(--retold-text, #abb2bf);
		}
		.rrrb-header-title
		{
			font-size: 0.95rem;
			font-weight: 600;
			flex: 1;
		}
		.rrrb-header button
		{
			background: var(--retold-bg-input, #1e1e1e);
			color: var(--retold-text, #abb2bf);
			border: 1px solid var(--retold-border, #3e4451);
			border-radius: 4px;
			padding: 4px 10px;
			font-size: 0.78rem;
			cursor: pointer;
		}
		.rrrb-body
		{
			flex: 1;
			display: flex;
			overflow: hidden;
		}
		.rrrb-tree
		{
			width: 260px;
			overflow-y: auto;
			background: var(--retold-bg-panel, #21252b);
			border-right: 1px solid var(--retold-border, #3e4451);
			padding: 8px 0;
		}
		.rrrb-tree-node
		{
			padding: 5px 14px;
			color: var(--retold-text, #abb2bf);
			cursor: pointer;
			font-size: 0.82rem;
			white-space: nowrap;
			overflow: hidden;
			text-overflow: ellipsis;
		}
		.rrrb-tree-node:hover { background: var(--retold-bg-hover, rgba(255,255,255,0.05)); }
		.rrrb-tree-node.active
		{
			background: var(--retold-accent, rgba(97,175,239,0.15));
			color: var(--retold-text-bright, #e0e0e0);
			font-weight: 600;
		}
		.rrrb-tree-count
		{
			color: var(--retold-text-dim, #707880);
			font-size: 0.72rem;
			margin-left: 4px;
		}
		.rrrb-list
		{
			flex: 1;
			overflow-y: auto;
			background: var(--retold-bg, #181a1f);
			padding: 8px 14px;
		}
		.rrrb-list-empty
		{
			color: var(--retold-text-dim, #707880);
			text-align: center;
			padding: 40px 20px;
			font-size: 0.9rem;
		}
		.rrrb-file-group
		{
			margin-bottom: 16px;
			border: 1px solid var(--retold-border, #3e4451);
			border-radius: 6px;
			background: var(--retold-bg-panel, #21252b);
			overflow: hidden;
		}
		.rrrb-file-header
		{
			padding: 8px 12px;
			background: var(--retold-bg-panel-alt, #282c34);
			color: var(--retold-text, #abb2bf);
			font-size: 0.82rem;
			font-weight: 600;
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.rrrb-file-name
		{
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
		.rrrb-file-count
		{
			color: var(--retold-text-dim, #707880);
			font-size: 0.72rem;
		}
		.rrrb-regions
		{
			padding: 6px 12px 10px 12px;
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
		}
		.rrrb-region
		{
			background: var(--retold-bg-input, #1e1e1e);
			border: 1px solid var(--retold-border, #3e4451);
			border-radius: 4px;
			padding: 5px 10px;
			font-size: 0.75rem;
			color: var(--retold-text, #abb2bf);
			cursor: pointer;
			display: inline-flex;
			align-items: center;
			gap: 6px;
		}
		.rrrb-region:hover { background: var(--retold-bg-hover, rgba(255,255,255,0.08)); border-color: var(--retold-accent, #61afef); }
		.rrrb-region-label { font-weight: 600; }
		.rrrb-region-dims { color: var(--retold-text-dim, #707880); font-size: 0.68rem; }
	`,

	Templates:
	[
		{
			Hash: "RetoldRemote-RegionsBrowser",
			Template: /*html*/`
				<div id="RetoldRemote-RegionsBrowser-Overlay">
					<div class="rrrb-header">
						<div class="rrrb-header-title" id="RetoldRemote-RegionsBrowser-Title">Regions Browser</div>
						<button onclick="pict.views['RetoldRemote-RegionsBrowser'].refresh()" title="Reload">&#8635; Reload</button>
						<button onclick="pict.views['RetoldRemote-RegionsBrowser'].close()" title="Close (Esc)">&#10005; Close</button>
					</div>
					<div class="rrrb-body">
						<div class="rrrb-tree" id="RetoldRemote-RegionsBrowser-Tree"></div>
						<div class="rrrb-list" id="RetoldRemote-RegionsBrowser-List"></div>
					</div>
				</div>
			`
		}
	],

	Renderables:
	[
		{
			RenderableHash: "RetoldRemote-RegionsBrowser",
			TemplateHash: "RetoldRemote-RegionsBrowser",
			DestinationAddress: "#RetoldRemote-RegionsBrowser-Container"
		}
	]
};

class RetoldRemoteRegionsBrowserView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		// Server response: [{ Path, Regions: [...] }, ...]
		this._allFiles = [];

		// Currently-highlighted folder in the tree. '' = root (all files).
		this._selectedFolder = '';

		// Keydown handler ref for add/remove
		this._keyHandler = null;
	}

	/**
	 * Open the browser overlay, render the UI, and fetch the full list
	 * of regions from the server.
	 */
	open()
	{
		// Ensure the overlay container exists in the DOM
		this._ensureOverlayContainer();

		// Render the shell
		this.render();

		// Make the overlay visible
		let tmpOverlay = document.getElementById('RetoldRemote-RegionsBrowser-Overlay');
		if (tmpOverlay) tmpOverlay.classList.add('active');

		// Seed the selected folder from the gallery's current location
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpCurrentLocation = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';
		this._selectedFolder = tmpCurrentLocation.replace(/\/+$/, '').replace(/^\/+/, '');

		// Install Escape-to-close
		let tmpSelf = this;
		this._keyHandler = function (pEvent)
		{
			if (pEvent.key === 'Escape')
			{
				pEvent.preventDefault();
				pEvent.stopPropagation();
				tmpSelf.close();
			}
		};
		document.addEventListener('keydown', this._keyHandler, true);

		// Fetch regions from the server
		this._fetchRegions();
	}

	/**
	 * Close the browser overlay.
	 */
	close()
	{
		let tmpOverlay = document.getElementById('RetoldRemote-RegionsBrowser-Overlay');
		if (tmpOverlay) tmpOverlay.classList.remove('active');

		if (this._keyHandler)
		{
			document.removeEventListener('keydown', this._keyHandler, true);
			this._keyHandler = null;
		}
	}

	/**
	 * Re-fetch the full regions list from the server (bypassing the
	 * in-memory cache on the server is not possible, but this will
	 * return the current cached values).
	 */
	refresh()
	{
		this._fetchRegions();
	}

	/**
	 * Ensure the overlay destination container exists in the DOM tree.
	 * Appends it to the body on first call.
	 */
	_ensureOverlayContainer()
	{
		let tmpContainer = document.getElementById('RetoldRemote-RegionsBrowser-Container');
		if (!tmpContainer)
		{
			tmpContainer = document.createElement('div');
			tmpContainer.id = 'RetoldRemote-RegionsBrowser-Container';
			document.body.appendChild(tmpContainer);
		}
	}

	/**
	 * Fetch all regions from the server (empty folder prefix returns
	 * everything, which is cheap thanks to the server-side cache).
	 */
	_fetchRegions()
	{
		let tmpSelf = this;
		let tmpListEl = document.getElementById('RetoldRemote-RegionsBrowser-List');
		let tmpTreeEl = document.getElementById('RetoldRemote-RegionsBrowser-Tree');
		if (tmpListEl) tmpListEl.innerHTML = '<div class="rrrb-list-empty">Loading\u2026</div>';
		if (tmpTreeEl) tmpTreeEl.innerHTML = '';

		fetch('/api/media/subimage-regions?folder=')
			.then((pResponse) => pResponse.json())
			.then((pResult) =>
			{
				if (!pResult || !pResult.Success || !Array.isArray(pResult.Files))
				{
					tmpSelf._allFiles = [];
					tmpSelf._renderTree();
					tmpSelf._renderList();
					return;
				}
				tmpSelf._allFiles = pResult.Files;
				tmpSelf._renderTree();
				tmpSelf._renderList();
			})
			.catch((pError) =>
			{
				if (tmpListEl)
				{
					tmpListEl.innerHTML = '<div class="rrrb-list-empty">Failed to load: '
						+ (pError && pError.message ? pError.message : 'unknown error')
						+ '</div>';
				}
			});
	}

	/**
	 * Build the folder tree from the list of files and render it.
	 * Folders are derived from the parent directories of each file path.
	 */
	_renderTree()
	{
		let tmpTreeEl = document.getElementById('RetoldRemote-RegionsBrowser-Tree');
		if (!tmpTreeEl) return;

		// Build a map of folder → total region count
		let tmpFolderCounts = {};
		tmpFolderCounts[''] = 0; // root
		for (let i = 0; i < this._allFiles.length; i++)
		{
			let tmpEntry = this._allFiles[i];
			let tmpRegionCount = Array.isArray(tmpEntry.Regions) ? tmpEntry.Regions.length : 0;
			tmpFolderCounts[''] += tmpRegionCount;

			let tmpParts = (tmpEntry.Path || '').split('/');
			tmpParts.pop(); // remove file name
			let tmpAcc = '';
			for (let j = 0; j < tmpParts.length; j++)
			{
				tmpAcc = tmpAcc ? (tmpAcc + '/' + tmpParts[j]) : tmpParts[j];
				tmpFolderCounts[tmpAcc] = (tmpFolderCounts[tmpAcc] || 0) + tmpRegionCount;
			}
		}

		// Sort folder keys alphabetically, root first
		let tmpFolderKeys = Object.keys(tmpFolderCounts);
		tmpFolderKeys.sort();

		let tmpFmt = this.pict.providers['RetoldRemote-FormattingUtilities'];
		let tmpHTML = '';

		// Always show root at the top
		let tmpRootActive = (this._selectedFolder === '') ? ' active' : '';
		tmpHTML += '<div class="rrrb-tree-node' + tmpRootActive + '" onclick="pict.views[\'RetoldRemote-RegionsBrowser\'].selectFolder(\'\')">';
		tmpHTML += '&#128193; <em>All folders</em>';
		tmpHTML += '<span class="rrrb-tree-count">(' + tmpFolderCounts[''] + ')</span>';
		tmpHTML += '</div>';

		for (let i = 0; i < tmpFolderKeys.length; i++)
		{
			let tmpKey = tmpFolderKeys[i];
			if (tmpKey === '') continue;
			let tmpDepth = tmpKey.split('/').length;
			let tmpName = tmpKey.split('/').pop();
			let tmpActive = (this._selectedFolder === tmpKey) ? ' active' : '';
			let tmpIndent = 'padding-left:' + (14 + (tmpDepth - 1) * 14) + 'px;';
			tmpHTML += '<div class="rrrb-tree-node' + tmpActive + '" style="' + tmpIndent + '"'
				+ ' onclick="pict.views[\'RetoldRemote-RegionsBrowser\'].selectFolder(\''
				+ tmpKey.replace(/'/g, "\\'") + '\')">';
			tmpHTML += '&#128193; ' + tmpFmt.escapeHTML(tmpName);
			tmpHTML += '<span class="rrrb-tree-count">(' + tmpFolderCounts[tmpKey] + ')</span>';
			tmpHTML += '</div>';
		}

		tmpTreeEl.innerHTML = tmpHTML;
	}

	/**
	 * Render the file/region list for the currently-selected folder.
	 */
	_renderList()
	{
		let tmpListEl = document.getElementById('RetoldRemote-RegionsBrowser-List');
		if (!tmpListEl) return;

		let tmpFmt = this.pict.providers['RetoldRemote-FormattingUtilities'];
		let tmpFolder = this._selectedFolder || '';

		// Filter files by the selected folder prefix
		let tmpFilteredFiles = [];
		for (let i = 0; i < this._allFiles.length; i++)
		{
			let tmpEntry = this._allFiles[i];
			if (!tmpEntry || !tmpEntry.Path) continue;
			if (tmpFolder === ''
				|| tmpEntry.Path === tmpFolder
				|| tmpEntry.Path.indexOf(tmpFolder + '/') === 0)
			{
				tmpFilteredFiles.push(tmpEntry);
			}
		}

		// Update the header title
		let tmpTitleEl = document.getElementById('RetoldRemote-RegionsBrowser-Title');
		if (tmpTitleEl)
		{
			let tmpLabel = tmpFolder || 'All folders';
			let tmpTotal = 0;
			for (let i = 0; i < tmpFilteredFiles.length; i++)
			{
				tmpTotal += (tmpFilteredFiles[i].Regions || []).length;
			}
			tmpTitleEl.textContent = 'Regions Browser — ' + tmpLabel
				+ ' (' + tmpTotal + ' region' + (tmpTotal === 1 ? '' : 's') + ' in '
				+ tmpFilteredFiles.length + ' file' + (tmpFilteredFiles.length === 1 ? '' : 's') + ')';
		}

		if (tmpFilteredFiles.length === 0)
		{
			tmpListEl.innerHTML = '<div class="rrrb-list-empty">No regions in this folder yet.</div>';
			return;
		}

		let tmpHTML = '';
		for (let i = 0; i < tmpFilteredFiles.length; i++)
		{
			let tmpEntry = tmpFilteredFiles[i];
			let tmpFileName = (tmpEntry.Path || '').replace(/^.*\//, '');
			let tmpRegions = tmpEntry.Regions || [];

			tmpHTML += '<div class="rrrb-file-group">';
			tmpHTML += '<div class="rrrb-file-header">';
			tmpHTML += '<span class="rrrb-file-name" title="' + tmpFmt.escapeHTML(tmpEntry.Path) + '">' + tmpFmt.escapeHTML(tmpFileName) + '</span>';
			tmpHTML += '<span class="rrrb-file-count">' + tmpRegions.length + ' region' + (tmpRegions.length === 1 ? '' : 's') + '</span>';
			tmpHTML += '</div>';
			tmpHTML += '<div class="rrrb-regions">';

			for (let j = 0; j < tmpRegions.length; j++)
			{
				let tmpRegion = tmpRegions[j];
				let tmpLabel = tmpRegion.Label || '(unlabeled)';
				let tmpDims = '';
				if (typeof tmpRegion.Width === 'number' && typeof tmpRegion.Height === 'number')
				{
					tmpDims = tmpRegion.Width + '×' + tmpRegion.Height;
				}
				else if (tmpRegion.PageNumber)
				{
					tmpDims = 'p.' + tmpRegion.PageNumber;
				}

				tmpHTML += '<div class="rrrb-region" onclick="pict.views[\'RetoldRemote-RegionsBrowser\'].navigateTo('
					+ '\'' + tmpEntry.Path.replace(/'/g, "\\'") + '\','
					+ '\'' + tmpRegion.ID + '\')">';
				tmpHTML += '<span class="rrrb-region-label">' + tmpFmt.escapeHTML(tmpLabel) + '</span>';
				if (tmpDims)
				{
					tmpHTML += '<span class="rrrb-region-dims">' + tmpFmt.escapeHTML(tmpDims) + '</span>';
				}
				tmpHTML += '</div>';
			}

			tmpHTML += '</div>';
			tmpHTML += '</div>';
		}

		tmpListEl.innerHTML = tmpHTML;
	}

	/**
	 * User clicked a folder in the tree — update the selection and
	 * re-render the list pane.
	 *
	 * @param {string} pFolder - Folder prefix ('' for root)
	 */
	selectFolder(pFolder)
	{
		this._selectedFolder = pFolder || '';
		this._renderTree();
		this._renderList();
	}

	/**
	 * User clicked a region — close the browser, navigate to the file,
	 * and zoom to the region. Handles images (via ImageExplorer) and
	 * documents (via MediaViewer).
	 *
	 * @param {string} pFilePath - Full relative path of the file
	 * @param {string} pRegionID - ID of the region to zoom to
	 */
	navigateTo(pFilePath, pRegionID)
	{
		this.close();

		let tmpSelf = this;
		let tmpExt = pFilePath.split('.').pop().toLowerCase();
		let tmpIsImage = ['jpg','jpeg','png','gif','bmp','webp','tiff','tif','svg'].indexOf(tmpExt) >= 0;

		// Use the image explorer for images, media viewer for everything else
		if (tmpIsImage)
		{
			let tmpIEX = this.pict.views['RetoldRemote-ImageExplorer'];
			if (tmpIEX)
			{
				tmpIEX.showExplorer(pFilePath);
				// Wait for the explorer and its regions to load before zooming
				setTimeout(function ()
				{
					let tmpIEX2 = tmpSelf.pict.views['RetoldRemote-ImageExplorer'];
					if (tmpIEX2 && typeof tmpIEX2.zoomToRegion === 'function')
					{
						tmpIEX2.zoomToRegion(pRegionID);
					}
				}, 900);
				return;
			}
		}

		// Fallback: open in the media viewer
		let tmpMediaViewer = this.pict.views['RetoldRemote-MediaViewer'];
		if (tmpMediaViewer)
		{
			tmpMediaViewer.showMedia(pFilePath, tmpIsImage ? 'image' : 'document');
			// Defer the jump-to-region call to after the viewer settles
			setTimeout(function ()
			{
				let tmpSubPanel = tmpSelf.pict.views['RetoldRemote-SubimagesPanel'];
				if (tmpSubPanel && typeof tmpSubPanel.navigateToRegion === 'function')
				{
					tmpSubPanel.navigateToRegion(pRegionID);
				}
			}, 900);
		}
	}
}

RetoldRemoteRegionsBrowserView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteRegionsBrowserView;
