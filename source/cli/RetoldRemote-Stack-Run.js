#!/usr/bin/env node
/**
 * Retold Stack — convenience entry point.
 *
 * Equivalent to running:  retold-remote serve --stack [args...]
 *
 * Spawns Ultravisor as a child process, embeds Orator-Conversion,
 * and starts the Retold Remote media browser pointed at the supplied
 * directory (or the current working directory by default).
 *
 * Data paths default to XDG-style locations:
 *   ~/.local/share/ultravisor/    — Ultravisor datastore + staging
 *   ~/.cache/retold-remote/        — Retold Remote cache
 *   ~/.config/retold-stack/        — Stack config files
 *
 * @license MIT
 */

// Inject 'serve --stack' as the first arguments if the user did not
// already specify a subcommand. This makes `retold-stack /some/path`
// equivalent to `retold-remote serve --stack /some/path`.
let tmpArgs = process.argv.slice(2);

// Detect whether the user already passed a known subcommand
let tmpKnownCommands = { 'serve': true };
let tmpHasSubcommand = tmpArgs.length > 0 && tmpKnownCommands[tmpArgs[0]];

if (!tmpHasSubcommand)
{
	tmpArgs = ['serve', '--stack'].concat(tmpArgs);
}
else if (tmpArgs.indexOf('--stack') === -1)
{
	// User passed `retold-stack serve <path>` — append --stack
	tmpArgs.splice(1, 0, '--stack');
}

process.argv = [process.argv[0], process.argv[1]].concat(tmpArgs);

const libRetoldRemoteProgram = require('./RetoldRemote-CLI-Program.js');
libRetoldRemoteProgram.run();
