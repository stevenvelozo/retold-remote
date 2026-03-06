const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-FileInfoPanel",
	DefaultRenderable: "RetoldRemote-FileInfoPanel",
	DefaultDestinationAddress: "#RetoldRemote-Info-Container",
	AutoRender: false,

	CSS: ``,

	DefaultTemplateRecordAddress: false,

	Templates:
	[
		{
			Hash: "RetoldRemote-FileInfoPanel",
			Template: `<div class="retold-remote-info" id="RetoldRemote-Info-Body"></div>`
		}
	],

	Renderables:
	[
		{
			RenderableHash: "RetoldRemote-FileInfoPanel",
			TemplateHash: "RetoldRemote-FileInfoPanel",
			DestinationAddress: "#RetoldRemote-Info-Container"
		}
	]
};

class RetoldRemoteFileInfoPanel extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._currentPath = null;
		this._currentMetadata = null;
		this._extracting = false;
	}

	onAfterRender()
	{
		this._refreshForCurrentFile();
	}

	/**
	 * Determine the currently selected file path and fetch metadata.
	 */
	_refreshForCurrentFile()
	{
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpPath = '';

		// Try content editor current file first
		if (this.pict.AppData.ContentEditor && this.pict.AppData.ContentEditor.CurrentFile)
		{
			tmpPath = this.pict.AppData.ContentEditor.CurrentFile;
		}

		// Fall back to viewer state
		if (!tmpPath && tmpRemote.CurrentViewerFile)
		{
			tmpPath = tmpRemote.CurrentViewerFile;
		}

		// Fall back to gallery cursor item
		if (!tmpPath)
		{
			let tmpItems = tmpRemote.GalleryItems || [];
			let tmpIndex = tmpRemote.GalleryCursorIndex || 0;
			if (tmpItems.length > 0 && tmpItems[tmpIndex] && tmpItems[tmpIndex].Path)
			{
				tmpPath = tmpItems[tmpIndex].Path;
			}
		}

		if (!tmpPath)
		{
			this._renderEmpty('No file selected');
			return;
		}

		// If same file and we already have metadata, just re-render
		if (tmpPath === this._currentPath && this._currentMetadata)
		{
			this._renderMetadata(this._currentMetadata);
			return;
		}

		this._currentPath = tmpPath;
		this._currentMetadata = null;

		// Check cache first (no extraction)
		this._fetchMetadata(tmpPath, false);
	}

	/**
	 * Fetch extended metadata from the server.
	 *
	 * @param {string} pPath - Relative file path
	 * @param {boolean} pExtract - Whether to trigger extraction
	 */
	_fetchMetadata(pPath, pExtract)
	{
		let tmpSelf = this;
		let tmpURL = '/api/media/extended-metadata?path=' + encodeURIComponent(pPath);
		if (pExtract)
		{
			tmpURL += '&extract=true';
			this._extracting = true;
			this._renderSpinner();
		}

		fetch(tmpURL)
			.then((pResponse) => pResponse.json())
			.then((pData) =>
			{
				tmpSelf._extracting = false;
				if (pData && pData.Success)
				{
					tmpSelf._currentMetadata = pData;
					tmpSelf.pict.AppData.RetoldRemote.CurrentFileMetadata = pData;
					tmpSelf._renderMetadata(pData);
				}
				else if (pData && pData.Cached === false)
				{
					// Not cached — show basic info + extract button
					tmpSelf._renderUncached(pPath);
				}
				else
				{
					tmpSelf._renderEmpty('Could not load metadata');
				}
			})
			.catch((pError) =>
			{
				tmpSelf._extracting = false;
				tmpSelf._renderEmpty('Error: ' + pError.message);
			});
	}

	/**
	 * Called when the user clicks "Extract Metadata".
	 */
	extractMetadata()
	{
		if (this._extracting || !this._currentPath)
		{
			return;
		}
		this._fetchMetadata(this._currentPath, true);
	}

	// ---------------------------------------------------------------
	// Rendering helpers
	// ---------------------------------------------------------------

	_getInfoBody()
	{
		return document.getElementById('RetoldRemote-Info-Body');
	}

	_renderEmpty(pMessage)
	{
		let tmpBody = this._getInfoBody();
		if (!tmpBody)
		{
			return;
		}
		tmpBody.innerHTML = `<div class="retold-remote-info-empty">${this._esc(pMessage)}</div>`;
	}

	_renderSpinner()
	{
		let tmpBody = this._getInfoBody();
		if (!tmpBody)
		{
			return;
		}
		tmpBody.innerHTML = `<div class="retold-remote-info-spinner">Extracting metadata...</div>`;
	}

	/**
	 * Render the "not yet cached" state with basic info + extract button.
	 */
	_renderUncached(pPath)
	{
		let tmpBody = this._getInfoBody();
		if (!tmpBody)
		{
			return;
		}

		let tmpFileName = pPath.split('/').pop() || pPath;
		let tmpDirPath = pPath.substring(0, pPath.length - tmpFileName.length);

		// Try to get basic info from gallery item
		let tmpRemote = this.pict.AppData.RetoldRemote;
		let tmpItems = tmpRemote.GalleryItems || [];
		let tmpItem = null;
		for (let i = 0; i < tmpItems.length; i++)
		{
			if (tmpItems[i].Path === pPath)
			{
				tmpItem = tmpItems[i];
				break;
			}
		}

		let tmpHTML = '';
		tmpHTML += `<div class="retold-remote-info-filename">${this._esc(tmpFileName)}</div>`;
		tmpHTML += `<div class="retold-remote-info-path">${this._esc(tmpDirPath)}</div>`;

		if (tmpItem)
		{
			tmpHTML += `<div class="retold-remote-info-section">`;
			tmpHTML += `<div class="retold-remote-info-section-title">Basic</div>`;
			if (tmpItem.Size)
			{
				tmpHTML += this._row('Size', this._formatSize(tmpItem.Size));
			}
			if (tmpItem.Type)
			{
				tmpHTML += this._row('Type', tmpItem.Type);
			}
			if (tmpItem.Extension)
			{
				tmpHTML += this._row('Extension', tmpItem.Extension);
			}
			tmpHTML += `</div>`;
		}

		tmpHTML += `<button class="retold-remote-info-extract-btn" onclick="pict.views['RetoldRemote-FileInfoPanel'].extractMetadata()">Extract Metadata</button>`;

		tmpBody.innerHTML = tmpHTML;
	}

	/**
	 * Render the full metadata record.
	 */
	_renderMetadata(pMeta)
	{
		let tmpBody = this._getInfoBody();
		if (!tmpBody)
		{
			return;
		}

		let tmpFileName = (pMeta.Path || '').split('/').pop() || pMeta.Path;
		let tmpDirPath = (pMeta.Path || '').substring(0, (pMeta.Path || '').length - tmpFileName.length);

		let tmpHTML = '';

		// Header
		tmpHTML += `<div class="retold-remote-info-filename">${this._esc(tmpFileName)}</div>`;
		tmpHTML += `<div class="retold-remote-info-path">${this._esc(tmpDirPath)}</div>`;

		// Basic section
		tmpHTML += `<div class="retold-remote-info-section">`;
		tmpHTML += `<div class="retold-remote-info-section-title">Basic</div>`;
		tmpHTML += this._row('Size', this._formatSize(pMeta.FileSize));
		tmpHTML += this._row('Category', pMeta.Category || 'unknown');
		if (pMeta.Extension)
		{
			tmpHTML += this._row('Extension', pMeta.Extension);
		}
		if (pMeta.Modified)
		{
			tmpHTML += this._row('Modified', this._formatDate(pMeta.Modified));
		}
		if (pMeta.Created)
		{
			tmpHTML += this._row('Created', this._formatDate(pMeta.Created));
		}
		if (pMeta.MD5)
		{
			tmpHTML += `<div class="retold-remote-info-row">`;
			tmpHTML += `<span class="retold-remote-info-label">MD5</span>`;
			tmpHTML += `<span class="retold-remote-info-value retold-remote-info-value-mono">${this._esc(pMeta.MD5)}</span>`;
			tmpHTML += `</div>`;
		}
		tmpHTML += `</div>`;

		// Format section (video/audio)
		if (pMeta.FormatName || pMeta.Duration)
		{
			tmpHTML += `<div class="retold-remote-info-section">`;
			tmpHTML += `<div class="retold-remote-info-section-title">Format</div>`;
			if (pMeta.FormatName)
			{
				tmpHTML += this._row('Container', pMeta.FormatName);
			}
			if (pMeta.Duration)
			{
				tmpHTML += this._row('Duration', this._formatDuration(pMeta.Duration));
			}
			if (pMeta.Bitrate)
			{
				tmpHTML += this._row('Bitrate', this._formatBitrate(pMeta.Bitrate));
			}
			tmpHTML += `</div>`;
		}

		// Video section
		if (pMeta.Video)
		{
			tmpHTML += `<div class="retold-remote-info-section">`;
			tmpHTML += `<div class="retold-remote-info-section-title">Video</div>`;
			let tmpV = pMeta.Video;
			if (tmpV.Codec)
			{
				let tmpCodecStr = tmpV.Codec;
				if (tmpV.Profile)
				{
					tmpCodecStr += ` (${tmpV.Profile}`;
					if (tmpV.Level)
					{
						tmpCodecStr += ` ${tmpV.Level}`;
					}
					tmpCodecStr += ')';
				}
				tmpHTML += this._row('Codec', tmpCodecStr);
			}
			if (tmpV.Width && tmpV.Height)
			{
				tmpHTML += this._row('Resolution', `${tmpV.Width}\u00D7${tmpV.Height}`);
			}
			if (tmpV.FrameRate)
			{
				tmpHTML += this._row('Frame Rate', this._formatFrameRate(tmpV.FrameRate));
			}
			if (tmpV.PixelFormat)
			{
				tmpHTML += this._row('Pixel Format', tmpV.PixelFormat);
			}
			if (tmpV.ColorSpace)
			{
				tmpHTML += this._row('Color Space', tmpV.ColorSpace);
			}
			if (tmpV.Bitrate)
			{
				tmpHTML += this._row('Bitrate', this._formatBitrate(tmpV.Bitrate));
			}
			tmpHTML += `</div>`;
		}

		// Audio section
		if (pMeta.Audio)
		{
			tmpHTML += `<div class="retold-remote-info-section">`;
			tmpHTML += `<div class="retold-remote-info-section-title">Audio</div>`;
			let tmpA = pMeta.Audio;
			if (tmpA.Codec)
			{
				let tmpCodecStr = tmpA.Codec;
				if (tmpA.Profile)
				{
					tmpCodecStr += ` (${tmpA.Profile})`;
				}
				tmpHTML += this._row('Codec', tmpCodecStr);
			}
			if (tmpA.SampleRate)
			{
				tmpHTML += this._row('Sample Rate', tmpA.SampleRate + ' Hz');
			}
			if (tmpA.Channels)
			{
				let tmpChStr = tmpA.ChannelLayout || (tmpA.Channels + ' ch');
				tmpHTML += this._row('Channels', tmpChStr);
			}
			if (tmpA.Bitrate)
			{
				tmpHTML += this._row('Bitrate', this._formatBitrate(tmpA.Bitrate));
			}
			if (tmpA.BitsPerSample)
			{
				tmpHTML += this._row('Bit Depth', tmpA.BitsPerSample + '-bit');
			}
			tmpHTML += `</div>`;
		}

		// Image section
		if (pMeta.Image)
		{
			let tmpImg = pMeta.Image;
			tmpHTML += `<div class="retold-remote-info-section">`;
			tmpHTML += `<div class="retold-remote-info-section-title">Image</div>`;
			if (tmpImg.Width && tmpImg.Height)
			{
				tmpHTML += this._row('Dimensions', `${tmpImg.Width}\u00D7${tmpImg.Height}`);
			}
			if (tmpImg.Format)
			{
				tmpHTML += this._row('Format', tmpImg.Format);
			}
			if (tmpImg.Space)
			{
				tmpHTML += this._row('Color Space', tmpImg.Space);
			}
			if (tmpImg.DPI)
			{
				tmpHTML += this._row('DPI', tmpImg.DPI);
			}
			if (tmpImg.HasAlpha !== null && tmpImg.HasAlpha !== undefined)
			{
				tmpHTML += this._row('Alpha', tmpImg.HasAlpha ? 'Yes' : 'No');
			}
			tmpHTML += `</div>`;

			// EXIF subsection
			if (tmpImg.EXIF)
			{
				let tmpE = tmpImg.EXIF;
				let tmpHasExif = tmpE.Make || tmpE.Model || tmpE.ExposureTime || tmpE.Software;
				if (tmpHasExif)
				{
					tmpHTML += `<div class="retold-remote-info-section">`;
					tmpHTML += `<div class="retold-remote-info-section-title">EXIF</div>`;
					if (tmpE.Make || tmpE.Model)
					{
						tmpHTML += this._row('Camera', ((tmpE.Make || '') + ' ' + (tmpE.Model || '')).trim());
					}
					if (tmpE.LensModel)
					{
						tmpHTML += this._row('Lens', tmpE.LensModel);
					}
					if (tmpE.ExposureTime || tmpE.FNumber || tmpE.ISO)
					{
						let tmpExpStr = '';
						if (tmpE.ExposureTime)
						{
							tmpExpStr += (tmpE.ExposureTime < 1 ? `1/${Math.round(1 / tmpE.ExposureTime)}s` : tmpE.ExposureTime + 's');
						}
						if (tmpE.FNumber)
						{
							tmpExpStr += (tmpExpStr ? ' ' : '') + `f/${tmpE.FNumber}`;
						}
						if (tmpE.ISO)
						{
							tmpExpStr += (tmpExpStr ? ' ' : '') + `ISO ${tmpE.ISO}`;
						}
						tmpHTML += this._row('Exposure', tmpExpStr);
					}
					if (tmpE.FocalLength)
					{
						tmpHTML += this._row('Focal Length', tmpE.FocalLength + 'mm');
					}
					if (tmpE.DateTimeOriginal)
					{
						tmpHTML += this._row('Date Taken', this._formatDate(tmpE.DateTimeOriginal));
					}
					if (tmpE.Software)
					{
						tmpHTML += this._row('Software', tmpE.Software);
					}
					tmpHTML += `</div>`;
				}
			}

			// GPS subsection
			if (tmpImg.GPS)
			{
				let tmpG = tmpImg.GPS;
				tmpHTML += `<div class="retold-remote-info-section">`;
				tmpHTML += `<div class="retold-remote-info-section-title">GPS</div>`;
				if (tmpG.Latitude !== null && tmpG.Longitude !== null)
				{
					let tmpLat = parseFloat(tmpG.Latitude).toFixed(6);
					let tmpLon = parseFloat(tmpG.Longitude).toFixed(6);
					let tmpLatDir = tmpG.Latitude >= 0 ? 'N' : 'S';
					let tmpLonDir = tmpG.Longitude >= 0 ? 'E' : 'W';
					tmpHTML += this._row('Latitude', `${Math.abs(tmpLat)}\u00B0 ${tmpLatDir}`);
					tmpHTML += this._row('Longitude', `${Math.abs(tmpLon)}\u00B0 ${tmpLonDir}`);

					if (tmpG.Altitude !== null && tmpG.Altitude !== undefined)
					{
						tmpHTML += this._row('Altitude', Math.round(tmpG.Altitude) + 'm');
					}

					let tmpMapsURL = `https://www.google.com/maps?q=${tmpLat},${tmpLon}`;
					tmpHTML += `<div style="margin-top: 4px;">`;
					tmpHTML += `<a class="retold-remote-info-gps-link" href="${tmpMapsURL}" target="_blank" rel="noopener">Open in Maps \u2197</a>`;
					tmpHTML += `</div>`;
				}
				tmpHTML += `</div>`;
			}
		}

		// Document section (PDF)
		if (pMeta.Document)
		{
			let tmpDoc = pMeta.Document;
			tmpHTML += `<div class="retold-remote-info-section">`;
			tmpHTML += `<div class="retold-remote-info-section-title">Document</div>`;
			if (tmpDoc.PageCount)
			{
				tmpHTML += this._row('Pages', tmpDoc.PageCount);
			}
			if (tmpDoc.Title)
			{
				tmpHTML += this._row('Title', tmpDoc.Title);
			}
			if (tmpDoc.Author)
			{
				tmpHTML += this._row('Author', tmpDoc.Author);
			}
			if (tmpDoc.Subject)
			{
				tmpHTML += this._row('Subject', tmpDoc.Subject);
			}
			if (tmpDoc.Keywords)
			{
				tmpHTML += this._row('Keywords', tmpDoc.Keywords);
			}
			if (tmpDoc.Creator)
			{
				tmpHTML += this._row('Creator', tmpDoc.Creator);
			}
			if (tmpDoc.Producer)
			{
				tmpHTML += this._row('Producer', tmpDoc.Producer);
			}
			if (tmpDoc.CreatedDate)
			{
				tmpHTML += this._row('Created', this._formatDate(tmpDoc.CreatedDate));
			}
			if (tmpDoc.ModifiedDate)
			{
				tmpHTML += this._row('Modified', this._formatDate(tmpDoc.ModifiedDate));
			}
			tmpHTML += `</div>`;
		}

		// Tags section
		if (pMeta.Tags && Object.keys(pMeta.Tags).length > 0)
		{
			tmpHTML += `<div class="retold-remote-info-section">`;
			tmpHTML += `<div class="retold-remote-info-section-title">Tags</div>`;
			let tmpTagKeys = Object.keys(pMeta.Tags).sort();
			for (let i = 0; i < tmpTagKeys.length; i++)
			{
				let tmpKey = tmpTagKeys[i];
				let tmpVal = pMeta.Tags[tmpKey];
				tmpHTML += `<div class="retold-remote-info-tag-row">`;
				tmpHTML += `<span class="retold-remote-info-tag-key">${this._esc(tmpKey)}</span>`;
				tmpHTML += `<span class="retold-remote-info-tag-value">${this._esc(String(tmpVal))}</span>`;
				tmpHTML += `</div>`;
			}
			tmpHTML += `</div>`;
		}

		// Chapters section
		if (pMeta.Chapters && pMeta.Chapters.length > 0)
		{
			tmpHTML += `<div class="retold-remote-info-section">`;
			tmpHTML += `<div class="retold-remote-info-section-title">Chapters (${pMeta.Chapters.length})</div>`;
			for (let c = 0; c < pMeta.Chapters.length; c++)
			{
				let tmpCh = pMeta.Chapters[c];
				tmpHTML += `<div class="retold-remote-info-chapter-row">`;
				tmpHTML += `<span class="retold-remote-info-chapter-time">${this._formatDuration(tmpCh.StartTime)}</span>`;
				tmpHTML += `<span class="retold-remote-info-chapter-title">${this._esc(tmpCh.Title)}</span>`;
				tmpHTML += `</div>`;
			}
			tmpHTML += `</div>`;
		}

		// Re-extract button at bottom
		tmpHTML += `<button class="retold-remote-info-extract-btn" onclick="pict.views['RetoldRemote-FileInfoPanel'].extractMetadata()" style="margin-top: 8px;">Re-extract Metadata</button>`;

		tmpBody.innerHTML = tmpHTML;
	}

	// ---------------------------------------------------------------
	// Formatting utilities
	// ---------------------------------------------------------------

	_row(pLabel, pValue)
	{
		return `<div class="retold-remote-info-row"><span class="retold-remote-info-label">${this._esc(String(pLabel))}</span><span class="retold-remote-info-value">${this._esc(String(pValue))}</span></div>`;
	}

	_esc(pStr)
	{
		if (!pStr)
		{
			return '';
		}
		return String(pStr)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

	_formatSize(pBytes)
	{
		if (!pBytes && pBytes !== 0)
		{
			return 'unknown';
		}
		let tmpBytes = parseInt(pBytes, 10);
		if (tmpBytes < 1024)
		{
			return tmpBytes + ' B';
		}
		if (tmpBytes < 1024 * 1024)
		{
			return (tmpBytes / 1024).toFixed(1) + ' KB';
		}
		if (tmpBytes < 1024 * 1024 * 1024)
		{
			return (tmpBytes / (1024 * 1024)).toFixed(1) + ' MB';
		}
		return (tmpBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
	}

	_formatDuration(pSeconds)
	{
		if (!pSeconds && pSeconds !== 0)
		{
			return 'unknown';
		}
		let tmpSec = Math.floor(pSeconds);
		let tmpHours = Math.floor(tmpSec / 3600);
		let tmpMins = Math.floor((tmpSec % 3600) / 60);
		let tmpRem = tmpSec % 60;

		if (tmpHours > 0)
		{
			return `${tmpHours}:${String(tmpMins).padStart(2, '0')}:${String(tmpRem).padStart(2, '0')}`;
		}
		return `${tmpMins}:${String(tmpRem).padStart(2, '0')}`;
	}

	_formatBitrate(pBits)
	{
		if (!pBits)
		{
			return 'unknown';
		}
		let tmpBits = parseInt(pBits, 10);
		if (tmpBits < 1000)
		{
			return tmpBits + ' bps';
		}
		if (tmpBits < 1000000)
		{
			return (tmpBits / 1000).toFixed(0) + ' kbps';
		}
		return (tmpBits / 1000000).toFixed(1) + ' Mbps';
	}

	_formatFrameRate(pRate)
	{
		if (!pRate)
		{
			return 'unknown';
		}
		// ffprobe returns frame rate as "24000/1001" or "30/1"
		if (typeof (pRate) === 'string' && pRate.includes('/'))
		{
			let tmpParts = pRate.split('/');
			let tmpNum = parseFloat(tmpParts[0]);
			let tmpDen = parseFloat(tmpParts[1]);
			if (tmpDen > 0)
			{
				return (tmpNum / tmpDen).toFixed(3).replace(/\.?0+$/, '') + ' fps';
			}
		}
		return pRate + ' fps';
	}

	_formatDate(pDateStr)
	{
		if (!pDateStr)
		{
			return 'unknown';
		}
		try
		{
			let tmpDate = new Date(pDateStr);
			if (isNaN(tmpDate.getTime()))
			{
				return String(pDateStr);
			}
			return tmpDate.toLocaleDateString() + ' ' + tmpDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
		}
		catch (pError)
		{
			return String(pDateStr);
		}
	}
}

module.exports = RetoldRemoteFileInfoPanel;

module.exports.default_configuration = _ViewConfiguration;
