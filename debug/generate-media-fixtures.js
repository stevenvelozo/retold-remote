/**
 * Generate a folder tree of real media files for manual testing.
 *
 * Uses ImageMagick (convert/magick) and ffmpeg to create actual images,
 * videos, and audio files with visible/audible content.  This exercises
 * thumbnail generation, explorers, metadata extraction, and the full
 * gallery experience with realistic data.
 *
 * Usage:
 *   node test/generate-media-fixtures.js              (generates files, prints path)
 *   node test/generate-media-fixtures.js --serve       (generates + starts server)
 *   node test/generate-media-fixtures.js --port 9005   (custom port)
 *   node test/generate-media-fixtures.js --no-hash     (disable hashed filenames)
 *
 * Requires: ImageMagick (convert) and ffmpeg on PATH.
 * If either is missing the script still runs but skips that media type.
 */

const libFs = require('fs');
const libPath = require('path');
const libOs = require('os');
const libChildProcess = require('child_process');

const _FIXTURE_ROOT = libPath.join(libOs.tmpdir(), 'retold-remote-media-fixtures');

// ── Tool Detection ───────────────────────────────────────

let _HAS_CONVERT = false;
let _CONVERT_CMD = 'convert';
let _HAS_FFMPEG = false;

function _detectTools()
{
	// ImageMagick: try `magick` first (v7), fall back to `convert` (v6)
	try
	{
		libChildProcess.execSync('magick --version', { stdio: 'ignore' });
		_HAS_CONVERT = true;
		_CONVERT_CMD = 'magick';
	}
	catch (_e)
	{
		try
		{
			libChildProcess.execSync('convert --version', { stdio: 'ignore' });
			_HAS_CONVERT = true;
			_CONVERT_CMD = 'convert';
		}
		catch (_e2)
		{
			console.warn('⚠  ImageMagick not found — image generation will be skipped');
		}
	}

	try
	{
		libChildProcess.execSync('ffmpeg -version', { stdio: 'ignore' });
		_HAS_FFMPEG = true;
	}
	catch (_e)
	{
		console.warn('⚠  ffmpeg not found — video and audio generation will be skipped');
	}
}

// ── Counters ─────────────────────────────────────────────

let _counts = { image: 0, video: 0, audio: 0, document: 0, archive: 0 };
let _errors = 0;

// ── Helpers ──────────────────────────────────────────────

function _ensureDir(pPath)
{
	libFs.mkdirSync(pPath, { recursive: true });
}

function _exec(pCmd, pTimeout)
{
	libChildProcess.execSync(pCmd, { stdio: 'ignore', timeout: pTimeout || 60000 });
}

function _tryGenerate(pType, pLabel, pCmd, pTimeout)
{
	try
	{
		_exec(pCmd, pTimeout);
		_counts[pType]++;
		return true;
	}
	catch (pError)
	{
		console.warn(`  ✗ ${pLabel}: ${pError.message.split('\n')[0]}`);
		_errors++;
		return false;
	}
}

function _writeFile(pPath, pContent)
{
	libFs.writeFileSync(pPath, pContent);
}

// ── Color Palettes ───────────────────────────────────────

const _COLORS =
[
	['#1a5276', '#d4e6f1'], ['#7d3c98', '#e8daef'], ['#1e8449', '#d5f5e3'],
	['#b7950b', '#fdebd0'], ['#922b21', '#fadbd8'], ['#1b4f72', '#aed6f1'],
	['#6c3483', '#d2b4de'], ['#196f3d', '#a9dfbf'], ['#b9770e', '#fad7a0'],
	['#78281f', '#f5b7b1'], ['#2e86c1', '#85c1e9'], ['#a569bd', '#d7bde2'],
	['#27ae60', '#82e0aa'], ['#f39c12', '#f9e79f'], ['#e74c3c', '#f1948a'],
	['#2980b9', '#7fb3d8'], ['#8e44ad', '#bb8fce'], ['#229954', '#7dcea0'],
	['#d68910', '#f8c471'], ['#cb4335', '#ec7063']
];

const _BG_COLORS =
[
	'skyblue', 'salmon', 'palegreen', 'plum', 'peachpuff',
	'lightcoral', 'lightskyblue', 'khaki', 'thistle', 'mistyrose'
];

const _DARK_COLORS =
[
	'#0a0a2a', '#0d1117', '#1a1a2e', '#16213e', '#0f3460',
	'#1b1b2f', '#162447', '#1f4068', '#1a1a40', '#0d0d0d'
];

const _BRIGHT_COLORS =
[
	'#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
	'#1abc9c', '#e67e22', '#e91e63', '#00bcd4', '#ff5722'
];

const _FREQUENCIES = [220, 261, 293, 329, 349, 392, 440, 493, 523, 587, 659, 698, 784, 880];

const _VIDEO_SOURCES =
[
	{ filter: 'testsrc', label: 'test-pattern' },
	{ filter: 'smptebars', label: 'smpte-bars' },
	{ filter: 'color=c=navy', label: 'solid-navy' },
	{ filter: 'color=c=darkred', label: 'solid-red' },
	{ filter: 'color=c=darkgreen', label: 'solid-green' },
	{ filter: 'color=c=indigo', label: 'solid-indigo' },
	{ filter: 'mandelbrot', label: 'mandelbrot' },
	{ filter: 'life=mold=10:death_color=#333333:life_color=#00ff88', label: 'life' },
	{ filter: 'testsrc2', label: 'test-pattern-2' },
	{ filter: 'rgbtestsrc', label: 'rgb-test' }
];

// ── Image Generation ─────────────────────────────────────

function _generateImages(pFolder, pSpecs)
{
	if (!_HAS_CONVERT) return;

	_ensureDir(pFolder);
	for (let i = 0; i < pSpecs.length; i++)
	{
		let tmpSpec = pSpecs[i];
		let tmpPath = libPath.join(pFolder, tmpSpec.name);
		let tmpCmd = `${_CONVERT_CMD} ${tmpSpec.args} "${tmpPath}"`;
		_tryGenerate('image', tmpSpec.name, tmpCmd);
	}
}

function _gradientImage(pName, pW, pH, pColor1, pColor2)
{
	return { name: pName, args: `-size ${pW}x${pH} gradient:"${pColor1}"-"${pColor2}"` };
}

function _plasmaImage(pName, pW, pH, pSeed)
{
	return { name: pName, args: `-size ${pW}x${pH} -seed ${pSeed} plasma:` };
}

