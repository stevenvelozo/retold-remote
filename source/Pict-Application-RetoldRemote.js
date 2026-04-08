const libContentEditorApplication = require('retold-content-system').PictContentEditor;

const libPictSectionFileBrowser = require('pict-section-filebrowser');

// Providers
const libProviderRetoldRemote = require('./providers/Pict-Provider-RetoldRemote.js');
const libProviderGalleryNavigation = require('./providers/Pict-Provider-GalleryNavigation.js');
const libProviderGalleryFilterSort = require('./providers/Pict-Provider-GalleryFilterSort.js');
const libProviderRetoldRemoteIcons = require('./providers/Pict-Provider-RetoldRemoteIcons.js');
const libProviderRetoldRemoteTheme = require('./providers/Pict-Provider-RetoldRemoteTheme.js');
const libProviderFormattingUtilities = require('./providers/Pict-Provider-FormattingUtilities.js');
const libProviderToastNotification = require('./providers/Pict-Provider-ToastNotification.js');
const libProviderOperationStatus = require('./providers/Pict-Provider-OperationStatus.js');
const libProviderCollectionManager = require('./providers/Pict-Provider-CollectionManager.js');
const libProviderAISortManager = require('./providers/Pict-Provider-AISortManager.js');

const libExtensionMaps = require('./RetoldRemote-ExtensionMaps.js');

// Views (replace parent views)
const libViewLayout = require('./views/PictView-Remote-Layout.js');
const libViewTopBar = require('./views/PictView-Remote-TopBar.js');
const libViewSettingsPanel = require('./views/PictView-Remote-SettingsPanel.js');

// Views (new)
const libViewGallery = require('./views/PictView-Remote-Gallery.js');
const libViewMediaViewer = require('./views/PictView-Remote-MediaViewer.js');
const libViewImageViewer = require('./views/PictView-Remote-ImageViewer.js');
const libViewVideoExplorer = require('./views/PictView-Remote-VideoExplorer.js');
const libViewAudioExplorer = require('./views/PictView-Remote-AudioExplorer.js');
const libViewImageExplorer = require('./views/PictView-Remote-ImageExplorer.js');
const libViewVLCSetup = require('./views/PictView-Remote-VLCSetup.js');
const libViewCollectionsPanel = require('./views/PictView-Remote-CollectionsPanel.js');
const libViewFileInfoPanel = require('./views/PictView-Remote-FileInfoPanel.js');
const libViewSubimagesPanel = require('./views/PictView-Remote-SubimagesPanel.js');
const libViewRegionsBrowser = require('./views/PictView-Remote-RegionsBrowser.js');

// Application configuration
const _DefaultConfiguration = require('./Pict-Application-RetoldRemote-Configuration.json');

/**
 * Retold Remote Application
 *
 * A NAS media browser that extends ContentEditorApplication from
 * retold-content-system.  Replaces the text editor views with gallery
 * and media viewer views while keeping the sidebar file browser and
 * file navigation infrastructure intact.
 */
class RetoldRemoteApplication extends libContentEditorApplication
{
	constructor(pFable, pOptions, pServiceHash)
	{
		let tmpOptions = Object.assign({}, _DefaultConfiguration, pOptions);
		super(pFable, tmpOptions, pServiceHash);

		// Replace parent views with media-focused versions.
		// Re-registering with the same ViewIdentifier replaces the parent's view.
		this.pict.addView('ContentEditor-Layout', libViewLayout.default_configuration, libViewLayout);
		this.pict.addView('ContentEditor-TopBar', libViewTopBar.default_configuration, libViewTopBar);

		// Add new views
		this.pict.addView('RetoldRemote-Gallery', libViewGallery.default_configuration, libViewGallery);
		this.pict.addView('RetoldRemote-MediaViewer', libViewMediaViewer.default_configuration, libViewMediaViewer);
		this.pict.addView('RetoldRemote-ImageViewer', libViewImageViewer.default_configuration, libViewImageViewer);
		this.pict.addView('RetoldRemote-SettingsPanel', libViewSettingsPanel.default_configuration, libViewSettingsPanel);
		this.pict.addView('RetoldRemote-VideoExplorer', libViewVideoExplorer.default_configuration, libViewVideoExplorer);
		this.pict.addView('RetoldRemote-AudioExplorer', libViewAudioExplorer.default_configuration, libViewAudioExplorer);
		this.pict.addView('RetoldRemote-ImageExplorer', libViewImageExplorer.default_configuration, libViewImageExplorer);
		this.pict.addView('RetoldRemote-VLCSetup', libViewVLCSetup.default_configuration, libViewVLCSetup);
		this.pict.addView('RetoldRemote-CollectionsPanel', libViewCollectionsPanel.default_configuration, libViewCollectionsPanel);
		this.pict.addView('RetoldRemote-FileInfoPanel', libViewFileInfoPanel.default_configuration, libViewFileInfoPanel);
		this.pict.addView('RetoldRemote-SubimagesPanel', libViewSubimagesPanel.default_configuration, libViewSubimagesPanel);
		this.pict.addView('RetoldRemote-RegionsBrowser', libViewRegionsBrowser.default_configuration, libViewRegionsBrowser);

		// Add new providers
		this.pict.addProvider('RetoldRemote-Provider', libProviderRetoldRemote.default_configuration, libProviderRetoldRemote);
		this.pict.addProvider('RetoldRemote-GalleryNavigation', libProviderGalleryNavigation.default_configuration, libProviderGalleryNavigation);
		this.pict.addProvider('RetoldRemote-GalleryFilterSort', libProviderGalleryFilterSort.default_configuration, libProviderGalleryFilterSort);
		this.pict.addProvider('RetoldRemote-Icons', libProviderRetoldRemoteIcons.default_configuration, libProviderRetoldRemoteIcons);
		this.pict.addProvider('RetoldRemote-Theme', libProviderRetoldRemoteTheme.default_configuration, libProviderRetoldRemoteTheme);
		this.pict.addProvider('RetoldRemote-FormattingUtilities', libProviderFormattingUtilities.default_configuration, libProviderFormattingUtilities);
		this.pict.addProvider('RetoldRemote-ToastNotification', libProviderToastNotification.default_configuration, libProviderToastNotification);
		this.pict.addProvider('RetoldRemote-OperationStatus', libProviderOperationStatus.default_configuration, libProviderOperationStatus);
		this.pict.addProvider('RetoldRemote-CollectionManager', libProviderCollectionManager.default_configuration, libProviderCollectionManager);
		this.pict.addProvider('RetoldRemote-AISortManager', libProviderAISortManager.default_configuration, libProviderAISortManager);
	}

