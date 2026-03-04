const libPictProvider = require('pict-provider');

const _DefaultProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-ToastNotification',
	AutoInitialize: true,
	AutoSolveWithApp: false
};

class ToastNotificationProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this.serviceType = 'RetoldRemoteProvider';

		this._overlayTimeout = null;
	}

	/**
	 * Show a brief overlay indicator inside the viewer body.
	 *
	 * Reuses the #RetoldRemote-FitIndicator element, creating it if needed.
	 * Used for fit-mode labels, "Filters cleared", VLC status, etc.
	 *
	 * @param {string} pMessage - Text to display
	 * @param {number} pDuration - Milliseconds before fade-out (default 1500)
	 */
	showOverlayIndicator(pMessage, pDuration)
	{
		let tmpDuration = pDuration || 1500;

		let tmpIndicator = document.getElementById('RetoldRemote-FitIndicator');
		if (!tmpIndicator)
		{
			tmpIndicator = document.createElement('div');
			tmpIndicator.id = 'RetoldRemote-FitIndicator';
			tmpIndicator.className = 'retold-remote-fit-indicator';

			let tmpContainer = document.querySelector('.retold-remote-viewer-body');
			if (tmpContainer)
			{
				tmpContainer.appendChild(tmpIndicator);
			}
		}

		tmpIndicator.textContent = pMessage;
		tmpIndicator.classList.add('visible');

		if (this._overlayTimeout)
		{
			clearTimeout(this._overlayTimeout);
		}

		this._overlayTimeout = setTimeout(function ()
		{
			tmpIndicator.classList.remove('visible');
		}, tmpDuration);
	}

	/**
	 * Show a page-level toast notification appended to document.body.
	 *
	 * Used for clipboard copy confirmations, setup status messages, etc.
	 *
	 * @param {string} pMessage - Text to display
	 * @param {number} pDuration - Milliseconds before removal (default 2000)
	 */
	showToast(pMessage, pDuration)
	{
		let tmpDuration = pDuration || 2000;

		let tmpExisting = document.querySelector('.retold-remote-toast');
		if (tmpExisting)
		{
			tmpExisting.remove();
		}

		let tmpToast = document.createElement('div');
		tmpToast.className = 'retold-remote-toast';
		tmpToast.textContent = pMessage;
		document.body.appendChild(tmpToast);

		setTimeout(function ()
		{
			if (tmpToast.parentNode)
			{
				tmpToast.remove();
			}
		}, tmpDuration);
	}
}

ToastNotificationProvider.default_configuration = _DefaultProviderConfiguration;

module.exports = ToastNotificationProvider;