function _shapeImage(pName, pW, pH, pBg, pFg, pDraw)
{
	return { name: pName, args: `-size ${pW}x${pH} xc:${pBg} -fill "${pFg}" -draw "${pDraw}"` };
}

function _labeledImage(pName, pW, pH, pBg, pFg, pLabel)
{
	return {
		name: pName,
		args: `-size ${pW}x${pH} xc:"${pBg}" -fill "${pFg}" -gravity center -pointsize ${Math.floor(pH / 6)} -annotate +0+0 "${pLabel}"`
	};
}

// ── Video Generation ─────────────────────────────────────

function _generateVideo(pPath, pSource, pDuration, pSize, pFormat)
{
	if (!_HAS_FFMPEG) return;

	let tmpFilter = pSource;
	let tmpCodec = pFormat === 'webm' ? '-c:v libvpx-vp9 -b:v 500k' : '-c:v libx264 -pix_fmt yuv420p';
	let tmpSep = tmpFilter.includes('=') ? ':' : '=';

	// Add size if not already in filter
	if (!tmpFilter.includes('s='))
	{
		tmpFilter += tmpSep + 's=' + pSize;
		tmpSep = ':';
	}

	// mandelbrot and life don't accept d= duration — use -t flag instead
	let tmpDurFlag = '';
	if (pSource.startsWith('mandelbrot') || pSource.startsWith('life'))
	{
		tmpDurFlag = '-t ' + pDuration;
	}
	else
	{
		tmpFilter += ':d=' + pDuration;
	}

	let tmpCmd = `ffmpeg -y -f lavfi -i "${tmpFilter}" ${tmpDurFlag} ${tmpCodec} -an "${pPath}"`;
	_tryGenerate('video', libPath.basename(pPath), tmpCmd, 120000);
}

function _generateVideoWithAudio(pPath, pSource, pDuration, pSize, pFreq)
{
	if (!_HAS_FFMPEG) return;

	let tmpFilter = pSource;
	let tmpExt = libPath.extname(pPath).slice(1);
	let tmpVCodec = tmpExt === 'webm' ? '-c:v libvpx-vp9 -b:v 500k' : '-c:v libx264 -pix_fmt yuv420p';
	let tmpACodec = tmpExt === 'webm' ? '-c:a libopus' : '-c:a aac';
	let tmpSep = tmpFilter.includes('=') ? ':' : '=';

	if (!tmpFilter.includes('s='))
	{
		tmpFilter += tmpSep + 's=' + pSize;
		tmpSep = ':';
	}

	let tmpDurFlag = '';
	if (pSource.startsWith('mandelbrot') || pSource.startsWith('life'))
	{
		tmpDurFlag = '-t ' + pDuration;
	}
	else
	{
		tmpFilter += ':d=' + pDuration;
	}

	let tmpCmd = `ffmpeg -y -f lavfi -i "${tmpFilter}" -f lavfi -i "sine=frequency=${pFreq}:duration=${pDuration}" ${tmpDurFlag} ${tmpVCodec} ${tmpACodec} -shortest "${pPath}"`;
	_tryGenerate('video', libPath.basename(pPath), tmpCmd, 120000);
}

// ── Audio Generation ─────────────────────────────────────

function _generateAudio(pPath, pSource, pDuration)
{
	if (!_HAS_FFMPEG) return;

	let tmpExt = libPath.extname(pPath).slice(1);
	let tmpCodecMap = { mp3: '-c:a libmp3lame -q:a 5', wav: '-c:a pcm_s16le', flac: '-c:a flac', ogg: '-c:a libopus', m4a: '-c:a aac' };
	let tmpCodec = tmpCodecMap[tmpExt] || '-c:a libmp3lame';
	let tmpCmd = `ffmpeg -y -f lavfi -i "${pSource}:d=${pDuration}" ${tmpCodec} "${pPath}"`;
	_tryGenerate('audio', libPath.basename(pPath), tmpCmd, 60000);
}

// ── Document Content ─────────────────────────────────────

const _MARKDOWN_CONTENT = `# Project Documentation

## Overview

This is a sample project document with realistic formatting for testing
syntax highlighting and document rendering.

### Features

- Item one with **bold** text
- Item two with *italic* text
- Item three with \`inline code\`

### Code Example

\`\`\`javascript
function fibonacci(n)
{
	if (n <= 1) return n;
	return fibonacci(n - 1) + fibonacci(n - 2);
}

for (let i = 0; i < 10; i++)
{
	console.log(fibonacci(i));
}
\`\`\`

## Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| Port | 8086 | Server port |
| Theme | twilight | Dark theme |
| Cache | enabled | Thumbnail caching |

## Notes

> This is a blockquote for testing markdown rendering.
> It spans multiple lines.

---

Last updated: 2026-03-06
`;

const _JS_CONTENT = `/**
 * A sample Express-style HTTP server for testing code viewer.
 */
const http = require('http');

const PORT = process.env.PORT || 3000;

const routes = new Map();

function get(path, handler)
{
	routes.set(\`GET:\${path}\`, handler);
}

function post(path, handler)
{
	routes.set(\`POST:\${path}\`, handler);
}

get('/', (req, res) =>
{
	res.writeHead(200, { 'Content-Type': 'text/html' });
	res.end('<h1>Hello World</h1>');
});

get('/api/status', (req, res) =>
{
	res.writeHead(200, { 'Content-Type': 'application/json' });
	res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
});

post('/api/data', (req, res) =>
{
	let body = '';
	req.on('data', (chunk) => { body += chunk; });
	req.on('end', () =>
	{
		let data = JSON.parse(body);
		res.writeHead(201, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify({ received: data }));
	});
});

const server = http.createServer((req, res) =>
{
	let key = \`\${req.method}:\${req.url}\`;
	let handler = routes.get(key);
	if (handler)
	{
		handler(req, res);
	}
	else
	{
		res.writeHead(404);
		res.end('Not Found');
	}
});

server.listen(PORT, () =>
{
	console.log(\`Server running on port \${PORT}\`);
});
`;

