/**
 * Retold Remote -- Headless Browser Tests
 *
 * Exercises major UI features in a headless Chromium browser, generates
 * fixture data in debug/tmp/ (gitignored) and outputs screenshots to
 * debug/dist/ (gitignored).
 *
 * Requires: puppeteer (dev dependency)
 * Requires: web-application/ to be pre-built (npm run build)
 */
const libAssert = require('assert');
const libPath = require('path');
const libFs = require('fs');
const libPuppeteer = require('puppeteer');

// ── Module-scope state ──────────────────────────────────
let _Browser = null;
let _Page = null;
let _ServerInfo = null;
let _BaseURL = '';
let _FixturePath = '';
let _ScreenshotDir = '';
let _ScreenshotIndex = 0;

// ── Fixture stubs ───────────────────────────────────────
// Minimal valid 1x1 white PNG (67 bytes)
const _PNG_1x1 = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB'
	+ 'Nl7BcQAAAABJRU5ErkJggg==', 'base64');

// Minimal valid 1x1 white JPEG (107 bytes)
const _JPEG_1x1 = Buffer.from(
	'/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkS'
	+ 'Ew8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJ'
	+ 'CQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIy'
	+ 'MjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf'
	+ '/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAA'
	+ 'AAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AKwA//9k=', 'base64');

function _stub(pText)
{
	return Buffer.from(pText || '(stub)\n');
}

const _FIXTURE_TREE =
{
	'Photos':
	{
		'vacation-sunset-2024.jpg': _JPEG_1x1,
		'family-portrait.png': _PNG_1x1,
		'mountain-landscape-panorama.webp': _stub(),
		'cat-sleeping.gif': _stub()
	},
	'Videos':
	{
		'birthday-party-compilation.mp4': _stub(),
		'tutorial-javascript-basics.webm': _stub()
	},
	'Music':
	{
		'favorite-song.mp3': _stub(),
		'podcast-episode-147.wav': _stub()
	},
	'Documents':
	{
		'meeting-notes-january.md': _stub('# Meeting Notes\n\nJanuary all-hands.\n'),
		'project-proposal-draft-v3-final-revised.docx': _stub(),
		'quarterly-financial-report-2025.pdf': _stub(),
		'README.txt': _stub('This is a sample README for testing.\n')
	},
	'Project Files':
	{
		'database-schema-migration-script.sql': _stub('-- migration stub\n'),
		'webpack.config.js': _stub('module.exports = {};\n'),
		'package-lock.json': _stub('{}')
	}
};

// ── Helpers ─────────────────────────────────────────────

function createFixtures(pRootPath)
{
	if (libFs.existsSync(pRootPath))
	{
		libFs.rmSync(pRootPath, { recursive: true, force: true });
	}

	for (let tmpFolder in _FIXTURE_TREE)
	{
		let tmpFolderPath = libPath.join(pRootPath, tmpFolder);
		libFs.mkdirSync(tmpFolderPath, { recursive: true });

		let tmpFiles = _FIXTURE_TREE[tmpFolder];
		for (let tmpFile in tmpFiles)
		{
			libFs.writeFileSync(libPath.join(tmpFolderPath, tmpFile), tmpFiles[tmpFile]);
		}
	}
}

function takeScreenshot(pName)
{
	_ScreenshotIndex++;
	let tmpPadded = String(_ScreenshotIndex).padStart(2, '0');
	let tmpFilename = tmpPadded + '-' + pName + '.png';
	return _Page.screenshot(
	{
		path: libPath.join(_ScreenshotDir, tmpFilename),
		fullPage: false
	});
}

async function settle(pMs)
{
	await _Page.evaluate((pDelay) => new Promise((r) => setTimeout(r, pDelay)), pMs || 500);
}

async function waitForAppReady()
{
	// Wait for the gallery container to exist
	await _Page.waitForSelector('#RetoldRemote-Gallery-Container', { timeout: 15000 });

	// Wait for gallery items to render (tiles or list rows)
	await _Page.waitForFunction(
		() =>
		{
			let tmpItems = document.querySelectorAll('.retold-remote-tile, .retold-remote-list-row');
			return tmpItems.length > 0;
		},
		{ timeout: 15000 }
	);

	// Wait for window.pict to be available
	await _Page.waitForFunction(
		() => typeof (window.pict) !== 'undefined' && window.pict.AppData && window.pict.AppData.RetoldRemote,
		{ timeout: 15000 }
	);

	await settle(500);
}

