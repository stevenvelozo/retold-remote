/**
 * Content roots: multi-root content addressing for the media services.
 *
 * Historically every service resolved a path relative to ONE global ContentPath. This lets a server
 * expose several named roots at once -- for example Sluice pointing retold-remote at a materialized
 * storage tree AND one or more NAS mounts -- so a rendition can be produced from any of them in place.
 *
 * Addressing: a path parameter is either "<root>/<rel>" (its first segment names a known root) or a bare
 * "<rel>" (resolved against the default root). resolve() returns a confined absolute path; toRelative()
 * is the reverse, used for cache keys and dispatch addresses.
 *
 * BACK-COMPAT: constructed from a single ContentPath (no ContentRoots), it registers that path as the
 * default root named "content" and behaves exactly as before -- bare path params resolve against it, and
 * toRelative() returns a BARE rel for paths under it, so existing cache keys are unchanged.
 */

const libPath = require('path');

class RetoldRemoteContentRoots
{
	constructor(pOptions)
	{
		let tmpOptions = pOptions || {};
		this._roots = {};        // name -> resolved absolute directory
		this._defaultRoot = null;

		// A single ContentPath becomes the default root "content" (back-compat).
		if (tmpOptions.ContentPath) { this.addRoot('content', tmpOptions.ContentPath); this._defaultRoot = 'content'; }

		if (tmpOptions.ContentRoots && typeof tmpOptions.ContentRoots === 'object')
		{
			Object.keys(tmpOptions.ContentRoots).forEach((pName) => this.addRoot(pName, tmpOptions.ContentRoots[pName]));
		}

		if (tmpOptions.DefaultRoot && this.hasRoot(tmpOptions.DefaultRoot)) { this._defaultRoot = tmpOptions.DefaultRoot; }
	}

	// Register (or replace) a named root. The first root registered becomes the default if none is set yet.
	addRoot(pName, pAbsoluteDirectory)
	{
		this._roots[String(pName)] = libPath.resolve(String(pAbsoluteDirectory || ''));
		if (!this._defaultRoot) { this._defaultRoot = String(pName); }
		return this;
	}

	hasRoot(pName) { return Object.prototype.hasOwnProperty.call(this._roots, String(pName)); }
	roots() { return Object.assign({}, this._roots); }
	defaultRoot() { return this._defaultRoot; }

	// Resolve a path parameter ("<root>/<rel>" or a bare "<rel>") to a confined absolute path.
	resolve(pPathParameter)
	{
		// Normalize separators but do NOT strip a leading slash: an absolute-looking input must reach
		// _confine and be refused, not be silently reinterpreted as relative-to-root.
		let tmpParam = String((pPathParameter === null || typeof pPathParameter === 'undefined') ? '' : pPathParameter)
			.replace(/\\/g, '/');
		let tmpSegments = tmpParam.split('/');
		let tmpRootDir;
		let tmpRelative;

		if (this.hasRoot(tmpSegments[0]))
		{
			tmpRootDir = this._roots[tmpSegments[0]];
			tmpRelative = tmpSegments.slice(1).join('/');
		}
		else if (this._defaultRoot)
		{
			tmpRootDir = this._roots[this._defaultRoot];
			tmpRelative = tmpParam;
		}
		else
		{
			throw new Error('No content root resolves [' + tmpParam + '] and no default root is configured.');
		}
		return this._confine(tmpRootDir, tmpRelative);
	}

	// Reverse a confined absolute path back to a path parameter. Paths under the DEFAULT root return a bare
	// rel (so existing single-root cache keys are unchanged); paths under a named non-default root return
	// "<root>/<rel>". Returns null if the path is under no configured root.
	toRelative(pAbsolutePath)
	{
		let tmpAbsolute = libPath.resolve(String(pAbsolutePath || ''));
		let tmpBest = null;
		Object.keys(this._roots).forEach((pName) =>
		{
			let tmpRootDir = this._roots[pName];
			let tmpRel = libPath.relative(tmpRootDir, tmpAbsolute);
			let tmpContained = (tmpRel === '') || (tmpRel !== '..' && tmpRel.indexOf('..' + libPath.sep) !== 0 && !libPath.isAbsolute(tmpRel));
			// Prefer the most specific (longest) root when roots nest.
			if (tmpContained && (!tmpBest || tmpRootDir.length > tmpBest.Dir.length))
			{
				tmpBest = { Name: pName, Dir: tmpRootDir, Rel: tmpRel.split(libPath.sep).join('/') };
			}
		});
		if (!tmpBest) { return null; }
		if (tmpBest.Name === this._defaultRoot) { return tmpBest.Rel; }
		return tmpBest.Rel ? (tmpBest.Name + '/' + tmpBest.Rel) : tmpBest.Name;
	}

	// Resolve a relative path under a root directory, refusing absolute inputs and `..` escapes.
	_confine(pRootDirectory, pRelative)
	{
		let tmpRelative = String(pRelative || '').replace(/\\/g, '/');
		if (tmpRelative.charAt(0) === '/' || /^[A-Za-z]:\//.test(tmpRelative) || libPath.isAbsolute(tmpRelative))
		{
			throw new Error('An absolute path is not allowed.');
		}
		let tmpAbsolute = libPath.resolve(pRootDirectory, tmpRelative);
		let tmpCheck = libPath.relative(pRootDirectory, tmpAbsolute);
		if (tmpCheck === '..' || tmpCheck.indexOf('..' + libPath.sep) === 0 || libPath.isAbsolute(tmpCheck))
		{
			throw new Error('That path escapes the content root.');
		}
		return tmpAbsolute;
	}
}

module.exports = RetoldRemoteContentRoots;
