/**
 * Retold Remote -- Operation Broadcaster
 *
 * A WebSocket-based pub/sub hub that lets long-running server services
 * publish progress events to connected browser clients, and lets clients
 * cancel running operations via cooperative flags.
 *
 * One shared broadcaster per retold-remote process. Services that want
 * to publish progress call setBroadcaster(broadcaster) during server
 * startup (same pattern as setDispatcher / setConversionService).
 *
 * The WebSocket server is attached via attachTo(httpServer) after Orator
 * has started. All upgrades hitting /ws/operations are routed here; other
 * paths are left alone so the rest of the HTTP server is unaffected.
 *
 * Message protocol (JSON, single line per message):
 *
 *   Server -> Client:
 *     { Type: 'hello', ServerTime }
 *     { Type: 'progress', OperationId, Phase?, Current?, Total?, Message?, Cancelable? }
 *     { Type: 'complete', OperationId, ElapsedMs? }
 *     { Type: 'error',    OperationId, Error }
 *     { Type: 'cancelled', OperationId }
 *     { Type: 'pong' }
 *
 *   Client -> Server:
 *     { Type: 'cancel', OperationId }
 *     { Type: 'ping' }
 *
 * Services poll isCancelled(opId) at natural break points (between
 * frames, between tiles, between items) and bail out if it returns
 * true. Cancellation is cooperative — we do not kill running child
 * processes mid-command. When a service detects cancellation, it
 * calls broadcastCancelled(opId) to notify all clients.
 *
 * Cancelled opIds are kept in memory for 5 minutes (CANCELLED_TTL_MS)
 * so late-arriving work can still see them, then garbage-collected.
 *
 * @license MIT
 */
const libFableServiceProviderBase = require('fable-serviceproviderbase');
const libWs = require('ws');

const WS_PATH = '/ws/operations';
const CANCELLED_TTL_MS = 5 * 60 * 1000; // 5 minutes

