const libPictView = require('pict-view');

/**
 * ContentEditor-TopBar — compatibility shim.
 *
 * The original retold-remote topbar was a single monolithic view at
 * this ViewIdentifier. After the pict-section-theme + pict-section-modal
 * migration, the topbar splits into:
 *   - Theme-TopBar (BrandMark + slot containers; from pict-section-theme)
 *   - RetoldRemote-TopBar-Nav  (breadcrumb + folder info; Theme-TopBar Nav slot)
 *   - RetoldRemote-TopBar-User (action buttons + gear; Theme-TopBar User slot)
 *
 * Many existing providers / viewers / keyboard handlers call methods
 * like `pict.views['ContentEditor-TopBar'].updateInfo()` to ask the
 * topbar to repaint. Rather than touching every call site, this shim
 * exposes those legacy method names and routes them to the new
 * slot views or the application's `renderTopBar()` helper.
 *
 * The shim renders nothing (it's hosted in a view-only invisible
 * destination) — its sole responsibility is method routing.
 */

const _ViewConfiguration =
{
	ViewIdentifier: "ContentEditor-TopBar",

	DefaultRenderable: "RetoldRemote-TopBar-Shim",
	DefaultDestinationAddress: "#RetoldRemote-TopBar-Shim-Anchor",

	AutoRender: false,

	CSS: ``,

	Templates:
	[
		{
			Hash: "RetoldRemote-TopBar-Shim",
			Template: /*html*/`<!-- shim -->`
		}
	],

	Renderables: []
};

class RetoldRemoteTopBarShim extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	_app()
	{
		return this.pict && this.pict.PictApplication;
	}

	_nav()
	{
		return this.pict.views['RetoldRemote-TopBar-Nav'];
	}

	_user()
	{
		return this.pict.views['RetoldRemote-TopBar-User'];
	}

	// "Render the topbar" — equivalent to the old monolithic view's
	// .render() call. Re-paints both new slot views.
	render()
	{
		let tmpApp = this._app();
		if (tmpApp && typeof tmpApp.renderTopBar === 'function')
		{
			tmpApp.renderTopBar();
		}
	}

	// Breadcrumb / folder summary updates — TopBar-Nav owns these.
	updateLocation() { this.render(); }
	updateInfo()     { this.render(); }

	// Action button state updates — TopBar-User owns these.
	updateFavoritesIcon()   { this.render(); }
	updateCollectionsIcon() { this.render(); }
	updateFilterIcon()      { this.render(); }
	updateAISortButton()    { this.render(); }
	updateDFToggleIcon()    { this.render(); }

	// Legacy sidebar-toggle icon — retired (sidebar toggle moved to the
	// shell's panel chrome). No-op.
	updateSidebarToggleIcon() {}

	// Breadcrumb dropdown — delegate to Nav slot.
	toggleBreadcrumbDropdown()
	{
		let tmpNav = this._nav();
		if (tmpNav && typeof tmpNav.toggleBreadcrumbDropdown === 'function')
		{
			tmpNav.toggleBreadcrumbDropdown();
		}
	}
	closeBreadcrumbDropdown()
	{
		let tmpNav = this._nav();
		if (tmpNav && typeof tmpNav.closeBreadcrumbDropdown === 'function')
		{
			tmpNav.closeBreadcrumbDropdown();
		}
	}

	// Action handlers — delegate to User slot.
	toggleDistractionFree()
	{
		let tmpUser = this._user();
		if (tmpUser && typeof tmpUser.toggleDistractionFree === 'function')
		{
			tmpUser.toggleDistractionFree();
		}
	}
	toggleFilterBar()
	{
		let tmpUser = this._user();
		if (tmpUser && typeof tmpUser.toggleFilterBar === 'function')
		{
			tmpUser.toggleFilterBar();
		}
	}
	triggerAISort()
	{
		let tmpUser = this._user();
		if (tmpUser && typeof tmpUser.triggerAISort === 'function')
		{
			tmpUser.triggerAISort();
		}
	}
	toggleFavorite()
	{
		let tmpUser = this._user();
		if (tmpUser && typeof tmpUser.toggleFavorite === 'function')
		{
			tmpUser.toggleFavorite();
		}
	}
	toggleCollections()
	{
		let tmpUser = this._user();
		if (tmpUser && typeof tmpUser.toggleCollections === 'function')
		{
			tmpUser.toggleCollections();
		}
	}
	addToCollection(pEvent)
	{
		let tmpUser = this._user();
		if (tmpUser && typeof tmpUser.addToCollection === 'function')
		{
			tmpUser.addToCollection(pEvent);
		}
	}
	showAddToCollectionDropdown(pEvent)
	{
		let tmpUser = this._user();
		if (tmpUser && typeof tmpUser.showAddToCollectionDropdown === 'function')
		{
			tmpUser.showAddToCollectionDropdown(pEvent);
		}
	}
}

RetoldRemoteTopBarShim.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteTopBarShim;