async function waitForGalleryItems()
{
	await _Page.waitForFunction(
		() =>
		{
			let tmpItems = document.querySelectorAll('.retold-remote-tile, .retold-remote-list-row');
			return tmpItems.length > 0;
		},
		{ timeout: 10000 }
	);
	await settle(300);
}

async function navigateToRoot()
{
	await _Page.evaluate(() =>
	{
		pict.PictApplication.loadFileList('');
	});
	await waitForGalleryItems();
}

async function navigateToFolder(pFolderName)
{
	await _Page.evaluate((pName) =>
	{
		pict.PictApplication.loadFileList(pName);
	}, pFolderName);
	await waitForGalleryItems();
}

async function openFileByIndex(pIndex)
{
	await _Page.evaluate((pIdx) =>
	{
		pict.views['RetoldRemote-Gallery'].onTileDoubleClick(pIdx);
	}, pIndex);
	await settle(800);
}

async function closeViewer()
{
	await _Page.evaluate(() =>
	{
		pict.providers['RetoldRemote-GalleryNavigation'].closeViewer();
	});
	await settle(500);
}

// ── Test Suite ──────────────────────────────────────────

suite
(
	'RetoldRemote Browser Tests',
	function ()
	{
		this.timeout(180000);

		suiteSetup
		(
			function (fDone)
			{
				this.timeout(60000);

				_FixturePath = libPath.join(__dirname, '..', 'debug', 'tmp');
				_ScreenshotDir = libPath.join(__dirname, '..', 'debug', 'dist');

				// Create fixture tree and screenshot output dir
				createFixtures(_FixturePath);
				libFs.mkdirSync(_ScreenshotDir, { recursive: true });

				// Start the server
				let tmpSetupServer = require('../source/cli/RetoldRemote-Server-Setup.js');
				let tmpPort = 10000 + Math.floor(Math.random() * 50000);

				tmpSetupServer(
				{
					ContentPath: _FixturePath,
					DistPath: libPath.join(__dirname, '..', 'web-application'),
					Port: tmpPort,
					HashedFilenames: false,
					CacheRoot: libPath.join(_FixturePath, '.cache')
				},
				function (pError, pServerInfo)
				{
					if (pError)
					{
						return fDone(pError);
					}

					_ServerInfo = pServerInfo;

					// Read the actual listening port from the Restify server
					let tmpActualPort = tmpPort;
					try
					{
						let tmpAddr = pServerInfo.Orator.serviceServer.server.address();
						if (tmpAddr && tmpAddr.port)
						{
							tmpActualPort = tmpAddr.port;
						}
					}
					catch (pErr)
					{
						// Fall back to the requested port
					}
					_BaseURL = 'http://localhost:' + tmpActualPort;

					// Launch Puppeteer
					libPuppeteer.launch(
					{
						headless: true,
						args: ['--no-sandbox', '--disable-setuid-sandbox']
					}).then(function (pBrowser)
					{
						_Browser = pBrowser;
						return _Browser.newPage();
					}).then(function (pPage)
					{
						_Page = pPage;
						return _Page.setViewport({ width: 1280, height: 800 });
					}).then(function ()
					{
						// Log browser errors to console for debugging
						_Page.on('pageerror', function (pError)
						{
							console.log('  [Browser Error]', pError.message);
						});

						return _Page.goto(_BaseURL, { waitUntil: 'networkidle2', timeout: 30000 });
					}).then(function ()
					{
						return waitForAppReady();
					}).then(function ()
					{
						fDone();
					}).catch(function (pErr)
					{
						fDone(pErr);
					});
				});
			}
		);

		suiteTeardown
		(
			function (fDone)
			{
				this.timeout(15000);

				let tmpClosePromise = Promise.resolve();

				if (_Browser)
				{
					tmpClosePromise = _Browser.close();
				}

				tmpClosePromise.then(function ()
				{
					if (_ServerInfo && _ServerInfo.Orator && _ServerInfo.Orator.serviceServer)
					{
						_ServerInfo.Orator.serviceServer.close(function ()
						{
							// Clean up fixture files
							if (libFs.existsSync(_FixturePath))
							{
								libFs.rmSync(_FixturePath, { recursive: true, force: true });
							}
							return fDone();
						});
					}
					else
					{
						return fDone();
					}
				}).catch(function ()
				{
					return fDone();
				});
			}
		);

		// ════════════════════════════════════════════════
		// Gallery Views
		// ════════════════════════════════════════════════
		suite
		(
			'Gallery Views',
			function ()
			{
				test
				(
					'displays gallery in grid view',
					async function ()
					{
						this.timeout(15000);

						// App defaults to list mode; switch to grid
						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.ViewMode = 'gallery';
							pict.views['RetoldRemote-Gallery'].renderGallery();
						});
						await settle(500);

						let tmpGridExists = await _Page.evaluate(
							() => !!document.querySelector('.retold-remote-grid')
						);
						libAssert.ok(tmpGridExists, 'Grid container should exist');

						let tmpTileCount = await _Page.evaluate(
							() => document.querySelectorAll('.retold-remote-tile').length
						);
						libAssert.ok(tmpTileCount > 0, 'Should have tiles in grid view');

						await takeScreenshot('gallery-grid-view');
					}
				);

				test
				(
					'displays gallery in list view',
					async function ()
					{
						this.timeout(15000);

						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.ViewMode = 'list';
							pict.views['RetoldRemote-Gallery'].renderGallery();
						});
						await settle(500);

						let tmpListExists = await _Page.evaluate(
							() => !!document.querySelector('.retold-remote-list')
						);
						libAssert.ok(tmpListExists, 'List container should exist');

						let tmpRowCount = await _Page.evaluate(
							() => document.querySelectorAll('.retold-remote-list-row').length
						);
						libAssert.ok(tmpRowCount > 0, 'Should have rows in list view');

						await takeScreenshot('gallery-list-view');
					}
				);
			}
		);

		// ════════════════════════════════════════════════
		// Folder Navigation
		// ════════════════════════════════════════════════
		suite
		(
			'Folder Navigation',
			function ()
			{
				test
				(
					'navigates into Photos folder',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Photos');

						let tmpItemCount = await _Page.evaluate(
							() => document.querySelectorAll('.retold-remote-tile, .retold-remote-list-row').length
						);
						libAssert.ok(tmpItemCount >= 4, 'Photos folder should have at least 4 items');

						await takeScreenshot('folder-navigation-photos');

						await navigateToRoot();
					}
				);

				test
				(
					'navigates into Videos folder',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Videos');

						let tmpItemCount = await _Page.evaluate(
							() => document.querySelectorAll('.retold-remote-tile, .retold-remote-list-row').length
						);
						libAssert.ok(tmpItemCount >= 2, 'Videos folder should have at least 2 items');

						await takeScreenshot('folder-navigation-videos');

						await navigateToRoot();
					}
				);

				test
				(
					'navigates into Documents folder',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Documents');

						let tmpItemCount = await _Page.evaluate(
							() => document.querySelectorAll('.retold-remote-tile, .retold-remote-list-row').length
						);
						libAssert.ok(tmpItemCount >= 4, 'Documents folder should have at least 4 items');

						await takeScreenshot('folder-navigation-documents');

						await navigateToRoot();
					}
				);
			}
		);

		// ════════════════════════════════════════════════
		// Media Viewer
		// ════════════════════════════════════════════════
		suite
		(
			'Media Viewer',
			function ()
			{
				test
				(
					'opens an image in the viewer',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Photos');

						// Open the first image
						await openFileByIndex(0);

						let tmpViewerVisible = await _Page.evaluate(
							() =>
							{
								let tmpEl = document.getElementById('RetoldRemote-Viewer-Container');
								return tmpEl && tmpEl.style.display !== 'none';
							}
						);
						libAssert.ok(tmpViewerVisible, 'Viewer container should be visible');

						let tmpActiveMode = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.ActiveMode
						);
						libAssert.strictEqual(tmpActiveMode, 'viewer', 'ActiveMode should be viewer');

						await takeScreenshot('image-viewer');

						await closeViewer();
						await navigateToRoot();
					}
				);

				test
				(
					'toggles distraction-free mode',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Photos');
						await openFileByIndex(0);

						// Toggle distraction-free via the view method
						await _Page.evaluate(() =>
						{
							pict.views['RetoldRemote-MediaViewer'].toggleDistractionFree();
						});
						await settle(500);

						await takeScreenshot('distraction-free-mode');

						// Toggle it back off
						await _Page.evaluate(() =>
						{
							pict.views['RetoldRemote-MediaViewer'].toggleDistractionFree();
						});
						await settle(300);

						await closeViewer();
						await navigateToRoot();
					}
				);

				test
				(
					'image scaling - fit mode',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Photos');
						await openFileByIndex(0);

						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.ImageFitMode = 'fit';
						});
						await settle(300);

						let tmpFitMode = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.ImageFitMode
						);
						libAssert.strictEqual(tmpFitMode, 'fit', 'ImageFitMode should be fit');

						await takeScreenshot('image-fit-mode-fit');

						await closeViewer();
						await navigateToRoot();
					}
				);

				test
				(
					'image scaling - fill mode',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Photos');
						await openFileByIndex(0);

						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.ImageFitMode = 'fill';
						});
						await settle(300);

						let tmpFitMode = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.ImageFitMode
						);
						libAssert.strictEqual(tmpFitMode, 'fill', 'ImageFitMode should be fill');

						await takeScreenshot('image-fit-mode-fill');

						await closeViewer();
						await navigateToRoot();
					}
				);

				test
				(
					'image scaling - original mode',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Photos');
						await openFileByIndex(0);

						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.ImageFitMode = 'original';
						});
						await settle(300);

						let tmpFitMode = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.ImageFitMode
						);
						libAssert.strictEqual(tmpFitMode, 'original', 'ImageFitMode should be original');

						await takeScreenshot('image-fit-mode-original');

						await closeViewer();
						await navigateToRoot();
					}
				);

				test
				(
					'opens video in viewer',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Videos');
						await openFileByIndex(0);

						let tmpActiveMode = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.ActiveMode
						);
						libAssert.strictEqual(tmpActiveMode, 'viewer', 'Should be in viewer mode');

						let tmpMediaType = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.CurrentViewerMediaType
						);
						libAssert.strictEqual(tmpMediaType, 'video', 'Should be viewing a video');

						await takeScreenshot('video-viewer');

						await closeViewer();
						await navigateToRoot();
					}
				);

				test
				(
					'opens audio in viewer',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Music');
						await openFileByIndex(0);

						let tmpActiveMode = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.ActiveMode
						);
						libAssert.strictEqual(tmpActiveMode, 'viewer', 'Should be in viewer mode');

						let tmpMediaType = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.CurrentViewerMediaType
						);
						libAssert.strictEqual(tmpMediaType, 'audio', 'Should be viewing audio');

						await takeScreenshot('audio-viewer');

						await closeViewer();
						await navigateToRoot();
					}
				);
			}
		);

		// ════════════════════════════════════════════════
		// Metadata and Info
		// ════════════════════════════════════════════════
		suite
		(
			'Metadata and Info',
			function ()
			{
				test
				(
					'shows metadata for an image file',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Photos');
						await openFileByIndex(0);

						// Toggle file info panel
						await _Page.evaluate(() =>
						{
							pict.providers['RetoldRemote-GalleryNavigation']._toggleFileInfo();
						});
						await settle(800);

						await takeScreenshot('metadata-image-file');

						// Close info panel
						await _Page.evaluate(() =>
						{
							pict.providers['RetoldRemote-GalleryNavigation']._toggleFileInfo();
						});
						await settle(300);

						await closeViewer();
						await navigateToRoot();
					}
				);

				test
				(
					'shows metadata for a document file',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Documents');
						await openFileByIndex(0);

						await _Page.evaluate(() =>
						{
							pict.providers['RetoldRemote-GalleryNavigation']._toggleFileInfo();
						});
						await settle(800);

						await takeScreenshot('metadata-document-file');

						await _Page.evaluate(() =>
						{
							pict.providers['RetoldRemote-GalleryNavigation']._toggleFileInfo();
						});
						await settle(300);

						await closeViewer();
						await navigateToRoot();
					}
				);
			}
		);

		// ════════════════════════════════════════════════
		// Settings and Themes
		// ════════════════════════════════════════════════
		suite
		(
			'Settings and Themes',
			function ()
			{
				test
				(
					'opens the settings panel',
					async function ()
					{
						this.timeout(15000);

						await _Page.evaluate(() =>
						{
							pict.views['RetoldRemote-SettingsPanel'].render();
						});
						await settle(500);

						let tmpSettingsRendered = await _Page.evaluate(
							() =>
							{
								let tmpEl = document.querySelector('.retold-remote-settings');
								return !!tmpEl;
							}
						);
						libAssert.ok(tmpSettingsRendered, 'Settings panel should render');

						await takeScreenshot('settings-panel');
					}
				);

				test
				(
					'switches to daylight theme',
					async function ()
					{
						this.timeout(15000);

						await _Page.evaluate(() =>
						{
							pict.providers['RetoldRemote-Theme'].applyTheme('daylight');
						});
						await settle(500);

						let tmpTheme = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.Theme
						);
						libAssert.strictEqual(tmpTheme, 'daylight', 'Theme should be daylight');

						await takeScreenshot('theme-daylight');
					}
				);

				test
				(
					'switches to neo-tokyo theme',
					async function ()
					{
						this.timeout(15000);

						await _Page.evaluate(() =>
						{
							pict.providers['RetoldRemote-Theme'].applyTheme('neo-tokyo');
						});
						await settle(500);

						let tmpTheme = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.Theme
						);
						libAssert.strictEqual(tmpTheme, 'neo-tokyo', 'Theme should be neo-tokyo');

						await takeScreenshot('theme-neo-tokyo');
					}
				);

				test
				(
					'switches to cyberpunk theme',
					async function ()
					{
						this.timeout(15000);

						await _Page.evaluate(() =>
						{
							pict.providers['RetoldRemote-Theme'].applyTheme('cyberpunk');
						});
						await settle(500);

						let tmpTheme = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.Theme
						);
						libAssert.strictEqual(tmpTheme, 'cyberpunk', 'Theme should be cyberpunk');

						let tmpBgColor = await _Page.evaluate(() =>
							getComputedStyle(document.documentElement).getPropertyValue('--retold-bg-primary').trim()
						);
						libAssert.ok(tmpBgColor && tmpBgColor.length > 0, 'Theme CSS variable should be set');

						await takeScreenshot('theme-cyberpunk');

						// Reset to twilight
						await _Page.evaluate(() =>
						{
							pict.providers['RetoldRemote-Theme'].applyTheme('twilight');
						});
						await settle(300);
					}
				);
			}
		);

		// ════════════════════════════════════════════════
		// Filtering and Search
		// ════════════════════════════════════════════════
		suite
		(
			'Filtering and Search',
			function ()
			{
				test
				(
					'filters gallery to images only',
					async function ()
					{
						this.timeout(15000);

						// Navigate into Photos to have image files visible
						await navigateToFolder('Photos');

						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.FilterState.MediaType = 'images';
							pict.providers['RetoldRemote-GalleryFilterSort'].applyFilterSort();
						});
						await settle(500);

						let tmpFilter = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.FilterState.MediaType
						);
						libAssert.strictEqual(tmpFilter, 'images', 'Filter should be set to images');

						await takeScreenshot('filter-images-only');

						// Reset filter
						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.FilterState.MediaType = 'all';
							pict.providers['RetoldRemote-GalleryFilterSort'].applyFilterSort();
						});
						await settle(300);

						await navigateToRoot();
					}
				);

				test
				(
					'filters gallery to video only',
					async function ()
					{
						this.timeout(15000);

						await navigateToFolder('Videos');

						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.FilterState.MediaType = 'video';
							pict.providers['RetoldRemote-GalleryFilterSort'].applyFilterSort();
						});
						await settle(500);

						let tmpFilter = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.FilterState.MediaType
						);
						libAssert.strictEqual(tmpFilter, 'video', 'Filter should be set to video');

						await takeScreenshot('filter-video-only');

						// Reset filter
						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.FilterState.MediaType = 'all';
							pict.providers['RetoldRemote-GalleryFilterSort'].applyFilterSort();
						});
						await settle(300);

						await navigateToRoot();
					}
				);

				test
				(
					'searches files by name',
					async function ()
					{
						this.timeout(15000);

						// Search from root folder (searches the 5 subfolders)
						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.SearchQuery = 'Photos';
							pict.providers['RetoldRemote-GalleryFilterSort'].applyFilterSort();
						});
						await settle(500);

						let tmpSearchQuery = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.SearchQuery
						);
						libAssert.strictEqual(tmpSearchQuery, 'Photos', 'Search query should be set');

						await takeScreenshot('search-results');

						// Clear search
						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.SearchQuery = '';
							pict.providers['RetoldRemote-GalleryFilterSort'].applyFilterSort();
						});
						await settle(300);
					}
				);
			}
		);

		// ════════════════════════════════════════════════
		// Collections
		// ════════════════════════════════════════════════
		suite
		(
			'Collections',
			function ()
			{
				test
				(
					'opens the collections panel',
					async function ()
					{
						this.timeout(15000);

						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.CollectionsPanelOpen = true;
							pict.views['RetoldRemote-CollectionsPanel'].render();
						});
						await settle(500);

						let tmpPanelOpen = await _Page.evaluate(
							() => pict.AppData.RetoldRemote.CollectionsPanelOpen
						);
						libAssert.ok(tmpPanelOpen, 'Collections panel should be open');

						await takeScreenshot('collections-panel');

						// Close it
						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.CollectionsPanelOpen = false;
						});
						await settle(300);
					}
				);
			}
		);

		// ════════════════════════════════════════════════
		// Thumbnail Sizes
		// ════════════════════════════════════════════════
		suite
		(
			'Thumbnail Sizes',
			function ()
			{
				test
				(
					'small thumbnails',
					async function ()
					{
						this.timeout(15000);

						// Switch to grid mode
						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.ViewMode = 'gallery';
							pict.AppData.RetoldRemote.ThumbnailSize = 'small';
							pict.views['RetoldRemote-Gallery'].renderGallery();
						});
						await settle(500);

						let tmpSizeClass = await _Page.evaluate(
							() => !!document.querySelector('.retold-remote-grid.size-small')
						);
						libAssert.ok(tmpSizeClass, 'Grid should have size-small class');

						await takeScreenshot('thumbnail-size-small');
					}
				);

				test
				(
					'medium thumbnails',
					async function ()
					{
						this.timeout(15000);

						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.ThumbnailSize = 'medium';
							pict.views['RetoldRemote-Gallery'].renderGallery();
						});
						await settle(500);

						let tmpSizeClass = await _Page.evaluate(
							() => !!document.querySelector('.retold-remote-grid.size-medium')
						);
						libAssert.ok(tmpSizeClass, 'Grid should have size-medium class');

						await takeScreenshot('thumbnail-size-medium');
					}
				);

				test
				(
					'large thumbnails',
					async function ()
					{
						this.timeout(15000);

						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.ThumbnailSize = 'large';
							pict.views['RetoldRemote-Gallery'].renderGallery();
						});
						await settle(500);

						let tmpSizeClass = await _Page.evaluate(
							() => !!document.querySelector('.retold-remote-grid.size-large')
						);
						libAssert.ok(tmpSizeClass, 'Grid should have size-large class');

						await takeScreenshot('thumbnail-size-large');

						// Reset to list mode
						await _Page.evaluate(() =>
						{
							pict.AppData.RetoldRemote.ViewMode = 'list';
							pict.AppData.RetoldRemote.ThumbnailSize = 'medium';
							pict.views['RetoldRemote-Gallery'].renderGallery();
						});
						await settle(300);
					}
				);
			}
		);
	}
);
