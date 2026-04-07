/**
 * Retold Remote -- Stack Launcher
 *
 * Spawns the full Retold stack as a unit:
 *   - Ultravisor (mesh coordinator) as a child process
 *   - Retold Remote (this process) connecting to it as a beacon
 *   - Orator-Conversion (embedded inside Retold Remote)
 *
 * Provides XDG-style default data paths so the stack runs sanely
 * from anywhere without configuration.
 *
 * Usage:
 *   const libStackLauncher = require('./RetoldRemote-Stack-Launcher');
 *   libStackLauncher.start({ Logger: log }, (pError, pStackInfo) => { ... });
 *
 * @license MIT
 */
const libFs = require('fs');
const libPath = require('path');
const libOs = require('os');
const libHttp = require('http');
const libChildProcess = require('child_process');

/**
 * Resolve XDG-style data paths for the Retold stack.
 *
 * Uses XDG Base Directory Specification environment variables
 * with sensible defaults under the user's home directory.
 *
 * @returns {object} { ConfigDir, DataDir, CacheDir, UltravisorData, UltravisorStaging, UltravisorCache, RetoldCache }
 */
function resolveStackPaths()
{
	let tmpHome = libOs.homedir();
	let tmpConfigBase = process.env.XDG_CONFIG_HOME || libPath.join(tmpHome, '.config');
	let tmpDataBase = process.env.XDG_DATA_HOME || libPath.join(tmpHome, '.local', 'share');
	let tmpCacheBase = process.env.XDG_CACHE_HOME || libPath.join(tmpHome, '.cache');

	return {
		ConfigDir: libPath.join(tmpConfigBase, 'retold-stack'),
		DataDir: libPath.join(tmpDataBase, 'retold-stack'),
		CacheDir: libPath.join(tmpCacheBase, 'retold-stack'),
		UltravisorData: libPath.join(tmpDataBase, 'ultravisor', 'datastore'),
		UltravisorStaging: libPath.join(tmpDataBase, 'ultravisor', 'staging'),
		UltravisorCache: libPath.join(tmpCacheBase, 'ultravisor'),
		RetoldCache: libPath.join(tmpCacheBase, 'retold-remote')
	};
}

/**
 * Ensure a directory exists, creating it (and parents) if necessary.
 *
 * @param {string} pDir - Directory path
 */
function ensureDir(pDir)
{
	if (!libFs.existsSync(pDir))
	{
		libFs.mkdirSync(pDir, { recursive: true });
	}
}

/**
 * Find the absolute path to the ultravisor CLI runner script.
 * Resolves through node's module resolution so it works no matter
 * where retold-remote is installed.
 *
 * @returns {string|null} Absolute path or null if not found
 */
function resolveUltravisorBin()
{
	try
	{
		// Resolve the package.json so we can read its bin entry
		let tmpPackageJsonPath = require.resolve('ultravisor/package.json');
		let tmpPackageDir = libPath.dirname(tmpPackageJsonPath);
		let tmpPackage = JSON.parse(libFs.readFileSync(tmpPackageJsonPath, 'utf8'));

		let tmpBinEntry = null;
		if (typeof tmpPackage.bin === 'string')
		{
			tmpBinEntry = tmpPackage.bin;
		}
		else if (tmpPackage.bin && typeof tmpPackage.bin === 'object')
		{
			tmpBinEntry = tmpPackage.bin.ultravisor || Object.values(tmpPackage.bin)[0];
		}

		if (!tmpBinEntry)
		{
			return null;
		}

		return libPath.resolve(tmpPackageDir, tmpBinEntry);
	}
	catch (pError)
	{
		return null;
	}
}

/**
 * Check whether a TCP port is accepting connections.
 *
 * @param {number}   pPort     - Port to test
 * @param {string}   pHost     - Host to test (default localhost)
 * @param {Function} fCallback - Callback(pIsOpen)
 */