const _PYTHON_CONTENT = `"""
Sample data analysis script for testing syntax highlighting.
"""
import random
import statistics
from collections import Counter
from datetime import datetime


class DataAnalyzer:
    """Analyze a dataset and produce summary statistics."""

    def __init__(self, data):
        self.data = data
        self.timestamp = datetime.now()

    def summary(self):
        return {
            "count": len(self.data),
            "mean": statistics.mean(self.data),
            "median": statistics.median(self.data),
            "stdev": statistics.stdev(self.data) if len(self.data) > 1 else 0,
            "min": min(self.data),
            "max": max(self.data),
        }

    def histogram(self, bins=10):
        lo, hi = min(self.data), max(self.data)
        width = (hi - lo) / bins
        counts = [0] * bins
        for value in self.data:
            idx = min(int((value - lo) / width), bins - 1)
            counts[idx] += 1
        return counts

    def top_n(self, n=5):
        counter = Counter(self.data)
        return counter.most_common(n)


def generate_dataset(size=1000, low=0, high=100):
    return [random.gauss((low + high) / 2, (high - low) / 6) for _ in range(size)]


if __name__ == "__main__":
    dataset = generate_dataset(500)
    analyzer = DataAnalyzer(dataset)
    stats = analyzer.summary()
    print(f"Analysis of {stats['count']} data points:")
    for key, value in stats.items():
        print(f"  {key}: {value:.2f}" if isinstance(value, float) else f"  {key}: {value}")
`;

const _HTML_CONTENT = `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<title>Sample Page</title>
	<style>
		body { font-family: system-ui, sans-serif; margin: 2rem; background: #f5f5f5; }
		.card { background: white; border-radius: 8px; padding: 1.5rem; margin: 1rem 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
		.card h2 { margin-top: 0; color: #333; }
		.badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; }
		.badge-green { background: #d4edda; color: #155724; }
		.badge-blue { background: #cce5ff; color: #004085; }
	</style>
</head>
<body>
	<h1>Dashboard</h1>
	<div class="card">
		<h2>Server Status <span class="badge badge-green">Online</span></h2>
		<p>All systems operational. Uptime: 99.97%</p>
	</div>
	<div class="card">
		<h2>Recent Activity <span class="badge badge-blue">12 new</span></h2>
		<ul>
			<li>User signup — 2 minutes ago</li>
			<li>File uploaded — 15 minutes ago</li>
			<li>Report generated — 1 hour ago</li>
		</ul>
	</div>
</body>
</html>
`;

const _CSS_CONTENT = `/* Theme variables and base styles */
:root
{
	--primary: #2563eb;
	--primary-hover: #1d4ed8;
	--bg: #ffffff;
	--bg-secondary: #f8fafc;
	--text: #1e293b;
	--text-muted: #64748b;
	--border: #e2e8f0;
	--radius: 8px;
	--shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

*,
*::before,
*::after
{
	box-sizing: border-box;
}

body
{
	margin: 0;
	font-family: 'Inter', system-ui, sans-serif;
	background: var(--bg);
	color: var(--text);
	line-height: 1.6;
}

.container
{
	max-width: 1200px;
	margin: 0 auto;
	padding: 0 1.5rem;
}

.btn
{
	display: inline-flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem 1rem;
	border: 1px solid var(--border);
	border-radius: var(--radius);
	background: var(--bg);
	color: var(--text);
	font-size: 0.875rem;
	cursor: pointer;
	transition: all 0.15s ease;
}

.btn:hover
{
	background: var(--bg-secondary);
	border-color: var(--primary);
	color: var(--primary);
}

.btn-primary
{
	background: var(--primary);
	border-color: var(--primary);
	color: white;
}

.btn-primary:hover
{
	background: var(--primary-hover);
}

/* Grid system */
.grid
{
	display: grid;
	gap: 1.5rem;
}

.grid-2 { grid-template-columns: repeat(2, 1fr); }
.grid-3 { grid-template-columns: repeat(3, 1fr); }
.grid-4 { grid-template-columns: repeat(4, 1fr); }

@media (max-width: 768px)
{
	.grid-2,
	.grid-3,
	.grid-4
	{
		grid-template-columns: 1fr;
	}
}
`;

const _CSV_CONTENT = `id,name,category,price,stock,rating,created
1,Widget Alpha,Electronics,29.99,150,4.5,2025-01-15
2,Gadget Beta,Electronics,49.99,75,4.2,2025-02-01
3,Tool Gamma,Hardware,15.99,300,4.8,2025-02-15
4,Device Delta,Electronics,99.99,50,3.9,2025-03-01
5,Part Epsilon,Hardware,5.99,500,4.1,2025-03-15
6,Module Zeta,Software,199.99,999,4.7,2025-04-01
7,Component Eta,Hardware,12.49,200,4.3,2025-04-15
8,System Theta,Software,299.99,999,4.6,2025-05-01
9,Unit Iota,Electronics,79.99,100,4.0,2025-05-15
10,Assembly Kappa,Hardware,34.99,175,4.4,2025-06-01
11,Platform Lambda,Software,149.99,999,4.8,2025-06-15
12,Sensor Mu,Electronics,24.99,250,4.1,2025-07-01
13,Bracket Nu,Hardware,8.99,400,3.7,2025-07-15
14,Framework Xi,Software,89.99,999,4.5,2025-08-01
15,Board Omicron,Electronics,119.99,60,4.3,2025-08-15
16,Kit Pi,Hardware,42.99,120,4.6,2025-09-01
17,Suite Rho,Software,249.99,999,4.9,2025-09-15
18,Chip Sigma,Electronics,19.99,350,4.0,2025-10-01
19,Panel Tau,Hardware,55.99,90,4.2,2025-10-15
20,Engine Upsilon,Software,179.99,999,4.7,2025-11-01
`;

const _JSON_CONFIG = JSON.stringify({
	name: 'sample-project',
	version: '2.1.0',
	description: 'A sample project configuration for testing JSON rendering',
	main: 'src/index.js',
	scripts: { start: 'node src/index.js', test: 'mocha test/', build: 'webpack --mode production', lint: 'eslint src/' },
	dependencies: { express: '^4.18.2', lodash: '^4.17.21', moment: '^2.29.4' },
	devDependencies: { mocha: '^10.2.0', eslint: '^8.50.0', webpack: '^5.88.0' },
	repository: { type: 'git', url: 'https://github.com/example/sample-project.git' },
	license: 'MIT'
}, null, '\t');

const _YAML_CONTENT = `# Application configuration
app:
  name: retold-remote
  version: 2.1.0
  environment: production

server:
  port: 8086
  host: 0.0.0.0
  cors:
    enabled: true
    origins:
      - http://localhost:3000
      - https://example.com

database:
  host: localhost
  port: 5432
  name: retold_db
  pool:
    min: 2
    max: 10

logging:
  level: info
  format: json
  outputs:
    - type: console
    - type: file
      path: /var/log/retold/app.log
      rotation: daily

cache:
  enabled: true
  ttl: 3600
  max_entries: 10000
`;

