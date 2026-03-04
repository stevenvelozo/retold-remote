const libPictProvider = require('pict-provider');

const _DefaultProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-FormattingUtilities',
	AutoInitialize: true,
	AutoSolveWithApp: false
};

class FormattingUtilitiesProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);
		this.serviceType = 'RetoldRemoteProvider';
	}

	/**
	 * Escape HTML special characters for safe insertion into markup.
	 *
	 * @param {string} pText - Raw text to escape
	 * @returns {string} Escaped text safe for innerHTML
	 */
	escapeHTML(pText)
	{
		if (!pText) return '';
		return pText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}

	/**
	 * Format a byte count into a human-readable size string.
	 *
	 * @param {number} pBytes - Size in bytes
	 * @returns {string} Formatted string like "1.5 MB"
	 */
	formatFileSize(pBytes)
	{
		if (!pBytes || pBytes === 0) return '0 B';
		let tmpUnits = ['B', 'KB', 'MB', 'GB', 'TB'];
		let tmpIndex = Math.floor(Math.log(pBytes) / Math.log(1024));
		if (tmpIndex >= tmpUnits.length) tmpIndex = tmpUnits.length - 1;
		let tmpSize = pBytes / Math.pow(1024, tmpIndex);
		return tmpSize.toFixed(tmpIndex === 0 ? 0 : 1) + ' ' + tmpUnits[tmpIndex];
	}

	/**
	 * Format a date string compactly for display.
	 * Shows "M/D/YY" to keep columns narrow.
	 *
	 * @param {string} pDateString - ISO date string or parseable date
	 * @returns {string} Formatted string like "3/4/26"
	 */
	formatShortDate(pDateString)
	{
		if (!pDateString)
		{
			return '';
		}
		let tmpDate = new Date(pDateString);
		if (isNaN(tmpDate.getTime()))
		{
			return '';
		}
		let tmpMonth = tmpDate.getMonth() + 1;
		let tmpDay = tmpDate.getDate();
		let tmpYear = String(tmpDate.getFullYear()).slice(-2);
		return tmpMonth + '/' + tmpDay + '/' + tmpYear;
	}

	/**
	 * Format a duration in seconds to a timestamp string.
	 *
	 * @param {number} pSeconds - Duration in seconds
	 * @param {boolean} pIncludeMilliseconds - If true, append tenths of a second
	 * @returns {string} Formatted string like "1:23" or "1:02:34.5"
	 */
	formatTimestamp(pSeconds, pIncludeMilliseconds)
	{
		if (pSeconds === null || pSeconds === undefined || isNaN(pSeconds))
		{
			return '--';
		}
		let tmpHours = Math.floor(pSeconds / 3600);
		let tmpMinutes = Math.floor((pSeconds % 3600) / 60);
		let tmpSecs = Math.floor(pSeconds % 60);

		let tmpResult;
		if (tmpHours > 0)
		{
			tmpResult = tmpHours + ':' + String(tmpMinutes).padStart(2, '0') + ':' + String(tmpSecs).padStart(2, '0');
		}
		else
		{
			tmpResult = tmpMinutes + ':' + String(tmpSecs).padStart(2, '0');
		}

		if (pIncludeMilliseconds)
		{
			let tmpMs = Math.floor((pSeconds % 1) * 10);
			tmpResult += '.' + tmpMs;
		}

		return tmpResult;
	}
}

FormattingUtilitiesProvider.default_configuration = _DefaultProviderConfiguration;

module.exports = FormattingUtilitiesProvider;