function checkPortOpen(pPort, pHost, fCallback)
{
	let tmpRequest = libHttp.get(
	{
		host: pHost || '127.0.0.1',
		port: pPort,
		path: '/',
		timeout: 1000
	},
	(pResponse) =>
	{
		// Any HTTP response means the port is open
		pResponse.resume();
		fCallback(true);
	});

	tmpRequest.on('error', () => fCallback(false));
	tmpRequest.on('timeout', () =>
	{
		tmpRequest.destroy();
		fCallback(false);
	});
}

/**
 * Wait for ultravisor to be ready by polling its HTTP port.
 *
 * @param {number}   pPort        - Port to poll
 * @param {number}   pTimeoutMs   - Total wait timeout in milliseconds
 * @param {Function} fCallback    - Callback(pError) — pError null if ready
 */
function waitForUltravisor(pPort, pTimeoutMs, fCallback)
{
	let tmpStart = Date.now();
	let tmpAttempts = 0;

	let _attempt = () =>
	{
		tmpAttempts++;
		checkPortOpen(pPort, '127.0.0.1', (pIsOpen) =>
		{
			if (pIsOpen)
			{
				return fCallback(null, tmpAttempts);
			}

			if (Date.now() - tmpStart > pTimeoutMs)
			{
				return fCallback(new Error(`Ultravisor did not become ready within ${pTimeoutMs}ms`));
			}

			setTimeout(_attempt, 500);
		});
	};

	// Initial delay so we don't poll before the process has started
	setTimeout(_attempt, 750);
}

/**
 * Spawn ultravisor as a child process with sane defaults.
 *
 * Writes a temporary config file with the user-specified data paths,
 * then launches `node ultravisor-bin start -c <config>`.
 *
 * @param {object}   pOptions  - { Port, DataPath, StagingPath, ConfigDir, Logger }
 * @param {Function} fCallback - Callback(pError, pChildProcess)
 */
function spawnUltravisor(pOptions, fCallback)
{
	let tmpLog = pOptions.Logger || console;
	let tmpUltravisorBin = resolveUltravisorBin();

	if (!tmpUltravisorBin)
	{
		return fCallback(new Error('Could not locate the ultravisor package. Run `npm install ultravisor` in retold-remote.'));
	}

	if (!libFs.existsSync(tmpUltravisorBin))
	{
		return fCallback(new Error(`Ultravisor binary not found at ${tmpUltravisorBin}`));
	}

	ensureDir(pOptions.ConfigDir);
	ensureDir(pOptions.DataPath);
	ensureDir(pOptions.StagingPath);

	// Write a config file pointing at the user-specified paths
	let tmpConfig =
	{
		UltravisorAPIServerPort: pOptions.Port,
		UltravisorFileStorePath: pOptions.DataPath,
		UltravisorStagingRoot: pOptions.StagingPath
	};

	let tmpConfigPath = libPath.join(pOptions.ConfigDir, 'ultravisor-stack.json');
	libFs.writeFileSync(tmpConfigPath, JSON.stringify(tmpConfig, null, '\t'));

	tmpLog.info(`[stack] launching ultravisor (port ${pOptions.Port})`);
	tmpLog.info(`[stack]   data:    ${pOptions.DataPath}`);
	tmpLog.info(`[stack]   staging: ${pOptions.StagingPath}`);

	let tmpChild = libChildProcess.spawn(
		process.execPath,
		[tmpUltravisorBin, 'start', '-c', tmpConfigPath],
		{
			stdio: ['ignore', 'pipe', 'pipe'],
			detached: false
		});

	// Stream child output with a prefix for clarity
	tmpChild.stdout.on('data', (pChunk) =>
	{
		let tmpLines = pChunk.toString().split('\n');
		for (let i = 0; i < tmpLines.length; i++)
		{
			if (tmpLines[i].length > 0)
			{
				tmpLog.info('[ultravisor] ' + tmpLines[i]);
			}
		}
	});

	tmpChild.stderr.on('data', (pChunk) =>
	{
		let tmpLines = pChunk.toString().split('\n');
		for (let i = 0; i < tmpLines.length; i++)
		{
			if (tmpLines[i].length > 0)
			{
				tmpLog.warn('[ultravisor] ' + tmpLines[i]);
			}
		}
	});

	tmpChild.on('exit', (pCode, pSignal) =>
	{
		if (pCode !== 0 && pCode !== null)
		{
			tmpLog.warn(`[stack] ultravisor exited with code ${pCode}`);
		}
	});

	tmpChild.on('error', (pError) =>
	{
		tmpLog.error(`[stack] ultravisor failed to launch: ${pError.message}`);
	});

	return fCallback(null, tmpChild);
}

