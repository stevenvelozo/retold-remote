/**
 * Retold Remote -- Explorer State Persistence Mixin
 *
 * Provides Bibliograph-backed state persistence for explorer services
 * (video, audio, ebook).  Each service stores per-file state records
 * keyed by a hash of the relative path and file modification time.
 *
 * Usage:
 *   const libExplorerStateMixin = require('./RetoldRemote-ExplorerStateMixin');
 *
 *   // In the service class, after calling super() in the constructor:
 *   libExplorerStateMixin.apply(this, 'retold-remote-video-explorer-state', 'video-explorer');
 *
 *   // This adds the following methods to the service instance:
 *   //   initializeState(fCallback)
 *   //   _buildExplorerStateKey(pRelPath, pMtimeMs)
 *   //   loadExplorerState(pRelPath, pMtimeMs, fCallback)
 *   //   saveExplorerState(pRelPath, pMtimeMs, pStateData, fCallback)
 *
 * @license MIT
 */
const libCrypto = require('crypto');

/**
 * Apply explorer state methods to a service instance.
 *
 * @param {object} pService         - The service instance (must have pService.fable)
 * @param {string} pBibliographSource - Bibliograph source name (e.g. 'retold-remote-video-explorer-state')
 * @param {string} pKeyPrefix       - Prefix for the hash input (e.g. 'video-explorer')
 */
function applyExplorerStateMixin(pService, pBibliographSource, pKeyPrefix)
{
	/**
	 * Create the Bibliograph source for this explorer's state.
	 * Must be called after Parime initialization completes.
	 *
	 * @param {Function} fCallback - Callback(pError)
	 */
	pService.initializeState = function initializeState(fCallback)
	{
		pService.fable.Bibliograph.createSource(pBibliographSource,
			(pError) =>
			{
				if (pError)
				{
					pService.fable.log.warn(pKeyPrefix + ' state source creation notice: ' + pError.message);
				}
				return fCallback();
			});
	};

	/**
	 * Build a 16-char hex Bibliograph record key for explorer state.
	 *
	 * @param {string} pRelPath - Relative path to the media file
	 * @param {number} pMtimeMs - File modification time in ms
	 * @returns {string} 16-character hex hash key
	 */
	pService._buildExplorerStateKey = function _buildExplorerStateKey(pRelPath, pMtimeMs)
	{
		let tmpInput = `${pKeyPrefix}:${pRelPath}:${pMtimeMs}`;
		return libCrypto.createHash('sha256').update(tmpInput).digest('hex').substring(0, 16);
	};

	/**
	 * Load saved explorer state from Bibliograph.
	 *
	 * @param {string}   pRelPath  - Relative path to the media file
	 * @param {number}   pMtimeMs  - File modification time in ms
	 * @param {Function} fCallback - Callback(pError, pState) where pState is the record or null
	 */
	pService.loadExplorerState = function loadExplorerState(pRelPath, pMtimeMs, fCallback)
	{
		let tmpKey = pService._buildExplorerStateKey(pRelPath, pMtimeMs);

		pService.fable.Bibliograph.read(pBibliographSource, tmpKey,
			(pError, pRecord) =>
			{
				if (pError || !pRecord)
				{
					return fCallback(null, null);
				}

				return fCallback(null, pRecord);
			});
	};

	/**
	 * Save explorer state to Bibliograph.
	 *
	 * @param {string}   pRelPath   - Relative path to the media file
	 * @param {number}   pMtimeMs   - File modification time in ms
	 * @param {object}   pStateData - State data to persist (written as-is with Path, ModifiedMs, UpdatedAt added)
	 * @param {Function} fCallback  - Callback(pError)
	 */
	pService.saveExplorerState = function saveExplorerState(pRelPath, pMtimeMs, pStateData, fCallback)
	{
		let tmpKey = pService._buildExplorerStateKey(pRelPath, pMtimeMs);

		// Add standard envelope fields
		pStateData.Path = pRelPath;
		pStateData.ModifiedMs = pMtimeMs;
		pStateData.UpdatedAt = new Date().toISOString();

		pService.fable.Bibliograph.write(pBibliographSource, tmpKey, pStateData,
			(pError) =>
			{
				if (pError)
				{
					pService.fable.log.error(pKeyPrefix + ' state: failed to save for ' + pRelPath + ': ' + pError.message);
				}
				return fCallback(pError);
			});
	};
}

module.exports = { apply: applyExplorerStateMixin };
