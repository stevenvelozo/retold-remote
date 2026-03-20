/**
 * Retold Remote -- Ultravisor Dispatcher
 *
 * Fable service that dispatches heavy media processing operations to
 * an Ultravisor beacon worker via the /Beacon/Work/Dispatch API.
 *
 * When UltravisorURL is not configured, the dispatcher is disabled and
 * all operations fall back to local processing. This ensures retold-remote
 * works identically with or without an Ultravisor server.
 *
 * File transfer is handled by the beacon executor: the dispatcher
 * provides a SourceURL (pointing to retold-remote's content API) and
 * the beacon downloads the file before processing. Results are returned
 * as base64-encoded data in the response.
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
	 * Check connection to Ultravisor server and log status.
	 * Called once at startup. Non-fatal — if Ultravisor is down,
	 * everything continues with local processing.
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

		this._httpRequest('GET', '/Beacon/Capabilities', null,
			(pError, pResult) =>
			{
				if (pError)
				{
					this.fable.log.warn(`Ultravisor Dispatcher: connection failed — ${pError.message}. Processing will be local.`);
					this._Available = false;
					return fCallback(null);
				}

				this._Capabilities = pResult.Capabilities || [];
				this._BeaconCount = pResult.BeaconCount || 0;
				this._Available = true;

				if (this._BeaconCount === 0)
				{
					this.fable.log.warn('Ultravisor Dispatcher: connected but no beacons registered. Processing will be local until beacons connect.');
				}
				else
				{
					this.fable.log.info(`Ultravisor Dispatcher: connected — ${this._BeaconCount} beacon(s), capabilities: [${this._Capabilities.join(', ')}]`);
				}

				return fCallback(null);
			});
	}

	/**
	 * Dispatch a work item to Ultravisor and wait for completion.
	 *
	 * @param {object} pWorkItem - Work item details
	 * @param {string} pWorkItem.Capability - Required capability (e.g. 'Shell')
	 * @param {string} [pWorkItem.Action] - Action within capability (e.g. 'Execute')
	 * @param {object} pWorkItem.Settings - Work item settings (Command, etc.)
	 * @param {string} [pWorkItem.AffinityKey] - Affinity key for routing
	 * @param {number} [pWorkItem.TimeoutMs] - Timeout in milliseconds
	 * @param {function} fCallback - function(pError, pResult)
	 */
	dispatch(pWorkItem, fCallback)
	{
		if (!this._UltravisorURL)
		{
			return fCallback(new Error('Ultravisor Dispatcher: not configured'));
		}

		this._httpRequest('POST', '/Beacon/Work/Dispatch', pWorkItem,
			(pError, pResult) =>
			{
				if (pError)
				{
					return fCallback(pError);
				}

				if (!pResult.Success)
				{
					return fCallback(new Error(pResult.Error || 'Dispatch failed'));
				}

				return fCallback(null, pResult);
			});
	}

	/**
	 * Dispatch a media processing command to Ultravisor.
	 * Convenience wrapper that builds SourceURL from ContentAPIURL,
	 * sets up file transfer, and handles base64 result decoding.
	 *
	 * @param {object} pOptions - Dispatch options
	 * @param {string} pOptions.Command - Shell command with {SourcePath} and {OutputPath} placeholders
	 * @param {string} [pOptions.InputPath] - Relative path to source file (from ContentPath)
	 * @param {string} [pOptions.InputFilename] - Filename for the downloaded source (defaults to basename of InputPath)
	 * @param {string} [pOptions.OutputFilename] - Name of the output file
	 * @param {string} [pOptions.AffinityKey] - Affinity routing key
	 * @param {number} [pOptions.TimeoutMs] - Timeout in ms (default 300000)
	 * @param {function} fCallback - function(pError, pResult) where pResult has OutputBuffer (Buffer) if output was collected
	 */
	dispatchMediaCommand(pOptions, fCallback)
	{
		let tmpSettings = {
			Command: pOptions.Command || ''
		};

		// Set up source file download
		if (pOptions.InputPath && this._ContentAPIURL)
		{
			let tmpEncodedPath = pOptions.InputPath.split('/').map(encodeURIComponent).join('/');
			tmpSettings.SourceURL = this._ContentAPIURL + '/content/' + tmpEncodedPath;
			tmpSettings.SourceFilename = pOptions.InputFilename ||
				pOptions.InputPath.split('/').pop() || 'source_file';
		}

		// Set up output file collection
		if (pOptions.OutputFilename)
		{
			tmpSettings.OutputFilename = pOptions.OutputFilename;
			tmpSettings.ReturnOutputAsBase64 = true;
		}

		let tmpWorkItem = {
			Capability: 'Shell',
			Action: 'Execute',
			Settings: tmpSettings,
			AffinityKey: pOptions.AffinityKey || '',
			TimeoutMs: pOptions.TimeoutMs || 300000
		};

		this.dispatch(tmpWorkItem,
			(pError, pResult) =>
			{
				if (pError)
				{
					return fCallback(pError);
				}

				// If we have base64 output data, decode it to a Buffer
				if (pResult.Outputs && pResult.Outputs.OutputData)
				{
					try
					{
						pResult.OutputBuffer = Buffer.from(pResult.Outputs.OutputData, 'base64');
					}
					catch (pDecodeError)
					{
						return fCallback(new Error('Failed to decode output data: ' + pDecodeError.message));
					}
				}

				return fCallback(null, pResult);
			});
	}

	/**
	 * Check if a specific capability is available on any connected beacon.
	 *
	 * @param {string} pCapability - The capability name (e.g. 'MediaConversion', 'Shell')
	 * @returns {boolean} True if at least one beacon has this capability
	 */
	hasCapability(pCapability)
	{
		return this._Available && this._Capabilities.indexOf(pCapability) >= 0;
	}

	/**
	 * Dispatch a structured media conversion to Ultravisor using the
	 * MediaConversion capability (orator-conversion beacon provider).
	 *
	 * Falls back to dispatchMediaCommand() (Shell) if MediaConversion
	 * is not available.
	 *
	 * @param {object} pOptions - Conversion options
	 * @param {string} pOptions.Action - Conversion action (e.g. 'ImageResize', 'PdfPageToPng')
	 * @param {string} [pOptions.InputPath] - Relative path to source file (from content root)
	 * @param {string} [pOptions.InputFilename] - Filename for the downloaded source
	 * @param {string} [pOptions.OutputFilename] - Name of the output file
	 * @param {number} [pOptions.Width] - Width for ImageResize
	 * @param {number} [pOptions.Height] - Height for ImageResize
	 * @param {string} [pOptions.Format] - Output format for ImageResize
	 * @param {number} [pOptions.Quality] - Quality for lossy formats
	 * @param {number} [pOptions.Page] - PDF page number (1-based)
	 * @param {number} [pOptions.LongSidePixels] - Max dimension for sized PDF renders
	 * @param {string} [pOptions.AffinityKey] - Affinity routing key
	 * @param {number} [pOptions.TimeoutMs] - Timeout in ms (default 300000)
	 * @param {function} fCallback - function(pError, pResult)
	 */
	dispatchConversion(pOptions, fCallback)
	{
		if (!this.hasCapability('MediaConversion'))
		{
			// Fall back to shell dispatch if caller provides a Command
			if (pOptions.FallbackCommand)
			{
				return this.dispatchMediaCommand({
					Command: pOptions.FallbackCommand,
					InputPath: pOptions.InputPath,
					InputFilename: pOptions.InputFilename,
					OutputFilename: pOptions.OutputFilename,
					AffinityKey: pOptions.AffinityKey,
					TimeoutMs: pOptions.TimeoutMs
				}, fCallback);
			}
			return fCallback(new Error('MediaConversion capability not available and no fallback command provided'));
		}

		let tmpSettings = {
			InputFile: pOptions.InputFilename ||
				(pOptions.InputPath ? pOptions.InputPath.split('/').pop() : 'source_file'),
			OutputFile: pOptions.OutputFilename || 'output'
		};

		// Pass through action-specific settings
		if (pOptions.Width) tmpSettings.Width = pOptions.Width;
		if (pOptions.Height) tmpSettings.Height = pOptions.Height;
		if (pOptions.Format) tmpSettings.Format = pOptions.Format;
		if (pOptions.Quality) tmpSettings.Quality = pOptions.Quality;
		if (pOptions.Page) tmpSettings.Page = pOptions.Page;
		if (pOptions.LongSidePixels) tmpSettings.LongSidePixels = pOptions.LongSidePixels;

		// Set up source file download
		if (pOptions.InputPath && this._ContentAPIURL)
		{
			let tmpEncodedPath = pOptions.InputPath.split('/').map(encodeURIComponent).join('/');
			tmpSettings.SourceURL = this._ContentAPIURL + '/content/' + tmpEncodedPath;
			tmpSettings.SourceFilename = tmpSettings.InputFile;
		}

		// Set up output file collection
		if (pOptions.OutputFilename)
		{
			tmpSettings.ReturnOutputAsBase64 = true;
		}

		let tmpWorkItem = {
			Capability: 'MediaConversion',
			Action: pOptions.Action || 'ImageResize',
			Settings: tmpSettings,
			AffinityKey: pOptions.AffinityKey || '',
			TimeoutMs: pOptions.TimeoutMs || 300000
		};

		this.dispatch(tmpWorkItem,
			(pError, pResult) =>
			{
				if (pError)
				{
					return fCallback(pError);
				}

				// If we have base64 output data, decode it to a Buffer
				if (pResult.Outputs && pResult.Outputs.OutputData)
				{
					try
					{
						pResult.OutputBuffer = Buffer.from(pResult.Outputs.OutputData, 'base64');
					}
					catch (pDecodeError)
					{
						return fCallback(new Error('Failed to decode output data: ' + pDecodeError.message));
					}
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

		let tmpOptions = {
			hostname: tmpParsedURL.hostname,
			port: tmpParsedURL.port || (tmpParsedURL.protocol === 'https:' ? 443 : 80),
			path: '/Beacon/Work/DispatchStream',
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Connection': 'keep-alive'
			}
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

		let tmpOptions = {
			hostname: tmpParsedURL.hostname,
			port: tmpParsedURL.port || (tmpParsedURL.protocol === 'https:' ? 443 : 80),
			path: pPath,
			method: pMethod,
			headers: {
				'Content-Type': 'application/json',
				'Connection': 'keep-alive'
			}
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