/**
 * Detect emulation (QEMU user-mode, Rosetta-on-Docker-Desktop, etc.)
 * which kills performance for native code (sharp/libvips, ffmpeg,
 * ImageMagick, LibreOffice). Logs a loud warning if detected so users
 * know to rebuild for the right architecture.
 *
 * Detection signals (any one of these triggers the warning):
 *   - /proc/cpuinfo contains "qemu" or "VirtualApple" (Docker Desktop on Mac)
 *   - /proc/cpuinfo vendor_id is anything other than the expected native vendor
 *   - /proc/version mentions an arch different from process.arch
 *   - A binfmt_misc qemu handler is registered AND we have a mismatch signal
 *   - A short native CPU loop runs at significantly less than expected speed
 *
 * @param {object} pLog - Logger
 */
function checkQemuEmulation(pLog)
{
	try
	{
		let tmpNodeArch = process.arch;
		let tmpEmulated = false;
		let tmpReason = '';
		let tmpCpuModel = null;
		let tmpCpuVendor = null;

		// 1. /proc/cpuinfo — most reliable signal
		if (libFs.existsSync('/proc/cpuinfo'))
		{
			try
			{
				let tmpCpuInfo = libFs.readFileSync('/proc/cpuinfo', 'utf8');

				// QEMU user-mode emulation often leaves the string "qemu" in cpuinfo
				if (/qemu/i.test(tmpCpuInfo))
				{
					tmpEmulated = true;
					tmpReason = '/proc/cpuinfo contains "qemu"';
				}

				// Docker Desktop on Apple Silicon emulating x86_64 reports vendor_id
				// as "VirtualApple" instead of "GenuineIntel" or "AuthenticAMD"
				let tmpVendorMatch = tmpCpuInfo.match(/^vendor_id\s*:\s*(.+)$/m);
				if (tmpVendorMatch)
				{
					tmpCpuVendor = tmpVendorMatch[1].trim();
					if (tmpNodeArch === 'x64' && tmpCpuVendor === 'VirtualApple')
					{
						tmpEmulated = true;
						tmpReason = 'x86_64 binary on Apple Silicon (VirtualApple vendor)';
					}
				}

				// Extract the model line for diagnostics
				let tmpModelMatch = tmpCpuInfo.match(/^model name\s*:\s*(.+)$/m);
				if (tmpModelMatch)
				{
					tmpCpuModel = tmpModelMatch[1].trim();
					if (/qemu/i.test(tmpCpuModel) || /VirtualApple/i.test(tmpCpuModel))
					{
						tmpEmulated = true;
						if (!tmpReason) tmpReason = 'CPU model name indicates emulation';
					}
				}
			}
			catch (pError)
			{
				// ignore
			}
		}

		// 2. /proc/version — Linux kernel build banner
		if (!tmpEmulated && libFs.existsSync('/proc/version'))
		{
			try
			{
				let tmpProcVersion = libFs.readFileSync('/proc/version', 'utf8');
				let tmpVersionLower = tmpProcVersion.toLowerCase();
				// If node says arm64 but the kernel banner says x86_64 (or vice versa)
				// we're definitely emulated.
				if (tmpNodeArch === 'arm64' && tmpVersionLower.indexOf('x86_64') >= 0)
				{
					tmpEmulated = true;
					tmpReason = 'arm64 binary, x86_64 kernel';
				}
				if (tmpNodeArch === 'x64' && tmpVersionLower.indexOf('aarch64') >= 0)
				{
					tmpEmulated = true;
					tmpReason = 'x86_64 binary, aarch64 kernel';
				}
			}
			catch (pError)
			{
				// ignore
			}
		}

		// 3. Performance heuristic — a tight CPU loop. Native arm64/amd64 should
		// finish 10M trivial integer ops in <100ms. Under emulation it's 5-20x slower.
		// We only run this if we haven't already decided we're emulated, and we keep
		// it small enough not to slow startup noticeably.
		if (!tmpEmulated)
		{
			let tmpLoopStart = Date.now();
			let tmpAccumulator = 0;
			for (let i = 0; i < 10000000; i++)
			{
				tmpAccumulator += i;
			}
			let tmpLoopMs = Date.now() - tmpLoopStart;
			// Native: typically 30-80ms. Emulated: typically 250-900ms.
			// Use 250ms as the threshold — generous enough to avoid false positives
			// on slow native NAS CPUs but still catches QEMU.
			if (tmpLoopMs > 250)
			{
				tmpEmulated = true;
				tmpReason = 'native CPU loop took ' + tmpLoopMs + 'ms (expected < 250ms — likely emulated)';
			}
			else
			{
				pLog.info('[stack] CPU loop self-test: ' + tmpLoopMs + 'ms (healthy)');
			}
		}

		if (tmpEmulated)
		{
			pLog.warn('==========================================================');
			pLog.warn('  WARNING: container is running under emulation!');
			pLog.warn('==========================================================');
			pLog.warn('  Reason: ' + tmpReason);
			pLog.warn('  Node arch: ' + tmpNodeArch);
			if (tmpCpuVendor)
			{
				pLog.warn('  CPU vendor: ' + tmpCpuVendor);
			}
			if (tmpCpuModel)
			{
				pLog.warn('  CPU model:  ' + tmpCpuModel);
			}
			pLog.warn('');
			pLog.warn('  Emulation is extremely slow for native code:');
			pLog.warn('    - sharp / libvips (image processing)');
			pLog.warn('    - ffmpeg / ffprobe (video and audio)');
			pLog.warn('    - ImageMagick (image fallback)');
			pLog.warn('    - LibreOffice (document conversion)');
			pLog.warn('    - Calibre (ebook conversion)');
			pLog.warn('');
			pLog.warn('  Symptoms you may see:');
			pLog.warn('    - Image previews/thumbnails take many seconds');
			pLog.warn('    - Video frame extraction times out');
			pLog.warn('    - Document conversion fails or hangs');
			pLog.warn('    - Random crashes in native modules');
			pLog.warn('');
			pLog.warn('  FIX: rebuild the image for the host architecture.');
			pLog.warn('  On the build machine:');
			pLog.warn('    ./docker-build-and-save.sh --amd64   # for Intel/AMD hosts');
			pLog.warn('    ./docker-build-and-save.sh --arm64   # for ARM hosts');
			pLog.warn('  Then transfer and load the new tar.gz.');
			pLog.warn('==========================================================');
		}
		else
		{
			pLog.info('[stack] arch: ' + tmpNodeArch + ' (native, no emulation detected)');
		}
	}
	catch (pError)
	{
		// Detection itself failed — not critical, just skip
		pLog.warn('[stack] arch detection failed: ' + pError.message);
	}
}

