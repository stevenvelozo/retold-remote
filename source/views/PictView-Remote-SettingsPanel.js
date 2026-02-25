const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-SettingsPanel",
	DefaultRenderable: "RetoldRemote-SettingsPanel",
	DefaultDestinationAddress: "#RetoldRemote-Settings-Container",
	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-settings
		{
			padding: 12px;
		}
		.retold-remote-settings-section
		{
			margin-bottom: 16px;
		}
		.retold-remote-settings-section-title
		{
			font-size: 0.7rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--retold-text-dim);
			margin-bottom: 8px;
		}
		.retold-remote-settings-row
		{
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 4px 0;
		}
		.retold-remote-settings-label
		{
			font-size: 0.78rem;
			color: var(--retold-text-secondary);
		}
		.retold-remote-settings-select
		{
			padding: 3px 8px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: var(--retold-bg-tertiary);
			color: var(--retold-text-secondary);
			font-size: 0.75rem;
			font-family: inherit;
		}
		.retold-remote-settings-checkbox
		{
			accent-color: var(--retold-accent);
		}
		.retold-remote-settings-capabilities
		{
			margin-top: 12px;
			padding: 8px;
			background: var(--retold-bg-secondary);
			border-radius: 4px;
			font-size: 0.72rem;
		}
		.retold-remote-settings-cap-row
		{
			display: flex;
			justify-content: space-between;
			padding: 2px 0;
		}
		.retold-remote-settings-cap-label
		{
			color: var(--retold-text-dim);
		}
		.retold-remote-settings-cap-yes
		{
			color: var(--retold-accent);
		}
		.retold-remote-settings-cap-no
		{
			color: var(--retold-danger-muted);
		}
	`
};

class RetoldRemoteSettingsPanelView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
	}

	onAfterRender()
	{
		super.onAfterRender();
		this._renderSettingsContent();
	}

	_renderSettingsContent()
	{
		let tmpContainer = document.getElementById('RetoldRemote-Settings-Container');
		if (!tmpContainer)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpCapabilities = tmpRemote.ServerCapabilities || {};

		let tmpHTML = '<div class="retold-remote-settings">';

		// Appearance section (theme dropdown)
		tmpHTML += '<div class="retold-remote-settings-section">';
		tmpHTML += '<div class="retold-remote-settings-section-title">Appearance</div>';

		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Theme</span>';
		tmpHTML += '<select class="retold-remote-settings-select" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeTheme(this.value)">';

		let tmpThemeProvider = this.pict.providers['RetoldRemote-Theme'];
		if (tmpThemeProvider)
		{
			let tmpThemes = tmpThemeProvider.getThemeList();
			let tmpCurrentTheme = tmpThemeProvider.getCurrentTheme();
			let tmpCurrentCategory = '';

			for (let i = 0; i < tmpThemes.length; i++)
			{
				let tmpTheme = tmpThemes[i];
				if (tmpTheme.category !== tmpCurrentCategory)
				{
					if (tmpCurrentCategory)
					{
						tmpHTML += '</optgroup>';
					}
					tmpHTML += '<optgroup label="' + tmpTheme.category + '">';
					tmpCurrentCategory = tmpTheme.category;
				}
				tmpHTML += '<option value="' + tmpTheme.key + '"'
					+ (tmpTheme.key === tmpCurrentTheme ? ' selected' : '')
					+ '>' + tmpTheme.name + '</option>';
			}
			if (tmpCurrentCategory)
			{
				tmpHTML += '</optgroup>';
			}
		}

		tmpHTML += '</select>';
		tmpHTML += '</div>';
		tmpHTML += '</div>'; // end appearance section

		// Gallery section
		tmpHTML += '<div class="retold-remote-settings-section">';
		tmpHTML += '<div class="retold-remote-settings-section-title">Gallery</div>';

		// Thumbnail size
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Thumbnail size</span>';
		tmpHTML += '<select class="retold-remote-settings-select" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeSetting(\'ThumbnailSize\', this.value)">';
		tmpHTML += '<option value="small"' + (tmpRemote.ThumbnailSize === 'small' ? ' selected' : '') + '>Small</option>';
		tmpHTML += '<option value="medium"' + (tmpRemote.ThumbnailSize === 'medium' ? ' selected' : '') + '>Medium</option>';
		tmpHTML += '<option value="large"' + (tmpRemote.ThumbnailSize === 'large' ? ' selected' : '') + '>Large</option>';
		tmpHTML += '</select>';
		tmpHTML += '</div>';

		// Default view mode
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Default view</span>';
		tmpHTML += '<select class="retold-remote-settings-select" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeSetting(\'ViewMode\', this.value)">';
		tmpHTML += '<option value="gallery"' + (tmpRemote.ViewMode === 'gallery' ? ' selected' : '') + '>Gallery</option>';
		tmpHTML += '<option value="list"' + (tmpRemote.ViewMode === 'list' ? ' selected' : '') + '>List</option>';
		tmpHTML += '</select>';
		tmpHTML += '</div>';

		// Show hidden files
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Show hidden files</span>';
		tmpHTML += '<input type="checkbox" class="retold-remote-settings-checkbox"'
			+ (tmpRemote.ShowHiddenFiles ? ' checked' : '')
			+ ' onchange="pict.views[\'RetoldRemote-SettingsPanel\'].toggleHiddenFiles(this.checked)">';
		tmpHTML += '</div>';

		// Navigation bar in distraction-free
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Nav bar in distraction-free</span>';
		tmpHTML += '<input type="checkbox" class="retold-remote-settings-checkbox"'
			+ (tmpRemote.DistractionFreeShowNav ? ' checked' : '')
			+ ' onchange="pict.views[\'RetoldRemote-SettingsPanel\'].toggleDistractionFreeNav(this.checked)">';
		tmpHTML += '</div>';

		// Autoplay video
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Autoplay video</span>';
		tmpHTML += '<input type="checkbox" class="retold-remote-settings-checkbox"'
			+ (tmpRemote.AutoplayVideo ? ' checked' : '')
			+ ' onchange="pict.views[\'RetoldRemote-SettingsPanel\'].toggleAutoplay(\'AutoplayVideo\', this.checked)">';
		tmpHTML += '</div>';

		// Autoplay audio
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Autoplay audio</span>';
		tmpHTML += '<input type="checkbox" class="retold-remote-settings-checkbox"'
			+ (tmpRemote.AutoplayAudio ? ' checked' : '')
			+ ' onchange="pict.views[\'RetoldRemote-SettingsPanel\'].toggleAutoplay(\'AutoplayAudio\', this.checked)">';
		tmpHTML += '</div>';

		tmpHTML += '</div>'; // end gallery section

		// Server capabilities
		tmpHTML += '<div class="retold-remote-settings-section">';
		tmpHTML += '<div class="retold-remote-settings-section-title">Server Capabilities</div>';
		tmpHTML += '<div class="retold-remote-settings-capabilities">';

		let tmpTools = [
			{ key: 'sharp', label: 'Sharp (image thumbnails)' },
			{ key: 'imagemagick', label: 'ImageMagick (image fallback)' },
			{ key: 'ffmpeg', label: 'ffmpeg (video thumbnails)' },
			{ key: 'ffprobe', label: 'ffprobe (media metadata)' }
		];

		for (let i = 0; i < tmpTools.length; i++)
		{
			let tmpTool = tmpTools[i];
			let tmpAvailable = tmpCapabilities[tmpTool.key];
			tmpHTML += '<div class="retold-remote-settings-cap-row">';
			tmpHTML += '<span class="retold-remote-settings-cap-label">' + tmpTool.label + '</span>';
			tmpHTML += '<span class="' + (tmpAvailable ? 'retold-remote-settings-cap-yes' : 'retold-remote-settings-cap-no') + '">'
				+ (tmpAvailable ? 'Available' : 'Not found') + '</span>';
			tmpHTML += '</div>';
		}

		// Hashed filenames status
		tmpHTML += '<div class="retold-remote-settings-cap-row" style="margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--retold-border);">';
		tmpHTML += '<span class="retold-remote-settings-cap-label">Hashed filenames</span>';
		tmpHTML += '<span class="' + (tmpRemote.HashedFilenames ? 'retold-remote-settings-cap-yes' : 'retold-remote-settings-cap-no') + '">'
			+ (tmpRemote.HashedFilenames ? 'Enabled' : 'Disabled') + '</span>';
		tmpHTML += '</div>';

		tmpHTML += '</div>';
		tmpHTML += '</div>'; // end capabilities section

		// Keyboard shortcuts
		tmpHTML += '<div class="retold-remote-settings-section">';
		tmpHTML += '<div class="retold-remote-settings-section-title">Keyboard Shortcuts</div>';

		let tmpShortcuts = [
			{ key: 'Arrow keys', desc: 'Navigate gallery' },
			{ key: 'Enter', desc: 'Open item' },
			{ key: 'Escape', desc: 'Back / close' },
			{ key: 'j / k', desc: 'Next / prev in viewer' },
			{ key: 'f', desc: 'Fullscreen' },
			{ key: 'i', desc: 'File info' },
			{ key: 'Space', desc: 'Play / pause' },
			{ key: '+ / -', desc: 'Zoom in / out' },
			{ key: '0', desc: 'Reset zoom' },
			{ key: 'g', desc: 'Toggle grid / list' },
			{ key: '/', desc: 'Focus search' }
		];

		for (let i = 0; i < tmpShortcuts.length; i++)
		{
			tmpHTML += '<div class="retold-remote-settings-cap-row">';
			tmpHTML += '<span class="retold-remote-settings-cap-label">' + tmpShortcuts[i].desc + '</span>';
			tmpHTML += '<span style="color: var(--retold-accent); font-family: var(--retold-font-mono, monospace);">' + tmpShortcuts[i].key + '</span>';
			tmpHTML += '</div>';
		}

		tmpHTML += '</div>'; // end shortcuts section

		tmpHTML += '</div>'; // end settings

		tmpContainer.innerHTML = tmpHTML;
	}

	changeTheme(pThemeKey)
	{
		let tmpThemeProvider = this.pict.providers['RetoldRemote-Theme'];
		if (tmpThemeProvider)
		{
			tmpThemeProvider.applyTheme(pThemeKey);
			this.pict.PictApplication.saveSettings();

			// Re-render settings to update dropdown selection
			this._renderSettingsContent();
		}
	}

	changeSetting(pKey, pValue)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote[pKey] = pValue;
		this.pict.PictApplication.saveSettings();

		// Re-render gallery if visible
		if (tmpRemote.ActiveMode === 'gallery')
		{
			let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
			if (tmpGalleryView)
			{
				tmpGalleryView.renderGallery();
			}
		}
	}

	toggleHiddenFiles(pChecked)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ShowHiddenFiles = pChecked;
		this.pict.PictApplication.saveSettings();
		this.pict.PictApplication.syncHiddenFilesSetting(() =>
		{
			this.pict.PictApplication.loadFileList();
		});
	}

	toggleAutoplay(pKey, pChecked)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote[pKey] = pChecked;
		this.pict.PictApplication.saveSettings();
	}

	toggleDistractionFreeNav(pChecked)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.DistractionFreeShowNav = pChecked;
		this.pict.PictApplication.saveSettings();

		// If currently in distraction-free mode, apply immediately
		if (tmpRemote._distractionFreeMode)
		{
			let tmpViewerHeader = document.querySelector('.retold-remote-viewer-header');
			if (tmpViewerHeader)
			{
				tmpViewerHeader.style.display = pChecked ? '' : 'none';
			}
		}
	}
}

RetoldRemoteSettingsPanelView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteSettingsPanelView;
