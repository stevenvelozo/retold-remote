/**
 * VideoExplorer — Frame Preview Mixin
 *
 * Full-screen frame preview overlay with keyboard navigation
 * (left/right arrows, j/k, Escape).  Combines regular and custom
 * frames into a single sorted sequence for prev/next traversal.
 *
 * Mixed into RetoldRemoteVideoExplorerView.prototype via Object.assign().
 * All methods access state through `this` (the view instance).
 *
 * @license MIT
 */

module.exports =
{
	/**
	 * Open any frame in the preview overlay.
	 * Unified entry point for both regular and custom frames.
	 *
	 * @param {Object} pFrameInfo - Frame descriptor { Type: 'regular'|'custom', Index, Filename, TimestampFormatted, CacheKey }
	 */
	openFrame: function openFrame(pFrameInfo)
	{
		if (!this._frameData || !pFrameInfo)
		{
			return;
		}

		let tmpCacheKey = pFrameInfo.CacheKey || this._frameData.CacheKey;
		let tmpURL = this._buildFrameURL(tmpCacheKey, pFrameInfo.Filename);
		let tmpLabel = pFrameInfo.TimestampFormatted + '  \u00b7  '
			+ (pFrameInfo.Type === 'regular' ? '#' + ((pFrameInfo.Index || 0) + 1) : 'custom');

		this._showFramePreview(tmpURL, tmpLabel, pFrameInfo.Type, pFrameInfo.Index);
	},

	/**
	 * Open a regular frame at full size (convenience wrapper for grid onclick).
	 *
	 * @param {number} pIndex - Frame index in the regular Frames array
	 */
	openFrameFullsize: function openFrameFullsize(pIndex)
	{
		if (!this._frameData || !this._frameData.Frames[pIndex])
		{
			return;
		}

		let tmpFrame = this._frameData.Frames[pIndex];
		this.openFrame(
		{
			Type: 'regular',
			Index: pIndex,
			Filename: tmpFrame.Filename,
			TimestampFormatted: tmpFrame.TimestampFormatted,
			CacheKey: this._frameData.CacheKey
		});
	},

	/**
	 * Open a custom frame in the preview overlay (convenience wrapper).
	 *
	 * @param {string} pFilename - Custom frame filename
	 * @param {string} pTimestamp - Formatted timestamp label
	 */
	openCustomFrameFullsize: function openCustomFrameFullsize(pFilename, pTimestamp)
	{
		if (!this._frameData)
		{
			return;
		}

		// Find the custom frame by filename
		let tmpCustomIndex = -1;
		let tmpCacheKey = this._frameData.CacheKey;
		for (let i = 0; i < this._customFrames.length; i++)
		{
			if (this._customFrames[i].Filename === pFilename)
			{
				tmpCustomIndex = i;
				if (this._customFrames[i].CacheKey)
				{
					tmpCacheKey = this._customFrames[i].CacheKey;
				}
				break;
			}
		}

		this.openFrame(
		{
			Type: 'custom',
			Index: tmpCustomIndex,
			Filename: pFilename,
			TimestampFormatted: pTimestamp,
			CacheKey: tmpCacheKey
		});
	},

	/**
	 * Build a sorted list of all frames (regular + custom) for navigation.
	 */
	_buildAllFramesList: function _buildAllFramesList()
	{
		let tmpAllFrames = [];

		// Add regular frames
		if (this._frameData && this._frameData.Frames)
		{
			for (let i = 0; i < this._frameData.Frames.length; i++)
			{
				let tmpFrame = this._frameData.Frames[i];
				tmpAllFrames.push({
					Type: 'regular',
					Index: i,
					Timestamp: tmpFrame.Timestamp,
					TimestampFormatted: tmpFrame.TimestampFormatted,
					Filename: tmpFrame.Filename,
					Label: tmpFrame.TimestampFormatted + '  \u00b7  #' + (tmpFrame.Index + 1)
				});
			}
		}

		// Add custom frames
		if (this._customFrames)
		{
			for (let i = 0; i < this._customFrames.length; i++)
			{
				let tmpCustom = this._customFrames[i];
				tmpAllFrames.push({
					Type: 'custom',
					Index: i,
					Timestamp: tmpCustom.Timestamp,
					TimestampFormatted: tmpCustom.TimestampFormatted,
					Filename: tmpCustom.Filename,
					CacheKey: tmpCustom.CacheKey || null,
					Label: tmpCustom.TimestampFormatted + '  \u00b7  custom'
				});
			}
		}

		// Sort by timestamp
		tmpAllFrames.sort((a, b) => a.Timestamp - b.Timestamp);

		return tmpAllFrames;
	},

	/**
	 * Show the frame preview overlay.
	 *
	 * @param {string} pURL - Frame image URL
	 * @param {string} pLabel - Frame label to display
	 * @param {string} pType - 'regular' or 'custom'
	 * @param {number} pIndex - Index within its type array
	 */
	_showFramePreview: function _showFramePreview(pURL, pLabel, pType, pIndex)
	{
		// Store current preview state for navigation
		this._previewType = pType;
		this._previewIndex = pIndex;

		// Build all frames for prev/next navigation
		let tmpAllFrames = this._buildAllFramesList();
		this._previewAllFrames = tmpAllFrames;

		// Find current position in the unified list
		this._previewPosition = 0;
		for (let i = 0; i < tmpAllFrames.length; i++)
		{
			if (tmpAllFrames[i].Type === pType && tmpAllFrames[i].Index === pIndex)
			{
				this._previewPosition = i;
				break;
			}
		}

		// Build the overlay
		let tmpSelf = this;
		let tmpBackdrop = document.createElement('div');
		tmpBackdrop.className = 'retold-remote-vex-preview-backdrop';
		tmpBackdrop.id = 'RetoldRemote-VEX-Preview';
		tmpBackdrop.onclick = (e) =>
		{
			if (e.target === tmpBackdrop)
			{
				tmpSelf.closeFramePreview();
			}
		};

		let tmpHTML = '';
		tmpHTML += '<div class="retold-remote-vex-preview-header">';
		tmpHTML += '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].closeFramePreview()" title="Back (Esc)">&larr; Back</button>';
		tmpHTML += '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].previewPrevFrame()" title="Previous (\u2190)">&lsaquo; Prev</button>';
		tmpHTML += '<div class="retold-remote-vex-preview-title" id="RetoldRemote-VEX-PreviewTitle">' + this._getFmt().escapeHTML(pLabel) + '</div>';
		tmpHTML += '<button class="retold-remote-vex-nav-btn" onclick="pict.views[\'RetoldRemote-VideoExplorer\'].previewNextFrame()" title="Next (\u2192)">Next &rsaquo;</button>';
		tmpHTML += '</div>';
		tmpHTML += '<div class="retold-remote-vex-preview-body" id="RetoldRemote-VEX-PreviewBody">';
		tmpHTML += '<img src="' + pURL + '" alt="' + this._getFmt().escapeHTML(pLabel) + '">';
		tmpHTML += '</div>';

		tmpBackdrop.innerHTML = tmpHTML;
		document.body.appendChild(tmpBackdrop);

		// Bind keyboard handler (stopImmediatePropagation prevents the global handler from also firing)
		this._previewKeyHandler = (e) =>
		{
			switch (e.key)
			{
				case 'Escape':
					e.preventDefault();
					e.stopImmediatePropagation();
					tmpSelf.closeFramePreview();
					break;
				case 'ArrowLeft':
				case 'k':
					e.preventDefault();
					e.stopImmediatePropagation();
					tmpSelf.previewPrevFrame();
					break;
				case 'ArrowRight':
				case 'j':
					e.preventDefault();
					e.stopImmediatePropagation();
					tmpSelf.previewNextFrame();
					break;
			}
		};
		document.addEventListener('keydown', this._previewKeyHandler);
	},

	/**
	 * Close the frame preview overlay.
	 */
	closeFramePreview: function closeFramePreview()
	{
		let tmpBackdrop = document.getElementById('RetoldRemote-VEX-Preview');
		if (tmpBackdrop)
		{
			tmpBackdrop.remove();
		}

		if (this._previewKeyHandler)
		{
			document.removeEventListener('keydown', this._previewKeyHandler);
			this._previewKeyHandler = null;
		}
	},

	/**
	 * Navigate to the previous frame in the preview.
	 */
	previewPrevFrame: function previewPrevFrame()
	{
		if (!this._previewAllFrames || this._previewPosition <= 0)
		{
			return;
		}

		this._previewPosition--;
		this._updatePreviewFrame();
	},

	/**
	 * Navigate to the next frame in the preview.
	 */
	previewNextFrame: function previewNextFrame()
	{
		if (!this._previewAllFrames || this._previewPosition >= this._previewAllFrames.length - 1)
		{
			return;
		}

		this._previewPosition++;
		this._updatePreviewFrame();
	},

	/**
	 * Update the preview to show the frame at the current position.
	 */
	_updatePreviewFrame: function _updatePreviewFrame()
	{
		let tmpFrame = this._previewAllFrames[this._previewPosition];
		if (!tmpFrame || !this._frameData)
		{
			return;
		}

		// For custom frames, use the frame's own CacheKey (may differ from current batch)
		let tmpCacheKey = this._frameData.CacheKey;
		if (tmpFrame.Type === 'custom' && tmpFrame.CacheKey)
		{
			tmpCacheKey = tmpFrame.CacheKey;
		}
		let tmpURL = this._buildFrameURL(tmpCacheKey, tmpFrame.Filename);

		let tmpBody = document.getElementById('RetoldRemote-VEX-PreviewBody');
		if (tmpBody)
		{
			tmpBody.innerHTML = '<img src="' + tmpURL + '" alt="' + this._getFmt().escapeHTML(tmpFrame.Label) + '">';
		}

		let tmpTitle = document.getElementById('RetoldRemote-VEX-PreviewTitle');
		if (tmpTitle)
		{
			tmpTitle.textContent = tmpFrame.Label;
		}

		// Also select the corresponding frame in the grid behind the overlay
		this._previewType = tmpFrame.Type;
		this._previewIndex = tmpFrame.Index;

		if (tmpFrame.Type === 'regular')
		{
			this.selectFrame(tmpFrame.Index);
		}
	}
};
