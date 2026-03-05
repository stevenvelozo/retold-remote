/**
 * Retold Remote -- AI Sort Manager Provider
 *
 * Client-side state management and API communication for the
 * AI-powered file sorting feature.  Manages AI endpoint settings,
 * connection testing, folder scanning, and sort plan generation.
 *
 * Sort plans are created as operation-plan collections, so all
 * preview, editing, and execution happens through the existing
 * collections infrastructure.
 *
 * Settings are persisted via localStorage alongside other RetoldRemote
 * settings.
 *
 * @license MIT
 */
const libPictProvider = require('pict-provider');

const _DefaultProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-AISortManager',
	AutoInitialize: true,
	AutoSolveWithApp: false
};

class AISortManagerProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		// Track in-progress operations
		this._generating = false;
		this._scanning = false;
		this._testingConnection = false;
	}

	// -- State Accessors --------------------------------------------------

	/**
	 * Shortcut to the RetoldRemote AppData namespace.
	 */
	_getRemote()
	{
		return this.pict.AppData.RetoldRemote;
	}

	/**
	 * Get the AI sort settings from AppData.
	 */
	_getSettings()
	{
		let tmpRemote = this._getRemote();
		if (!tmpRemote.AISortSettings)
		{
			tmpRemote.AISortSettings =
			{
				AIEndpoint: 'http://localhost:11434',
				AIModel: 'llama3.1',
				AIProvider: 'ollama',
				NamingTemplate: '{artist}/{album}/{track} - {title}'
			};
		}
		return tmpRemote.AISortSettings;
	}

	/**
	 * Get the toast notification provider.
	 */
	_getToast()
	{
		return this.pict.providers['RetoldRemote-ToastNotification'];
	}

	/**
	 * Get the collection manager provider.
	 */
	_getCollectionManager()
	{
		return this.pict.providers['RetoldRemote-CollectionManager'];
	}

	// -- Settings Management ----------------------------------------------

	/**
	 * Update AI sort settings.
	 *
	 * @param {object} pSettings - Settings object with any of: AIEndpoint, AIModel, AIProvider, NamingTemplate
	 */
	updateSettings(pSettings)
	{
		let tmpSettings = this._getSettings();

		if (pSettings.AIEndpoint !== undefined)
		{
			tmpSettings.AIEndpoint = pSettings.AIEndpoint;
		}
		if (pSettings.AIModel !== undefined)
		{
			tmpSettings.AIModel = pSettings.AIModel;
		}
		if (pSettings.AIProvider !== undefined)
		{
			tmpSettings.AIProvider = pSettings.AIProvider;
		}
		if (pSettings.NamingTemplate !== undefined)
		{
			tmpSettings.NamingTemplate = pSettings.NamingTemplate;
		}

		// Persist settings
		this.pict.PictApplication.saveSettings();
	}

	// -- API Methods ------------------------------------------------------

	/**
	 * Test the AI endpoint connection.
	 *
	 * @param {Function} [fCallback] - Optional callback(pError, pResult)
	 */
	testConnection(fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		if (this._testingConnection)
		{
			return tmpCallback(new Error('Connection test already in progress'));
		}

		this._testingConnection = true;
		let tmpSettings = this._getSettings();

		let tmpToast = this._getToast();

		fetch('/api/ai-sort/test-connection',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(
			{
				AIEndpoint: tmpSettings.AIEndpoint,
				AIModel: tmpSettings.AIModel,
				AIProvider: tmpSettings.AIProvider
			})
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				tmpSelf._testingConnection = false;

				if (pData.Success)
				{
					if (tmpToast)
					{
						tmpToast.show('AI connected (' + pData.ResponseTime + 'ms)');
					}
				}
				else
				{
					if (tmpToast)
					{
						tmpToast.show('AI connection failed: ' + (pData.Error || 'Unknown error'));
					}
				}

				// Update the test button state if settings panel is open
				tmpSelf._updateTestButtonState(pData.Success);

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf._testingConnection = false;

				if (tmpToast)
				{
					tmpToast.show('AI connection error: ' + pError.message);
				}

				tmpSelf._updateTestButtonState(false);

				return tmpCallback(pError);
			});
	}

	/**
	 * Scan a folder for audio files and return metadata.
	 *
	 * @param {string} pPath - Folder path relative to content root
	 * @param {boolean} [pRecursive] - Scan subdirectories
	 * @param {Function} [fCallback] - Optional callback(pError, pResult)
	 */
	scanFolder(pPath, pRecursive, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		if (this._scanning)
		{
			return tmpCallback(new Error('Scan already in progress'));
		}

		this._scanning = true;

		fetch('/api/ai-sort/scan',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(
			{
				Path: pPath || '',
				Recursive: pRecursive || false
			})
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				tmpSelf._scanning = false;

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					if (pData.Success)
					{
						tmpToast.show('Scanned ' + pData.FileCount + ' audio files');
					}
					else
					{
						tmpToast.show('Scan failed: ' + (pData.Error || 'Unknown error'));
					}
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf._scanning = false;

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.show('Scan error: ' + pError.message);
				}

				return tmpCallback(pError);
			});
	}

	/**
	 * Generate a sort plan for a folder.
	 *
	 * Creates an operation-plan collection and opens it in the
	 * collections panel for preview and editing.
	 *
	 * @param {string} pPath - Folder path relative to content root
	 * @param {Function} [fCallback] - Optional callback(pError, pResult)
	 */
	generateSortPlan(pPath, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		if (this._generating)
		{
			let tmpToast = this._getToast();
			if (tmpToast)
			{
				tmpToast.show('Sort plan generation already in progress...');
			}
			return tmpCallback(new Error('Generation already in progress'));
		}

		this._generating = true;
		let tmpSettings = this._getSettings();

		let tmpToast = this._getToast();
		if (tmpToast)
		{
			tmpToast.show('Generating sort plan...');
		}

		fetch('/api/ai-sort/generate-plan',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(
			{
				Path: pPath || '',
				NamingTemplate: tmpSettings.NamingTemplate,
				Recursive: true,
				AIEndpoint: tmpSettings.AIEndpoint,
				AIModel: tmpSettings.AIModel,
				AIProvider: tmpSettings.AIProvider
			})
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				tmpSelf._generating = false;

				if (!pData.Success)
				{
					if (tmpToast)
					{
						tmpToast.show('Sort plan failed: ' + (pData.Error || pData.Message || 'Unknown error'));
					}
					return tmpCallback(new Error(pData.Error || pData.Message));
				}

				if (!pData.CollectionGUID)
				{
					if (tmpToast)
					{
						tmpToast.show(pData.Message || 'No audio files found');
					}
					return tmpCallback(null, pData);
				}

				// Open the generated collection in the panel
				let tmpCollManager = tmpSelf._getCollectionManager();
				if (tmpCollManager)
				{
					let tmpRemote = tmpSelf._getRemote();
					tmpRemote.CollectionsPanelMode = 'detail';

					if (!tmpRemote.CollectionsPanelOpen)
					{
						tmpCollManager.togglePanel();
					}

					tmpCollManager.fetchCollection(pData.CollectionGUID);
					tmpCollManager.fetchCollections();
				}

				if (tmpToast)
				{
					let tmpMsg = 'Sort plan created: ' + pData.TotalFiles + ' files';
					if (pData.TaggedFiles > 0)
					{
						tmpMsg += ' (' + pData.TaggedFiles + ' by tags';
						if (pData.AIFiles > 0)
						{
							tmpMsg += ', ' + pData.AIFiles + ' by AI';
						}
						tmpMsg += ')';
					}
					tmpToast.show(tmpMsg);
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf._generating = false;

				if (tmpToast)
				{
					tmpToast.show('Sort plan error: ' + pError.message);
				}

				return tmpCallback(pError);
			});
	}

	// -- UI Helpers --------------------------------------------------------

	/**
	 * Update the test connection button state in the settings panel.
	 *
	 * @param {boolean} pSuccess - Whether the test was successful
	 */
	_updateTestButtonState(pSuccess)
	{
		let tmpBtn = document.getElementById('RetoldRemote-AISortTestBtn');
		if (!tmpBtn)
		{
			return;
		}

		tmpBtn.disabled = false;

		if (pSuccess === true)
		{
			tmpBtn.style.borderColor = 'var(--retold-accent)';
			tmpBtn.style.color = 'var(--retold-accent)';
			tmpBtn.textContent = 'Connected';
			setTimeout(() =>
			{
				tmpBtn.textContent = 'Test Connection';
				tmpBtn.style.borderColor = '';
				tmpBtn.style.color = '';
			}, 3000);
		}
		else if (pSuccess === false)
		{
			tmpBtn.style.borderColor = 'var(--retold-danger-muted)';
			tmpBtn.style.color = 'var(--retold-danger-muted)';
			tmpBtn.textContent = 'Failed';
			setTimeout(() =>
			{
				tmpBtn.textContent = 'Test Connection';
				tmpBtn.style.borderColor = '';
				tmpBtn.style.color = '';
			}, 3000);
		}
	}

	/**
	 * Get a preview of the naming template with sample data.
	 *
	 * @param {string} pTemplate - Naming template
	 * @returns {string} Preview string
	 */
	getTemplatePreview(pTemplate)
	{
		let tmpTemplate = pTemplate || '{artist}/{album}/{track} - {title}';
		let tmpPreview = tmpTemplate
			.replace(/\{artist\}/gi, 'Pink Floyd')
			.replace(/\{album\}/gi, 'Dark Side of the Moon')
			.replace(/\{title\}/gi, 'Time')
			.replace(/\{track\}/gi, '04')
			.replace(/\{year\}/gi, '1973')
			.replace(/\{genre\}/gi, 'Progressive Rock');

		return tmpPreview + '.mp3';
	}

	/**
	 * Whether the AI sort button should be visible for the current folder.
	 *
	 * Returns true if we're in gallery mode (browsing a folder).
	 *
	 * @returns {boolean}
	 */
	isAvailable()
	{
		let tmpRemote = this._getRemote();
		return tmpRemote.ActiveMode === 'gallery';
	}

	/**
	 * Whether a generation is currently in progress.
	 *
	 * @returns {boolean}
	 */
	isGenerating()
	{
		return this._generating;
	}
}

AISortManagerProvider.default_configuration = _DefaultProviderConfiguration;

module.exports = AISortManagerProvider;