	onAfterInitializeAsync(fCallback)
	{
		// Expose pict on window for inline onclick handlers
		if (typeof (window) !== 'undefined')
		{
			window.pict = this.pict;
		}

		// Initialize RetoldRemote-specific state
		this.pict.AppData.RetoldRemote =
		{
			ActiveMode: 'gallery',          // 'gallery' or 'viewer'
			Theme: 'twilight',              // Theme key (e.g. 'twilight', 'neo-tokyo')
			ViewMode: 'list',               // 'gallery' or 'list'
			ThumbnailSize: 'medium',        // 'small', 'medium', 'large'
			RawFileList: [],                // Unfiltered server response
			GalleryItems: [],               // Filtered+sorted file list (single source of truth)
			GalleryCursorIndex: 0,          // Currently highlighted item
			FolderCursorHistory: {},        // Map of folder path -> last cursor index
			GalleryFilter: 'all',           // 'all', 'images', 'video', 'audio', 'documents'
			SearchQuery: '',
			SearchCaseSensitive: false,
			SearchRegex: false,
			ServerCapabilities: {},         // From /api/media/capabilities
			FolderSummary: null,            // From /api/media/folder-summary
			CurrentViewerFile: '',          // File being viewed
			CurrentViewerMediaType: '',     // Media type of viewed file
			HashedFilenames: true,         // From /api/remote/settings
			ShowHiddenFiles: false,
			DistractionFreeShowNav: false,
			ImageFitMode: 'fit',
			SidebarCollapsed: false,
			SidebarWidth: 250,
			AutoplayVideo: false,
			AutoplayAudio: false,

			// List column visibility
			ListShowExtension: true,
			ListShowSize: true,
			ListShowDate: true,

			// Filter state
			FilterState:
			{
				MediaType: 'all',
				Extensions: [],             // e.g. ['png', 'jpg'] -- empty = all
				SizeMin: null,              // bytes or null
				SizeMax: null,
				DateModifiedAfter: null,    // ISO date string or null
				DateModifiedBefore: null,
				DateCreatedAfter: null,
				DateCreatedBefore: null
			},

			// Sort state
			SortField: 'folder-first',      // 'name', 'folder-first', 'created', 'modified'
			SortDirection: 'asc',           // 'asc', 'desc'

			// Filter panel UI
			FilterBarVisible: false,
			FilterPanelOpen: false,

			// Saved filter presets
			FilterPresets: [],              // [{ Name, FilterState, SortField, SortDirection }]

			// Collections state
			Collections: [],                // Array of collection summaries
			CollectionsPanelOpen: false,
			CollectionsPanelWidth: 300,
			CollectionsPanelMode: 'list',   // 'list' | 'detail' | 'edit'
			ActiveCollectionGUID: null,
			ActiveCollection: null,
			CollectionSearchQuery: '',
			LastUsedCollectionGUID: null,
			BrowsingCollection: false,		// true when viewer is navigating collection items
			BrowsingCollectionIndex: -1,	// index into ActiveCollection.Items

			// Favorites
			FavoritesGUID: null,
			FavoritesCollection: null,
			FavoritesPathSet: {},			// path → itemID for O(1) favorited-state checks

			CurrentFileMetadata: null,		// cached extended metadata for the currently viewed file

			// AI Sort settings
			AISortSettings:
			{
				AIEndpoint: 'http://localhost:11434',
				AIModel: 'llama3.1',
				AIProvider: 'ollama',
				NamingTemplate: '{artist}/{album}/{track} - {title}'
			}
		};

		// Load persisted settings
		this._loadRemoteSettings();

		// Apply the loaded theme (must happen after _loadRemoteSettings sets Theme)
		let tmpThemeProvider = this.pict.providers['RetoldRemote-Theme'];
		if (tmpThemeProvider)
		{
			tmpThemeProvider.applyTheme(this.pict.AppData.RetoldRemote.Theme);
		}

		// Initialize parent state (ContentEditor AppData)
		this.pict.AppData.ContentEditor =
		{
			CurrentFile: '',
			ActiveEditor: 'markdown',
			IsDirty: false,
			IsSaving: false,
			IsLoading: false,
			Files: [],
			Document: { Segments: [{ Content: '' }] },
			CodeContent: '',
			SaveStatus: '',
			SaveStatusClass: '',
			AutoSegmentMarkdown: false,
			AutoSegmentDepth: 1,
			AutoContentPreview: false,
			MarkdownEditingControls: true,
			MarkdownWordWrap: true,
			CodeWordWrap: false,
			SidebarCollapsed: this.pict.AppData.RetoldRemote.SidebarCollapsed,
			SidebarWidth: this.pict.AppData.RetoldRemote.SidebarWidth,
			AutoPreviewImages: true,
			AutoPreviewVideo: false,
			AutoPreviewAudio: false,
			ShowHiddenFiles: this.pict.AppData.RetoldRemote.ShowHiddenFiles,
			TopicsFilePath: ''
		};

		// Render the layout shell
		this.pict.views['ContentEditor-Layout'].render();

		// Render the topbar
		this.pict.views['ContentEditor-TopBar'].render();

		// Render the collections panel (starts collapsed)
		this.pict.views['RetoldRemote-CollectionsPanel'].render();

		// Fetch collections list and ensure favorites collection exists
		let tmpCollManager = this.pict.providers['RetoldRemote-CollectionManager'];
		if (tmpCollManager)
		{
			tmpCollManager.fetchCollections(() =>
			{
				tmpCollManager.ensureFavoritesCollection();
			});
		}

		// Update the collections button icon
		let tmpTopBarView = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBarView && typeof tmpTopBarView.updateCollectionsIcon === 'function')
		{
			tmpTopBarView.updateCollectionsIcon();
		}

