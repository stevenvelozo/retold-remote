/**
 * Retold Remote -- EPUB XML Parser
 *
 * Pure parsing functions for EPUB XML formats:
 *   - container.xml  → OPF path
 *   - OPF            → metadata, manifest, spine, cover ID, TOC refs
 *   - nav.xhtml      → EPUB3 table of contents
 *   - toc.ncx        → EPUB2 table of contents
 *   - TOC/spine matching
 *   - Utility helpers (word count, depth calc, element text)
 *
 * All functions are stateless.  Where error logging is needed the
 * caller's logger is passed in as pLog (expected to have a .warn()
 * method; if null, errors are silently swallowed).
 *
 * @license MIT
 */
const { DOMParser } = require('@xmldom/xmldom');

// ──────────────────────────────────────────────
// Container & OPF
// ──────────────────────────────────────────────

/**
 * Parse container.xml to find the rootfile (OPF) path.
 *
 * @param {string} pXmlString - The container.xml content
 * @param {object} [pLog]     - Logger with .warn() (optional)
 * @returns {string|null} Path to the OPF file, or null
 */
function parseContainerXml(pXmlString, pLog)
{
	try
	{
		let tmpDoc = new DOMParser().parseFromString(pXmlString, 'text/xml');
		let tmpRootfiles = tmpDoc.getElementsByTagName('rootfile');
		if (tmpRootfiles.length > 0)
		{
			return tmpRootfiles[0].getAttribute('full-path') || null;
		}
	}
	catch (pError)
	{
		if (pLog)
		{
			pLog.warn('container.xml parse error: ' + pError.message);
		}
	}

	return null;
}

/**
 * Parse an OPF (Open Packaging Format) file to extract metadata,
 * manifest, spine, cover item ID, and TOC reference.
 *
 * @param {string} pXmlString - The OPF file content
 * @param {string} pOpfDir    - Directory of the OPF file (for resolving hrefs)
 * @param {object} [pLog]     - Logger with .warn() (optional)
 * @returns {object|null} { metadata, manifest, spine, coverItemId, navHref, ncxHref }
 */