// ── Main Generation ──────────────────────────────────────

function generate()
{
	console.log('Generating media fixtures...\n');
	_detectTools();
	console.log('');

	// Wipe and recreate
	if (libFs.existsSync(_FIXTURE_ROOT))
	{
		libFs.rmSync(_FIXTURE_ROOT, { recursive: true, force: true });
	}

	// ── Nature / Landscapes ──────────────────────────────
	let tmpDir = libPath.join(_FIXTURE_ROOT, 'Nature', 'Landscapes');
	_generateImages(tmpDir,
	[
		_gradientImage('sunset-horizon.jpg', 1024, 768, _COLORS[0][0], _COLORS[0][1]),
		_gradientImage('ocean-deep.jpg', 1200, 800, '#003366', '#66ccff'),
		_gradientImage('forest-canopy.jpg', 800, 600, '#0a3d0a', '#66cc66'),
		_gradientImage('desert-dunes.png', 1024, 576, '#c2b280', '#f5deb3'),
		_gradientImage('mountain-peak.png', 1280, 720, '#4a4a6a', '#e0e0f0'),
		_gradientImage('autumn-leaves.jpg', 960, 640, '#8b4513', '#ffd700'),
		_gradientImage('frozen-lake.webp', 800, 600, '#b0c4de', '#f0f8ff'),
		_plasmaImage('nebula-cloud.png', 800, 600, 101),
		_plasmaImage('aurora-borealis.jpg', 1024, 768, 202),
		_plasmaImage('coral-reef.jpg', 960, 720, 303),
		_shapeImage('rolling-hills.jpg', 1024, 400, 'skyblue', '#228b22', 'ellipse 512,500 600,200 0,360'),
		_shapeImage('island-view.png', 800, 600, '#4682b4', '#2e8b57', 'circle 400,450 400,300'),
		_labeledImage('sunrise-panorama.jpg', 1920, 640, '#ff6347', '#ffd700', 'Sunrise Panorama'),
		_labeledImage('twilight-valley.jpg', 1280, 720, '#2f4f4f', '#dda0dd', 'Twilight Valley'),
		_gradientImage('spring-meadow.jpg', 640, 480, '#006400', '#98fb98'),
		_gradientImage('stormy-sky.png', 1024, 768, '#2f4f4f', '#778899'),
		_plasmaImage('lava-flow.jpg', 800, 600, 404),
		_plasmaImage('crystal-cave.png', 640, 480, 505),
		_gradientImage('waterfall-mist.webp', 720, 960, '#4682b4', '#e0ffff'),
		_gradientImage('glacier-blue.jpg', 1200, 800, '#0077be', '#b0e0e6')
	]);

	// ── Nature / Wildlife ────────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Nature', 'Wildlife');
	_generateImages(tmpDir,
	[
		_shapeImage('eagle-soaring.jpg', 800, 600, 'skyblue', '#8b4513', 'polygon 400,100 350,300 300,250 250,350 400,300 550,350 500,250 450,300'),
		_shapeImage('fish-pond.png', 640, 480, '#4682b4', '#ffa500', 'ellipse 320,300 100,40 0,360'),
		_shapeImage('butterfly-garden.jpg', 720, 540, '#90ee90', '#ff69b4', 'circle 360,270 360,200'),
		_plasmaImage('tropical-bird.jpg', 600, 800, 606),
		_plasmaImage('underwater-scene.png', 1024, 576, 707),
		_labeledImage('safari-sunset.jpg', 1280, 720, '#cd853f', '#ffffff', 'Safari'),
		_shapeImage('deer-meadow.jpg', 800, 600, '#6b8e23', '#8b4513', 'ellipse 400,400 60,100 0,360'),
		_gradientImage('rainforest-canopy.png', 640, 960, '#004d00', '#90ee90'),
		_plasmaImage('jellyfish-glow.webp', 600, 600, 808),
		_shapeImage('bear-tracks.jpg', 800, 600, '#d2b48c', '#654321', 'circle 300,300 300,270'),
		_labeledImage('whale-watching.jpg', 1200, 675, '#1c3d5a', '#87ceeb', 'Whale Watch'),
		_plasmaImage('chameleon-colors.png', 500, 500, 909),
		_gradientImage('flamingo-lake.jpg', 720, 480, '#ff69b4', '#ffc0cb'),
		_shapeImage('owl-portrait.png', 600, 800, '#2f2f2f', '#ffd700', 'circle 300,300 300,200'),
		_plasmaImage('peacock-feathers.jpg', 800, 800, 1010)
	]);

	// ── Nature / Timelapse ───────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Nature', 'Timelapse');
	_ensureDir(tmpDir);
	if (_HAS_FFMPEG)
	{
		_generateVideoWithAudio(libPath.join(tmpDir, 'sunset-timelapse.mp4'), 'color=c=#ff4500', 8, '1280x720', 440);
		_generateVideo(libPath.join(tmpDir, 'clouds-rolling.mp4'), 'mandelbrot', 12, '640x480', 'mp4');
		_generateVideoWithAudio(libPath.join(tmpDir, 'stars-rotating.mp4'), 'life=mold=10:death_color=#000033:life_color=#ffffcc', 15, '640x360', 523);
		_generateVideo(libPath.join(tmpDir, 'flower-blooming.webm'), 'testsrc2', 10, '640x480', 'webm');
		_generateVideoWithAudio(libPath.join(tmpDir, 'ice-melting.mp4'), 'color=c=#87ceeb', 6, '1280x720', 330);
		_generateVideo(libPath.join(tmpDir, 'city-to-night.mp4'), 'smptebars', 20, '1280x720', 'mp4');
		_generateVideo(libPath.join(tmpDir, 'waves-crashing.mp4'), 'rgbtestsrc', 8, '640x360', 'mp4');
		_generateVideoWithAudio(libPath.join(tmpDir, 'northern-lights.webm'), 'mandelbrot', 30, '640x480', 261);
	}

	// ── City / Architecture ──────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'City', 'Architecture');
	let tmpArchSpecs = [];
	let tmpBuildingNames = ['tower', 'bridge', 'cathedral', 'skyscraper', 'museum',
		'library', 'station', 'dome', 'arch', 'plaza', 'monument', 'courthouse', 'hotel', 'theater', 'pavilion'];
	for (let i = 0; i < tmpBuildingNames.length; i++)
	{
		let tmpW = 600 + (i % 5) * 200;
		let tmpH = 400 + (i % 4) * 200;
		let tmpPair = _COLORS[i % _COLORS.length];
		let tmpExt = ['jpg', 'png', 'webp'][i % 3];
		tmpArchSpecs.push(_labeledImage(
			`${tmpBuildingNames[i]}-${i + 1}.${tmpExt}`,
			tmpW, tmpH, tmpPair[0], tmpPair[1], tmpBuildingNames[i].toUpperCase()
		));
	}
	_generateImages(tmpDir, tmpArchSpecs);

	// ── City / Street ────────────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'City', 'Street');
	let tmpStreetSpecs = [];
	let tmpStreetNames = ['downtown-crossing', 'market-square', 'side-alley', 'boulevard',
		'cafe-corner', 'park-entrance', 'subway-station', 'rooftop-view', 'waterfront', 'garden-path'];
	for (let i = 0; i < tmpStreetNames.length; i++)
	{
		let tmpW = 800 + (i % 3) * 200;
		let tmpH = 600 + (i % 2) * 200;
		let tmpBg = _BG_COLORS[i % _BG_COLORS.length];
		tmpStreetSpecs.push(_labeledImage(
			`${tmpStreetNames[i]}.jpg`,
			tmpW, tmpH, tmpBg, '#333333', tmpStreetNames[i].replace(/-/g, ' ')
		));
	}
	_generateImages(tmpDir, tmpStreetSpecs);
	_ensureDir(tmpDir);
	if (_HAS_FFMPEG)
	{
		_generateVideoWithAudio(libPath.join(tmpDir, 'traffic-flow.mp4'), 'testsrc', 10, '1280x720', 220);
		_generateVideo(libPath.join(tmpDir, 'pedestrian-crossing.mp4'), 'smptebars', 8, '640x480', 'mp4');
		_generateVideoWithAudio(libPath.join(tmpDir, 'street-musician.mp4'), 'color=c=#8b7355', 15, '640x360', 440);
		_generateVideo(libPath.join(tmpDir, 'fountain-plaza.webm'), 'testsrc2', 12, '640x480', 'webm');
		_generateVideoWithAudio(libPath.join(tmpDir, 'rainy-evening.mp4'), 'color=c=#2f4f4f', 6, '1280x720', 349);
	}

	// ── City / Night ─────────────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'City', 'Night');
	let tmpNightSpecs = [];
	let tmpNightNames = ['neon-signs', 'city-skyline', 'bridge-lights', 'empty-street',
		'rain-reflections', 'rooftop-bar', 'highway-trails', 'harbor-glow', 'clock-tower', 'alley-shadow'];
	for (let i = 0; i < tmpNightNames.length; i++)
	{
		let tmpW = 800 + (i % 4) * 160;
		let tmpH = 600 + (i % 3) * 100;
		let tmpBg = _DARK_COLORS[i % _DARK_COLORS.length];
		let tmpFg = _BRIGHT_COLORS[i % _BRIGHT_COLORS.length];
		let tmpCx = Math.floor(tmpW / 2);
		let tmpCy = Math.floor(tmpH / 2);
		tmpNightSpecs.push(_shapeImage(
			`${tmpNightNames[i]}.jpg`,
			tmpW, tmpH, tmpBg, tmpFg, `circle ${tmpCx},${tmpCy} ${tmpCx},${tmpCy - 80}`
		));
	}
	_generateImages(tmpDir, tmpNightSpecs);

	// ── Music / Jazz ─────────────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Music', 'Jazz');
	_ensureDir(tmpDir);
	if (_HAS_FFMPEG)
	{
		let tmpJazzNames = ['blue-note-session', 'midnight-sax', 'piano-trio', 'bass-walk',
			'drum-solo', 'trumpet-ballad', 'cool-breeze', 'smoky-lounge', 'swing-time', 'latin-groove'];
		for (let i = 0; i < tmpJazzNames.length; i++)
		{
			let tmpFreq = _FREQUENCIES[i % _FREQUENCIES.length];
			let tmpDur = 10 + (i * 5);
			let tmpExts = ['mp3', 'wav', 'flac', 'mp3', 'wav', 'flac', 'mp3', 'wav', 'mp3', 'flac'];
			let tmpSource = `sine=frequency=${tmpFreq}`;
			_generateAudio(libPath.join(tmpDir, `${tmpJazzNames[i]}.${tmpExts[i]}`), tmpSource, tmpDur);
		}
	}

	// ── Music / Electronic ───────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Music', 'Electronic');
	_ensureDir(tmpDir);
	if (_HAS_FFMPEG)
	{
		let tmpElecNames = ['synth-wave', 'deep-bass', 'hi-hat-loop', 'ambient-pad',
			'acid-line', 'glitch-hop', 'trance-lead', 'dubstep-wobble', 'techno-kick', 'chillout-mix'];
		for (let i = 0; i < tmpElecNames.length; i++)
		{
			let tmpFreq = 110 + (i * 80);
			let tmpDur = 8 + (i * 3);
			let tmpExts = ['mp3', 'wav', 'mp3', 'flac', 'mp3', 'ogg', 'mp3', 'wav', 'mp3', 'flac'];
			_generateAudio(libPath.join(tmpDir, `${tmpElecNames[i]}.${tmpExts[i]}`), `sine=frequency=${tmpFreq}`, tmpDur);
		}
	}

	// ── Music / Classical ────────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Music', 'Classical');
	_ensureDir(tmpDir);
	if (_HAS_FFMPEG)
	{
		let tmpClassicalNames = ['adagio-strings', 'allegro-vivace', 'nocturne-in-e', 'sonata-movement-1',
			'waltz-in-a', 'concerto-finale', 'prelude-dawn', 'fugue-in-d'];
		for (let i = 0; i < tmpClassicalNames.length; i++)
		{
			let tmpFreq = _FREQUENCIES[(i * 2) % _FREQUENCIES.length];
			let tmpDur = 30 + (i * 15);
			let tmpExts = ['mp3', 'flac', 'wav', 'ogg', 'mp3', 'flac', 'wav', 'mp3'];
			_generateAudio(libPath.join(tmpDir, `${tmpClassicalNames[i]}.${tmpExts[i]}`), `sine=frequency=${tmpFreq}`, tmpDur);
		}
	}

	// ── Projects / Code ──────────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Projects', 'Code');
	_ensureDir(tmpDir);
	_writeFile(libPath.join(tmpDir, 'server.js'), _JS_CONTENT); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'analyzer.py'), _PYTHON_CONTENT); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'dashboard.html'), _HTML_CONTENT); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'theme.css'), _CSS_CONTENT); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'package.json'), _JSON_CONFIG); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'config.yaml'), _YAML_CONTENT); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'query.sql'), 'SELECT u.id, u.name, u.email, COUNT(o.id) AS order_count\nFROM users u\nLEFT JOIN orders o ON o.user_id = u.id\nWHERE u.created_at > \'2025-01-01\'\nGROUP BY u.id, u.name, u.email\nHAVING COUNT(o.id) > 5\nORDER BY order_count DESC\nLIMIT 50;\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'Makefile'), 'CC=gcc\nCFLAGS=-Wall -Wextra -O2\nSRC=$(wildcard src/*.c)\nOBJ=$(SRC:.c=.o)\n\nall: build\n\nbuild: $(OBJ)\n\t$(CC) $(CFLAGS) -o app $^\n\nclean:\n\trm -f $(OBJ) app\n\ntest: build\n\t./app --test\n\n.PHONY: all build clean test\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'Dockerfile'), 'FROM node:20-slim\n\nWORKDIR /app\n\nCOPY package*.json ./\nRUN npm ci --production\n\nCOPY . .\n\nEXPOSE 8086\n\nCMD ["node", "server.js"]\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'README.md'), _MARKDOWN_CONTENT); _counts.document++;
	_writeFile(libPath.join(tmpDir, '.gitignore'), 'node_modules/\ncoverage/\n.nyc_output/\n*.log\n.env\ndist/\n.DS_Store\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, '.eslintrc.json'), JSON.stringify({ env: { node: true, es2021: true }, extends: 'eslint:recommended', rules: { 'no-unused-vars': 'warn', 'no-console': 'off', indent: ['error', 'tab'] } }, null, '\t')); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'helpers.sh'), '#!/bin/bash\n# Deployment helper script\nset -euo pipefail\n\nAPP_NAME="retold-remote"\nDEPLOY_DIR="/opt/$APP_NAME"\n\nlog() {\n  echo "[$(date +\'%Y-%m-%d %H:%M:%S\')] $1"\n}\n\nlog "Starting deployment of $APP_NAME"\nnpm ci --production\nlog "Dependencies installed"\nnpm test || { log "Tests failed"; exit 1; }\nlog "Tests passed"\nrsync -avz --delete ./ "$DEPLOY_DIR/"\nlog "Deployment complete"\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'middleware.ts'), '/**\n * Express middleware for request logging and authentication.\n */\nimport { Request, Response, NextFunction } from \'express\';\n\ninterface AuthPayload {\n\tuserId: string;\n\trole: \'admin\' | \'user\' | \'guest\';\n\texp: number;\n}\n\nexport function requestLogger(req: Request, _res: Response, next: NextFunction): void\n{\n\tconst start = Date.now();\n\tconst method = req.method;\n\tconst url = req.originalUrl;\n\n\t_res.on(\'finish\', () =>\n\t{\n\t\tconst duration = Date.now() - start;\n\t\tconsole.log(`${method} ${url} ${_res.statusCode} ${duration}ms`);\n\t});\n\n\tnext();\n}\n\nexport function authenticate(req: Request, res: Response, next: NextFunction): void\n{\n\tconst token = req.headers.authorization?.replace(\'Bearer \', \'\');\n\tif (!token)\n\t{\n\t\tres.status(401).json({ error: \'Authentication required\' });\n\t\treturn;\n\t}\n\tnext();\n}\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'schema.graphql'), 'type Query {\n\tusers(limit: Int = 10, offset: Int = 0): [User!]!\n\tuser(id: ID!): User\n\tposts(filter: PostFilter): [Post!]!\n}\n\ntype Mutation {\n\tcreateUser(input: CreateUserInput!): User!\n\tupdateUser(id: ID!, input: UpdateUserInput!): User!\n\tdeleteUser(id: ID!): Boolean!\n\tcreatePost(input: CreatePostInput!): Post!\n}\n\ntype User {\n\tid: ID!\n\tname: String!\n\temail: String!\n\trole: Role!\n\tposts: [Post!]!\n\tcreatedAt: DateTime!\n}\n\ntype Post {\n\tid: ID!\n\ttitle: String!\n\tcontent: String!\n\tauthor: User!\n\ttags: [String!]!\n\tpublished: Boolean!\n\tcreatedAt: DateTime!\n}\n\nenum Role {\n\tADMIN\n\tUSER\n\tGUEST\n}\n\ninput CreateUserInput {\n\tname: String!\n\temail: String!\n\trole: Role = USER\n}\n\ninput UpdateUserInput {\n\tname: String\n\temail: String\n\trole: Role\n}\n\ninput PostFilter {\n\tpublished: Boolean\n\ttag: String\n\tauthorId: ID\n}\n\ninput CreatePostInput {\n\ttitle: String!\n\tcontent: String!\n\ttags: [String!]\n}\n\nscalar DateTime\n'); _counts.document++;

	// ── Projects / Documents ─────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Projects', 'Documents');
	_ensureDir(tmpDir);
	_writeFile(libPath.join(tmpDir, 'meeting-notes-q1.md'), '# Q1 Meeting Notes\n\n## January 15\n\n- Discussed roadmap priorities\n- Agreed on sprint schedule\n- Action items:\n  1. Set up CI pipeline\n  2. Review design mockups\n  3. Schedule user testing\n\n## February 12\n\n- Sprint retrospective\n- Demo of new dashboard\n- Performance improvements needed\n\n## March 8\n\n- Quarter review\n- Budget allocation for Q2\n- Team hiring plan\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'api-spec.md'), '# API Specification\n\n## Authentication\n\nAll endpoints require a Bearer token in the Authorization header.\n\n## Endpoints\n\n### GET /api/users\n\nReturns a paginated list of users.\n\n**Parameters:**\n- `page` (int) — Page number, default 1\n- `limit` (int) — Items per page, default 20\n\n**Response:**\n```json\n{\n  "data": [...],\n  "total": 150,\n  "page": 1\n}\n```\n\n### POST /api/users\n\nCreate a new user.\n\n**Body:**\n```json\n{\n  "name": "string",\n  "email": "string"\n}\n```\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'changelog.txt'), 'CHANGELOG\n=========\n\nv2.1.0 (2026-03-01)\n- Added audio waveform explorer\n- Added video frame selection\n- Fixed thumbnail caching for large files\n- Improved dark theme contrast\n\nv2.0.0 (2026-01-15)\n- Major UI rewrite\n- Added collection system\n- 15 built-in themes\n- Archive browsing support\n\nv1.5.0 (2025-10-01)\n- Added video explorer\n- VLC streaming integration\n- Keyboard navigation overhaul\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'inventory.csv'), _CSV_CONTENT); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'todo-list.txt'), '[ ] Finalize API documentation\n[ ] Write integration tests for collection endpoints\n[x] Fix thumbnail caching race condition\n[x] Add keyboard shortcut help panel\n[ ] Optimize waveform rendering for long audio files\n[ ] Add drag-and-drop file upload\n[x] Implement favorites system\n[ ] Support HEIC image thumbnails\n[ ] Add batch file operations UI\n[ ] Write deployment documentation\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'license.txt'), 'MIT License\n\nCopyright (c) 2026 Example Corp\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'architecture-notes.md'), '# Architecture Notes\n\n## Service Provider Pattern\n\nAll modules extend `fable-serviceproviderbase` and register with a Fable instance.\nServices get access to logging, configuration, and other services through DI.\n\n## Data Flow\n\n```\nClient (Pict Views)\n  │\n  ├── REST API (Orator/Restify)\n  │     │\n  │     ├── MediaService (ffmpeg, sharp)\n  │     ├── CollectionService (Bibliograph)\n  │     └── FileBrowser (fs)\n  │\n  └── Static Files (web-application/)\n```\n\n## Caching Strategy\n\n- Thumbnails: Parime BinaryStorage, mtime-based invalidation\n- Metadata: Bibliograph JSON records, hash-based keys\n- Explorer state: Bibliograph, per-file persistence\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'environment.env'), '# Application environment variables\nNODE_ENV=production\nPORT=8086\nLOG_LEVEL=info\nCACHE_DIR=/tmp/retold-cache\nMAX_UPLOAD_SIZE=100MB\nTHUMBNAIL_QUALITY=80\nFFMPEG_TIMEOUT=30000\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'data-export.csv'), 'timestamp,event_type,user_id,duration_ms,status\n2026-01-15T10:23:45Z,page_view,usr_001,1234,success\n2026-01-15T10:24:12Z,api_call,usr_002,456,success\n2026-01-15T10:25:03Z,file_upload,usr_001,8901,success\n2026-01-15T10:26:44Z,thumbnail_gen,system,2345,success\n2026-01-15T10:27:15Z,api_call,usr_003,123,error\n2026-01-15T10:28:30Z,page_view,usr_002,987,success\n2026-01-15T10:29:01Z,collection_add,usr_001,234,success\n2026-01-15T10:30:22Z,video_explore,usr_004,5678,success\n2026-01-15T10:31:45Z,audio_segment,usr_002,3456,success\n2026-01-15T10:32:10Z,page_view,usr_005,1111,success\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'config.toml'), '[server]\nport = 8086\nhost = "0.0.0.0"\nworkers = 4\n\n[database]\nurl = "postgresql://localhost:5432/retold"\npool_size = 10\ntimeout_ms = 5000\n\n[cache]\nenabled = true\nmax_size_mb = 512\nttl_seconds = 3600\n\n[logging]\nlevel = "info"\nformat = "json"\nfile = "/var/log/retold/app.log"\n'); _counts.document++;

	// ── Projects / Archives ──────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Projects', 'Archives');
	_ensureDir(tmpDir);
	// Create zip files from existing content if zip is available
	try
	{
		let tmpCodeDir = libPath.join(_FIXTURE_ROOT, 'Projects', 'Code');
		_exec(`cd "${tmpCodeDir}" && zip -q "${libPath.join(tmpDir, 'source-code-v2.1.zip')}" server.js analyzer.py dashboard.html theme.css package.json`);
		_counts.archive++;
		_exec(`cd "${tmpCodeDir}" && zip -q "${libPath.join(tmpDir, 'config-files.zip')}" config.yaml Dockerfile Makefile .gitignore`);
		_counts.archive++;
		let tmpDocDir = libPath.join(_FIXTURE_ROOT, 'Projects', 'Documents');
		_exec(`cd "${tmpDocDir}" && zip -q "${libPath.join(tmpDir, 'documents-export.zip')}" meeting-notes-q1.md api-spec.md changelog.txt todo-list.txt`);
		_counts.archive++;
	}
	catch (_e)
	{
		console.warn('  ✗ zip not available — skipping archive generation');
	}

	// ── Short Clips (thumbnail edge case testing) ────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Short Clips');
	_ensureDir(tmpDir);
	if (_HAS_FFMPEG)
	{
		let tmpShortDurations = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 0.3];
		let tmpShortNames = ['flash-frame', 'blink', 'one-second', 'quick-cut', 'moment',
			'glimpse', 'threshold', 'brief-scene', 'three-beats', 'instant'];
		for (let i = 0; i < tmpShortDurations.length; i++)
		{
			let tmpSource = _VIDEO_SOURCES[i % _VIDEO_SOURCES.length];
			_generateVideo(
				libPath.join(tmpDir, tmpShortNames[i] + '-' + tmpShortDurations[i] + 's.mp4'),
				tmpSource.filter, tmpShortDurations[i], '640x360', 'mp4'
			);
		}
	}

	// ── Large Files ──────────────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Large Files');
	_ensureDir(tmpDir);
	if (_HAS_CONVERT)
	{
		_generateImages(tmpDir,
		[
			_plasmaImage('highres-landscape-1.jpg', 2400, 1600, 1111),
			_plasmaImage('highres-landscape-2.png', 2000, 2000, 2222),
			_gradientImage('ultrawide-panorama.jpg', 3840, 1080, '#1a1a2e', '#e94560'),
			_plasmaImage('detailed-texture.png', 2560, 1440, 3333),
			_labeledImage('poster-4k.jpg', 3840, 2160, '#1b2838', '#66c0f4', '4K TEST'),
			// Ultra-high-res images for OpenSeadragon DZI tiling tests
			_plasmaImage('massive-16k-square.jpg', 16000, 16000, 6666),
			_gradientImage('massive-16k-wide.jpg', 16000, 9000, '#0d1b2a', '#e0fbfc'),
			_plasmaImage('massive-12k-portrait.png', 8000, 12000, 7777),
			_labeledImage('massive-16k-labeled.jpg', 16384, 16384, '#1a1a2e', '#e94560', '16K TILE TEST')
		]);
	}
	if (_HAS_FFMPEG)
	{
		_generateVideoWithAudio(libPath.join(tmpDir, 'long-presentation-60s.mp4'), 'testsrc', 60, '1280x720', 440);
		_generateVideoWithAudio(libPath.join(tmpDir, 'extended-recording-90s.mp4'), 'smptebars', 90, '640x480', 330);
		_generateVideoWithAudio(libPath.join(tmpDir, 'full-session-120s.mp4'), 'testsrc2', 120, '1280x720', 523);
	}

	// ── Mixed ────────────────────────────────────────────
	tmpDir = libPath.join(_FIXTURE_ROOT, 'Mixed');
	_ensureDir(tmpDir);
	if (_HAS_CONVERT)
	{
		_generateImages(tmpDir,
		[
			_gradientImage('sample-photo-1.jpg', 800, 600, '#2c3e50', '#ecf0f1'),
			_gradientImage('sample-photo-2.png', 640, 480, '#8e44ad', '#f5b7b1'),
			_plasmaImage('abstract-art.webp', 600, 600, 4444),
			_labeledImage('presentation-slide.jpg', 1280, 720, '#ffffff', '#333333', 'Welcome'),
			_shapeImage('logo-draft.png', 400, 400, '#2c3e50', '#e74c3c', 'circle 200,200 200,100'),
			_gradientImage('banner-header.jpg', 1200, 300, '#3498db', '#2ecc71'),
			_plasmaImage('wallpaper-abstract.png', 1920, 1080, 5555),
			_labeledImage('thumbnail-template.jpg', 320, 240, '#34495e', '#bdc3c7', 'THUMB')
		]);
	}
	if (_HAS_FFMPEG)
	{
		_generateVideoWithAudio(libPath.join(tmpDir, 'screen-recording.mp4'), 'testsrc', 15, '1280x720', 440);
		_generateVideo(libPath.join(tmpDir, 'clip-montage.mp4'), 'mandelbrot', 8, '640x480', 'mp4');
		_generateVideoWithAudio(libPath.join(tmpDir, 'demo-reel.webm'), 'rgbtestsrc', 20, '1280x720', 523);
		_generateVideo(libPath.join(tmpDir, 'animation-test.mp4'), 'life=mold=10', 10, '640x360', 'mp4');

		_generateAudio(libPath.join(tmpDir, 'voice-memo.mp3'), 'sine=frequency=300', 12);
		_generateAudio(libPath.join(tmpDir, 'sound-effect.wav'), 'sine=frequency=880', 3);
		_generateAudio(libPath.join(tmpDir, 'ambient-loop.ogg'), 'anoisesrc=c=pink:a=0.3', 20);
		_generateAudio(libPath.join(tmpDir, 'notification-chime.mp3'), 'sine=frequency=523', 2);
	}
	_writeFile(libPath.join(tmpDir, 'notes.md'), '# Quick Notes\n\n- Review this folder for mixed content testing\n- All file types should appear with correct icons and thumbnails\n- Videos should generate thumbnails when ffmpeg is available\n'); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'data.json'), JSON.stringify({ items: [{ id: 1, name: 'Alpha' }, { id: 2, name: 'Beta' }, { id: 3, name: 'Gamma' }] }, null, '\t')); _counts.document++;
	_writeFile(libPath.join(tmpDir, 'readme.txt'), 'This folder contains a mix of images, videos, audio, and documents.\nUse it to test gallery sorting, filtering, and thumbnail generation.\n'); _counts.document++;

	return _FIXTURE_ROOT;
}