		let tmpSelf = this;

		// Wire up file selection from the file browser sidebar
		let tmpListProvider = this.pict.providers['Pict-FileBrowser-List'];
		if (tmpListProvider)
		{
			let tmpOriginalSelectFile = tmpListProvider.selectFile.bind(tmpListProvider);
			tmpListProvider.selectFile = function (pFileEntry)
			{
				tmpOriginalSelectFile(pFileEntry);
				if (pFileEntry && pFileEntry.Type === 'file')
				{
					tmpSelf.navigateToFile(pFileEntry.Path);
				}
				else if (pFileEntry && (pFileEntry.Type === 'folder' || pFileEntry.Type === 'archive'))
				{
					// Single-click on a folder or archive navigates into it
					let tmpCurrentLocation = (tmpSelf.pict.AppData.PictFileBrowser && tmpSelf.pict.AppData.PictFileBrowser.CurrentLocation) || '';
					let tmpNewPath = tmpCurrentLocation ? (tmpCurrentLocation + '/' + pFileEntry.Name) : pFileEntry.Name;
					tmpSelf.loadFileList(tmpNewPath);
				}
			};
		}

		// Wire up folder navigation
		let tmpBrowseProvider = this.pict.providers['Pict-FileBrowser-Browse'];
		if (tmpBrowseProvider)
		{
			let tmpOriginalNavigate = tmpBrowseProvider.navigateToFolder.bind(tmpBrowseProvider);
			tmpBrowseProvider.navigateToFolder = function (pPath)
			{
				tmpOriginalNavigate(pPath);
				tmpSelf.loadFileList(pPath);
			};
		}

		// Fetch server capabilities and remote settings
		let tmpProvider = this.pict.providers['RetoldRemote-Provider'];
		if (tmpProvider)
		{
			tmpProvider.fetchCapabilities(
				(pError, pCapabilities) =>
				{
					if (!pError && pCapabilities)
					{
						tmpSelf.pict.AppData.RetoldRemote.ServerCapabilities = pCapabilities;
					}
				});

			tmpProvider.fetchRemoteSettings(
				(pError, pSettings) =>
				{
					if (!pError && pSettings)
					{
						tmpSelf.pict.AppData.RetoldRemote.HashedFilenames = !!(pSettings.HashedFilenames);
					}
				});
		}

		// Bind keyboard navigation
		let tmpNavProvider = this.pict.providers['RetoldRemote-GalleryNavigation'];
		if (tmpNavProvider)
		{
			tmpNavProvider.bindKeyboardNavigation();
		}

		// Capture the initial hash BEFORE loading the file list.
		// loadFileList() overwrites window.location.hash with the loaded
		// folder's hash, so if we don't save it first, the original
		// deep-link hash (e.g. #/browse/11ee5820d1) gets clobbered.
		let tmpInitialHash = window.location.hash || '';

