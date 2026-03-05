/**
 * Retold Remote -- Collection Service
 *
 * Provides REST API endpoints for managing user-defined collections
 * of files, folders, and sub-file references.  Collections are stored
 * as Bibliograph JSON records under the source "retold-remote-collections".
 *
 * Endpoints:
 *   GET    /api/collections                      -- List all collections (summaries)
 *   GET    /api/collections/:guid                -- Get full collection with items
 *   PUT    /api/collections/:guid                -- Create or update a collection
 *   DELETE /api/collections/:guid                -- Delete a collection
 *   POST   /api/collections/:guid/items          -- Add item(s) to a collection
 *   DELETE /api/collections/:guid/items/:itemId  -- Remove an item
 *   PUT    /api/collections/:guid/reorder        -- Reorder items (manual sort)
 *   POST   /api/collections/copy-items           -- Copy items between collections
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');

const SOURCE_NAME = 'retold-remote-collections';

class RetoldRemoteCollectionService extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteCollectionService';
	}

	// -- Helpers ----------------------------------------------------------

	/**
	 * Build a lightweight summary object from a full collection record.
	 *
	 * @param {object} pRecord - Full collection record
	 * @returns {object} Summary with GUID, Name, Description, CoverImage, Icon, ItemCount, ModifiedAt, Tags
	 */
	_buildCollectionSummary(pRecord)
	{
		return (
		{
			GUID: pRecord.GUID,
			Name: pRecord.Name || '',
			Description: pRecord.Description || '',
			CoverImage: pRecord.CoverImage || '',
			Icon: pRecord.Icon || 'bookmark',
			ItemCount: (Array.isArray(pRecord.Items)) ? pRecord.Items.length : 0,
			CreatedAt: pRecord.CreatedAt || '',
			ModifiedAt: pRecord.ModifiedAt || '',
			Tags: pRecord.Tags || []
		});
	}

	/**
	 * Sort a collection's Items array in place.
	 *
	 * @param {Array} pItems - Items array
	 * @param {string} pSortMode - "manual" | "name" | "modified" | "type" | "size"
	 * @param {string} pSortDirection - "asc" | "desc"
	 * @returns {Array} The same array, sorted
	 */
	_sortItems(pItems, pSortMode, pSortDirection)
	{
		if (!Array.isArray(pItems) || pItems.length < 2)
		{
			return pItems;
		}

		let tmpDirection = (pSortDirection === 'desc') ? -1 : 1;

		switch (pSortMode)
		{
			case 'name':
				pItems.sort((a, b) =>
				{
					let tmpA = (a.Label || a.Path || '').toLowerCase();
					let tmpB = (b.Label || b.Path || '').toLowerCase();
					// Sort by filename portion only (after last /)
					let tmpSlashA = tmpA.lastIndexOf('/');
					let tmpSlashB = tmpB.lastIndexOf('/');
					if (tmpSlashA >= 0) tmpA = tmpA.substring(tmpSlashA + 1);
					if (tmpSlashB >= 0) tmpB = tmpB.substring(tmpSlashB + 1);
					return tmpDirection * tmpA.localeCompare(tmpB);
				});
				break;

			case 'type':
				pItems.sort((a, b) =>
				{
					let tmpA = (a.Type || '').toLowerCase();
					let tmpB = (b.Type || '').toLowerCase();
					return tmpDirection * tmpA.localeCompare(tmpB);
				});
				break;

			case 'modified':
				pItems.sort((a, b) =>
				{
					let tmpA = a.AddedAt || '';
					let tmpB = b.AddedAt || '';
					return tmpDirection * tmpA.localeCompare(tmpB);
				});
				break;

			case 'manual':
			default:
				pItems.sort((a, b) =>
				{
					return tmpDirection * ((a.SortOrder || 0) - (b.SortOrder || 0));
				});
				break;
		}

		return pItems;
	}

	/**
	 * Create a blank collection record with defaults.
	 *
	 * @param {string} pGUID - Collection GUID
	 * @param {string} pName - Collection name
	 * @returns {object} New collection record
	 */
	_createBlankCollection(pGUID, pName)
	{
		let tmpNow = new Date().toISOString();
		return (
		{
			GUID: pGUID,
			Name: pName || 'Untitled Collection',
			Description: '',
			CoverImage: '',
			Icon: 'bookmark',
			CreatedAt: tmpNow,
			ModifiedAt: tmpNow,
			SortMode: 'manual',
			SortDirection: 'asc',
			Tags: [],
			Items: []
		});
	}

	// -- Route Wiring -----------------------------------------------------

	/**
	 * Wire all REST endpoints.  Called from Server-Setup after Parime
	 * initialization is complete.
	 *
	 * @param {object} pServiceServer - Orator service server instance
	 */
	connectRoutes(pServiceServer)
	{
		let tmpSelf = this;

		// Ensure the Bibliograph source directory exists (idempotent)
		this.fable.Bibliograph.createSource(SOURCE_NAME,
			(pError) =>
			{
				if (pError)
				{
					tmpSelf.fable.log.warn('Collection source creation notice: ' + pError.message);
				}
				tmpSelf._wireRoutes(pServiceServer);
			});
	}

	/**
	 * Internal: register all endpoint handlers.
	 *
	 * @param {object} pServiceServer - Orator service server instance
	 */
	_wireRoutes(pServiceServer)
	{
		let tmpSelf = this;
		let tmpServer = pServiceServer.server;

		// -----------------------------------------------------------------
		// GET /api/collections — List all collections (summaries)
		// Optional: ?q=searchTerm to filter by name/description/tags
		// -----------------------------------------------------------------
		tmpServer.get('/api/collections',
			(pRequest, pResponse, fNext) =>
			{
				tmpSelf.fable.Bibliograph.readRecordKeys(SOURCE_NAME,
					(pError, pKeys) =>
					{
						if (pError)
						{
							pResponse.send(200, []);
							return fNext();
						}

						if (!pKeys || pKeys.length === 0)
						{
							pResponse.send(200, []);
							return fNext();
						}

						let tmpSummaries = [];
						let tmpPending = pKeys.length;
						let tmpSearchQuery = (pRequest.query && pRequest.query.q) ? pRequest.query.q.toLowerCase() : '';

						for (let i = 0; i < pKeys.length; i++)
						{
							tmpSelf.fable.Bibliograph.read(SOURCE_NAME, pKeys[i],
								(pReadError, pRecord) =>
								{
									if (!pReadError && pRecord)
									{
										// If there is a search query, filter
										if (tmpSearchQuery)
										{
											let tmpName = (pRecord.Name || '').toLowerCase();
											let tmpDesc = (pRecord.Description || '').toLowerCase();
											let tmpTags = (pRecord.Tags || []).join(' ').toLowerCase();
											if (tmpName.indexOf(tmpSearchQuery) >= 0 ||
												tmpDesc.indexOf(tmpSearchQuery) >= 0 ||
												tmpTags.indexOf(tmpSearchQuery) >= 0)
											{
												tmpSummaries.push(tmpSelf._buildCollectionSummary(pRecord));
											}
										}
										else
										{
											tmpSummaries.push(tmpSelf._buildCollectionSummary(pRecord));
										}
									}

									tmpPending--;
									if (tmpPending <= 0)
									{
										// Sort by most recently modified first
										tmpSummaries.sort((a, b) => (b.ModifiedAt || '').localeCompare(a.ModifiedAt || ''));
										pResponse.send(200, tmpSummaries);
										return fNext();
									}
								});
						}
					});
			});

		// -----------------------------------------------------------------
		// GET /api/collections/:guid — Get full collection
		// -----------------------------------------------------------------
		tmpServer.get('/api/collections/:guid',
			(pRequest, pResponse, fNext) =>
			{
				let tmpGUID = pRequest.params.guid;
				if (!tmpGUID)
				{
					pResponse.send(400, { Error: 'Missing collection GUID.' });
					return fNext();
				}

				tmpSelf.fable.Bibliograph.read(SOURCE_NAME, tmpGUID,
					(pError, pRecord) =>
					{
						if (pError || !pRecord)
						{
							pResponse.send(404, { Error: 'Collection not found.' });
							return fNext();
						}

						// Sort items according to collection's sort preference
						if (pRecord.Items)
						{
							tmpSelf._sortItems(pRecord.Items, pRecord.SortMode, pRecord.SortDirection);
						}

						pResponse.send(200, pRecord);
						return fNext();
					});
			});

		// -----------------------------------------------------------------
		// PUT /api/collections/:guid — Create or update a collection
		// -----------------------------------------------------------------
		tmpServer.put('/api/collections/:guid',
			(pRequest, pResponse, fNext) =>
			{
				let tmpGUID = pRequest.params.guid;
				if (!tmpGUID)
				{
					pResponse.send(400, { Error: 'Missing collection GUID.' });
					return fNext();
				}

				let tmpBody = pRequest.body || {};

				// Check if this is a creation or update
				tmpSelf.fable.Bibliograph.read(SOURCE_NAME, tmpGUID,
					(pReadError, pExisting) =>
					{
						let tmpRecord;

						if (pExisting)
						{
							// Update: merge body into existing record
							tmpRecord = pExisting;
							if (typeof tmpBody.Name === 'string') tmpRecord.Name = tmpBody.Name;
							if (typeof tmpBody.Description === 'string') tmpRecord.Description = tmpBody.Description;
							if (typeof tmpBody.CoverImage === 'string') tmpRecord.CoverImage = tmpBody.CoverImage;
							if (typeof tmpBody.Icon === 'string') tmpRecord.Icon = tmpBody.Icon;
							if (typeof tmpBody.SortMode === 'string') tmpRecord.SortMode = tmpBody.SortMode;
							if (typeof tmpBody.SortDirection === 'string') tmpRecord.SortDirection = tmpBody.SortDirection;
							if (Array.isArray(tmpBody.Tags)) tmpRecord.Tags = tmpBody.Tags;
							if (Array.isArray(tmpBody.Items)) tmpRecord.Items = tmpBody.Items;
							tmpRecord.ModifiedAt = new Date().toISOString();
						}
						else
						{
							// Create new
							tmpRecord = tmpSelf._createBlankCollection(tmpGUID, tmpBody.Name);
							if (typeof tmpBody.Description === 'string') tmpRecord.Description = tmpBody.Description;
							if (typeof tmpBody.CoverImage === 'string') tmpRecord.CoverImage = tmpBody.CoverImage;
							if (typeof tmpBody.Icon === 'string') tmpRecord.Icon = tmpBody.Icon;
							if (typeof tmpBody.SortMode === 'string') tmpRecord.SortMode = tmpBody.SortMode;
							if (typeof tmpBody.SortDirection === 'string') tmpRecord.SortDirection = tmpBody.SortDirection;
							if (Array.isArray(tmpBody.Tags)) tmpRecord.Tags = tmpBody.Tags;
						}

						tmpSelf.fable.Bibliograph.write(SOURCE_NAME, tmpGUID, tmpRecord,
							(pWriteError) =>
							{
								if (pWriteError)
								{
									pResponse.send(500, { Error: 'Failed to save collection: ' + pWriteError.message });
									return fNext();
								}

								pResponse.send(200, tmpRecord);
								return fNext();
							});
					});
			});

		// -----------------------------------------------------------------
		// DELETE /api/collections/:guid — Delete a collection
		// -----------------------------------------------------------------
		tmpServer.del('/api/collections/:guid',
			(pRequest, pResponse, fNext) =>
			{
				let tmpGUID = pRequest.params.guid;
				if (!tmpGUID)
				{
					pResponse.send(400, { Error: 'Missing collection GUID.' });
					return fNext();
				}

				tmpSelf.fable.Bibliograph.delete(SOURCE_NAME, tmpGUID,
					(pError) =>
					{
						if (pError)
						{
							pResponse.send(500, { Error: 'Failed to delete collection: ' + pError.message });
							return fNext();
						}

						pResponse.send(200, { Success: true });
						return fNext();
					});
			});

		// -----------------------------------------------------------------
		// POST /api/collections/:guid/items — Add item(s)
		// Body: { Items: [ { Type, Path, Hash, Label, ... }, ... ] }
		// -----------------------------------------------------------------
		tmpServer.post('/api/collections/:guid/items',
			(pRequest, pResponse, fNext) =>
			{
				let tmpGUID = pRequest.params.guid;
				if (!tmpGUID)
				{
					pResponse.send(400, { Error: 'Missing collection GUID.' });
					return fNext();
				}

				let tmpBody = pRequest.body || {};
				let tmpNewItems = tmpBody.Items;
				if (!Array.isArray(tmpNewItems) || tmpNewItems.length === 0)
				{
					pResponse.send(400, { Error: 'Body must contain an Items array.' });
					return fNext();
				}

				tmpSelf.fable.Bibliograph.read(SOURCE_NAME, tmpGUID,
					(pReadError, pRecord) =>
					{
						if (pReadError || !pRecord)
						{
							pResponse.send(404, { Error: 'Collection not found.' });
							return fNext();
						}

						if (!Array.isArray(pRecord.Items))
						{
							pRecord.Items = [];
						}

						// Determine the next SortOrder value
						let tmpMaxSortOrder = 0;
						for (let i = 0; i < pRecord.Items.length; i++)
						{
							if ((pRecord.Items[i].SortOrder || 0) > tmpMaxSortOrder)
							{
								tmpMaxSortOrder = pRecord.Items[i].SortOrder;
							}
						}

						let tmpNow = new Date().toISOString();

						for (let i = 0; i < tmpNewItems.length; i++)
						{
							let tmpItem = tmpNewItems[i];
							tmpMaxSortOrder++;

							pRecord.Items.push(
							{
								ID: tmpItem.ID || tmpSelf.fable.getUUID(),
								Type: tmpItem.Type || 'file',
								Path: tmpItem.Path || '',
								Hash: tmpItem.Hash || '',
								Label: tmpItem.Label || '',
								Note: tmpItem.Note || '',
								SortOrder: tmpMaxSortOrder,
								AddedAt: tmpNow,
								ArchivePath: tmpItem.ArchivePath || null,
								CropRegion: tmpItem.CropRegion || null,
								VideoStart: (typeof tmpItem.VideoStart === 'number') ? tmpItem.VideoStart : null,
								VideoEnd: (typeof tmpItem.VideoEnd === 'number') ? tmpItem.VideoEnd : null,
								FrameTimestamp: (typeof tmpItem.FrameTimestamp === 'number') ? tmpItem.FrameTimestamp : null
							});
						}

						pRecord.ModifiedAt = tmpNow;

						tmpSelf.fable.Bibliograph.write(SOURCE_NAME, tmpGUID, pRecord,
							(pWriteError) =>
							{
								if (pWriteError)
								{
									pResponse.send(500, { Error: 'Failed to save collection: ' + pWriteError.message });
									return fNext();
								}

								pResponse.send(200, pRecord);
								return fNext();
							});
					});
			});

		// -----------------------------------------------------------------
		// DELETE /api/collections/:guid/items/:itemId — Remove an item
		// -----------------------------------------------------------------
		tmpServer.del('/api/collections/:guid/items/:itemId',
			(pRequest, pResponse, fNext) =>
			{
				let tmpGUID = pRequest.params.guid;
				let tmpItemId = pRequest.params.itemId;
				if (!tmpGUID || !tmpItemId)
				{
					pResponse.send(400, { Error: 'Missing collection GUID or item ID.' });
					return fNext();
				}

				tmpSelf.fable.Bibliograph.read(SOURCE_NAME, tmpGUID,
					(pReadError, pRecord) =>
					{
						if (pReadError || !pRecord)
						{
							pResponse.send(404, { Error: 'Collection not found.' });
							return fNext();
						}

						if (!Array.isArray(pRecord.Items))
						{
							pRecord.Items = [];
						}

						let tmpOriginalLength = pRecord.Items.length;
						pRecord.Items = pRecord.Items.filter((pItem) => pItem.ID !== tmpItemId);

						if (pRecord.Items.length === tmpOriginalLength)
						{
							pResponse.send(404, { Error: 'Item not found in collection.' });
							return fNext();
						}

						pRecord.ModifiedAt = new Date().toISOString();

						tmpSelf.fable.Bibliograph.write(SOURCE_NAME, tmpGUID, pRecord,
							(pWriteError) =>
							{
								if (pWriteError)
								{
									pResponse.send(500, { Error: 'Failed to save collection: ' + pWriteError.message });
									return fNext();
								}

								pResponse.send(200, pRecord);
								return fNext();
							});
					});
			});

		// -----------------------------------------------------------------
		// PUT /api/collections/:guid/reorder — Reorder items
		// Body: { ItemOrder: ["id1", "id2", ...] }
		// -----------------------------------------------------------------
		tmpServer.put('/api/collections/:guid/reorder',
			(pRequest, pResponse, fNext) =>
			{
				let tmpGUID = pRequest.params.guid;
				if (!tmpGUID)
				{
					pResponse.send(400, { Error: 'Missing collection GUID.' });
					return fNext();
				}

				let tmpBody = pRequest.body || {};
				let tmpItemOrder = tmpBody.ItemOrder;
				if (!Array.isArray(tmpItemOrder))
				{
					pResponse.send(400, { Error: 'Body must contain an ItemOrder array of item IDs.' });
					return fNext();
				}

				tmpSelf.fable.Bibliograph.read(SOURCE_NAME, tmpGUID,
					(pReadError, pRecord) =>
					{
						if (pReadError || !pRecord)
						{
							pResponse.send(404, { Error: 'Collection not found.' });
							return fNext();
						}

						if (!Array.isArray(pRecord.Items))
						{
							pRecord.Items = [];
						}

						// Build a lookup map of item ID -> item
						let tmpItemMap = {};
						for (let i = 0; i < pRecord.Items.length; i++)
						{
							tmpItemMap[pRecord.Items[i].ID] = pRecord.Items[i];
						}

						// Renumber SortOrder based on the provided order
						for (let i = 0; i < tmpItemOrder.length; i++)
						{
							if (tmpItemMap[tmpItemOrder[i]])
							{
								tmpItemMap[tmpItemOrder[i]].SortOrder = i;
							}
						}

						pRecord.SortMode = 'manual';
						pRecord.ModifiedAt = new Date().toISOString();

						tmpSelf.fable.Bibliograph.write(SOURCE_NAME, tmpGUID, pRecord,
							(pWriteError) =>
							{
								if (pWriteError)
								{
									pResponse.send(500, { Error: 'Failed to save collection: ' + pWriteError.message });
									return fNext();
								}

								// Return sorted items
								tmpSelf._sortItems(pRecord.Items, 'manual', 'asc');
								pResponse.send(200, pRecord);
								return fNext();
							});
					});
			});

		// -----------------------------------------------------------------
		// POST /api/collections/copy-items — Copy items between collections
		// Body: { SourceGUID, TargetGUID, ItemIDs: [] }
		// -----------------------------------------------------------------
		tmpServer.post('/api/collections/copy-items',
			(pRequest, pResponse, fNext) =>
			{
				let tmpBody = pRequest.body || {};
				let tmpSourceGUID = tmpBody.SourceGUID;
				let tmpTargetGUID = tmpBody.TargetGUID;
				let tmpItemIDs = tmpBody.ItemIDs;

				if (!tmpSourceGUID || !tmpTargetGUID)
				{
					pResponse.send(400, { Error: 'SourceGUID and TargetGUID are required.' });
					return fNext();
				}
				if (!Array.isArray(tmpItemIDs) || tmpItemIDs.length === 0)
				{
					pResponse.send(400, { Error: 'ItemIDs must be a non-empty array.' });
					return fNext();
				}

				// Read the source collection
				tmpSelf.fable.Bibliograph.read(SOURCE_NAME, tmpSourceGUID,
					(pSourceError, pSourceRecord) =>
					{
						if (pSourceError || !pSourceRecord)
						{
							pResponse.send(404, { Error: 'Source collection not found.' });
							return fNext();
						}

						// Read the target collection
						tmpSelf.fable.Bibliograph.read(SOURCE_NAME, tmpTargetGUID,
							(pTargetError, pTargetRecord) =>
							{
								if (pTargetError || !pTargetRecord)
								{
									pResponse.send(404, { Error: 'Target collection not found.' });
									return fNext();
								}

								if (!Array.isArray(pTargetRecord.Items))
								{
									pTargetRecord.Items = [];
								}

								// Determine next sort order in target
								let tmpMaxSortOrder = 0;
								for (let i = 0; i < pTargetRecord.Items.length; i++)
								{
									if ((pTargetRecord.Items[i].SortOrder || 0) > tmpMaxSortOrder)
									{
										tmpMaxSortOrder = pTargetRecord.Items[i].SortOrder;
									}
								}

								// Build a set for quick lookup
								let tmpItemIDSet = {};
								for (let i = 0; i < tmpItemIDs.length; i++)
								{
									tmpItemIDSet[tmpItemIDs[i]] = true;
								}

								// Copy matching items with new IDs
								let tmpNow = new Date().toISOString();
								let tmpSourceItems = pSourceRecord.Items || [];
								for (let i = 0; i < tmpSourceItems.length; i++)
								{
									if (tmpItemIDSet[tmpSourceItems[i].ID])
									{
										tmpMaxSortOrder++;
										let tmpCopy = JSON.parse(JSON.stringify(tmpSourceItems[i]));
										tmpCopy.ID = tmpSelf.fable.getUUID();
										tmpCopy.SortOrder = tmpMaxSortOrder;
										tmpCopy.AddedAt = tmpNow;
										pTargetRecord.Items.push(tmpCopy);
									}
								}

								pTargetRecord.ModifiedAt = tmpNow;

								tmpSelf.fable.Bibliograph.write(SOURCE_NAME, tmpTargetGUID, pTargetRecord,
									(pWriteError) =>
									{
										if (pWriteError)
										{
											pResponse.send(500, { Error: 'Failed to save target collection: ' + pWriteError.message });
											return fNext();
										}

										pResponse.send(200, pTargetRecord);
										return fNext();
									});
							});
					});
			});

		this.fable.log.info('Collection Service: routes connected.');
	}
}

module.exports = RetoldRemoteCollectionService;
