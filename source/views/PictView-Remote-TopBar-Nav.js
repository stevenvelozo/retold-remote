const libPictView = require('pict-view');

/**
 * PictView-Remote-TopBar-Nav — slot view rendered into Theme-TopBar's
 * NavView slot. Hosts the breadcrumb / current folder location dropdown
 * and the folder summary (cursor position + media counts).
 *
 * Re-render via PictApplication.renderTopBar() whenever the location,
 * gallery cursor, folder summary, or active viewer file changes.
 */

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-TopBar-Nav",

	DefaultRenderable: "RetoldRemote-TopBar-Nav-Display",
	DefaultDestinationAddress: "#Theme-TopBar-Nav",

	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-nav
		{
			display: flex;
			align-items: center;
			height: 100%;
			min-width: 0;
			padding: 0 12px;
			gap: 10px;
			color: var(--theme-color-text-on-brand, var(--theme-color-text-primary, #E0E0E0));
		}
		/* The breadcrumb + info elements use the legacy
		   .retold-remote-topbar-* classes already styled in
		   retold-remote.css so they keep working without rework. */
	`,

	Templates:
	[
		{
			Hash: "RetoldRemote-TopBar-Nav-Template",
			Template: /*html*/`
<div class="retold-remote-nav">
	<div class="retold-remote-topbar-location" id="RetoldRemote-TopBar-Location"></div>
	<div class="retold-remote-topbar-info" id="RetoldRemote-TopBar-Info"></div>
</div>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: "RetoldRemote-TopBar-Nav-Display",
			TemplateHash: "RetoldRemote-TopBar-Nav-Template",
			DestinationAddress: "#Theme-TopBar-Nav",
			RenderMethod: "replace"
		}
	]
};