function parseOpf(pXmlString, pOpfDir, pLog)
{
	try
	{
		let tmpDoc = new DOMParser().parseFromString(pXmlString, 'text/xml');

		// --- Metadata ---
		let tmpMetadata =
		{
			Title: '',
			Creator: '',
			Language: '',
			Publisher: '',
			Description: '',
			Date: '',
			Identifier: '',
			Rights: ''
		};

		let tmpMetaEl = tmpDoc.getElementsByTagName('metadata')[0];
		if (tmpMetaEl)
		{
			tmpMetadata.Title = getElementText(tmpMetaEl, 'dc:title') || getElementText(tmpMetaEl, 'title') || '';
			tmpMetadata.Creator = getElementText(tmpMetaEl, 'dc:creator') || getElementText(tmpMetaEl, 'creator') || '';
			tmpMetadata.Language = getElementText(tmpMetaEl, 'dc:language') || getElementText(tmpMetaEl, 'language') || '';
			tmpMetadata.Publisher = getElementText(tmpMetaEl, 'dc:publisher') || getElementText(tmpMetaEl, 'publisher') || '';
			tmpMetadata.Description = getElementText(tmpMetaEl, 'dc:description') || getElementText(tmpMetaEl, 'description') || '';
			tmpMetadata.Date = getElementText(tmpMetaEl, 'dc:date') || getElementText(tmpMetaEl, 'date') || '';
			tmpMetadata.Identifier = getElementText(tmpMetaEl, 'dc:identifier') || getElementText(tmpMetaEl, 'identifier') || '';
			tmpMetadata.Rights = getElementText(tmpMetaEl, 'dc:rights') || getElementText(tmpMetaEl, 'rights') || '';
		}

		// --- Manifest ---
		let tmpManifest = {};
		let tmpManifestEl = tmpDoc.getElementsByTagName('manifest')[0];
		let tmpNavHref = null;
		let tmpCoverItemId = null;

		if (tmpManifestEl)
		{
			let tmpItems = tmpManifestEl.getElementsByTagName('item');
			for (let i = 0; i < tmpItems.length; i++)
			{
				let tmpItem = tmpItems[i];
				let tmpId = tmpItem.getAttribute('id') || '';
				let tmpHref = tmpItem.getAttribute('href') || '';
				let tmpMediaType = tmpItem.getAttribute('media-type') || '';
				let tmpProperties = tmpItem.getAttribute('properties') || '';

				// Resolve href relative to OPF directory
				let tmpResolvedHref = pOpfDir + tmpHref;

				tmpManifest[tmpId] =
				{
					id: tmpId,
					href: tmpResolvedHref,
					mediaType: tmpMediaType,
					properties: tmpProperties
				};

				// EPUB3: nav document
				if (tmpProperties.indexOf('nav') >= 0)
				{
					tmpNavHref = tmpResolvedHref;
				}

				// EPUB3: cover-image
				if (tmpProperties.indexOf('cover-image') >= 0)
				{
					tmpCoverItemId = tmpId;
				}
			}
		}

		// --- EPUB2 cover detection (meta name="cover") ---
		if (!tmpCoverItemId && tmpMetaEl)
		{
			let tmpMetas = tmpMetaEl.getElementsByTagName('meta');
			for (let i = 0; i < tmpMetas.length; i++)
			{
				if (tmpMetas[i].getAttribute('name') === 'cover')
				{
					let tmpCoverId = tmpMetas[i].getAttribute('content');
					if (tmpCoverId && tmpManifest[tmpCoverId])
					{
						tmpCoverItemId = tmpCoverId;
					}
					break;
				}
			}
		}

		// --- Spine ---
		let tmpSpine = [];
		let tmpNcxHref = null;
		let tmpSpineEl = tmpDoc.getElementsByTagName('spine')[0];

		if (tmpSpineEl)
		{
			// EPUB2: toc attribute references NCX id
			let tmpTocAttr = tmpSpineEl.getAttribute('toc');
			if (tmpTocAttr && tmpManifest[tmpTocAttr])
			{
				tmpNcxHref = tmpManifest[tmpTocAttr].href;
			}

			let tmpItemRefs = tmpSpineEl.getElementsByTagName('itemref');
			for (let i = 0; i < tmpItemRefs.length; i++)
			{
				tmpSpine.push(
				{
					idref: tmpItemRefs[i].getAttribute('idref') || ''
				});
			}
		}

		return {
			metadata: tmpMetadata,
			manifest: tmpManifest,
			spine: tmpSpine,
			coverItemId: tmpCoverItemId,
			navHref: tmpNavHref,
			ncxHref: tmpNcxHref
		};
	}
	catch (pError)
	{
		if (pLog)
		{
			pLog.warn('OPF parse error: ' + pError.message);
		}
		return null;
	}
}

// ──────────────────────────────────────────────
// EPUB3 navigation document (nav.xhtml)
// ──────────────────────────────────────────────

/**
 * Parse an EPUB3 navigation document (nav.xhtml) for the TOC.
 *
 * @param {string} pXmlString - The nav.xhtml content
 * @param {object} [pLog]     - Logger with .warn() (optional)
 * @returns {object} { MaxDepth, Chapters: [...] }
 */
function parseNavXhtml(pXmlString, pLog)
{
	let tmpResult = { MaxDepth: 0, Chapters: [] };

	try
	{
		let tmpDoc = new DOMParser().parseFromString(pXmlString, 'application/xhtml+xml');

		// Find <nav epub:type="toc"> or just the first <nav>
		let tmpNavElements = tmpDoc.getElementsByTagName('nav');
		let tmpTocNav = null;

		for (let i = 0; i < tmpNavElements.length; i++)
		{
			let tmpType = tmpNavElements[i].getAttribute('epub:type') || '';
			if (tmpType === 'toc' || tmpType.indexOf('toc') >= 0)
			{
				tmpTocNav = tmpNavElements[i];
				break;
			}
		}

		// Fallback to first nav
		if (!tmpTocNav && tmpNavElements.length > 0)
		{
			tmpTocNav = tmpNavElements[0];
		}

		if (tmpTocNav)
		{
			// Find the top-level <ol>
			let tmpOlElements = tmpTocNav.getElementsByTagName('ol');
			if (tmpOlElements.length > 0)
			{
				tmpResult.Chapters = _parseNavOl(tmpOlElements[0], 1);
				tmpResult.MaxDepth = calcMaxDepth(tmpResult.Chapters, 1);
			}
		}
	}
	catch (pError)
	{
		if (pLog)
		{
			pLog.warn('nav.xhtml parse error: ' + pError.message);
		}
	}

	return tmpResult;
}