// ── Summary ──────────────────────────────────────────────

function _printSummary(pPath)
{
	let tmpTotal = _counts.image + _counts.video + _counts.audio + _counts.document + _counts.archive;
	let tmpSize = _getDirSize(pPath);

	console.log('\n══════════════════════════════════════════════════════════');
	console.log('  Media Fixture Generation Complete');
	console.log('══════════════════════════════════════════════════════════');
	console.log(`  Location:   ${pPath}`);
	console.log(`  Total Size: ${_formatSize(tmpSize)}`);
	console.log('');
	console.log(`  Images:     ${_counts.image}`);
	console.log(`  Videos:     ${_counts.video}`);
	console.log(`  Audio:      ${_counts.audio}`);
	console.log(`  Documents:  ${_counts.document}`);
	console.log(`  Archives:   ${_counts.archive}`);
	console.log(`  ─────────────────`);
	console.log(`  Total:      ${tmpTotal} files`);
	if (_errors > 0)
	{
		console.log(`  Errors:     ${_errors} (skipped)`);
	}
	console.log('══════════════════════════════════════════════════════════\n');
}

function _getDirSize(pDir)
{
	let tmpSize = 0;
	try
	{
		let tmpEntries = libFs.readdirSync(pDir, { withFileTypes: true });
		for (let i = 0; i < tmpEntries.length; i++)
		{
			let tmpPath = libPath.join(pDir, tmpEntries[i].name);
			if (tmpEntries[i].isDirectory())
			{
				tmpSize += _getDirSize(tmpPath);
			}
			else
			{
				tmpSize += libFs.statSync(tmpPath).size;
			}
		}
	}
	catch (_e) { /* skip */ }
	return tmpSize;
}

