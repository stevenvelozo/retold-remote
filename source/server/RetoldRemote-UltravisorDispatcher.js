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
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libHTTP = require('http');
const libHTTPS = require('https');

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

		// Session cookie for authenticated requests
		this._SessionCookie = null;
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
		this._authenticate((pAuthError) =>
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
	 * Authenticate with the Ultravisor server to obtain a session cookie.
	 *
	 * @param {function} fCallback - function(pError)
	 */
	_authenticate(fCallback)
	{
		let tmpSelf = this;
		let tmpBody = {
			UserName: 'retold-remote-dispatcher',
			Password: ''
		};
		let tmpBodyString = JSON.stringify(tmpBody);
		let tmpParsedURL;

		try
		{
			tmpParsedURL = new URL(this._UltravisorURL);
		}
		catch (pError)
		{
			return fCallback(new Error('Invalid UltravisorURL: ' + this._UltravisorURL));
		}

		let tmpLib = tmpParsedURL.protocol === 'https:' ? libHTTPS : libHTTP;

		let tmpOptions = {
			hostname: tmpParsedURL.hostname,
			port: tmpParsedURL.port || (tmpParsedURL.protocol === 'https:' ? 443 : 80),
			path: '/1.0/Authenticate',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Content-Length': Buffer.byteLength(tmpBodyString)
			}
		};

		let tmpReq = tmpLib.request(tmpOptions, (pResponse) =>
		{
			let tmpData = '';
			pResponse.on('data', (pChunk) => { tmpData += pChunk; });
			pResponse.on('end', () =>
			{
				if (pResponse.statusCode >= 400)
				{
					return fCallback(new Error(`Authentication failed: HTTP ${pResponse.statusCode}`));
				}

				// Extract session cookie from Set-Cookie headers
				let tmpSetCookieHeaders = pResponse.headers['set-cookie'];
				if (tmpSetCookieHeaders && tmpSetCookieHeaders.length > 0)
				{
					let tmpCookieParts = tmpSetCookieHeaders[0].split(';');
					tmpSelf._SessionCookie = tmpCookieParts[0].trim();
					tmpSelf.fable.log.info('Ultravisor Dispatcher: authenticated.');
				}

				return fCallback(null);
			});
			pResponse.on('error', fCallback);
		});

		tmpReq.on('error', fCallback);
		tmpReq.write(tmpBodyString);
		tmpReq.end();
	}

	/**
	 * Refresh cached Ultravisor state (capabilities, beacon count).
	 *
	 * @param {function} [fCallback] - Optional callback
	 */
	_refreshState(fCallback)
	{
		let tmpSelf = this;

		this._httpRequest('GET', '/Beacon/Capabilities', null,
			(pError, pResult) =>
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
					if (fCallback) return fCallback(null);
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

				if (fCallback) return fCallback(null);
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

		let tmpBody = JSON.stringify({
			Parameters: pParameters || {},
			Async: false,
			TimeoutMs: (pParameters && pParameters.TimeoutMs) || 300000
		});

		let tmpParsedURL;
		try
		{
			tmpParsedURL = new URL(this._UltravisorURL);
		}
		catch (pURLError)
		{
			return fCallback(new Error('Invalid UltravisorURL: ' + this._UltravisorURL));
		}

		let tmpLib = tmpParsedURL.protocol === 'https:' ? libHTTPS : libHTTP;

		let tmpHeaders = {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(tmpBody),
			'Connection': 'keep-alive'
		};
		if (this._SessionCookie)
		{
			tmpHeaders['Cookie'] = this._SessionCookie;
		}

		let tmpOptions = {
			hostname: tmpParsedURL.hostname,
			port: tmpParsedURL.port || (tmpParsedURL.protocol === 'https:' ? 443 : 80),
			path: '/Operation/' + encodeURIComponent(pOperationHash) + '/Trigger',
			method: 'POST',
			headers: tmpHeaders
		};

		let tmpCallbackFired = false;
		let tmpComplete = (pError, pResult) =>
		{
			if (tmpCallbackFired) return;
			tmpCallbackFired = true;
			return fCallback(pError, pResult);
		};

		this.fable.log.info(`[TriggerOp] Sending POST ${tmpOptions.path} to ${tmpOptions.hostname}:${tmpOptions.port}`);

		let tmpReq = tmpLib.request(tmpOptions, (pResponse) =>
		{
			let tmpContentType = pResponse.headers['content-type'] || '';

			this.fable.log.info(`[TriggerOp] Response received: HTTP ${pResponse.statusCode} content-type="${tmpContentType}"`);

			if (tmpContentType.indexOf('application/octet-stream') >= 0)
			{
				// Binary response — collect chunks as Buffers
				let tmpChunks = [];
				pResponse.on('data', (pChunk) => { tmpChunks.push(pChunk); });
				pResponse.on('end', () =>
				{
					let tmpBuffer = Buffer.concat(tmpChunks);
					this.fable.log.info(`[TriggerOp] Binary response: ${tmpBuffer.length} bytes, run=${pResponse.headers['x-run-hash']}, status=${pResponse.headers['x-status']}`);
					let tmpResult = {
						Success: true,
						OutputBuffer: tmpBuffer,
						RunHash: pResponse.headers['x-run-hash'] || '',
						Status: pResponse.headers['x-status'] || 'Complete',
						ElapsedMs: parseInt(pResponse.headers['x-elapsed-ms'] || '0', 10)
					};
					return tmpComplete(null, tmpResult);
				});
				pResponse.on('error', tmpComplete);
			}
			else
			{
				// JSON response (error or no binary result)
				let tmpData = '';
				pResponse.on('data', (pChunk) => { tmpData += pChunk; });
				pResponse.on('end', () =>
				{
					this.fable.log.info(`[TriggerOp] JSON response body: ${tmpData.substring(0, 500)}`);
					try
					{
						let tmpParsed = JSON.parse(tmpData);
						if (pResponse.statusCode >= 400)
						{
							this.fable.log.warn(`[TriggerOp] HTTP error ${pResponse.statusCode}: ${tmpParsed.Error || 'unknown'}`);
							return tmpComplete(new Error(tmpParsed.Error || 'HTTP ' + pResponse.statusCode));
						}
						if (!tmpParsed.Success)
						{
							this.fable.log.warn(`[TriggerOp] Operation not successful. Errors: ${JSON.stringify(tmpParsed.Errors || [])}`);
							return tmpComplete(new Error(
								tmpParsed.Errors && tmpParsed.Errors.length > 0
									? tmpParsed.Errors[0]
									: 'Operation trigger failed'));
						}
						this.fable.log.info(`[TriggerOp] JSON success: run=${tmpParsed.RunHash}, status=${tmpParsed.Status}, keys=${Object.keys(tmpParsed).join(',')}`);
						return tmpComplete(null, tmpParsed);
					}
					catch (pParseError)
					{
						this.fable.log.warn(`[TriggerOp] Failed to parse JSON response: ${pParseError.message}`);
						return tmpComplete(new Error('Invalid response from trigger'));
					}
				});
				pResponse.on('error', tmpComplete);
			}
		});

		tmpReq.on('error', (pReqError) =>
		{
			this.fable.log.warn(`[TriggerOp] Request error: ${pReqError.message}`);
			tmpComplete(pReqError);
		});
		tmpReq.setTimeout(0);
		tmpReq.write(tmpBody);
		tmpReq.end();
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
	 * Frame protocol (binary-frames-v1):
	 *   [1 byte type][4 bytes payload length (uint32 big-endian)][payload]
	 *   Type 0x01: Progress      (JSON: { Percent, Message, Step, TotalSteps })
	 *   Type 0x02: Intermediate  (raw binary: e.g. thumbnail preview)
	 *   Type 0x03: Final output  (raw binary: completed file)
	 *   Type 0x04: Result        (JSON: { Success, Outputs, Log })
	 *   Type 0x05: Error         (JSON: { Error })
	 *
	 * @param {object} pWorkItem - Work item details (same as dispatch())
	 * @param {object} pCallbacks - Event callbacks:
	 *   {
	 *     onProgress: function({ Percent, Message, Step, TotalSteps }) — optional
	 *     onBinaryData: function(Buffer) — optional, intermediate binary data
	 *     onError: function({ Error }) — optional, non-fatal error notification
	 *   }
	 * @param {function} fCallback - function(pError, pResult) called on completion.
	 *   pResult includes OutputBuffer (Buffer) if final binary output was streamed.
	 */
	dispatchStream(pWorkItem, pCallbacks, fCallback)
	{
		if (!this._UltravisorURL)
		{
			return fCallback(new Error('Ultravisor Dispatcher: not configured'));
		}

		let tmpParsedURL;
		try
		{
			tmpParsedURL = new URL(this._UltravisorURL);
		}
		catch (pError)
		{
			return fCallback(new Error('Invalid UltravisorURL: ' + this._UltravisorURL));
		}

		let tmpLib = tmpParsedURL.protocol === 'https:' ? libHTTPS : libHTTP;

		let tmpStreamHeaders = {
			'Content-Type': 'application/json',
			'Connection': 'keep-alive'
		};

		// Attach session cookie if available
		if (this._SessionCookie)
		{
			tmpStreamHeaders['Cookie'] = this._SessionCookie;
		}

		let tmpOptions = {
			hostname: tmpParsedURL.hostname,
			port: tmpParsedURL.port || (tmpParsedURL.protocol === 'https:' ? 443 : 80),
			path: '/Beacon/Work/DispatchStream',
			method: 'POST',
			headers: tmpStreamHeaders
		};

		let tmpCallbackFired = false;
		let tmpComplete = (pError, pResult) =>
		{
			if (tmpCallbackFired) { return; }
			tmpCallbackFired = true;
			fCallback(pError, pResult);
		};

		let tmpReq = tmpLib.request(tmpOptions, (pResponse) =>
		{
			// Non-streaming error response (4xx/5xx before stream starts)
			if (pResponse.statusCode >= 400)
			{
				let tmpData = '';
				pResponse.on('data', (pChunk) => { tmpData += pChunk; });
				pResponse.on('end', () =>
				{
					try
					{
						let tmpParsed = JSON.parse(tmpData);
						tmpComplete(new Error(tmpParsed.Error || `HTTP ${pResponse.statusCode}`));
					}
					catch (pParseError)
					{
						tmpComplete(new Error(`HTTP ${pResponse.statusCode}: ${tmpData.substring(0, 200)}`));
					}
				});
				pResponse.on('error', tmpComplete);
				return;
			}

			// Binary frame stream parser
			let tmpBuffer = Buffer.alloc(0);
			let tmpLastResult = null;
			let tmpBinaryChunks = [];

			pResponse.on('data', (pChunk) =>
			{
				tmpBuffer = Buffer.concat([tmpBuffer, pChunk]);

				// Parse complete frames from the buffer
				while (tmpBuffer.length >= 5)
				{
					let tmpPayloadLen = tmpBuffer.readUInt32BE(1);

					if (tmpBuffer.length < 5 + tmpPayloadLen)
					{
						break; // Need more data for this frame
					}

					let tmpType = tmpBuffer.readUInt8(0);
					let tmpPayload = tmpBuffer.slice(5, 5 + tmpPayloadLen);
					tmpBuffer = tmpBuffer.slice(5 + tmpPayloadLen);

					switch (tmpType)
					{
						case 0x01: // Progress
							if (pCallbacks && pCallbacks.onProgress)
							{
								try
								{
									pCallbacks.onProgress(JSON.parse(tmpPayload.toString()));
								}
								catch (pParseError)
								{
									// Ignore malformed progress frames
								}
							}
							break;

						case 0x02: // Intermediate binary data
							if (pCallbacks && pCallbacks.onBinaryData)
							{
								pCallbacks.onBinaryData(Buffer.from(tmpPayload));
							}
							break;

						case 0x03: // Final binary output
							tmpBinaryChunks.push(Buffer.from(tmpPayload));
							break;

						case 0x04: // Result metadata
							try
							{
								tmpLastResult = JSON.parse(tmpPayload.toString());
							}
							catch (pParseError)
							{
								// Ignore malformed result frames
							}
							break;

						case 0x05: // Error
							if (pCallbacks && pCallbacks.onError)
							{
								try
								{
									pCallbacks.onError(JSON.parse(tmpPayload.toString()));
								}
								catch (pParseError)
								{
									// Ignore malformed error frames
								}
							}
							break;
					}
				}
			});

			pResponse.on('end', () =>
			{
				if (tmpLastResult)
				{
					// Attach final binary output as a Buffer
					if (tmpBinaryChunks.length > 0)
					{
						tmpLastResult.OutputBuffer = Buffer.concat(tmpBinaryChunks);
					}
					tmpComplete(null, tmpLastResult);
				}
				else
				{
					tmpComplete(new Error('Stream ended without result frame'));
				}
			});

			pResponse.on('error', tmpComplete);
		});

		tmpReq.on('error', tmpComplete);

		// Disable socket timeout for long-running streaming dispatch
		tmpReq.setTimeout(0);

		tmpReq.write(JSON.stringify(pWorkItem));
		tmpReq.end();
	}

	// ================================================================
	// HTTP Transport
	// ================================================================

	/**
	 * Make an HTTP request to the Ultravisor server.
	 *
	 * @param {string} pMethod - HTTP method
	 * @param {string} pPath - URL path
	 * @param {object|null} pBody - Request body (JSON)
	 * @param {function} fCallback - function(pError, pResult)
	 */
	_httpRequest(pMethod, pPath, pBody, fCallback)
	{
		let tmpParsedURL;
		try
		{
			tmpParsedURL = new URL(this._UltravisorURL);
		}
		catch (pError)
		{
			return fCallback(new Error('Invalid UltravisorURL: ' + this._UltravisorURL));
		}

		let tmpLib = tmpParsedURL.protocol === 'https:' ? libHTTPS : libHTTP;

		let tmpHeaders = {
			'Content-Type': 'application/json',
			'Connection': 'keep-alive'
		};

		// Attach session cookie if available
		if (this._SessionCookie)
		{
			tmpHeaders['Cookie'] = this._SessionCookie;
		}

		let tmpOptions = {
			hostname: tmpParsedURL.hostname,
			port: tmpParsedURL.port || (tmpParsedURL.protocol === 'https:' ? 443 : 80),
			path: pPath,
			method: pMethod,
			headers: tmpHeaders
		};

		let tmpCallbackFired = false;

		let tmpComplete = (pError, pResult) =>
		{
			if (tmpCallbackFired) return;
			tmpCallbackFired = true;
			if (pError) return fCallback(pError);
			return fCallback(null, pResult);
		};

		let tmpReq = tmpLib.request(tmpOptions, (pResponse) =>
		{
			let tmpData = '';
			pResponse.on('data', (pChunk) => { tmpData += pChunk; });
			pResponse.on('end', () =>
			{
				try
				{
					let tmpParsed = JSON.parse(tmpData);
					if (pResponse.statusCode >= 400)
					{
						return tmpComplete(new Error(tmpParsed.Error || `HTTP ${pResponse.statusCode}`));
					}
					return tmpComplete(null, tmpParsed);
				}
				catch (pParseError)
				{
					return tmpComplete(new Error(`Invalid JSON response: ${tmpData.substring(0, 200)}`));
				}
			});
			pResponse.on('error', tmpComplete);
		});

		tmpReq.on('error', (pError) =>
		{
			tmpComplete(pError);
		});

		// Disable socket timeout for long-running dispatch requests
		tmpReq.setTimeout(0);

		if (pBody && (pMethod === 'POST' || pMethod === 'PUT'))
		{
			tmpReq.write(JSON.stringify(pBody));
		}

		tmpReq.end();
	}
}

module.exports = RetoldRemoteUltravisorDispatcher;