/**
 * Recursively parse an <ol> element from a nav document.
 *
 * @param {Element} pOlElement - The <ol> DOM element
 * @param {number}  pDepth     - Current nesting depth
 * @returns {Array} Array of chapter objects
 */
function _parseNavOl(pOlElement, pDepth)
{
	let tmpChapters = [];
	let tmpChildren = pOlElement.childNodes;

	for (let i = 0; i < tmpChildren.length; i++)
	{
		let tmpChild = tmpChildren[i];
		if (tmpChild.nodeName !== 'li')
		{
			continue;
		}

		let tmpChapter = { Label: '', Href: '', SpineIndex: -1, SubItems: [] };

		// Find <a> element for label and href
		let tmpLinks = tmpChild.getElementsByTagName('a');
		if (tmpLinks.length > 0)
		{
			tmpChapter.Label = (tmpLinks[0].textContent || '').trim();
			tmpChapter.Href = tmpLinks[0].getAttribute('href') || '';
		}
		else
		{
			// Might be a <span> label without a link
			let tmpSpans = tmpChild.getElementsByTagName('span');
			if (tmpSpans.length > 0)
			{
				tmpChapter.Label = (tmpSpans[0].textContent || '').trim();
			}
		}

		// Check for nested <ol>
		let tmpNestedOl = tmpChild.getElementsByTagName('ol');
		if (tmpNestedOl.length > 0)
		{
			tmpChapter.SubItems = _parseNavOl(tmpNestedOl[0], pDepth + 1);
		}

		if (tmpChapter.Label)
		{
			tmpChapters.push(tmpChapter);
		}
	}

	return tmpChapters;
}

// ──────────────────────────────────────────────
// EPUB2 NCX table of contents
// ──────────────────────────────────────────────

/**
 * Parse an EPUB2 NCX table of contents.
 *
 * @param {string} pXmlString - The toc.ncx content
 * @param {string} pOpfDir    - OPF directory for resolving relative hrefs
 * @param {object} [pLog]     - Logger with .warn() (optional)
 * @returns {object} { MaxDepth, Chapters: [...] }
 */
function parseNcx(pXmlString, pOpfDir, pLog)
{
	let tmpResult = { MaxDepth: 0, Chapters: [] };

	try
	{
		let tmpDoc = new DOMParser().parseFromString(pXmlString, 'text/xml');
		let tmpNavMap = tmpDoc.getElementsByTagName('navMap')[0];

		if (tmpNavMap)
		{
			tmpResult.Chapters = _parseNcxNavPoints(tmpNavMap, pOpfDir, 1);
			tmpResult.MaxDepth = calcMaxDepth(tmpResult.Chapters, 1);
		}
	}
	catch (pError)
	{
		if (pLog)
		{
			pLog.warn('toc.ncx parse error: ' + pError.message);
		}
	}

	return tmpResult;
}

/**
 * Recursively parse <navPoint> elements from an NCX navMap.
 *
 * @param {Element} pParentElement - Parent element containing navPoints
 * @param {string}  pOpfDir        - OPF directory for href resolution
 * @param {number}  pDepth         - Current nesting depth
 * @returns {Array} Array of chapter objects
 */