function _formatSize(pBytes)
{
	if (pBytes < 1024) return pBytes + ' B';
	if (pBytes < 1024 * 1024) return (pBytes / 1024).toFixed(1) + ' KB';
	if (pBytes < 1024 * 1024 * 1024) return (pBytes / (1024 * 1024)).toFixed(1) + ' MB';
	return (pBytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// ── Main ─────────────────────────────────────────────────

let tmpPath = generate();
_printSummary(tmpPath);

if (process.argv.includes('--serve'))
{
	let tmpSetupServer = require('../source/cli/RetoldRemote-Server-Setup.js');
	let tmpPort = 9005;
	for (let i = 0; i < process.argv.length; i++)
	{
		if ((process.argv[i] === '-p' || process.argv[i] === '--port') && process.argv[i + 1])
		{
			tmpPort = parseInt(process.argv[i + 1], 10) || tmpPort;
		}
	}

	tmpSetupServer(
		{
			ContentPath: tmpPath,
			DistPath: libPath.join(__dirname, '..', 'web-application'),
			Port: tmpPort,
			HashedFilenames: !process.argv.includes('--no-hash')
		},
		function (pError, pServerInfo)
		{
			if (pError)
			{
				console.error('Failed to start server:', pError.message);
				process.exit(1);
			}
			pServerInfo.Fable.log.info('==========================================================');
			pServerInfo.Fable.log.info(`  Media fixtures at: ${tmpPath}`);
			pServerInfo.Fable.log.info(`  Browse: http://localhost:${pServerInfo.Port}/`);
			pServerInfo.Fable.log.info('==========================================================');
		});
}
