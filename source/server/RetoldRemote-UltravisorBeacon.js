/**
 * Retold Remote -- Ultravisor Beacon
 *
 * Fable service that registers retold-remote as a beacon in the
 * Ultravisor mesh.  This makes the running server discoverable by
 * the coordinator and exposes its content directory and cache as
 * addressable contexts via universal data addressing.
 *
 * The beacon registration is separate from (and complementary to) the
 * UltravisorDispatcher:
 *   - Dispatcher: sends work OUT to the mesh (client role)
 *   - BeaconService: registers IN the mesh (server role, contexts)
 *
 * Both share the same UltravisorURL.
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libBeaconService = require('ultravisor-beacon');

class RetoldRemoteUltravisorBeacon extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteUltravisorBeacon';

		// Beacon service reference (created on connectBeacon)
		this._BeaconService = null;
	}

	/**
	 * Connect to an Ultravisor coordinator as a beacon, registering
	 * this retold-remote instance's content and cache contexts.
	 *
	 * @param {object} pBeaconConfig Beacon configuration:
	 *   - ServerURL {string} Ultravisor server URL (required)
	 *   - Name {string} Beacon name (default: 'retold-remote')
	 *   - Password {string} Auth password (default: '')
	 *   - MaxConcurrent {number} Max concurrent work items (default: 1)
	 *   - StagingPath {string} Local staging directory (default: cwd)
	 *   - Tags {object} Beacon tags (default: {})
	 *   - ContentPath {string} Absolute path to content directory
	 *   - ContentBaseURL {string} URL prefix for content access (e.g. 'http://localhost:7500/content/')
	 *   - CacheRoot {string} Absolute path to cache directory
	 * @param {Function} fCallback Called with (pError, pBeaconInfo)
	 */
	connectBeacon(pBeaconConfig, fCallback)
	{
		if (!pBeaconConfig || !pBeaconConfig.ServerURL)
		{
			return fCallback(new Error('connectBeacon requires a ServerURL in the config.'));
		}

		if (this._BeaconService && this._BeaconService.isEnabled())
		{
			this.log.warn('RetoldRemoteUltravisorBeacon: beacon already connected.');
			return fCallback(null);
		}

		// Register the beacon service type with fable if not already present
		this.fable.addServiceTypeIfNotExists('UltravisorBeacon', libBeaconService);

		// Instantiate the beacon service with the provided config
		this._BeaconService = this.fable.instantiateServiceProviderWithoutRegistration('UltravisorBeacon',
			{
				ServerURL: pBeaconConfig.ServerURL,
				Name: pBeaconConfig.Name || 'retold-remote',
				Password: pBeaconConfig.Password || '',
				MaxConcurrent: pBeaconConfig.MaxConcurrent || 1,
				StagingPath: pBeaconConfig.StagingPath || process.cwd(),
				Tags: pBeaconConfig.Tags || {},
				BindAddresses: pBeaconConfig.BindAddresses || []
			});

		// Register the File context (content root — the user's media folder)
		if (pBeaconConfig.ContentPath)
		{
			this._BeaconService.registerContext('File',
				{
					BasePath: pBeaconConfig.ContentPath,
					BaseURL: pBeaconConfig.ContentBaseURL || '/content/',
					Writable: false,
					Description: 'Content root (media library)'
				});
		}

		// Register the Cache context (thumbnails, previews, etc.)
		if (pBeaconConfig.CacheRoot)
		{
			this._BeaconService.registerContext('Cache',
				{
					BasePath: pBeaconConfig.CacheRoot,
					BaseURL: '/cache/',
					Writable: true,
					Description: 'Cache storage (thumbnails, previews)'
				});
		}

		// Register media processing operations so Ultravisor knows
		// what workflows retold-remote dispatches through the mesh.
		let tmpOperations = require('./RetoldRemote-UltravisorOperations.js').getOperations();
		this.log.info(`RetoldRemoteUltravisorBeacon: loading ${tmpOperations.length} operations from RetoldRemote-UltravisorOperations.js`);
		for (let i = 0; i < tmpOperations.length; i++)
		{
			let tmpOp = tmpOperations[i];
			let tmpHasRefs = JSON.stringify(tmpOp).includes('{~D:');
			this.log.info(`  operation [${tmpOp.Hash}] "${tmpOp.Name}" (${tmpHasRefs ? 'has state refs' : 'STATIC'})`);
			this._BeaconService.registerOperation(tmpOp);
		}
		this.log.info(`RetoldRemoteUltravisorBeacon: registered ${tmpOperations.length} operations with BeaconService (_Operations.length=${this._BeaconService._Operations.length}).`);

		// Enable the beacon — authenticate, register, begin polling.
		// retold-remote joins the mesh for context/addressing and
		// publishes its operations for visibility in the flow editor.
		this._BeaconService.enable(
			(pEnableError, pBeaconInfo) =>
			{
				if (pEnableError)
				{
					this.log.error(`RetoldRemoteUltravisorBeacon: beacon enable failed: ${pEnableError.message}`);
					this._BeaconService = null;
					return fCallback(pEnableError);
				}

				this.log.info(`RetoldRemoteUltravisorBeacon: beacon connected as ${pBeaconInfo.BeaconID}`);
				return fCallback(null, pBeaconInfo);
			});
	}

	/**
	 * Disconnect the beacon from the Ultravisor coordinator.
	 *
	 * @param {Function} fCallback Called with (pError)
	 */
	disconnectBeacon(fCallback)
	{
		if (!this._BeaconService || !this._BeaconService.isEnabled())
		{
			if (this.log)
			{
				this.log.info('RetoldRemoteUltravisorBeacon: beacon not connected, nothing to disconnect.');
			}
			return fCallback(null);
		}

		this._BeaconService.disable(
			(pError) =>
			{
				if (pError)
				{
					this.log.warn(`RetoldRemoteUltravisorBeacon: beacon disconnect warning: ${pError.message}`);
				}
				else
				{
					this.log.info('RetoldRemoteUltravisorBeacon: beacon disconnected.');
				}
				this._BeaconService = null;
				return fCallback(pError || null);
			});
	}

	/**
	 * Check if beacon mode is currently enabled.
	 *
	 * @returns {boolean}
	 */
	isEnabled()
	{
		return this._BeaconService && this._BeaconService.isEnabled();
	}
}

module.exports = RetoldRemoteUltravisorBeacon;
