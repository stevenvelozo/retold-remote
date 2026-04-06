const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-ImageViewer",
	DefaultRenderable: "RetoldRemote-ImageViewer",
	DefaultDestinationAddress: "#RetoldRemote-Viewer-Container",
	AutoRender: false,

	CSS: ``
};

class RetoldRemoteImageViewerView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._zoomLevel = 1;
		this._naturalWidth = 0;
		this._naturalHeight = 0;
		this._resizeHandler = null;
	}

	/**
	 * Called when the image finishes loading.  Captures the natural
	 * dimensions and applies the current fit mode.
	 *
	 * The MediaViewer handles probe-before-load logic (preview URLs
	 * for large images, auto-launch of OpenSeadragon for >8192px).
	 * This method just sets up display and always shows the Explore
	 * button so the user can press `e` on any image.
	 */
	initImage()
	{
		let tmpImg = document.getElementById('RetoldRemote-ImageViewer-Img');
		if (!tmpImg)
		{
			return;
		}

		this._naturalWidth = tmpImg.naturalWidth;
		this._naturalHeight = tmpImg.naturalHeight;
		this._zoomLevel = 1;

		this._applyDisplay();

		// Recalculate on window resize
		if (this._resizeHandler)
		{
			window.removeEventListener('resize', this._resizeHandler);
		}

		let tmpSelf = this;
		let tmpResizeTimer = null;
		this._resizeHandler = function ()
		{
			clearTimeout(tmpResizeTimer);
			tmpResizeTimer = setTimeout(function ()
			{
				tmpSelf._applyDisplay();
			}, 100);
		};
		window.addEventListener('resize', this._resizeHandler);

		// Always show the Explore button so `e` works on any image
		this._showExploreButton();
	}

	/**
	 * Show the explore button in the header nav bar.
	 */
	_showExploreButton()
	{
		let tmpBtn = document.getElementById('RetoldRemote-HeaderExploreBtn');
		if (tmpBtn)
		{
			tmpBtn.style.display = '';
		}
	}

	/**
	 * Get the current fit mode from AppData.
	 *
	 * @returns {string} 'fit' | 'auto' | 'original'
	 */
	_getFitMode()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		return tmpRemote.ImageFitMode || 'fit';
	}

	/**
	 * Set the fit mode and persist it.
	 *
	 * @param {string} pMode - 'fit' | 'auto' | 'original'
	 */
	setFitMode(pMode)
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		tmpRemote.ImageFitMode = pMode;
		this._zoomLevel = 1;
		this._applyDisplay();

		if (this.pict.PictApplication && this.pict.PictApplication.saveSettings)
		{
			this.pict.PictApplication.saveSettings();
		}
	}

	/**
	 * Cycle through fit modes: fit → auto → original → fit
	 */
	cycleFitMode()
	{
		let tmpMode = this._getFitMode();
		let tmpNext;

		switch (tmpMode)
		{
			case 'fit':
				tmpNext = 'auto';
				break;
			case 'auto':
				tmpNext = 'original';
				break;
			default:
				tmpNext = 'fit';
				break;
		}

		this.setFitMode(tmpNext);
		this._showFitModeIndicator(tmpNext);
	}

	/**
	 * Toggle between 1× and 2× zoom.
	 */
	toggleZoom()
	{
		if (!this._naturalWidth)
		{
			return;
		}

		if (this._zoomLevel === 1)
		{
			this._zoomLevel = 2;
		}
		else
		{
			this._zoomLevel = 1;
		}

		this._applyDisplay();
	}

	zoomIn()
	{
		this._zoomLevel = Math.min(this._zoomLevel * 1.25, 8);
		this._applyDisplay();
	}

	zoomOut()
	{
		this._zoomLevel = Math.max(this._zoomLevel / 1.25, 0.25);
		this._applyDisplay();
	}

	zoomReset()
	{
		this._zoomLevel = 1;
		this._applyDisplay();
	}

	/**
	 * Core display method.  Calculates image width/height from the
	 * current fit mode and zoom level, then sets them explicitly so
	 * the container can scroll naturally.
	 */
	_applyDisplay()
	{
		let tmpImg = document.getElementById('RetoldRemote-ImageViewer-Img');
		if (!tmpImg || !this._naturalWidth)
		{
			return;
		}

		let tmpContainer = tmpImg.parentElement;
		if (!tmpContainer)
		{
			return;
		}

		let tmpBase = this._getBaseSize(tmpContainer);
		let tmpDisplayW = Math.round(tmpBase.width * this._zoomLevel);
		let tmpDisplayH = Math.round(tmpBase.height * this._zoomLevel);

		// Clear the initial inline constraints from _buildImageHTML
		tmpImg.style.maxWidth = 'none';
		tmpImg.style.maxHeight = 'none';
		tmpImg.style.objectFit = '';

		tmpImg.style.width = tmpDisplayW + 'px';
		tmpImg.style.height = tmpDisplayH + 'px';
		tmpImg.style.transform = '';

		// Update cursor based on whether zoomed
		if (this._zoomLevel > 1 || (tmpDisplayW > tmpContainer.clientWidth || tmpDisplayH > tmpContainer.clientHeight))
		{
			tmpImg.style.cursor = 'zoom-out';
		}
		else
		{
			tmpImg.style.cursor = 'zoom-in';
		}
	}

	/**
	 * Calculate the base display size (before zoom) for the current
	 * fit mode.
	 *
	 * @param {HTMLElement} pContainer - The viewer body element
	 * @returns {{ width: number, height: number }}
	 */
	_getBaseSize(pContainer)
	{
		let tmpNW = this._naturalWidth;
		let tmpNH = this._naturalHeight;
		let tmpCW = pContainer.clientWidth;
		let tmpCH = pContainer.clientHeight;

		if (!tmpCW || !tmpCH)
		{
			return { width: tmpNW, height: tmpNH };
		}

		let tmpAspect = tmpNW / tmpNH;
		let tmpMode = this._getFitMode();

		switch (tmpMode)
		{
			case 'fit':
			{
				// Always scale to fill viewport (contain)
				let tmpFitW = tmpCW;
				let tmpFitH = tmpCW / tmpAspect;

				if (tmpFitH > tmpCH)
				{
					tmpFitH = tmpCH;
					tmpFitW = tmpCH * tmpAspect;
				}

				return { width: tmpFitW, height: tmpFitH };
			}

			case 'auto':
			{
				// Original size if smaller, fit if larger
				if (tmpNW <= tmpCW && tmpNH <= tmpCH)
				{
					return { width: tmpNW, height: tmpNH };
				}

				// Scale down to fit
				let tmpFitW = tmpCW;
				let tmpFitH = tmpCW / tmpAspect;

				if (tmpFitH > tmpCH)
				{
					tmpFitH = tmpCH;
					tmpFitW = tmpCH * tmpAspect;
				}

				return { width: tmpFitW, height: tmpFitH };
			}

			case 'original':
			default:
			{
				// Always native resolution
				return { width: tmpNW, height: tmpNH };
			}
		}
	}

	/**
	 * Show a brief overlay label indicating the current fit mode.
	 *
	 * @param {string} pMode - The mode identifier
	 */
	_showFitModeIndicator(pMode)
	{
		let tmpLabels =
		{
			'fit': 'Fit to Window',
			'auto': 'Original if Smaller',
			'original': 'Original Size'
		};

		let tmpLabel = tmpLabels[pMode] || pMode;

		this.pict.providers['RetoldRemote-ToastNotification'].showOverlayIndicator(tmpLabel, 1200);
	}

	/**
	 * Clean up resize handler when navigating away.
	 */
	cleanup()
	{
		if (this._resizeHandler)
		{
			window.removeEventListener('resize', this._resizeHandler);
			this._resizeHandler = null;
		}
	}
}

RetoldRemoteImageViewerView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteImageViewerView;