		// Sync hidden files setting and load initial file list
		this.syncHiddenFilesSetting(() =>
		{
			tmpSelf.loadFileList(null, () =>
			{
				// Restore the initial hash so resolveHash() sees the original
				// deep-link, not the root folder's hash that loadFileList set.
				// Setting the hash fires hashchange → resolveHash() automatically,
				// so we only need the explicit call when there's no hash to restore.
				if (tmpInitialHash && tmpInitialHash !== '#' && tmpInitialHash !== '#/' && tmpInitialHash !== '#/browse/' && tmpInitialHash !== '#/browse')
				{
					window.location.hash = tmpInitialHash;
				}
				else
				{
					tmpSelf.resolveHash();
				}
			});
		});

		// Do NOT call super.onAfterInitializeAsync because we have replaced
		// the full initialization flow above.  Instead call the grandparent's callback.
		// The parent's onAfterInitializeAsync tries to render editors and load topics
		// which we don't need.
		if (typeof (fCallback) === 'function')
		{
			return fCallback();
		}
	}

	/**
	 * Override _getMediaType to use comprehensive extension maps.
	 *
	 * The parent class has a hardcoded subset of video/audio/image extensions.
	 * We use RetoldRemote-ExtensionMaps which covers many more formats
	 * (mpg, mpeg, ts, mts, 3gp, heic, etc.).
	 *
	 * @param {string} pExtension - Lowercase extension without dot
	 * @returns {string} 'image', 'video', 'audio', 'document', 'text', or 'other'
	 */
	_getMediaType(pExtension)
	{
		let tmpTextExtensions =
		{
			'js': true, 'mjs': true, 'cjs': true, 'ts': true, 'tsx': true, 'jsx': true,
			'py': true, 'rb': true, 'java': true, 'c': true, 'cpp': true, 'h': true, 'hpp': true,
			'cs': true, 'go': true, 'rs': true, 'php': true, 'sh': true, 'bash': true, 'zsh': true,
			'pl': true, 'r': true, 'swift': true, 'kt': true, 'scala': true, 'lua': true,
			'json': true, 'xml': true, 'yaml': true, 'yml': true, 'toml': true,
			'ini': true, 'cfg': true, 'conf': true, 'env': true, 'properties': true,
			'md': true, 'markdown': true, 'txt': true, 'csv': true, 'tsv': true, 'log': true,
			'html': true, 'htm': true, 'css': true, 'scss': true, 'sass': true, 'less': true,
			'sql': true, 'graphql': true, 'gql': true,
			'makefile': true, 'dockerfile': true, 'gitignore': true, 'editorconfig': true,
			'htaccess': true, 'npmrc': true, 'eslintrc': true, 'prettierrc': true
		};
		if (tmpTextExtensions[pExtension])
		{
			return 'text';
		}

		// Use the comprehensive extension maps (covers mpg, mpeg, ts, heic, etc.)
		return libExtensionMaps.getCategory(pExtension);
	}

	/**
	 * Override navigateToFile to route to media viewer instead of editor.
	 *
	 * @param {string} pFilePath - Relative file path
	 */
	navigateToFile(pFilePath)
	{
		if (!pFilePath)
		{
			return;
		}

		let tmpEditorType = this.getEditorTypeForFile(pFilePath);
		let tmpExtension = pFilePath.replace(/^.*\./, '').toLowerCase();
		let tmpMediaType = this._getMediaType(tmpExtension);
		let tmpRemote = this.pict.AppData.RetoldRemote;

		// Update the hash (use hashed identifier when available)
		let tmpFragProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpFragId = tmpFragProvider ? tmpFragProvider.getFragmentIdentifier(pFilePath) : pFilePath;
		window.location.hash = '#/view/' + tmpFragId;

		// Update parent state for compatibility
		this.pict.AppData.ContentEditor.CurrentFile = pFilePath;
		this.pict.AppData.ContentEditor.ActiveEditor = tmpEditorType;

		if (tmpEditorType === 'binary')
		{
			// Route binary files to the media viewer
			let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
			if (tmpViewer)
			{
				tmpViewer.showMedia(pFilePath, tmpMediaType);
			}
		}
		else if (tmpMediaType === 'text')
		{
			// Text/code files: show inline in media viewer
			let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
			if (tmpViewer)
			{
				tmpViewer.showMedia(pFilePath, 'text');
			}
		}
		else if (tmpMediaType === 'other')
		{
			// Unknown files: show fallback view
			let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
			if (tmpViewer)
			{
				tmpViewer.showMedia(pFilePath, 'document');
			}
		}
		else
		{
			// Default: use media viewer
			let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
			if (tmpViewer)
			{
				tmpViewer.showMedia(pFilePath, tmpMediaType);
			}
		}

		// Update the topbar
		let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBar)
		{
			tmpTopBar.updateInfo();
			if (typeof tmpTopBar.updateFavoritesIcon === 'function')
			{
				tmpTopBar.updateFavoritesIcon();
			}
		}
	}

	/**
	 * Navigate to a file with an explicit media type override, bypassing
	 * extension-based detection.
	 *
	 * @param {string} pFilePath - Relative file path
	 * @param {string} pMediaType - 'image', 'video', 'audio', or 'text'
	 */
	navigateToFileAs(pFilePath, pMediaType)
	{
		if (!pFilePath)
		{
			return;
		}

		let tmpRemote = this.pict.AppData.RetoldRemote;

		// Update the hash
		let tmpFragProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpFragId = tmpFragProvider ? tmpFragProvider.getFragmentIdentifier(pFilePath) : pFilePath;
		window.location.hash = '#/view/' + tmpFragId;

		// Update parent state for compatibility
		this.pict.AppData.ContentEditor.CurrentFile = pFilePath;
		this.pict.AppData.ContentEditor.ActiveEditor = 'binary';

		let tmpViewer = this.pict.views['RetoldRemote-MediaViewer'];
		if (tmpViewer)
		{
			tmpViewer.showMedia(pFilePath, pMediaType);
		}

		let tmpTopBar = this.pict.views['ContentEditor-TopBar'];
		if (tmpTopBar)
		{
			tmpTopBar.updateInfo();
			if (typeof tmpTopBar.updateFavoritesIcon === 'function')
			{
				tmpTopBar.updateFavoritesIcon();
			}
		}
	}

	/**
	 * Override loadFileList to also populate the gallery and fetch folder summary.
	 */
	loadFileList(pPath, fCallback)
	{
		let tmpCallback = (typeof (fCallback) === 'function') ? fCallback :
			(typeof (pPath) === 'function') ? pPath : () => {};
		let tmpSelf = this;

		let tmpPath = (typeof (pPath) === 'string') ? pPath : null;
		if (tmpPath === null && this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation)
		{
			tmpPath = this.pict.AppData.PictFileBrowser.CurrentLocation;
		}

		// Paint an immediate loading overlay in the gallery so the user gets
		// visible feedback the moment a folder is clicked — before the fetch
		// and before any rendering work. This prevents the "nothing happened"
		// impression on folders with thousands of files.
		let tmpGalleryView = tmpSelf.pict.views['RetoldRemote-Gallery'];
		if (tmpGalleryView && typeof tmpGalleryView.showLoadingState === 'function')
		{
			tmpGalleryView.showLoadingState(tmpPath || '');
		}

		// Cancel any chunked render from a previous folder
		if (tmpGalleryView && typeof tmpGalleryView.cancelActiveRender === 'function')
		{
			tmpGalleryView.cancelActiveRender();
		}

		let tmpURL = '/api/filebrowser/list';
		if (tmpPath && tmpPath.length > 0)
		{
			let tmpMediaProvider = tmpSelf.pict.providers['RetoldRemote-Provider'];
			if (tmpMediaProvider)
			{
				tmpURL += '?path=' + tmpMediaProvider._getPathParam(tmpPath);
			}
			else
			{
				tmpURL += '?path=' + encodeURIComponent(tmpPath);
			}
		}

		fetch(tmpURL)
			.then((pResponse) =>
			{
				// Capture the folder hash header before parsing JSON
				let tmpFolderHash = pResponse.headers.get('X-Retold-Folder-Hash');
				if (tmpFolderHash && tmpPath)
				{
					let tmpHashProvider = tmpSelf.pict.providers['RetoldRemote-Provider'];
					if (tmpHashProvider)
					{
						tmpHashProvider.registerHash(tmpPath, tmpFolderHash);
					}
				}
				return pResponse.json();
			})
			.then((pFileList) =>
			{
				tmpSelf.pict.AppData.PictFileBrowser = tmpSelf.pict.AppData.PictFileBrowser || {};
				tmpSelf.pict.AppData.PictFileBrowser.FileList = pFileList || [];
				tmpSelf.pict.AppData.PictFileBrowser.CurrentLocation = (typeof (pPath) === 'string') ? pPath : (tmpSelf.pict.AppData.PictFileBrowser.CurrentLocation || '');

				// Register hashes from file list entries (when hashed filenames is on)
				let tmpHashProvider = tmpSelf.pict.providers['RetoldRemote-Provider'];
				if (tmpHashProvider && Array.isArray(pFileList))
				{
					for (let i = 0; i < pFileList.length; i++)
					{
						if (pFileList[i].Hash && pFileList[i].Path)
						{
							tmpHashProvider.registerHash(pFileList[i].Path, pFileList[i].Hash);
						}
					}
				}

				// Render the file browser sidebar
				let tmpFileBrowserView = tmpSelf.pict.views['Pict-FileBrowser'];
				if (tmpFileBrowserView)
				{
					tmpFileBrowserView.render();
				}

				let tmpListDetailView = tmpSelf.pict.views['Pict-FileBrowser-ListDetail'];
				if (tmpListDetailView)
				{
					tmpListDetailView.render();
				}

				// Inject the add-folder button at the bottom of the sidebar file list
				tmpSelf._injectSidebarAddFolderButton();

				// Populate raw file list and run filter pipeline
				let tmpRemote = tmpSelf.pict.AppData.RetoldRemote;
				tmpRemote.RawFileList = pFileList || [];
				tmpRemote.ActiveMode = 'gallery';
				tmpRemote.SearchQuery = '';

				// Reset advanced filters on folder change (preserve MediaType preference)
				tmpRemote.FilterState =
				{
					MediaType: tmpRemote.FilterState.MediaType,
					Extensions: [],
					SizeMin: null,
					SizeMax: null,
					DateModifiedAfter: null,
					DateModifiedBefore: null,
					DateCreatedAfter: null,
					DateCreatedBefore: null
				};

				// Show the gallery, hide the viewer
				let tmpGalleryContainer = document.getElementById('RetoldRemote-Gallery-Container');
				let tmpViewerContainer = document.getElementById('RetoldRemote-Viewer-Container');
				if (tmpGalleryContainer) tmpGalleryContainer.style.display = '';
				if (tmpViewerContainer) tmpViewerContainer.style.display = 'none';

				// Run the filter+sort pipeline (sets GalleryItems, resets cursor, renders gallery)
				let tmpFilterSort = tmpSelf.pict.providers['RetoldRemote-GalleryFilterSort'];
				if (tmpFilterSort)
				{
					tmpFilterSort.applyFilterSort();
				}
				else
				{
					// Fallback if provider not ready
					tmpRemote.GalleryItems = pFileList || [];
					let tmpSavedIndex = tmpRemote.FolderCursorHistory && tmpRemote.FolderCursorHistory[tmpSelf.pict.AppData.PictFileBrowser.CurrentLocation || ''];
					tmpRemote.GalleryCursorIndex = (typeof tmpSavedIndex === 'number' && tmpSavedIndex < (pFileList || []).length) ? tmpSavedIndex : 0;
					let tmpGalleryView = tmpSelf.pict.views['RetoldRemote-Gallery'];
					if (tmpGalleryView)
					{
						tmpGalleryView.renderGallery();
					}
				}

				// Update the hash (use hashed identifier when available)
				let tmpCurrentPath = tmpSelf.pict.AppData.PictFileBrowser.CurrentLocation || '';
				let tmpBrowseFragProvider = tmpSelf.pict.providers['RetoldRemote-Provider'];
				let tmpBrowseFragId = (tmpBrowseFragProvider && tmpCurrentPath) ? tmpBrowseFragProvider.getFragmentIdentifier(tmpCurrentPath) : tmpCurrentPath;
				window.location.hash = tmpBrowseFragId ? '#/browse/' + tmpBrowseFragId : '#/browse/';

				// Fetch folder summary for topbar info (skip for archive paths — they are not filesystem directories)
				let tmpMediaProvider = tmpSelf.pict.providers['RetoldRemote-Provider'];
				let tmpIsArchivePath = /\.(zip|7z|rar|tar|tgz|cbz|cbr|tar\.gz|tar\.bz2|tar\.xz)(\/|$)/i.test(tmpCurrentPath);
				if (tmpMediaProvider && !tmpIsArchivePath)
				{
					tmpMediaProvider.fetchFolderSummary(tmpCurrentPath,
						(pError, pSummary) =>
						{
							if (!pError && pSummary)
							{
								tmpRemote.FolderSummary = pSummary;
								let tmpTopBar = tmpSelf.pict.views['ContentEditor-TopBar'];
								if (tmpTopBar)
								{
									tmpTopBar.updateLocation();
									tmpTopBar.updateInfo();
								}
							}
						});
				}
				else
				{
					let tmpTopBar = tmpSelf.pict.views['ContentEditor-TopBar'];
					if (tmpTopBar)
					{
						tmpTopBar.updateLocation();
						tmpTopBar.updateInfo();
					}
				}

				return tmpCallback();
			})
			.catch((pError) =>
			{
				tmpSelf.log.error(`Failed to load file list: ${pError.message}`);
				return tmpCallback();
			});
	}

	/**
	 * Override resolveHash to handle gallery and viewer routes.
	 *
	 * When a hash token (10-char hex) can't be resolved from the client-side
	 * cache, we ask the server to walk the content directory and find it.
	 */
	resolveHash()
	{
		let tmpHash = decodeURIComponent((window.location.hash || '').replace(/^#\/?/, ''));

		if (!tmpHash)
		{
			return;
		}

		let tmpParts = tmpHash.split('/');
		let tmpFragProvider = this.pict.providers['RetoldRemote-Provider'];
		let tmpSelf = this;

		// Routes that take a path identifier in the second segment
		let tmpPathRoutes = ['browse', 'view', 'explore', 'explore-audio', 'explore-image', 'edit'];
		let tmpRoute = tmpParts[0];

		if (tmpPathRoutes.indexOf(tmpRoute) >= 0 && tmpParts.length >= 2)
		{
			let tmpRawPath = tmpParts.slice(1).join('/');
			let tmpResolvedPath = tmpFragProvider ? tmpFragProvider.resolveFragmentIdentifier(tmpRawPath) : tmpRawPath;

			// If it still looks like an unresolved hash, ask the server
			if (/^[a-f0-9]{10}$/.test(tmpResolvedPath))
			{
				tmpSelf._resolveHashFromServer(tmpResolvedPath,
					(pResolvedPath) =>
					{
						tmpSelf._executeRoute(tmpRoute, pResolvedPath || tmpResolvedPath);
					});
				return;
			}

			this._executeRoute(tmpRoute, tmpResolvedPath);
		}
		else if (tmpRoute === 'collection' && tmpParts.length >= 2)
		{
			let tmpCollectionGUID = tmpParts[1];
			let tmpCollManager = this.pict.providers['RetoldRemote-CollectionManager'];
			if (tmpCollManager)
			{
				let tmpRemote = this.pict.AppData.RetoldRemote;
				tmpRemote.CollectionsPanelMode = 'detail';
				tmpCollManager.openPanel();
				tmpCollManager.fetchCollection(tmpCollectionGUID);
			}
		}
	}

	/**
	 * Execute a resolved route action.
	 *
	 * @param {string} pRoute - Route type (browse, view, explore, etc.)
	 * @param {string} pPath - Resolved file/folder path
	 */
	_executeRoute(pRoute, pPath)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpActiveMode = tmpRemote.ActiveMode || 'gallery';

		switch (pRoute)
		{
			case 'browse':
			{
				let tmpCurrentPath = (this.pict.AppData.PictFileBrowser && this.pict.AppData.PictFileBrowser.CurrentLocation) || '';
				if (pPath !== tmpCurrentPath || tmpActiveMode !== 'gallery')
				{
					this.loadFileList(pPath);
				}
				break;
			}
			case 'view':
			case 'edit':
			{
				if (this.pict.AppData.ContentEditor.CurrentFile !== pPath || tmpActiveMode === 'gallery')
				{
					this.navigateToFile(pPath);
				}
				break;
			}
			case 'explore':
			{
				let tmpVEX = this.pict.views['RetoldRemote-VideoExplorer'];
				if (tmpVEX)
				{
					tmpVEX.showExplorer(pPath);
				}
				break;
			}
			case 'explore-audio':
			{
				let tmpAEX = this.pict.views['RetoldRemote-AudioExplorer'];
				if (tmpAEX)
				{
					tmpAEX.showExplorer(pPath);
				}
				break;
			}
			case 'explore-image':
			{
				let tmpIEX = this.pict.views['RetoldRemote-ImageExplorer'];
				if (tmpIEX)
				{
					tmpIEX.showExplorer(pPath);
				}
				break;
			}
		}
	}

	/**
	 * Ask the server to resolve a hash token to a file path.
	 * Falls back to returning null if the server can't resolve it.
	 *
	 * @param {string} pHash - 10-char hex hash
	 * @param {Function} fCallback - Callback(pResolvedPath) — null if not found
	 */
	_resolveHashFromServer(pHash, fCallback)
	{
		let tmpSelf = this;

		fetch('/api/resolve-hash/' + pHash)
			.then((pResponse) =>
			{
				if (!pResponse.ok)
				{
					return fCallback(null);
				}
				return pResponse.json();
			})
			.then((pData) =>
			{
				if (pData && pData.Success && pData.Path)
				{
					// Register the mapping client-side for future use
					let tmpProvider = tmpSelf.pict.providers['RetoldRemote-Provider'];
					if (tmpProvider)
					{
						tmpProvider.registerHash(pData.Path, pHash);
					}

					// Also load the parent folder so the gallery has context
					let tmpParent = pData.Path.replace(/\/[^/]+$/, '') || '';
					tmpSelf.loadFileList(tmpParent);

					return fCallback(pData.Path);
				}
				return fCallback(null);
			})
			.catch(() =>
			{
				return fCallback(null);
			});
	}

	/**
	 * Inject a subtle "Add Folder" button at the bottom of the sidebar file list.
	 * Replaces the bright white "+" button from the breadcrumb bar.
	 */
	_injectSidebarAddFolderButton()
	{
		let tmpDetailRows = document.getElementById('Pict-FileBrowser-DetailRows');
		if (!tmpDetailRows)
		{
			return;
		}

		// Remove any existing injected button so we don't duplicate
		let tmpExisting = tmpDetailRows.parentElement.querySelector('.retold-remote-sidebar-addfolder');
		if (tmpExisting)
		{
			tmpExisting.parentElement.removeChild(tmpExisting);
		}

		let tmpBtn = document.createElement('button');
		tmpBtn.className = 'retold-remote-sidebar-addfolder';
		tmpBtn.textContent = '+ New Folder';
		tmpBtn.title = 'Create a new folder here';
		tmpBtn.onclick = function()
		{
			pict.PictApplication.promptNewFolder();
		};

		// Insert after the detail rows container
		tmpDetailRows.parentElement.appendChild(tmpBtn);
	}

	/**
	 * Save RetoldRemote settings to localStorage.
	 */
	saveSettings()
	{
		try
		{
			let tmpRemote = this.pict.AppData.RetoldRemote;
			let tmpSettings =
			{
				Theme: tmpRemote.Theme,
				ViewMode: tmpRemote.ViewMode,
				ThumbnailSize: tmpRemote.ThumbnailSize,
				GalleryFilter: tmpRemote.GalleryFilter,
				ShowHiddenFiles: tmpRemote.ShowHiddenFiles,
				DistractionFreeShowNav: tmpRemote.DistractionFreeShowNav,
				ImageFitMode: tmpRemote.ImageFitMode,
				SidebarCollapsed: tmpRemote.SidebarCollapsed,
				SidebarWidth: tmpRemote.SidebarWidth,
				SortField: tmpRemote.SortField,
				SortDirection: tmpRemote.SortDirection,
				FilterPresets: tmpRemote.FilterPresets,
				FilterPanelOpen: tmpRemote.FilterPanelOpen,
				AutoplayVideo: tmpRemote.AutoplayVideo,
				AutoplayAudio: tmpRemote.AutoplayAudio,
				ListShowExtension: tmpRemote.ListShowExtension,
				ListShowSize: tmpRemote.ListShowSize,
				ListShowDate: tmpRemote.ListShowDate,
				CollectionsPanelOpen: tmpRemote.CollectionsPanelOpen,
				CollectionsPanelWidth: tmpRemote.CollectionsPanelWidth,
				LastUsedCollectionGUID: tmpRemote.LastUsedCollectionGUID,
				FavoritesGUID: tmpRemote.FavoritesGUID,
				AISortSettings: tmpRemote.AISortSettings
			};
			localStorage.setItem('retold-remote-settings', JSON.stringify(tmpSettings));
		}
		catch (pError)
		{
			// localStorage may not be available
		}
	}

	/**
	 * Load RetoldRemote settings from localStorage.
	 */
	_loadRemoteSettings()
	{
		try
		{
			let tmpStored = localStorage.getItem('retold-remote-settings');
			if (tmpStored)
			{
				let tmpSettings = JSON.parse(tmpStored);
				let tmpRemote = this.pict.AppData.RetoldRemote;

				if (tmpSettings.Theme) tmpRemote.Theme = tmpSettings.Theme;
				if (tmpSettings.ViewMode) tmpRemote.ViewMode = tmpSettings.ViewMode;
				if (tmpSettings.ThumbnailSize) tmpRemote.ThumbnailSize = tmpSettings.ThumbnailSize;
				if (tmpSettings.GalleryFilter)
				{
					tmpRemote.GalleryFilter = tmpSettings.GalleryFilter;
					tmpRemote.FilterState.MediaType = tmpSettings.GalleryFilter;
				}
				if (typeof (tmpSettings.ShowHiddenFiles) === 'boolean') tmpRemote.ShowHiddenFiles = tmpSettings.ShowHiddenFiles;
				if (typeof (tmpSettings.DistractionFreeShowNav) === 'boolean') tmpRemote.DistractionFreeShowNav = tmpSettings.DistractionFreeShowNav;
				if (tmpSettings.ImageFitMode) tmpRemote.ImageFitMode = tmpSettings.ImageFitMode;
				if (typeof (tmpSettings.SidebarCollapsed) === 'boolean') tmpRemote.SidebarCollapsed = tmpSettings.SidebarCollapsed;
				if (tmpSettings.SidebarWidth) tmpRemote.SidebarWidth = tmpSettings.SidebarWidth;
				if (tmpSettings.SortField) tmpRemote.SortField = tmpSettings.SortField;
				if (tmpSettings.SortDirection) tmpRemote.SortDirection = tmpSettings.SortDirection;
				if (Array.isArray(tmpSettings.FilterPresets)) tmpRemote.FilterPresets = tmpSettings.FilterPresets;
				if (typeof (tmpSettings.FilterPanelOpen) === 'boolean') tmpRemote.FilterPanelOpen = tmpSettings.FilterPanelOpen;
				if (typeof (tmpSettings.AutoplayVideo) === 'boolean') tmpRemote.AutoplayVideo = tmpSettings.AutoplayVideo;
				if (typeof (tmpSettings.AutoplayAudio) === 'boolean') tmpRemote.AutoplayAudio = tmpSettings.AutoplayAudio;
				if (typeof (tmpSettings.ListShowExtension) === 'boolean') tmpRemote.ListShowExtension = tmpSettings.ListShowExtension;
				if (typeof (tmpSettings.ListShowSize) === 'boolean') tmpRemote.ListShowSize = tmpSettings.ListShowSize;
				if (typeof (tmpSettings.ListShowDate) === 'boolean') tmpRemote.ListShowDate = tmpSettings.ListShowDate;
				if (typeof (tmpSettings.CollectionsPanelOpen) === 'boolean') tmpRemote.CollectionsPanelOpen = tmpSettings.CollectionsPanelOpen;
				if (tmpSettings.CollectionsPanelWidth) tmpRemote.CollectionsPanelWidth = tmpSettings.CollectionsPanelWidth;
				if (tmpSettings.LastUsedCollectionGUID) tmpRemote.LastUsedCollectionGUID = tmpSettings.LastUsedCollectionGUID;
				if (tmpSettings.FavoritesGUID) tmpRemote.FavoritesGUID = tmpSettings.FavoritesGUID;
				if (tmpSettings.AISortSettings && typeof tmpSettings.AISortSettings === 'object')
				{
					if (tmpSettings.AISortSettings.AIEndpoint) tmpRemote.AISortSettings.AIEndpoint = tmpSettings.AISortSettings.AIEndpoint;
					if (tmpSettings.AISortSettings.AIModel) tmpRemote.AISortSettings.AIModel = tmpSettings.AISortSettings.AIModel;
					if (tmpSettings.AISortSettings.AIProvider) tmpRemote.AISortSettings.AIProvider = tmpSettings.AISortSettings.AIProvider;
					if (tmpSettings.AISortSettings.NamingTemplate) tmpRemote.AISortSettings.NamingTemplate = tmpSettings.AISortSettings.NamingTemplate;
				}
			}
		}
		catch (pError)
		{
			// localStorage may not be available
		}
	}
}

module.exports = RetoldRemoteApplication;