function _parseNcxNavPoints(pParentElement, pOpfDir, pDepth)
{
	let tmpChapters = [];
	let tmpChildren = pParentElement.childNodes;

	for (let i = 0; i < tmpChildren.length; i++)
	{
		let tmpChild = tmpChildren[i];
		if (tmpChild.nodeName !== 'navPoint')
		{
			continue;
		}

		let tmpChapter = { Label: '', Href: '', SpineIndex: -1, SubItems: [] };

		// Get label from <navLabel><text>
		let tmpLabels = tmpChild.getElementsByTagName('navLabel');
		if (tmpLabels.length > 0)
		{
			let tmpTexts = tmpLabels[0].getElementsByTagName('text');
			if (tmpTexts.length > 0)
			{
				tmpChapter.Label = (tmpTexts[0].textContent || '').trim();
			}
		}

		// Get href from <content src="...">
		let tmpContents = tmpChild.getElementsByTagName('content');
		if (tmpContents.length > 0)
		{
			let tmpSrc = tmpContents[0].getAttribute('src') || '';
			tmpChapter.Href = pOpfDir + tmpSrc;
		}

		// Recurse into nested navPoints
		tmpChapter.SubItems = _parseNcxNavPoints(tmpChild, pOpfDir, pDepth + 1);

		if (tmpChapter.Label)
		{
			tmpChapters.push(tmpChapter);
		}
	}

	return tmpChapters;
}

// ──────────────────────────────────────────────
// TOC/Spine matching
// ──────────────────────────────────────────────

/**
 * For each TOC chapter, find the matching spine index by comparing
 * hrefs (stripping fragment identifiers).
 *
 * @param {Array} pChapters   - Array of TOC chapter objects (mutated in place)
 * @param {Array} pSpineItems - Array of spine items with Href field
 */
function matchTocToSpine(pChapters, pSpineItems)
{
	for (let i = 0; i < pChapters.length; i++)
	{
		let tmpChapterHref = (pChapters[i].Href || '').split('#')[0];

		for (let j = 0; j < pSpineItems.length; j++)
		{
			if (pSpineItems[j].Href === tmpChapterHref)
			{
				pChapters[i].SpineIndex = j;
				break;
			}
		}

		// Recurse into sub-items
		if (pChapters[i].SubItems && pChapters[i].SubItems.length > 0)
		{
			matchTocToSpine(pChapters[i].SubItems, pSpineItems);
		}
	}
}

// ──────────────────────────────────────────────
// Utility helpers
// ──────────────────────────────────────────────

/**
 * Get the text content of the first child element with the given tag name.
 *
 * @param {Element} pParent  - Parent element
 * @param {string}  pTagName - Tag name to find
 * @returns {string|null} Text content or null
 */
function getElementText(pParent, pTagName)
{
	let tmpElements = pParent.getElementsByTagName(pTagName);
	if (tmpElements.length > 0 && tmpElements[0].textContent)
	{
		return tmpElements[0].textContent.trim();
	}
	return null;
}

/**
 * Estimate word count from an HTML/XHTML string by stripping tags
 * and counting whitespace-delimited tokens.
 *
 * @param {string} pHtmlString - HTML content
 * @returns {number} Estimated word count
 */
function estimateWordCount(pHtmlString)
{
	if (!pHtmlString)
	{
		return 0;
	}

	// Strip all HTML tags
	let tmpText = pHtmlString.replace(/<[^>]+>/g, ' ');

	// Decode common HTML entities
	tmpText = tmpText.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#?\w+;/g, ' ');

	// Split by whitespace and count non-empty tokens
	let tmpWords = tmpText.split(/\s+/).filter((pWord) => pWord.length > 0);
	return tmpWords.length;
}

/**
 * Calculate the maximum nesting depth of a chapter tree.
 *
 * @param {Array}  pChapters - Array of chapter objects
 * @param {number} pDepth    - Current depth
 * @returns {number} Maximum depth
 */
function calcMaxDepth(pChapters, pDepth)
{
	let tmpMax = pDepth;
	for (let i = 0; i < pChapters.length; i++)
	{
		if (pChapters[i].SubItems && pChapters[i].SubItems.length > 0)
		{
			let tmpChildDepth = calcMaxDepth(pChapters[i].SubItems, pDepth + 1);
			if (tmpChildDepth > tmpMax)
			{
				tmpMax = tmpChildDepth;
			}
		}
	}
	return tmpMax;
}

module.exports =
{
	parseContainerXml: parseContainerXml,
	parseOpf: parseOpf,
	parseNavXhtml: parseNavXhtml,
	parseNcx: parseNcx,
	matchTocToSpine: matchTocToSpine,
	getElementText: getElementText,
	estimateWordCount: estimateWordCount,
	calcMaxDepth: calcMaxDepth
};
