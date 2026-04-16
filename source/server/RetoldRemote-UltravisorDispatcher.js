/**
 * Retold Remote -- Ultravisor Dispatcher
 *
 * Fable service that triggers Ultravisor operations for heavy media
 * processing via the /Operation/{hash}/Trigger API.
 *
 * When UltravisorURL is not configured, the dispatcher is disabled and
 * all operations fall back to local processing. This ensures retold-remote
 * works identically with or without an Ultravisor server.
 *
 * Operations use universal addresses (>BeaconName/Context/Path) for
 * file resolution. Results are returned as binary (OutputBuffer) or
 * JSON (TaskOutputs) depending on the operation type.
 *
 * HTTP transport is delegated to `fable-ultravisor-client`. This service
 * owns retold-remote-specific concerns: UltravisorURL gating, periodic
 * state refresh, capability/beacon-count tracking, and ContentAPIURL.
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libFableUltravisorClient = require('fable-ultravisor-client');

class RetoldRemoteUltravisorDispatcher extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteUltravisorDispatcher';

		// UltravisorURL — if not set, dispatcher is disabled
		this._UltravisorURL = this.fable.settings.UltravisorURL || '';

		// ContentAPIURL — the URL where the beacon can reach retold-remote's
		// content API to download source files
		this._ContentAPIURL = this.fable.settings.ContentAPIURL || '';

		// Connection state
		this._Available = false;
		this._BeaconCount = 0;
		this._Capabilities = [];

		// Credentials for the service account retold-remote authenticates as
		let tmpUserName = this.fable.settings.UltravisorUserName || 'retold-remote-dispatcher';
		let tmpPassword = (typeof(this.fable.settings.UltravisorPassword) === 'string')
			? this.fable.settings.UltravisorPassword
			: '';

		// Underlying HTTP client (owns session cookie, frame parser, etc.)
		this._Client = new libFableUltravisorClient(this.fable,
			{
				UltravisorURL: this._UltravisorURL,
				UserName: tmpUserName,
				Password: tmpPassword
			});
	}

	/**
	 * Check if the dispatcher is available for use.
	 *
	 * @returns {boolean} True if UltravisorURL is configured and beacons are online
	 */
	isAvailable()
	{
		return this._Available && this._BeaconCount > 0;
	}

	/**
	 * Check connection to Ultravisor server, authenticate,
	 * update cached state, and start periodic refresh.
	 * Non-fatal — if Ultravisor is down, everything continues
	 * with local processing.
	 *
	 * @param {function} fCallback - function(pError)
	 */
	checkConnection(fCallback)
	{
		if (!this._UltravisorURL)
		{
			this.fable.log.info('Ultravisor Dispatcher: disabled (no UltravisorURL configured)');
			return fCallback(null);
		}

		this.fable.log.info(`Ultravisor Dispatcher: checking connection to ${this._UltravisorURL}`);

		// Authenticate first, then refresh state
		this._Client.authenticate((pAuthError) =>
		{
			if (pAuthError)
			{
				this.fable.log.warn(`Ultravisor Dispatcher: authentication failed — ${pAuthError.message}`);
			}

			this._refreshState((pError) =>
			{
				// Start periodic refresh (every 15 seconds) so the
				// dispatcher picks up beacons that connect after startup.
				if (!this._refreshInterval)
				{
					this._refreshInterval = setInterval(() =>
					{
						this._refreshState();
					}, 15000);
					// Don't keep the process alive just for this timer
					if (this._refreshInterval.unref)
					{
						this._refreshInterval.unref();
					}
				}

				return fCallback(null);
			});
		});
	}

	/**
	 * Refresh cached Ultravisor state (capabilities, beacon count).
	 *
	 * @param {function} [fCallback] - Optional callback
	 */
	_refreshState(fCallback)
	{
		let tmpSelf = this;

		this._Client.getStatus((pError, pResult) =>
		{
			if (pError)
			{
				if (tmpSelf._Available)
				{
					tmpSelf.fable.log.warn(`Ultravisor Dispatcher: connection lost — ${pError.message}. Processing will be local.`);
				}
				tmpSelf._Available = false;
				tmpSelf._BeaconCount = 0;
				tmpSelf._Capabilities = [];
				if (fCallback) { return fCallback(null); }
				return;
			}

			let tmpPrevBeaconCount = tmpSelf._BeaconCount;
			let tmpPrevAvailable = tmpSelf._Available;

			tmpSelf._Capabilities = pResult.Capabilities || [];
			tmpSelf._BeaconCount = pResult.BeaconCount || 0;
			tmpSelf._Available = true;

			// Log state transitions
			if (!tmpPrevAvailable && tmpSelf._BeaconCount > 0)
			{
				tmpSelf.fable.log.info(`Ultravisor Dispatcher: connected — ${tmpSelf._BeaconCount} beacon(s), capabilities: [${tmpSelf._Capabilities.join(', ')}]`);
			}
			else if (tmpPrevBeaconCount === 0 && tmpSelf._BeaconCount > 0)
			{
				tmpSelf.fable.log.info(`Ultravisor Dispatcher: ${tmpSelf._BeaconCount} beacon(s) now available, capabilities: [${tmpSelf._Capabilities.join(', ')}]`);
			}
			else if (tmpSelf._BeaconCount === 0 && !tmpPrevAvailable)
			{
				tmpSelf.fable.log.warn('Ultravisor Dispatcher: connected but no beacons registered. Processing will be local until beacons connect.');
			}

			if (fCallback) { return fCallback(null); }
		});
	}

	// ================================================================
	// Operation Trigger
	// ================================================================

	/**
	 * Trigger an operation on Ultravisor with parameters.
	 *
	 * Parameters seed the operation's initial state.  The operation
	 * graph resolves universal addresses (>BeaconName/Context/Path)
	 * and dispatches work to the appropriate beacon.
	 *
	 * @param {string} pOperationHash - Operation hash (e.g. 'rr-image-thumbnail')
	 * @param {object} pParameters    - Key-value pairs seeded into OperationState
	 * @param {function} fCallback    - function(pError, pResult) where pResult includes TaskOutputs
	 */
	triggerOperation(pOperationHash, pParameters, fCallback)
	{
		if (!this._UltravisorURL)
		{
			return fCallback(new Error('Ultravisor Dispatcher: not configured'));
		}

		this.fable.log.info(`[TriggerOp] START triggerOperation("${pOperationHash}") params: ${JSON.stringify(pParameters)}`);

		this._Client.triggerOperation(pOperationHash, pParameters, (pError, pResult) =>
		{
			if (pError)
			{
				this.fable.log.warn(`[TriggerOp] error: ${pError.message}`);
				return fCallback(pError);
			}
			if (pResult && pResult.OutputBuffer)
			{
				this.fable.log.info(`[TriggerOp] Binary response: ${pResult.OutputBuffer.length} bytes, run=${pResult.RunHash}, status=${pResult.Status}`);
			}
			else
			{
				this.fable.log.info(`[TriggerOp] JSON success: run=${pResult && pResult.RunHash}, status=${pResult && pResult.Status}`);
			}
			return fCallback(null, pResult);
		});
	}

	// ================================================================
	// Streaming Dispatch (binary-framed)
	// ================================================================

	/**
	 * Dispatch a work item with binary-framed streaming.
	 *
	 * Uses the /Beacon/Work/DispatchStream endpoint which returns a
	 * binary frame stream instead of a single JSON response. This
	 * enables real-time progress updates and efficient binary output
	 * transfer without base64 re-encoding overhead.
	 *
	 * Frame protocol is documented in fable-ultravisor-client.
	 *
	 * @param {object} pWorkItem - Work item details
	 * @param {object} pCallbacks - Event callbacks ({ onProgress, onBinaryData, onError })
	 * @param {function} fCallback - function(pError, pResult)
	 */
	dispatchStream(pWorkItem, pCallbacks, fCallback)
	{
		if (!this._UltravisorURL)
		{
			return fCallback(new Error('Ultravisor Dispatcher: not configured'));
		}

		this._Client.dispatchStream(pWorkItem, pCallbacks, fCallback);
	}
}

module.exports = RetoldRemoteUltravisorDispatcher;
