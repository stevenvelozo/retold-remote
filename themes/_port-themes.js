/**
 * One-shot porting tool: convert each entry in
 * source/providers/RetoldRemote-ThemeDefinitions.js into an unrolled
 * theme folder under themes/<key>/manifest.json with semantically grouped
 * Tokens and an Aliases block preserving the legacy `--retold-*` names.
 *
 * Run: node themes/_port-themes.js
 *
 * Idempotent — overwrites manifests in place.  Skips already-ported keys
 * if their existing manifest has a non-default Description (so manual
 * edits aren't clobbered).  Twilight is left alone — it was hand-ported
 * first as the smoke-test reference.
 */
const libFS = require('fs');
const libPath = require('path');

const _DEFINITIONS = require('../source/providers/RetoldRemote-ThemeDefinitions.js');
const THEMES_ROOT = __dirname;

const SKIP_KEYS = { 'twilight': true };

// Map from legacy --retold-* variable name to its semantic token path
// under Tokens.*  Same shape every theme uses.
const _ALIAS_MAP =
{
	'--retold-bg-primary':       { Path: 'Color.Background.Primary' },
	'--retold-bg-secondary':     { Path: 'Color.Background.Secondary' },
	'--retold-bg-tertiary':      { Path: 'Color.Background.Tertiary' },
	'--retold-bg-panel':         { Path: 'Color.Background.Panel' },
	'--retold-bg-viewer':        { Path: 'Color.Background.Viewer' },
	'--retold-bg-hover':         { Path: 'Color.Background.Hover' },
	'--retold-bg-selected':      { Path: 'Color.Background.Selected' },
	'--retold-bg-thumb':         { Path: 'Color.Background.Thumb' },
	'--retold-text-primary':     { Path: 'Color.Text.Primary' },
	'--retold-text-secondary':   { Path: 'Color.Text.Secondary' },
	'--retold-text-muted':       { Path: 'Color.Text.Muted' },
	'--retold-text-dim':         { Path: 'Color.Text.Dim' },
	'--retold-text-placeholder': { Path: 'Color.Text.Placeholder' },
	'--retold-accent':           { Path: 'Color.Brand.Accent' },
	'--retold-accent-hover':     { Path: 'Color.Brand.AccentHover' },
	'--retold-border':           { Path: 'Color.Border.Default' },
	'--retold-border-light':     { Path: 'Color.Border.Light' },
	'--retold-danger':           { Path: 'Color.Status.Danger' },
	'--retold-danger-muted':     { Path: 'Color.Status.DangerMuted' },
	'--retold-scrollbar':        { Path: 'Color.Scrollbar.Track' },
	'--retold-scrollbar-hover':  { Path: 'Color.Scrollbar.Hover' },
	'--retold-selection-bg':     { Path: 'Color.Selection.Background' },
	'--retold-focus-outline':    { Path: 'Color.Focus.Outline' },
	'--retold-font-family':      { Path: 'Typography.Family.Sans' },
	'--retold-font-mono':        { Path: 'Typography.Family.Mono' }
};

function setAtPath(pRoot, pPath, pValue)
{
	let tmpSegments = pPath.split('.');
	let tmpNode = pRoot;
	for (let i = 0; i < tmpSegments.length - 1; i++)
	{
		let tmpKey = tmpSegments[i];
		if (!tmpNode[tmpKey] || typeof tmpNode[tmpKey] !== 'object')
		{
			tmpNode[tmpKey] = {};
		}
		tmpNode = tmpNode[tmpKey];
	}
	tmpNode[tmpSegments[tmpSegments.length - 1]] = pValue;
}

function buildManifest(pTheme)
{
	let tmpTokens = {};
	let tmpAliases = {};

	let tmpVars = pTheme.Variables || {};
	let tmpKeys = Object.keys(tmpVars);
	for (let i = 0; i < tmpKeys.length; i++)
	{
		let tmpVarName = tmpKeys[i];
		let tmpValue = tmpVars[tmpVarName];
		let tmpMapping = _ALIAS_MAP[tmpVarName];
		if (!tmpMapping)
		{
			// Unknown legacy variable — keep it under a flat Color.Custom
			// bucket so it still flows out and is aliased back.
			let tmpFlatKey = tmpVarName.replace(/^--retold-/, '').replace(/-/g, '_');
			let tmpPath = 'Color.Custom.' + tmpFlatKey;
			setAtPath(tmpTokens, tmpPath, tmpValue);
			tmpAliases[tmpVarName] = tmpPath;
			continue;
		}
		setAtPath(tmpTokens, tmpMapping.Path, tmpValue);
		tmpAliases[tmpVarName] = tmpMapping.Path;
	}

	let tmpManifest =
	{
		Hash: pTheme.Key,
		Name: pTheme.Name,
		Category: pTheme.Category,
		Version: '0.0.1',
		Description: pTheme.Description + ' Ported from RetoldRemote-ThemeDefinitions.js to the pict-provider-theme manifest format.',
		Comprehensive: true,
		Modes: { Strategy: 'single', Default: pTheme.Category === 'Grey' ? 'dark' : 'light' },
		Tokens: tmpTokens,
		Aliases: tmpAliases,
		IconColors: pTheme.IconColors || {}
	};
	return tmpManifest;
}

let tmpWritten = 0;
let tmpSkipped = 0;
for (let i = 0; i < _DEFINITIONS.length; i++)
{
	let tmpDef = _DEFINITIONS[i];
	if (SKIP_KEYS[tmpDef.Key])
	{
		console.log('[skip] ' + tmpDef.Key + ' (already hand-ported)');
		tmpSkipped++;
		continue;
	}

	let tmpDir = libPath.join(THEMES_ROOT, tmpDef.Key);
	libFS.mkdirSync(tmpDir, { recursive: true });
	let tmpManifest = buildManifest(tmpDef);
	libFS.writeFileSync(
		libPath.join(tmpDir, 'manifest.json'),
		JSON.stringify(tmpManifest, null, '\t') + '\n',
		'utf8');
	console.log('[wrote] themes/' + tmpDef.Key + '/manifest.json');
	tmpWritten++;
}

console.log('\nDone. ' + tmpWritten + ' written, ' + tmpSkipped + ' skipped.');
