const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "ContentEditor-TopBar",

	DefaultRenderable: "RetoldRemote-TopBar",
	DefaultDestinationAddress: "#ContentEditor-TopBar-Container",

	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-topbar
		{
			display: flex;
			align-items: center;
			height: 40px;
			padding: 0 16px;
			background: var(--retold-bg-secondary);
			border-bottom: 1px solid var(--retold-border);
			gap: 16px;
		}
		.retold-remote-topbar-brand
		{
			font-size: 0.85rem;
			font-weight: 700;
			color: var(--retold-accent);
			flex-shrink: 0;
		}
		.retold-remote-topbar-location
		{
			flex: 1;
			font-size: 0.82rem;
			color: var(--retold-text-muted);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			text-align: center;
		}
		.retold-remote-topbar-location-crumb
		{
			color: var(--retold-accent);
			cursor: pointer;
			text-decoration: none;
		}
		.retold-remote-topbar-location-crumb:hover
		{
			text-decoration: underline;
		}
		.retold-remote-topbar-sep
		{
			color: var(--retold-text-placeholder);
			margin: 0 3px;
		}
		.retold-remote-topbar-info
		{
			flex-shrink: 0;
			font-size: 0.75rem;
			color: var(--retold-text-dim);
		}
		.retold-remote-topbar-actions
		{
			flex-shrink: 0;
			display: flex;
			gap: 8px;
		}
		.retold-remote-topbar-btn
		{
			padding: 4px 10px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 0.75rem;
			cursor: pointer;
			transition: color 0.15s, border-color 0.15s;
			font-family: inherit;
		}
		.retold-remote-topbar-btn:hover
		{
			color: var(--retold-text-primary);
			border-color: var(--retold-accent);
		}
	`,

	Templates:
	[
		{
			Hash: "RetoldRemote-TopBar",
			Template: /*html*/`
				<div class="retold-remote-topbar">
					<div class="retold-remote-topbar-brand">Retold Remote</div>
					<div class="retold-remote-topbar-location" id="RetoldRemote-TopBar-Location"></div>
					<div class="retold-remote-topbar-info" id="RetoldRemote-TopBar-Info"></div>
					<div class="retold-remote-topbar-actions">
						<button class="retold-remote-topbar-btn" onclick="pict.views['ContentEditor-Layout'].toggleSidebar()" title="Toggle Sidebar">&#9776;</button>
					</div>
				</div>
			`
		}
	],

	Renderables:
	[
		{
			RenderableHash: "RetoldRemote-TopBar",
			TemplateHash: "RetoldRemote-TopBar",
			DestinationAddress: "#ContentEditor-TopBar-Container"
		}
	]
};

class RetoldRemoteTopBarView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender()
	{
		super.onAfterRender();
		this.updateLocation();
		this.updateInfo();
	}

	/**
	 * Update the breadcrumb location display.
	 */
	updateLocation()
	{
		let tmpLocationEl = document.getElementById('RetoldRemote-TopBar-Location');
		if (!tmpLocationEl)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpCurrentLocation = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';

		if (!tmpCurrentLocation)
		{
			tmpLocationEl.innerHTML = '<span class="retold-remote-topbar-location-crumb" onclick="pict.PictApplication.loadFileList(\'\')">/</span>';
			return;
		}

		let tmpParts = tmpCurrentLocation.split('/').filter((p) => p);
		let tmpHTML = '<span class="retold-remote-topbar-location-crumb" onclick="pict.PictApplication.loadFileList(\'\')">/</span>';

		for (let i = 0; i < tmpParts.length; i++)
		{
			let tmpPath = tmpParts.slice(0, i + 1).join('/');
			tmpHTML += '<span class="retold-remote-topbar-sep">/</span>';
			tmpHTML += '<span class="retold-remote-topbar-location-crumb" onclick="pict.PictApplication.loadFileList(\'' + tmpPath + '\')">' + tmpParts[i] + '</span>';
		}

		tmpLocationEl.innerHTML = tmpHTML;
	}

	/**
	 * Update the info display with folder summary.
	 */
	updateInfo()
	{
		let tmpInfoEl = document.getElementById('RetoldRemote-TopBar-Info');
		if (!tmpInfoEl)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpSummary = tmpRemote.FolderSummary;

		if (tmpRemote.ActiveMode === 'viewer')
		{
			let tmpItems = tmpRemote.GalleryItems || [];
			let tmpIndex = tmpRemote.GalleryCursorIndex || 0;
			let tmpItem = tmpItems[tmpIndex];
			if (tmpItem)
			{
				tmpInfoEl.textContent = tmpItem.Name;
			}
			return;
		}

		if (!tmpSummary)
		{
			tmpInfoEl.textContent = '';
			return;
		}

		let tmpParts = [];
		if (tmpSummary.Folders > 0) tmpParts.push(tmpSummary.Folders + ' folders');
		if (tmpSummary.Images > 0) tmpParts.push(tmpSummary.Images + ' images');
		if (tmpSummary.Videos > 0) tmpParts.push(tmpSummary.Videos + ' videos');
		if (tmpSummary.Audio > 0) tmpParts.push(tmpSummary.Audio + ' audio');
		if (tmpSummary.Documents > 0) tmpParts.push(tmpSummary.Documents + ' docs');
		if (tmpSummary.Other > 0) tmpParts.push(tmpSummary.Other + ' other');

		tmpInfoEl.textContent = tmpParts.join(' \u00b7 ');
	}
}

RetoldRemoteTopBarView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteTopBarView;
