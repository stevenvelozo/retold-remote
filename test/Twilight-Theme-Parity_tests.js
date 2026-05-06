/**
 * Twilight Theme Parity Test
 *
 * Once `pict-provider-theme` is added as a retold-remote dependency, this
 * test asserts that the migrated `themes/twilight/` (compiled into
 * `theme/twilight.json`) produces CSS in which every legacy `--retold-*`
 * variable resolves (via Aliases) to the same value as the legacy bespoke
 * RetoldRemote-ThemeDefinitions.js' twilight entry.
 *
 * If this passes, retold-remote can swap the bespoke theme provider for
 * pict-provider-theme without modifying the existing CSS.
 */
const libAssert = require('assert');
const libFS = require('fs');
const libPath = require('path');
const libFable = require('fable');

let libPictProviderTheme = null;
try
{
	libPictProviderTheme = require('pict-provider-theme');
}
catch (pError)
{
	// pict-provider-theme not installed — test will skip itself.
}

const libThemeDefinitions = require('../source/providers/RetoldRemote-ThemeDefinitions.js');
const COMPILED_BUNDLE_PATH = libPath.join(__dirname, '..', 'theme', 'twilight.json');

function buildStubDocument()
{
	let tmpStyleEl = null;
	let tmpClasses = new Set();
	return {
		documentElement:
		{
			classList:
			{
				add: (c) => tmpClasses.add(c),
				remove: (c) => tmpClasses.delete(c),
				contains: (c) => tmpClasses.has(c)
			}
		},
		head: { appendChild: function (pEl) { tmpStyleEl = pEl; } },
		getElementById: function (pId) { return (tmpStyleEl && tmpStyleEl.id === pId) ? tmpStyleEl : null; },
		createElement: function (pTag) { return { tagName: pTag, id: '', textContent: '' }; },
		_getStyle: () => tmpStyleEl
	};
}

function buildVarMap(pCSS)
{
	let tmpMap = {};
	let tmpRe = /^\s*(--[a-z0-9-]+)\s*:\s*([^;]+);/gim;
	let tmpMatch;
	while ((tmpMatch = tmpRe.exec(pCSS)) !== null)
	{
		tmpMap[tmpMatch[1]] = tmpMatch[2].trim();
	}
	return tmpMap;
}

function resolveAlias(pVarMap, pAliasName)
{
	let tmpValue = pVarMap[pAliasName];
	if (typeof tmpValue === 'undefined') return null;
	let tmpVarRefMatch = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(tmpValue);
	if (!tmpVarRefMatch) return tmpValue;
	return pVarMap[tmpVarRefMatch[1]];
}

suite
(
	'Twilight Theme Parity (legacy bespoke -> pict-provider-theme)',
	() =>
	{
		test('parity check: every --retold-* variable resolves to the legacy value', (fDone) =>
		{
			if (!libPictProviderTheme)
			{
				console.log('  skipped: pict-provider-theme not installed in retold-remote');
				return fDone();
			}
			if (!libFS.existsSync(COMPILED_BUNDLE_PATH))
			{
				console.log('  skipped: compiled bundle not present at ' + COMPILED_BUNDLE_PATH);
				return fDone();
			}

			let tmpLegacy = null;
			for (let i = 0; i < libThemeDefinitions.length; i++)
			{
				if (libThemeDefinitions[i].Key === 'twilight')
				{
					tmpLegacy = libThemeDefinitions[i];
					break;
				}
			}
			libAssert.ok(tmpLegacy, 'legacy twilight definition missing');

			let tmpBundle = JSON.parse(libFS.readFileSync(COMPILED_BUNDLE_PATH, 'utf8'));

			let tmpFable = new libFable({
				Product: 'TwilightParity',
				LogStreams: [{ streamtype: 'console', level: 'fatal' }]
			});
			let tmpProvider = new libPictProviderTheme(tmpFable, {}, 'TestTheme');
			tmpProvider.pict = { providers: { Theme: tmpProvider }, AppData: {}, CSSMap: null };
			tmpProvider.log = tmpFable.log;

			let tmpDoc = buildStubDocument();
			global.document = tmpDoc;

			try
			{
				libAssert.strictEqual(tmpProvider.registerTheme(tmpBundle), true);
				libAssert.strictEqual(tmpProvider.applyTheme('twilight'), true);

				let tmpCSS = tmpDoc._getStyle().textContent;
				let tmpVarMap = buildVarMap(tmpCSS);
				let tmpKeys = Object.keys(tmpLegacy.Variables);
				let tmpMissing = [];
				let tmpMismatch = [];
				for (let i = 0; i < tmpKeys.length; i++)
				{
					let tmpName = tmpKeys[i];
					let tmpExpected = tmpLegacy.Variables[tmpName];
					let tmpResolved = resolveAlias(tmpVarMap, tmpName);
					if (tmpResolved === null) tmpMissing.push(tmpName);
					else if (tmpResolved !== tmpExpected)
					{
						tmpMismatch.push(tmpName + ' expected=' + tmpExpected + ' got=' + tmpResolved);
					}
				}
				if (tmpMissing.length > 0 || tmpMismatch.length > 0)
				{
					let tmpMsg = '';
					if (tmpMissing.length > 0) tmpMsg += '\n  MISSING: ' + tmpMissing.join(', ');
					if (tmpMismatch.length > 0) tmpMsg += '\n  MISMATCH:\n    ' + tmpMismatch.join('\n    ');
					throw new Error(tmpMsg);
				}
				console.log('  ' + tmpKeys.length + ' legacy --retold-* variables verified at parity.');
			}
			finally
			{
				delete global.document;
			}
			fDone();
		});
	}
);
