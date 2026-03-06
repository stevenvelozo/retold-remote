/**
 * CollectionManager — Operation Plan Mixin
 *
 * Methods for creating, executing, and undoing file-operation plans
 * (sort plans).  These are special collections of type 'operation-plan'
 * that batch move/copy/rename operations.
 *
 * Mixed into CollectionManagerProvider.prototype via Object.assign().
 * All methods have access to this._getRemote(), this._getToast(), etc.
 *
 * @license MIT
 */

module.exports =
{
	// -- Operation Plan Methods -------------------------------------------

	/**
	 * Create an operation-plan collection with pre-populated items.
	 *
	 * @param {string} pName - Plan name
	 * @param {Array} pItems - Items with Operation and DestinationPath set
	 * @param {Function} [fCallback] - Optional callback(pError, pCollection)
	 */
	createOperationPlan: function createOperationPlan(pName, pItems, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};
		let tmpGUID = this.fable.getUUID();

		let tmpCollectionData =
		{
			Name: pName || 'Sort Plan',
			CollectionType: 'operation-plan',
			Items: pItems || []
		};

		fetch('/api/collections/' + encodeURIComponent(tmpGUID),
		{
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(tmpCollectionData)
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();

				// Open the panel and navigate to this collection
				tmpRemote.ActiveCollectionGUID = tmpGUID;
				tmpRemote.ActiveCollection = pData;
				tmpRemote.CollectionsPanelMode = 'detail';

				if (!tmpRemote.CollectionsPanelOpen)
				{
					tmpSelf.togglePanel();
				}
				else
				{
					let tmpPanel = tmpSelf._getPanelView();
					if (tmpPanel)
					{
						tmpPanel.renderContent();
					}
				}

				// Refresh the list
				tmpSelf.fetchCollections();

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Sort plan created: ' + (pData.Name || pName));
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to create operation plan: ' + pError.message);
				return tmpCallback(pError);
			});
	},

	/**
	 * Execute all pending operations in a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {Function} [fCallback] - Optional callback(pError, pResult)
	 */
	executeCollectionOperations: function executeCollectionOperations(pGUID, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};

		fetch('/api/collections/' + encodeURIComponent(pGUID) + '/execute',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({})
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				let tmpRemote = tmpSelf._getRemote();

				if (pData.Collection && tmpRemote.ActiveCollectionGUID === pGUID)
				{
					tmpRemote.ActiveCollection = pData.Collection;
				}

				let tmpPanel = tmpSelf._getPanelView();
				if (tmpPanel)
				{
					tmpPanel.renderContent();
				}

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					if (pData.TotalFailed > 0)
					{
						tmpToast.showToast('Moved ' + pData.TotalMoved + ' files (' + pData.TotalFailed + ' failed)');
					}
					else
					{
						tmpToast.showToast('Successfully moved ' + pData.TotalMoved + ' files');
					}
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to execute operations: ' + pError.message);
				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Failed to execute operations: ' + pError.message);
				}
				return tmpCallback(pError);
			});
	},

	/**
	 * Undo the last batch of operations for a collection.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {Function} [fCallback] - Optional callback(pError, pResult)
	 */
	undoCollectionOperations: function undoCollectionOperations(pGUID, fCallback)
	{
		let tmpSelf = this;
		let tmpCallback = (typeof fCallback === 'function') ? fCallback : () => {};
		let tmpRemote = this._getRemote();

		let tmpCollection = tmpRemote.ActiveCollection;
		if (!tmpCollection || !tmpCollection.OperationBatchGUID)
		{
			let tmpToast = tmpSelf._getToast();
			if (tmpToast)
			{
				tmpToast.showToast('No batch to undo');
			}
			return tmpCallback(new Error('No batch to undo'));
		}

		fetch('/api/files/undo-batch',
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ BatchGUID: tmpCollection.OperationBatchGUID })
		})
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				// Reset operation statuses back to pending
				if (tmpCollection.Items)
				{
					for (let i = 0; i < tmpCollection.Items.length; i++)
					{
						if (tmpCollection.Items[i].OperationStatus === 'completed')
						{
							tmpCollection.Items[i].OperationStatus = 'pending';
						}
					}
				}
				tmpCollection.OperationBatchGUID = null;

				// Save updated collection
				tmpSelf.updateCollection(tmpCollection);

				let tmpPanel = tmpSelf._getPanelView();
				if (tmpPanel)
				{
					tmpPanel.renderContent();
				}

				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Undo complete: ' + pData.TotalReversed + ' files restored');
				}

				return tmpCallback(null, pData);
			})
			.catch((pError) =>
			{
				tmpSelf.log.error('Failed to undo operations: ' + pError.message);
				let tmpToast = tmpSelf._getToast();
				if (tmpToast)
				{
					tmpToast.showToast('Failed to undo: ' + pError.message);
				}
				return tmpCallback(pError);
			});
	},

	/**
	 * Update a single item's destination path in the active collection.
	 *
	 * @param {string} pItemID - Item ID
	 * @param {string} pNewDestPath - New destination path
	 */
	setItemDestination: function setItemDestination(pItemID, pNewDestPath)
	{
		let tmpRemote = this._getRemote();
		let tmpCollection = tmpRemote.ActiveCollection;

		if (!tmpCollection || !tmpCollection.Items)
		{
			return;
		}

		for (let i = 0; i < tmpCollection.Items.length; i++)
		{
			if (tmpCollection.Items[i].ID === pItemID)
			{
				tmpCollection.Items[i].DestinationPath = pNewDestPath;
				break;
			}
		}

		// Save to server in background
		this.updateCollection(tmpCollection);
	},

	/**
	 * Skip an item's operation (set status to 'skipped').
	 *
	 * @param {string} pItemID - Item ID
	 */
	skipItemOperation: function skipItemOperation(pItemID)
	{
		let tmpRemote = this._getRemote();
		let tmpCollection = tmpRemote.ActiveCollection;

		if (!tmpCollection || !tmpCollection.Items)
		{
			return;
		}

		for (let i = 0; i < tmpCollection.Items.length; i++)
		{
			if (tmpCollection.Items[i].ID === pItemID)
			{
				tmpCollection.Items[i].OperationStatus = 'skipped';
				break;
			}
		}

		let tmpPanel = this._getPanelView();
		if (tmpPanel)
		{
			tmpPanel.renderContent();
		}

		// Save to server in background
		this.updateCollection(tmpCollection);
	}
};