class RetoldRemoteTopBarNavView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent)
	{
		this.pict.CSSMap.injectCSS();
		this.updateLocation();
		this.updateInfo();
		return super.onAfterRender(pRenderable, pRenderDestinationAddress, pRecord, pContent);
	}

	/**
	 * Update the breadcrumb location display.
	 *
	 * The home icon always shows and acts as a dropdown trigger
	 * listing all path segments in the chain. Clicking individual
	 * items in the dropdown navigates to that level.
	 */
	updateLocation()
	{
		let tmpLocationEl = document.getElementById('RetoldRemote-TopBar-Location');
		if (!tmpLocationEl)
		{
			return;
		}

		let tmpCurrentLocation = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';

		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		let tmpHomeIcon = tmpIconProvider ? tmpIconProvider.getIcon('home', 16) : '/';

		let tmpParts = tmpCurrentLocation ? tmpCurrentLocation.split('/').filter((p) => p) : [];

		// Build the dropdown contents (path chain + Home at bottom)
		let tmpDropdownHTML = '';

		if (tmpParts.length > 0)
		{
			let tmpFolderIcon = tmpIconProvider ? tmpIconProvider.getIcon('folder', 16) : '';
			let tmpHomeIconSmall = tmpIconProvider ? tmpIconProvider.getIcon('home', 16) : '/';

			for (let i = tmpParts.length - 2; i >= 0; i--)
			{
				let tmpPath = tmpParts.slice(0, i + 1).join('/');
				let tmpFolderName = tmpParts[i] + '/';
				let tmpPrefix = '';
				if (i > 0)
				{
					tmpPrefix = '/' + tmpParts.slice(0, i).join('/') + '/';
				}

				tmpDropdownHTML += '<button class="retold-remote-topbar-overflow-item" onclick="pict.PictApplication.loadFileList(\'' + tmpPath + '\'); pict.views[\'RetoldRemote-TopBar-Nav\'].closeBreadcrumbDropdown();">';
				tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-icon">' + tmpFolderIcon + '</span>';
				if (tmpPrefix)
				{
					tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-label"><span class="retold-remote-topbar-overflow-item-prefix">' + tmpPrefix + '</span>' + tmpFolderName + '</span>';
				}
				else
				{
					tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-label">' + tmpFolderName + '</span>';
				}
				tmpDropdownHTML += '</button>';
			}

			tmpDropdownHTML += '<button class="retold-remote-topbar-overflow-item" onclick="pict.PictApplication.loadFileList(\'\'); pict.views[\'RetoldRemote-TopBar-Nav\'].closeBreadcrumbDropdown();">';
			tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-icon">' + tmpHomeIconSmall + '</span>';
			tmpDropdownHTML += '<span class="retold-remote-topbar-overflow-item-label">Home</span>';
			tmpDropdownHTML += '</button>';
		}

		let tmpHTML = '';
		tmpHTML += '<span class="retold-remote-topbar-breadcrumb-overflow">';
		tmpHTML += '<span class="retold-remote-topbar-home-crumb"';
		if (tmpParts.length > 0)
		{
			tmpHTML += ' onclick="pict.views[\'RetoldRemote-TopBar-Nav\'].toggleBreadcrumbDropdown()"';
			tmpHTML += ' title="Navigate to parent folders"';
		}
		else
		{
			tmpHTML += ' title="Home"';
		}
		tmpHTML += '>' + tmpHomeIcon + '</span>';
		tmpHTML += '<div class="retold-remote-topbar-overflow-dropdown" id="RetoldRemote-BreadcrumbDropdown">';
		tmpHTML += tmpDropdownHTML;
		tmpHTML += '</div>';
		tmpHTML += '</span>';

		if (tmpParts.length > 0)
		{
			let tmpLastPart = tmpParts[tmpParts.length - 1];
			let tmpLastPath = tmpParts.join('/');
			tmpHTML += '<span class="retold-remote-topbar-location-inner">';
			tmpHTML += '<span class="retold-remote-topbar-sep">/</span>';
			tmpHTML += '<span class="retold-remote-topbar-location-crumb" onclick="pict.PictApplication.loadFileList(\'' + tmpLastPath + '\')">' + tmpLastPart + '</span>';
			tmpHTML += '</span>';
		}

		tmpLocationEl.innerHTML = tmpHTML;
	}

	toggleBreadcrumbDropdown()
	{
		let tmpDropdown = document.getElementById('RetoldRemote-BreadcrumbDropdown');
		if (!tmpDropdown)
		{
			return;
		}

		let tmpIsOpen = tmpDropdown.classList.contains('open');

		if (tmpIsOpen)
		{
			this.closeBreadcrumbDropdown();
		}
		else
		{
			tmpDropdown.classList.add('open');

			let tmpSelf = this;
			let tmpCloseHandler = function(pEvent)
			{
				if (tmpDropdown.contains(pEvent.target))
				{
					return;
				}
				let tmpBtn = tmpDropdown.parentElement && tmpDropdown.parentElement.querySelector('.retold-remote-topbar-home-crumb');
				if (tmpBtn && tmpBtn.contains(pEvent.target))
				{
					return;
				}
				tmpSelf.closeBreadcrumbDropdown();
				document.removeEventListener('click', tmpCloseHandler, true);
				document.removeEventListener('touchstart', tmpCloseHandler, true);
			};

			setTimeout(function()
			{
				document.addEventListener('click', tmpCloseHandler, true);
				document.addEventListener('touchstart', tmpCloseHandler, true);
			}, 0);

			this._breadcrumbCloseHandler = tmpCloseHandler;
		}
	}

	closeBreadcrumbDropdown()
	{
		let tmpDropdown = document.getElementById('RetoldRemote-BreadcrumbDropdown');
		if (tmpDropdown)
		{
			tmpDropdown.classList.remove('open');
		}

		if (this._breadcrumbCloseHandler)
		{
			document.removeEventListener('click', this._breadcrumbCloseHandler, true);
			document.removeEventListener('touchstart', this._breadcrumbCloseHandler, true);
			this._breadcrumbCloseHandler = null;
		}
	}

	/**
	 * Update the info display with folder summary.
	 *
	 * On narrow screens, summary segments degrade progressively:
	 *   Priority 3 (hidden first): folder/file type counts (folders, docs, other)
	 *   Priority 2 (hidden next): primary media counts (images, videos, audio)
	 *   Priority 1 (hidden last): viewer file name
	 *   Always visible: cursor position (e.g. "3/6")
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
				let tmpPos = (tmpIndex + 1) + '/' + tmpItems.length;
				tmpInfoEl.innerHTML = '<span>' + tmpPos + '</span>'
					+ '<span class="retold-remote-topbar-info-sep retold-remote-topbar-info-priority-1"> · </span>'
					+ '<span class="retold-remote-topbar-info-priority-1">' + this._escapeHTML(tmpItem.Name) + '</span>';
			}
			return;
		}

		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpIndex = tmpRemote.GalleryCursorIndex || 0;
		let tmpCursorText = '';

		if (tmpItems.length > 0)
		{
			tmpCursorText = (tmpIndex + 1) + '/' + tmpItems.length;
		}

		if (!tmpSummary)
		{
			tmpInfoEl.textContent = tmpCursorText;
			return;
		}

		let tmpMediaParts = [];
		if (tmpSummary.Images > 0) tmpMediaParts.push(tmpSummary.Images + ' images');
		if (tmpSummary.Videos > 0) tmpMediaParts.push(tmpSummary.Videos + ' videos');
		if (tmpSummary.Audio > 0) tmpMediaParts.push(tmpSummary.Audio + ' audio');

		let tmpExtraParts = [];
		if (tmpSummary.Folders > 0) tmpExtraParts.push(tmpSummary.Folders + ' folders');
		if (tmpSummary.Documents > 0) tmpExtraParts.push(tmpSummary.Documents + ' docs');
		if (tmpSummary.Other > 0) tmpExtraParts.push(tmpSummary.Other + ' other');

		let tmpHTML = '';

		if (tmpCursorText)
		{
			tmpHTML += '<span>' + tmpCursorText + '</span>';
		}

		if (tmpExtraParts.length > 0)
		{
			let tmpSep = tmpHTML ? '<span class="retold-remote-topbar-info-sep retold-remote-topbar-info-priority-3"> · </span>' : '';
			tmpHTML += tmpSep + '<span class="retold-remote-topbar-info-priority-3">' + tmpExtraParts.join(' · ') + '</span>';
		}

		if (tmpMediaParts.length > 0)
		{
			let tmpSep = tmpHTML ? '<span class="retold-remote-topbar-info-sep retold-remote-topbar-info-priority-2"> · </span>' : '';
			tmpHTML += tmpSep + '<span class="retold-remote-topbar-info-priority-2">' + tmpMediaParts.join(' · ') + '</span>';
		}

		tmpInfoEl.innerHTML = tmpHTML || '';
	}

	_escapeHTML(pText)
	{
		if (!pText) return '';
		return pText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}
}

module.exports = RetoldRemoteTopBarNavView;
module.exports.default_configuration = _ViewConfiguration;
