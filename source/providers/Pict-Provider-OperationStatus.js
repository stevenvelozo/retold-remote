const libPictProvider = require('pict-provider');

/**
 * Pict-Provider-OperationStatus
 *
 * Client-side singleton that:
 *   1. Maintains a sticky-bottom status strip showing active long-running
 *      operations (DZI tile generation, video frame extraction, document
 *      conversion, collection export, etc.)
 *   2. Connects to the retold-remote server's /ws/operations WebSocket
 *      endpoint and routes incoming progress events to the matching entry
 *   3. Provides AbortController-based cancellation on navigate-away
 *   4. Provides an explicit × button for user-initiated cancellation
 *
 * Usage pattern from an explorer or viewer:
 *
 *     let tmpStatus = this.pict.providers['RetoldRemote-OperationStatus'];
 *
 *     // Cancel any previous op for this view
 *     if (this._activeOpId)
 *     {
 *         tmpStatus.cancelOperation(this._activeOpId);
 *     }
 *
 *     // Start a new one
 *     let tmpOp = tmpStatus.startOperation({
 *         Label: 'Generating DZI tiles',
 *         Cancelable: true
 *     });
 *     this._activeOpId = tmpOp.OperationId;
 *     this._activeAbortController = tmpOp.AbortController;
 *
 *     fetch(url, {
 *         signal: tmpOp.AbortController.signal,
 *         headers: { 'X-Op-Id': tmpOp.OperationId }
 *     })
 *         .then(r => r.json())
 *         .then(data => {
 *             tmpStatus.completeOperation(tmpOp.OperationId);
 *             // ...use data
 *         })
 *         .catch(err => {
 *             if (err.name === 'AbortError') return;
 *             tmpStatus.errorOperation(tmpOp.OperationId, err);
 *         });
 *
 *     // On navigate-away:
 *     if (this._activeAbortController)
 *     {
 *         this._activeAbortController.abort();
 *         tmpStatus.cancelOperation(this._activeOpId);
 *     }
 */
const _DefaultProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-OperationStatus',
	AutoInitialize: true,
	AutoSolveWithApp: false
};

// Visible op count cap — extras are summarized as "+N more"
const MAX_VISIBLE_OPS = 3;
// How long to keep a completed entry visible before fading out
const COMPLETE_FADEOUT_MS = 1200;
// Reconnect backoff ladder (ms)
const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 15000, 30000];

class OperationStatusProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this.serviceType = 'RetoldRemoteOperationStatusProvider';

		// Map<opId, {
		//   Id, Label, Phase, Current, Total, Message,
		//   Cancelable, AbortController, Started, Status
		// }>
		// Status: 'active' | 'complete' | 'error' | 'cancelled'
		this._operations = new Map();

		// Monotonic counter so opIds are unique even within one millisecond
		this._opCounter = 0;

		// WebSocket state
		this._ws = null;
		this._wsConnected = false;
		this._wsReconnectAttempt = 0;
		this._wsReconnectTimer = null;
		this._wsShouldRun = false;
	}

	/**
	 * Called by pict-application once the provider is registered.
	 * We defer DOM wiring until the anchor element is present.
	 */
	onPictInitialize()
	{
		// Try to connect the WebSocket as soon as the DOM is ready
		if (typeof document !== 'undefined')
		{
			if (document.readyState === 'loading')
			{
				let tmpSelf = this;
				document.addEventListener('DOMContentLoaded', function ()
				{
					tmpSelf._connectWebSocket();
				}, { once: true });
			}
			else
			{
				this._connectWebSocket();
			}
		}
	}

	// -----------------------------------------------------------------
	//  Public API
	// -----------------------------------------------------------------

	/**
	 * Begin tracking a new operation. Returns the assigned OperationId
	 * and an AbortController the caller can hand to fetch().
	 *
	 * @param {object} pOptions
	 * @param {string}  [pOptions.Label]      - Display label
	 * @param {string}  [pOptions.Phase]      - Initial phase text
	 * @param {boolean} [pOptions.Cancelable] - Show × button (default true)
	 * @returns {{ OperationId: string, AbortController: AbortController }}
	 */
	startOperation(pOptions)
	{
		let tmpOptions = pOptions || {};
		let tmpOpId = this._newOperationId();

		let tmpAbortController = null;
		if (typeof AbortController !== 'undefined')
		{
			try
			{
				tmpAbortController = new AbortController();
			}
			catch (pErr)
			{
				tmpAbortController = null;
			}
		}

		let tmpOp =
		{
			Id: tmpOpId,
			Label: tmpOptions.Label || 'Working…',
			Phase: tmpOptions.Phase || '',
			Current: 0,
			Total: 0,
			Message: tmpOptions.Phase || '',
			Cancelable: (tmpOptions.Cancelable !== false),
			AbortController: tmpAbortController,
			Started: Date.now(),
			Status: 'active'
		};
		this._operations.set(tmpOpId, tmpOp);
		this._render();

		return { OperationId: tmpOpId, AbortController: tmpAbortController };
	}

	/**
	 * Merge a partial update into an existing operation's state.
	 */
	updateOperation(pOperationId, pPartial)
	{
		let tmpOp = this._operations.get(pOperationId);
		if (!tmpOp)
		{
			return;
		}
		if (pPartial && typeof pPartial === 'object')
		{
			for (let tmpKey in pPartial)
			{
				if (pPartial.hasOwnProperty(tmpKey))
				{
					tmpOp[tmpKey] = pPartial[tmpKey];
				}
			}
		}
		this._render();
	}

	/**
	 * Mark an operation as complete. Auto-dismisses after a short delay.
	 */
	completeOperation(pOperationId, pResult)
	{
		let tmpOp = this._operations.get(pOperationId);
		if (!tmpOp)
		{
			return;
		}
		tmpOp.Status = 'complete';
		tmpOp.Message = 'Done';
		this._render();

		let tmpSelf = this;
		setTimeout(function ()
		{
			tmpSelf._operations.delete(pOperationId);
			tmpSelf._render();
		}, COMPLETE_FADEOUT_MS);
	}

	/**
	 * Mark an operation as failed. Stays visible until the user dismisses.
	 */
	errorOperation(pOperationId, pError)
	{
		let tmpOp = this._operations.get(pOperationId);
		if (!tmpOp)
		{
			return;
		}
		tmpOp.Status = 'error';
		tmpOp.Message = pError && pError.message ? pError.message : String(pError || 'Error');
		this._render();
	}

	/**
	 * Cancel an operation: abort the local fetch, send a cancel message
	 * over the WebSocket so the server can stop the corresponding service
	 * work, and remove the entry from the strip.
	 */
	cancelOperation(pOperationId)
	{
		let tmpOp = this._operations.get(pOperationId);
		if (!tmpOp)
		{
			return;
		}

		// Abort the local fetch (silent — caller's .catch filters AbortError)
		if (tmpOp.AbortController && typeof tmpOp.AbortController.abort === 'function')
		{
			try
			{
				tmpOp.AbortController.abort();
			}
			catch (pErr)
			{
				// ignore
			}
		}

		// Tell the server to stop the corresponding work
		this._sendWs({ Type: 'cancel', OperationId: pOperationId });

		tmpOp.Status = 'cancelled';
		tmpOp.Message = 'Cancelled';
		this._render();

		// Remove after a brief visual acknowledgement
		let tmpSelf = this;
		setTimeout(function ()
		{
			tmpSelf._operations.delete(pOperationId);
			tmpSelf._render();
		}, 600);
	}

	/**
	 * Dismiss an entry without cancelling it (used for completed/errored
	 * entries after the user clicks × on the strip).
	 */
	dismissOperation(pOperationId)
	{
		if (this._operations.delete(pOperationId))
		{
			this._render();
		}
	}

	/**
	 * Return true if a given opId is currently active (for use by
	 * WebSocket reconnect logic — only re-subscribe to ops we care about).
	 */
	hasOperation(pOperationId)
	{
		return this._operations.has(pOperationId);
	}

	// -----------------------------------------------------------------
	//  Internals — DOM rendering
	// -----------------------------------------------------------------

	_newOperationId()
	{
		this._opCounter++;
		return 'op-' + Date.now() + '-' + this._opCounter;
	}

	_render()
	{
		if (typeof document === 'undefined')
		{
			return;
		}
		let tmpContainer = document.getElementById('RetoldRemote-OperationStatus-Container');
		if (!tmpContainer)
		{
			// Anchor not present yet (app still booting). Try again next tick.
			return;
		}

		if (this._operations.size === 0)
		{
			tmpContainer.innerHTML = '';
			tmpContainer.classList.remove('has-ops');
			return;
		}

		tmpContainer.classList.add('has-ops');

		// Convert to array, keep insertion order (Map preserves it)
		let tmpAllOps = Array.from(this._operations.values());
		let tmpVisible = tmpAllOps.slice(0, MAX_VISIBLE_OPS);
		let tmpExtraCount = tmpAllOps.length - tmpVisible.length;

		let tmpHTML = '<div class="retold-remote-operation-status-list">';
		for (let i = 0; i < tmpVisible.length; i++)
		{
			tmpHTML += this._renderItem(tmpVisible[i]);
		}
		if (tmpExtraCount > 0)
		{
			tmpHTML += '<div class="retold-remote-operation-status-more">+' + tmpExtraCount + ' more\u2026</div>';
		}
		tmpHTML += '</div>';

		tmpContainer.innerHTML = tmpHTML;
	}

	_renderItem(pOp)
	{
		let tmpStatusClass = '';
		let tmpIconHTML = '';

		if (pOp.Status === 'complete')
		{
			tmpStatusClass = ' is-complete';
			tmpIconHTML = '<span class="retold-remote-operation-status-check">\u2714</span>';
		}
		else if (pOp.Status === 'error')
		{
			tmpStatusClass = ' is-error';
			tmpIconHTML = '<span class="retold-remote-operation-status-error-icon">\u26a0</span>';
		}
		else if (pOp.Status === 'cancelled')
		{
			tmpStatusClass = ' is-cancelled';
			tmpIconHTML = '<span class="retold-remote-operation-status-error-icon">\u00d7</span>';
		}
		else
		{
			tmpIconHTML = '<span class="retold-remote-operation-status-spinner"></span>';
		}

		// Progress bar vs indeterminate
		let tmpBarHTML = '';
		let tmpCountHTML = '';
		if (pOp.Total && pOp.Total > 0)
		{
			let tmpPct = Math.min(100, Math.max(0, Math.round((pOp.Current / pOp.Total) * 100)));
			tmpBarHTML = '<div class="retold-remote-operation-status-bar">'
				+ '<div class="retold-remote-operation-status-bar-fill" style="width:' + tmpPct + '%;"></div>'
				+ '</div>';
			tmpCountHTML = '<span class="retold-remote-operation-status-count">' + pOp.Current + ' / ' + pOp.Total + '</span>';
		}

		let tmpLabel = this._escapeHtml(pOp.Label || '');
		let tmpMessage = this._escapeHtml(pOp.Message || pOp.Phase || '');

		let tmpCancelHTML = '';
		if (pOp.Cancelable && pOp.Status === 'active')
		{
			tmpCancelHTML = '<button class="retold-remote-operation-status-cancel" '
				+ 'onclick="pict.providers[\'RetoldRemote-OperationStatus\'].cancelOperation(\'' + pOp.Id + '\')" '
				+ 'title="Cancel">\u00d7</button>';
		}
		else if (pOp.Status === 'error' || pOp.Status === 'cancelled')
		{
			// Dismiss button for completed errors
			tmpCancelHTML = '<button class="retold-remote-operation-status-cancel" '
				+ 'onclick="pict.providers[\'RetoldRemote-OperationStatus\'].dismissOperation(\'' + pOp.Id + '\')" '
				+ 'title="Dismiss">\u00d7</button>';
		}

		return '<div class="retold-remote-operation-status-item' + tmpStatusClass + '" data-op-id="' + pOp.Id + '">'
			+ tmpIconHTML
			+ '<div class="retold-remote-operation-status-text">'
				+ '<div class="retold-remote-operation-status-label">' + tmpLabel + '</div>'
				+ '<div class="retold-remote-operation-status-phase">' + tmpMessage + '</div>'
				+ tmpBarHTML
			+ '</div>'
			+ tmpCountHTML
			+ tmpCancelHTML
			+ '</div>';
	}

	_escapeHtml(pStr)
	{
		if (pStr === null || pStr === undefined)
		{
			return '';
		}
		return String(pStr)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	// -----------------------------------------------------------------
	//  Internals — WebSocket client with reconnect
	// -----------------------------------------------------------------

	_connectWebSocket()
	{
		if (typeof WebSocket === 'undefined')
		{
			return;
		}

		this._wsShouldRun = true;

		// Build the URL from the current page location so we work on any
		// host / port the user hits (native dev or Docker).
		let tmpProto = (typeof window !== 'undefined' && window.location && window.location.protocol === 'https:')
			? 'wss:'
			: 'ws:';
		let tmpHost = (typeof window !== 'undefined' && window.location && window.location.host)
			? window.location.host
			: 'localhost';
		let tmpUrl = tmpProto + '//' + tmpHost + '/ws/operations';

		try
		{
			this._ws = new WebSocket(tmpUrl);
		}
		catch (pErr)
		{
			this._scheduleReconnect();
			return;
		}

		let tmpSelf = this;
		this._ws.addEventListener('open', function ()
		{
			tmpSelf._wsConnected = true;
			tmpSelf._wsReconnectAttempt = 0;
		});

		this._ws.addEventListener('message', function (pEvent)
		{
			tmpSelf._onWsMessage(pEvent);
		});

		this._ws.addEventListener('close', function ()
		{
			tmpSelf._wsConnected = false;
			tmpSelf._ws = null;
			if (tmpSelf._wsShouldRun)
			{
				tmpSelf._scheduleReconnect();
			}
		});

		this._ws.addEventListener('error', function ()
		{
			// Silent — the 'close' handler will attempt reconnect
		});
	}

	_scheduleReconnect()
	{
		if (!this._wsShouldRun)
		{
			return;
		}
		if (this._wsReconnectTimer)
		{
			return;
		}
		let tmpDelay = RECONNECT_BACKOFF_MS[Math.min(this._wsReconnectAttempt, RECONNECT_BACKOFF_MS.length - 1)];
		this._wsReconnectAttempt++;

		let tmpSelf = this;
		this._wsReconnectTimer = setTimeout(function ()
		{
			tmpSelf._wsReconnectTimer = null;
			tmpSelf._connectWebSocket();
		}, tmpDelay);
	}

	_sendWs(pMessage)
	{
		if (!this._ws || !this._wsConnected)
		{
			return;
		}
		try
		{
			this._ws.send(JSON.stringify(pMessage));
		}
		catch (pErr)
		{
			// ignore
		}
	}

	_onWsMessage(pEvent)
	{
		let tmpData;
		try
		{
			tmpData = JSON.parse(pEvent.data);
		}
		catch (pErr)
		{
			return;
		}

		if (!tmpData || typeof tmpData.Type !== 'string')
		{
			return;
		}

		switch (tmpData.Type)
		{
			case 'hello':
				// Connection handshake — nothing to do
				break;

			case 'progress':
				if (this._operations.has(tmpData.OperationId))
				{
					this.updateOperation(tmpData.OperationId,
					{
						Phase: tmpData.Phase,
						Current: typeof tmpData.Current === 'number' ? tmpData.Current : undefined,
						Total: typeof tmpData.Total === 'number' ? tmpData.Total : undefined,
						Message: tmpData.Message,
						Cancelable: (typeof tmpData.Cancelable === 'boolean') ? tmpData.Cancelable : undefined
					});
				}
				break;

			case 'complete':
				if (this._operations.has(tmpData.OperationId))
				{
					this.completeOperation(tmpData.OperationId);
				}
				break;

			case 'error':
				if (this._operations.has(tmpData.OperationId))
				{
					this.errorOperation(tmpData.OperationId, { message: tmpData.Error });
				}
				break;

			case 'cancelled':
				if (this._operations.has(tmpData.OperationId))
				{
					let tmpOp = this._operations.get(tmpData.OperationId);
					tmpOp.Status = 'cancelled';
					tmpOp.Message = 'Cancelled';
					this._render();
					let tmpSelf = this;
					setTimeout(function ()
					{
						tmpSelf._operations.delete(tmpData.OperationId);
						tmpSelf._render();
					}, 600);
				}
				break;

			case 'pong':
				// Heartbeat response — nothing to do
				break;
		}
	}
}

OperationStatusProvider.default_configuration = _DefaultProviderConfiguration;

module.exports = OperationStatusProvider;