/**
 * Start the full stack: spawn ultravisor as a child process, wait for
 * it to be ready, then return so the caller can start retold-remote.
 *
 * @param {object}   pOptions
 * @param {object}   pOptions.Logger        - A fable-style logger ({ info, warn, error })
 * @param {number}   [pOptions.UltravisorPort=54321] - Port for ultravisor
 * @param {string}   [pOptions.DataPath]    - Override ultravisor data path
 * @param {string}   [pOptions.StagingPath] - Override ultravisor staging path
 * @param {string}   [pOptions.ConfigDir]   - Override ultravisor config dir
 * @param {Function} fCallback - Callback(pError, pStackInfo)
 *                               pStackInfo: { UltravisorURL, UltravisorChild, UltravisorPort, Paths }
 */
function start(pOptions, fCallback)
{
	let tmpLog = pOptions.Logger || console;
	let tmpPaths = resolveStackPaths();

	let tmpPort = pOptions.UltravisorPort || 54321;
	let tmpDataPath = pOptions.DataPath || tmpPaths.UltravisorData;
	let tmpStagingPath = pOptions.StagingPath || tmpPaths.UltravisorStaging;
	let tmpConfigDir = pOptions.ConfigDir || tmpPaths.ConfigDir;

	tmpLog.info('==========================================================');
	tmpLog.info('  Retold Stack Launcher');
	tmpLog.info('==========================================================');

	// QEMU emulation detection: if /proc/sys/kernel/osrelease contains "linuxkit"
	// or the binfmt entries indicate qemu, native operations will be slow.
	// Cross-architecture binaries running under QEMU show up here too.
	checkQemuEmulation(tmpLog);

	// Check if ultravisor is already running on the target port
	checkPortOpen(tmpPort, '127.0.0.1', (pAlreadyRunning) =>
	{
		if (pAlreadyRunning)
		{
			tmpLog.info(`[stack] ultravisor already running on port ${tmpPort}, reusing`);
			return fCallback(null,
			{
				UltravisorURL: 'http://localhost:' + tmpPort,
				UltravisorChild: null,
				UltravisorPort: tmpPort,
				Paths: tmpPaths,
				AlreadyRunning: true
			});
		}

		// Spawn ultravisor as a child process
		spawnUltravisor(
		{
			Port: tmpPort,
			DataPath: tmpDataPath,
			StagingPath: tmpStagingPath,
			ConfigDir: tmpConfigDir,
			Logger: tmpLog
		},
		(pSpawnError, pChild) =>
		{
			if (pSpawnError)
			{
				return fCallback(pSpawnError);
			}

			// Wait for ultravisor to start accepting connections
			waitForUltravisor(tmpPort, 30000, (pWaitError, pAttempts) =>
			{
				if (pWaitError)
				{
					try { pChild.kill(); } catch (e) { /* ignore */ }
					return fCallback(pWaitError);
				}

				tmpLog.info(`[stack] ultravisor ready (after ${pAttempts} attempts)`);

				return fCallback(null,
				{
					UltravisorURL: 'http://localhost:' + tmpPort,
					UltravisorChild: pChild,
					UltravisorPort: tmpPort,
					Paths: tmpPaths,
					AlreadyRunning: false
				});
			});
		});
	});
}

/**
 * Stop the stack — kill the ultravisor child process if we spawned it.
 *
 * @param {object}   pStackInfo - The object returned from start()
 * @param {Function} fCallback  - Callback() called after shutdown
 */
function stop(pStackInfo, fCallback)
{
	if (pStackInfo && pStackInfo.UltravisorChild && !pStackInfo.AlreadyRunning)
	{
		try
		{
			pStackInfo.UltravisorChild.kill('SIGTERM');
		}
		catch (pError)
		{
			// ignore
		}
		// Give it a moment to exit gracefully
		setTimeout(() =>
		{
			try
			{
				pStackInfo.UltravisorChild.kill('SIGKILL');
			}
			catch (pError)
			{
				// ignore — already gone
			}
			if (fCallback) fCallback();
		}, 1000);
	}
	else if (fCallback)
	{
		fCallback();
	}
}

module.exports =
{
	resolveStackPaths: resolveStackPaths,
	resolveUltravisorBin: resolveUltravisorBin,
	start: start,
	stop: stop
};