class RetoldRemoteOperationBroadcaster extends libFableServiceProviderBase
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this.serviceType = 'RetoldRemoteOperationBroadcaster';

		// WebSocketServer in "noServer" mode — we hook HTTP upgrades manually
		this._wss = new libWs.WebSocketServer({ noServer: true });

		// Connected clients
		this._clients = new Set();

		// opId -> cancelledAt timestamp
		this._cancelled = new Map();

		// Upgrade handler stashed so we can detach cleanly (not currently used
		// but kept for safety / tests)
		this._upgradeHandler = null;

		// Periodic cleanup of stale cancelled entries
		this._cleanupInterval = setInterval(
			() => { this._cleanupCancelled(); },
			60 * 1000);
		// Don't hold the process open for just this timer
		if (this._cleanupInterval && typeof this._cleanupInterval.unref === 'function')
		{
			this._cleanupInterval.unref();
		}

		this._wss.on('connection', (pSocket, pRequest) =>
		{
			this._onConnection(pSocket, pRequest);
		});

		this.fable.log.info('Operation Broadcaster initialized (WebSocket path: ' + WS_PATH + ')');
	}

	/**
	 * Attach the WebSocket server to a running Node http.Server instance.
	 * We listen for 'upgrade' events and only accept upgrades for our path.
	 *
	 * @param {http.Server} pHttpServer - The underlying Node HTTP server
	 */
	attachTo(pHttpServer)
	{
		if (!pHttpServer || typeof pHttpServer.on !== 'function')
		{
			this.fable.log.warn('OperationBroadcaster.attachTo: invalid http server, skipping');
			return false;
		}

		let tmpSelf = this;
		this._upgradeHandler = function (pRequest, pSocket, pHead)
		{
			// Parse the path without a full URL parser — we only care about the pathname
			let tmpUrl = pRequest.url || '';
			let tmpPath = tmpUrl.split('?')[0];

			if (tmpPath !== WS_PATH)
			{
				// Not our path — leave the socket alone so other handlers can take it
				return;
			}

			tmpSelf._wss.handleUpgrade(pRequest, pSocket, pHead, (pWs) =>
			{
				tmpSelf._wss.emit('connection', pWs, pRequest);
			});
		};

		pHttpServer.on('upgrade', this._upgradeHandler);
		this.fable.log.info('Operation Broadcaster attached to HTTP server at ' + WS_PATH);
		return true;
	}

	/**
	 * Handle a newly-connected WebSocket client.
	 *
	 * @param {WebSocket} pSocket - The ws WebSocket instance
	 * @param {http.IncomingMessage} pRequest - The original HTTP upgrade request
	 */
	_onConnection(pSocket, pRequest)
	{
		this._clients.add(pSocket);
		this.fable.log.info('[OpBroadcast] client connected (' + this._clients.size + ' total)');

		let tmpSelf = this;

		pSocket.on('message', (pData) =>
		{
			let tmpMessage;
			try
			{
				tmpMessage = JSON.parse(pData.toString());
			}
			catch (pParseError)
			{
				return;
			}

			if (!tmpMessage || typeof tmpMessage.Type !== 'string')
			{
				return;
			}

			if (tmpMessage.Type === 'ping')
			{
				tmpSelf._send(pSocket, { Type: 'pong' });
				return;
			}

			if (tmpMessage.Type === 'cancel' && typeof tmpMessage.OperationId === 'string')
			{
				tmpSelf.fable.log.info('[OpBroadcast] client requested cancel of ' + tmpMessage.OperationId);
				tmpSelf.markCancelled(tmpMessage.OperationId);
				tmpSelf.broadcastCancelled(tmpMessage.OperationId);
				return;
			}

			// Unknown message types are ignored
		});

		pSocket.on('close', () =>
		{
			tmpSelf._clients.delete(pSocket);
			tmpSelf.fable.log.info('[OpBroadcast] client disconnected (' + tmpSelf._clients.size + ' total)');
		});

		pSocket.on('error', (pError) =>
		{
			tmpSelf.fable.log.warn('[OpBroadcast] client socket error: ' + pError.message);
			tmpSelf._clients.delete(pSocket);
		});

		// Send a hello so clients know the connection is live
		this._send(pSocket, { Type: 'hello', ServerTime: new Date().toISOString() });
	}

	/**
	 * Send a message to a single client, ignoring any error.
	 */
	_send(pSocket, pMessage)
	{
		try
		{
			if (pSocket.readyState === libWs.OPEN)
			{
				pSocket.send(JSON.stringify(pMessage));
			}
		}
		catch (pError)
		{
			// Socket likely closed; drop the message
		}
	}

	/**
	 * Broadcast a message to every connected client.
	 */
	_broadcast(pMessage)
	{
		if (this._clients.size === 0)
		{
			return;
		}
		let tmpBody = JSON.stringify(pMessage);
		for (let tmpSocket of this._clients)
		{
			try
			{
				if (tmpSocket.readyState === libWs.OPEN)
				{
					tmpSocket.send(tmpBody);
				}
			}
			catch (pError)
			{
				// Ignore individual socket errors; cleanup happens on 'close'
			}
		}
	}

	/**
	 * Publish a progress update for an operation.
	 *
	 * @param {string} pOperationId - The opId originated by a client
	 * @param {object} pPayload - Any subset of: { Phase, Current, Total, Message, Cancelable }
	 */
	broadcastProgress(pOperationId, pPayload)
	{
		if (!pOperationId)
		{
			return;
		}
		let tmpMessage = Object.assign({}, pPayload || {}, {
			Type: 'progress',
			OperationId: pOperationId
		});
		this._broadcast(tmpMessage);
	}

	/**
	 * Mark an operation as complete. Clients will auto-dismiss its entry.
	 */
	broadcastComplete(pOperationId, pResult)
	{
		if (!pOperationId)
		{
			return;
		}
		let tmpMessage = { Type: 'complete', OperationId: pOperationId };
		if (pResult && typeof pResult.ElapsedMs === 'number')
		{
			tmpMessage.ElapsedMs = pResult.ElapsedMs;
		}
		this._broadcast(tmpMessage);
		// Cancellation flag is no longer relevant once complete
		this._cancelled.delete(pOperationId);
	}

	/**
	 * Mark an operation as failed.
	 */
	broadcastError(pOperationId, pError)
	{
		if (!pOperationId)
		{
			return;
		}
		let tmpErrorText = pError
			? (typeof pError === 'string' ? pError : (pError.message || 'Unknown error'))
			: 'Unknown error';
		this._broadcast({ Type: 'error', OperationId: pOperationId, Error: tmpErrorText });
		this._cancelled.delete(pOperationId);
	}

	/**
	 * Notify clients that an operation was cancelled (and thus is no
	 * longer running on the server).
	 */
	broadcastCancelled(pOperationId)
	{
		if (!pOperationId)
		{
			return;
		}
		this._broadcast({ Type: 'cancelled', OperationId: pOperationId });
	}

	/**
	 * Record that an operation has been cancelled. Services should call
	 * isCancelled() before each unit of work. Entries auto-expire after
	 * CANCELLED_TTL_MS so memory doesn't grow unboundedly.
	 */
	markCancelled(pOperationId)
	{
		if (!pOperationId)
		{
			return;
		}
		this._cancelled.set(pOperationId, Date.now());
	}

	/**
	 * Check whether a given opId has been cancelled.
	 *
	 * @param {string} pOperationId
	 * @returns {boolean}
	 */
	isCancelled(pOperationId)
	{
		if (!pOperationId)
		{
			return false;
		}
		return this._cancelled.has(pOperationId);
	}

	/**
	 * Remove cancelled entries older than CANCELLED_TTL_MS.
	 */
	_cleanupCancelled()
	{
		let tmpNow = Date.now();
		for (let tmpEntry of this._cancelled)
		{
			let tmpOpId = tmpEntry[0];
			let tmpCancelledAt = tmpEntry[1];
			if (tmpNow - tmpCancelledAt > CANCELLED_TTL_MS)
			{
				this._cancelled.delete(tmpOpId);
			}
		}
	}

	/**
	 * Gracefully shut down the broadcaster.
	 * Closes all client sockets and stops the cleanup timer.
	 */
	shutdown()
	{
		if (this._cleanupInterval)
		{
			clearInterval(this._cleanupInterval);
			this._cleanupInterval = null;
		}
		for (let tmpSocket of this._clients)
		{
			try { tmpSocket.close(); } catch (pError) { /* ignore */ }
		}
		this._clients.clear();
	}
}

module.exports = RetoldRemoteOperationBroadcaster;
