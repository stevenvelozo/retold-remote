const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-SettingsPanel",
	DefaultRenderable: "RetoldRemote-SettingsPanel",
	DefaultDestinationAddress: "#RetoldRemote-Settings-Container",
	AutoRender: false,

	CSS: ``
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

		// View mode
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">View mode</span>';
		tmpHTML += '<select class="retold-remote-settings-select" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeSetting(\'ViewMode\', this.value)">';
		tmpHTML += '<option value="gallery"' + (tmpRemote.ViewMode === 'gallery' ? ' selected' : '') + '>Grid</option>';
		tmpHTML += '<option value="list"' + (tmpRemote.ViewMode === 'list' ? ' selected' : '') + '>List</option>';
		tmpHTML += '</select>';
		tmpHTML += '</div>';

		// Thumbnail size
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Thumbnail size</span>';
		tmpHTML += '<select class="retold-remote-settings-select" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeSetting(\'ThumbnailSize\', this.value)">';
		tmpHTML += '<option value="small"' + (tmpRemote.ThumbnailSize === 'small' ? ' selected' : '') + '>Small</option>';
		tmpHTML += '<option value="medium"' + (tmpRemote.ThumbnailSize === 'medium' ? ' selected' : '') + '>Medium</option>';
		tmpHTML += '<option value="large"' + (tmpRemote.ThumbnailSize === 'large' ? ' selected' : '') + '>Large</option>';
		tmpHTML += '</select>';
		tmpHTML += '</div>';

		// Sort field
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Sort by</span>';
		tmpHTML += '<select class="retold-remote-settings-select" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeSortField(this.value)">';
		tmpHTML += '<option value="folder-first"' + (tmpRemote.SortField === 'folder-first' ? ' selected' : '') + '>Folders first</option>';
		tmpHTML += '<option value="name"' + (tmpRemote.SortField === 'name' ? ' selected' : '') + '>Name</option>';
		tmpHTML += '<option value="modified"' + (tmpRemote.SortField === 'modified' ? ' selected' : '') + '>Modified</option>';
		tmpHTML += '<option value="created"' + (tmpRemote.SortField === 'created' ? ' selected' : '') + '>Created</option>';
		tmpHTML += '</select>';
		tmpHTML += '</div>';

		// Sort direction
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Sort direction</span>';
		tmpHTML += '<select class="retold-remote-settings-select" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeSortDirection(this.value)">';
		tmpHTML += '<option value="asc"' + (tmpRemote.SortDirection === 'asc' ? ' selected' : '') + '>Ascending</option>';
		tmpHTML += '<option value="desc"' + (tmpRemote.SortDirection === 'desc' ? ' selected' : '') + '>Descending</option>';
		tmpHTML += '</select>';
		tmpHTML += '</div>';

		// Default media filter
		let tmpFilterMediaType = (tmpRemote.FilterState && tmpRemote.FilterState.MediaType) || 'all';
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Media filter</span>';
		tmpHTML += '<select class="retold-remote-settings-select" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeMediaFilter(this.value)">';
		tmpHTML += '<option value="all"' + (tmpFilterMediaType === 'all' ? ' selected' : '') + '>All files</option>';
		tmpHTML += '<option value="images"' + (tmpFilterMediaType === 'images' ? ' selected' : '') + '>Images</option>';
		tmpHTML += '<option value="video"' + (tmpFilterMediaType === 'video' ? ' selected' : '') + '>Video</option>';
		tmpHTML += '<option value="audio"' + (tmpFilterMediaType === 'audio' ? ' selected' : '') + '>Audio</option>';
		tmpHTML += '<option value="documents"' + (tmpFilterMediaType === 'documents' ? ' selected' : '') + '>Documents</option>';
		tmpHTML += '</select>';
		tmpHTML += '</div>';

		// Show hidden files
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Show hidden files</span>';
		tmpHTML += '<input type="checkbox" class="retold-remote-settings-checkbox"'
			+ (tmpRemote.ShowHiddenFiles ? ' checked' : '')
			+ ' onchange="pict.views[\'RetoldRemote-SettingsPanel\'].toggleHiddenFiles(this.checked)">';
		tmpHTML += '</div>';

		tmpHTML += '</div>'; // end gallery section

		// Viewer section
		tmpHTML += '<div class="retold-remote-settings-section">';
		tmpHTML += '<div class="retold-remote-settings-section-title">Viewer</div>';

		// Image fit mode
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Image fit mode</span>';
		tmpHTML += '<select class="retold-remote-settings-select" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeImageFitMode(this.value)">';
		tmpHTML += '<option value="fit"' + (tmpRemote.ImageFitMode === 'fit' ? ' selected' : '') + '>Fit to window</option>';
		tmpHTML += '<option value="auto"' + (tmpRemote.ImageFitMode === 'auto' ? ' selected' : '') + '>Original if smaller</option>';
		tmpHTML += '<option value="original"' + (tmpRemote.ImageFitMode === 'original' ? ' selected' : '') + '>Original size</option>';
		tmpHTML += '</select>';
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

		// Navigation bar in distraction-free
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Nav bar in distraction-free</span>';
		tmpHTML += '<input type="checkbox" class="retold-remote-settings-checkbox"'
			+ (tmpRemote.DistractionFreeShowNav ? ' checked' : '')
			+ ' onchange="pict.views[\'RetoldRemote-SettingsPanel\'].toggleDistractionFreeNav(this.checked)">';
		tmpHTML += '</div>';

		tmpHTML += '</div>'; // end viewer section

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

		// AI File Sort
		tmpHTML += '<div class="retold-remote-settings-section">';
		tmpHTML += '<div class="retold-remote-settings-section-title">AI File Sort</div>';

		let tmpAISortManager = this.pict.providers['RetoldRemote-AISortManager'];
		let tmpAISettings = tmpRemote.AISortSettings ||
		{
			AIEndpoint: 'http://localhost:11434',
			AIModel: 'llama3.1',
			AIProvider: 'ollama',
			NamingTemplate: '{artist}/{album}/{track} - {title}'
		};

		// AI Endpoint
		tmpHTML += '<div class="retold-remote-settings-input-row">';
		tmpHTML += '<label class="retold-remote-settings-input-label">AI Endpoint URL</label>';
		tmpHTML += '<input class="retold-remote-settings-input" type="text" id="RetoldRemote-AISortEndpoint" value="' + this._escapeAttr(tmpAISettings.AIEndpoint) + '" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeAISetting(\'AIEndpoint\', this.value)" placeholder="http://localhost:11434">';
		tmpHTML += '</div>';

		// AI Model
		tmpHTML += '<div class="retold-remote-settings-input-row">';
		tmpHTML += '<label class="retold-remote-settings-input-label">Model</label>';
		tmpHTML += '<input class="retold-remote-settings-input" type="text" id="RetoldRemote-AISortModel" value="' + this._escapeAttr(tmpAISettings.AIModel) + '" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeAISetting(\'AIModel\', this.value)" placeholder="llama3.1">';
		tmpHTML += '</div>';

		// AI Provider
		tmpHTML += '<div class="retold-remote-settings-row">';
		tmpHTML += '<span class="retold-remote-settings-label">Provider</span>';
		tmpHTML += '<select class="retold-remote-settings-select" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeAISetting(\'AIProvider\', this.value)">';
		tmpHTML += '<option value="ollama"' + (tmpAISettings.AIProvider === 'ollama' ? ' selected' : '') + '>Ollama</option>';
		tmpHTML += '<option value="openai"' + (tmpAISettings.AIProvider === 'openai' ? ' selected' : '') + '>OpenAI-compatible</option>';
		tmpHTML += '</select>';
		tmpHTML += '</div>';

		// Naming Template
		tmpHTML += '<div class="retold-remote-settings-input-row" style="margin-top: 8px;">';
		tmpHTML += '<label class="retold-remote-settings-input-label">Naming Template</label>';
		tmpHTML += '<input class="retold-remote-settings-input" type="text" id="RetoldRemote-AISortTemplate" value="' + this._escapeAttr(tmpAISettings.NamingTemplate) + '" onchange="pict.views[\'RetoldRemote-SettingsPanel\'].changeAISetting(\'NamingTemplate\', this.value)" placeholder="{artist}/{album}/{track} - {title}">';

		// Template preview
		let tmpTemplatePreview = tmpAISortManager ? tmpAISortManager.getTemplatePreview(tmpAISettings.NamingTemplate) : '';
		if (tmpTemplatePreview)
		{
			tmpHTML += '<div class="retold-remote-settings-template-preview">Preview: ' + this._escapeHTML(tmpTemplatePreview) + '</div>';
		}
		tmpHTML += '</div>';

		// Test Connection button
		tmpHTML += '<button class="retold-remote-settings-vlc-btn" id="RetoldRemote-AISortTestBtn" onclick="pict.views[\'RetoldRemote-SettingsPanel\'].testAIConnection()" style="margin-top: 8px;">';
		tmpHTML += 'Test Connection';
		tmpHTML += '</button>';

		tmpHTML += '</div>'; // end AI sort section

		// VLC Setup
		tmpHTML += '<div class="retold-remote-settings-section">';
		tmpHTML += '<div class="retold-remote-settings-section-title">VLC Streaming</div>';
		tmpHTML += '<button class="retold-remote-settings-vlc-btn" onclick="pict.views[\'RetoldRemote-VLCSetup\'].openModal()">';
		tmpHTML += 'VLC Protocol Setup';
		tmpHTML += '</button>';
		tmpHTML += '</div>';

		// Help button
		tmpHTML += '<div class="retold-remote-settings-section">';
		tmpHTML += '<div class="retold-remote-settings-section-title">Help</div>';
		tmpHTML += '<button class="retold-remote-settings-vlc-btn" onclick="pict.providers[\'RetoldRemote-GalleryNavigation\']._toggleHelpPanel()">';
		tmpHTML += 'Help (F1)';
		tmpHTML += '</button>';
		tmpHTML += '</div>';

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

	changeImageFitMode(pMode)
	{
		let tmpImageViewer = this.pict.views['RetoldRemote-ImageViewer'];
		if (tmpImageViewer)
		{
			tmpImageViewer.setFitMode(pMode);
		}
		else
		{
			let tmpRemote = this.pict.AppData.RetoldRemote;
			tmpRemote.ImageFitMode = pMode;
			this.pict.PictApplication.saveSettings();
		}
	}

	changeSortField(pValue)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.SortField = pValue;
		this.pict.PictApplication.saveSettings();
		this._refilterGallery();
	}

	changeSortDirection(pValue)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.SortDirection = pValue;
		this.pict.PictApplication.saveSettings();
		this._refilterGallery();
	}

	changeMediaFilter(pValue)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.GalleryFilter = pValue;
		if (tmpRemote.FilterState)
		{
			tmpRemote.FilterState.MediaType = pValue;
		}
		this.pict.PictApplication.saveSettings();
		this._refilterGallery();
	}

	/**
	 * Change an AI sort setting.
	 *
	 * @param {string} pKey - Setting key (AIEndpoint, AIModel, AIProvider, NamingTemplate)
	 * @param {string} pValue - New value
	 */
	changeAISetting(pKey, pValue)
	{
		let tmpAISortManager = this.pict.providers['RetoldRemote-AISortManager'];
		if (tmpAISortManager)
		{
			let tmpUpdate = {};
			tmpUpdate[pKey] = pValue;
			tmpAISortManager.updateSettings(tmpUpdate);
		}

		// Update the template preview if the template changed
		if (pKey === 'NamingTemplate')
		{
			this._renderSettingsContent();
		}
	}

	/**
	 * Test the AI endpoint connection.
	 */
	testAIConnection()
	{
		let tmpBtn = document.getElementById('RetoldRemote-AISortTestBtn');
		if (tmpBtn)
		{
			tmpBtn.disabled = true;
			tmpBtn.textContent = 'Testing...';
		}

		let tmpAISortManager = this.pict.providers['RetoldRemote-AISortManager'];
		if (tmpAISortManager)
		{
			tmpAISortManager.testConnection();
		}
	}

	/**
	 * Escape HTML attribute values.
	 *
	 * @param {string} pStr
	 * @returns {string}
	 */
	_escapeAttr(pStr)
	{
		if (!pStr) return '';
		return String(pStr).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	/**
	 * Escape HTML text content.
	 *
	 * @param {string} pStr
	 * @returns {string}
	 */
	_escapeHTML(pStr)
	{
		if (!pStr) return '';
		return String(pStr).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	/**
	 * Re-run the filter/sort pipeline and refresh the gallery.
	 */
	_refilterGallery()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpFilterSort = this.pict.providers['RetoldRemote-GalleryFilterSort'];
		if (tmpFilterSort)
		{
			tmpFilterSort.runFilterPipeline();
		}

		if (tmpRemote.ActiveMode === 'gallery')
		{
			let tmpGalleryView = this.pict.views['RetoldRemote-Gallery'];
			if (tmpGalleryView)
			{
				tmpGalleryView.renderGallery();
			}
		}
	}
}

RetoldRemoteSettingsPanelView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteSettingsPanelView;
