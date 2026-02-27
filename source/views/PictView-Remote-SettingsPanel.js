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
		.retold-remote-settings-vlc-btn
		{
			display: block;
			width: 100%;
			padding: 8px 12px;
			border: 1px solid var(--retold-border);
			border-radius: 4px;
			background: var(--retold-bg-secondary);
			color: var(--retold-text-secondary);
			font-size: 0.75rem;
			font-family: inherit;
			cursor: pointer;
			text-align: left;
			transition: background 0.15s, color 0.15s;
		}
		.retold-remote-settings-vlc-btn:hover
		{
			background: var(--retold-bg-hover);
			color: var(--retold-text-primary);
		}
		.retold-remote-settings-shortcut-group
		{
			margin-bottom: 10px;
		}
		.retold-remote-settings-shortcut-group-title
		{
			font-size: 0.68rem;
			font-weight: 600;
			color: var(--retold-text-muted);
			margin-bottom: 4px;
			padding-bottom: 2px;
			border-bottom: 1px solid var(--retold-border);
		}
		.retold-remote-settings-shortcut-row
		{
			display: flex;
			justify-content: space-between;
			align-items: center;
			padding: 2px 0;
		}
		.retold-remote-settings-shortcut-desc
		{
			color: var(--retold-text-dim);
			font-size: 0.72rem;
		}
		.retold-remote-settings-shortcut-key
		{
			display: inline-block;
			padding: 1px 6px;
			border: 1px solid var(--retold-border);
			border-radius: 3px;
			background: var(--retold-bg-primary);
			color: var(--retold-accent);
			font-size: 0.68rem;
			font-family: var(--retold-font-mono, monospace);
			min-width: 18px;
			text-align: center;
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

		// VLC Setup
		tmpHTML += '<div class="retold-remote-settings-section">';
		tmpHTML += '<div class="retold-remote-settings-section-title">VLC Streaming</div>';
		tmpHTML += '<button class="retold-remote-settings-vlc-btn" onclick="pict.views[\'RetoldRemote-VLCSetup\'].openModal()">';
		tmpHTML += 'VLC Protocol Setup';
		tmpHTML += '</button>';
		tmpHTML += '</div>';

		// Keyboard shortcuts
		tmpHTML += '<div class="retold-remote-settings-section">';
		tmpHTML += '<div class="retold-remote-settings-section-title">Keyboard Shortcuts</div>';

		tmpHTML += this._buildShortcutGroup('Global',
		[
			{ key: 'F1', desc: 'Help panel' },
			{ key: 'F9', desc: 'Focus sidebar' },
			{ key: '/', desc: 'Search / filter bar' },
			{ key: 'Esc', desc: 'Close overlay / back' }
		]);

		tmpHTML += this._buildShortcutGroup('Gallery',
		[
			{ key: '\u2190 \u2191 \u2192 \u2193', desc: 'Navigate items' },
			{ key: 'Enter', desc: 'Open item' },
			{ key: 'Esc', desc: 'Go up one folder' },
			{ key: 'Home', desc: 'Jump to first item' },
			{ key: 'End', desc: 'Jump to last item' },
			{ key: 'g', desc: 'Toggle grid / list' },
			{ key: 'f', desc: 'Advanced filter panel' },
			{ key: 's', desc: 'Focus sort dropdown' },
			{ key: 'x', desc: 'Clear all filters' },
			{ key: 'c', desc: 'Settings panel' },
			{ key: 'd', desc: 'Distraction-free mode' }
		]);

		tmpHTML += this._buildShortcutGroup('Sidebar (F9)',
		[
			{ key: '\u2191 \u2193', desc: 'Navigate file list' },
			{ key: 'Home', desc: 'Jump to first' },
			{ key: 'End', desc: 'Jump to last' },
			{ key: 'Enter', desc: 'Open item' },
			{ key: 'Esc', desc: 'Return to gallery' }
		]);

		tmpHTML += this._buildShortcutGroup('Media Viewer',
		[
			{ key: 'Esc', desc: 'Back to gallery' },
			{ key: '\u2192  j', desc: 'Next file' },
			{ key: '\u2190  k', desc: 'Previous file' },
			{ key: 'Space', desc: 'Play / pause' },
			{ key: 'f', desc: 'Fullscreen' },
			{ key: 'i', desc: 'File info overlay' },
			{ key: 'v', desc: 'Stream with VLC' },
			{ key: '+  -', desc: 'Zoom in / out' },
			{ key: '0', desc: 'Reset zoom' },
			{ key: 'z', desc: 'Cycle fit mode' },
			{ key: 'd', desc: 'Distraction-free mode' }
		]);

		tmpHTML += this._buildShortcutGroup('Video Menu',
		[
			{ key: 'Space', desc: 'Play in browser' },
			{ key: 'Enter', desc: 'Play in browser' },
			{ key: 'e', desc: 'Explore video frames' },
			{ key: 't', desc: 'Extract thumbnail' },
			{ key: 'v', desc: 'Stream with VLC' },
			{ key: '\u2192  j', desc: 'Next file' },
			{ key: '\u2190  k', desc: 'Previous file' },
			{ key: 'Esc', desc: 'Back to gallery' }
		]);

		tmpHTML += this._buildShortcutGroup('Video Explorer',
		[
			{ key: 'Esc', desc: 'Back' }
		]);

		tmpHTML += this._buildShortcutGroup('Audio Explorer',
		[
			{ key: 'Space', desc: 'Play selection' },
			{ key: '+  -', desc: 'Zoom in / out' },
			{ key: '0', desc: 'Zoom to fit' },
			{ key: 'z', desc: 'Zoom to selection' },
			{ key: 'Esc', desc: 'Clear selection / back' }
		]);

		tmpHTML += '</div>'; // end shortcuts section

		tmpHTML += '</div>'; // end settings

		tmpContainer.innerHTML = tmpHTML;
	}

	_buildShortcutGroup(pTitle, pShortcuts)
	{
		let tmpHTML = '<div class="retold-remote-settings-shortcut-group">';
		tmpHTML += '<div class="retold-remote-settings-shortcut-group-title">' + pTitle + '</div>';

		for (let i = 0; i < pShortcuts.length; i++)
		{
			tmpHTML += '<div class="retold-remote-settings-shortcut-row">';
			tmpHTML += '<span class="retold-remote-settings-shortcut-desc">' + pShortcuts[i].desc + '</span>';
			tmpHTML += '<span class="retold-remote-settings-shortcut-key">' + pShortcuts[i].key + '</span>';
			tmpHTML += '</div>';
		}

		tmpHTML += '</div>';
		return tmpHTML;
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
