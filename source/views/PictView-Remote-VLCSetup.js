const libPictView = require('pict-view');

const _ViewConfiguration =
{
	ViewIdentifier: "RetoldRemote-VLCSetup",
	DefaultRenderable: "RetoldRemote-VLCSetup",
	DefaultDestinationAddress: "#ContentEditor-Application-Container",
	AutoRender: false,

	CSS: /*css*/`
		.retold-remote-vlc-modal-backdrop
		{
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(0, 0, 0, 0.6);
			z-index: 9000;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.retold-remote-vlc-modal
		{
			background: var(--retold-bg-tertiary);
			border: 1px solid var(--retold-border);
			border-radius: 8px;
			width: 600px;
			max-width: 90vw;
			max-height: 85vh;
			display: flex;
			flex-direction: column;
			box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		}
		.retold-remote-vlc-modal-header
		{
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 14px 18px;
			border-bottom: 1px solid var(--retold-border);
			flex-shrink: 0;
		}
		.retold-remote-vlc-modal-title
		{
			font-size: 0.85rem;
			font-weight: 700;
			color: var(--retold-text-primary);
		}
		.retold-remote-vlc-modal-close
		{
			border: none;
			background: transparent;
			color: var(--retold-text-muted);
			font-size: 1.1rem;
			cursor: pointer;
			padding: 2px 6px;
			border-radius: 3px;
			font-family: inherit;
			line-height: 1;
		}
		.retold-remote-vlc-modal-close:hover
		{
			background: var(--retold-bg-hover);
			color: var(--retold-text-primary);
		}
		.retold-remote-vlc-modal-body
		{
			flex: 1;
			overflow-y: auto;
			padding: 18px;
		}
		.retold-remote-vlc-setup-section
		{
			margin-bottom: 18px;
		}
		.retold-remote-vlc-setup-section-title
		{
			font-size: 0.7rem;
			font-weight: 700;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--retold-text-dim);
			margin-bottom: 8px;
		}
		.retold-remote-vlc-setup-desc
		{
			font-size: 0.75rem;
			color: var(--retold-text-secondary);
			line-height: 1.5;
			margin-bottom: 8px;
		}
		.retold-remote-vlc-setup-status
		{
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 8px;
			border-radius: 4px;
			background: var(--retold-bg-secondary);
			margin-bottom: 12px;
			font-size: 0.75rem;
			color: var(--retold-text-secondary);
		}
		.retold-remote-vlc-setup-status-dot
		{
			width: 8px;
			height: 8px;
			border-radius: 50%;
			flex-shrink: 0;
		}
		.retold-remote-vlc-setup-status-dot.detected
		{
			background: var(--retold-accent);
		}
		.retold-remote-vlc-setup-status-dot.unknown
		{
			background: var(--retold-text-dim);
		}
		.retold-remote-vlc-setup-platform
		{
			display: none;
		}
		.retold-remote-vlc-setup-platform.active
		{
			display: block;
		}
		.retold-remote-vlc-setup-platform-tabs
		{
			display: flex;
			gap: 0;
			margin-bottom: 12px;
			border-bottom: 1px solid var(--retold-border);
		}
		.retold-remote-vlc-setup-platform-tab
		{
			padding: 6px 12px;
			border: none;
			background: transparent;
			font-size: 0.72rem;
			font-weight: 600;
			color: var(--retold-text-muted);
			cursor: pointer;
			border-bottom: 2px solid transparent;
			font-family: inherit;
		}
		.retold-remote-vlc-setup-platform-tab:hover
		{
			color: var(--retold-text-secondary);
		}
		.retold-remote-vlc-setup-platform-tab.active
		{
			color: var(--retold-accent);
			border-bottom-color: var(--retold-accent);
		}
		.retold-remote-vlc-setup-code
		{
			background: var(--retold-bg-primary);
			border: 1px solid var(--retold-border);
			border-radius: 4px;
			padding: 10px;
			font-family: "SF Mono", "Fira Code", "Consolas", monospace;
			font-size: 0.68rem;
			color: var(--retold-text-secondary);
			line-height: 1.6;
			overflow-x: auto;
			white-space: pre;
			margin-bottom: 8px;
			tab-size: 4;
		}
		.retold-remote-vlc-setup-btn
		{
			display: inline-block;
			padding: 6px 14px;
			border: 1px solid var(--retold-border);
			border-radius: 4px;
			background: var(--retold-bg-secondary);
			color: var(--retold-text-secondary);
			font-size: 0.72rem;
			font-family: inherit;
			cursor: pointer;
			transition: background 0.15s, color 0.15s;
			margin-right: 6px;
			margin-bottom: 6px;
		}
		.retold-remote-vlc-setup-btn:hover
		{
			background: var(--retold-bg-hover);
			color: var(--retold-text-primary);
		}
		.retold-remote-vlc-setup-btn.primary
		{
			background: var(--retold-accent);
			border-color: var(--retold-accent);
			color: #fff;
		}
		.retold-remote-vlc-setup-btn.primary:hover
		{
			opacity: 0.85;
		}
		.retold-remote-vlc-setup-step
		{
			display: flex;
			gap: 10px;
			margin-bottom: 10px;
		}
		.retold-remote-vlc-setup-step-num
		{
			flex-shrink: 0;
			width: 20px;
			height: 20px;
			border-radius: 50%;
			background: var(--retold-accent);
			color: #fff;
			font-size: 0.65rem;
			font-weight: 700;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.retold-remote-vlc-setup-step-content
		{
			flex: 1;
			font-size: 0.75rem;
			color: var(--retold-text-secondary);
			line-height: 1.5;
		}
		.retold-remote-vlc-setup-note
		{
			font-size: 0.7rem;
			color: var(--retold-text-dim);
			font-style: italic;
			margin-top: 4px;
		}
		.retold-remote-toast
		{
			position: fixed;
			bottom: 20px;
			left: 50%;
			transform: translateX(-50%);
			background: var(--retold-bg-secondary);
			color: var(--retold-accent);
			padding: 8px 16px;
			border-radius: 4px;
			font-size: 0.75rem;
			z-index: 10000;
			pointer-events: none;
			border: 1px solid var(--retold-border);
		}
	`
};

class RetoldRemoteVLCSetupView extends libPictView
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._activePlatformTab = this._detectPlatform();
		this._modalVisible = false;
		this._boundKeyHandler = null;
	}

	_detectPlatform()
	{
		let tmpUA = (typeof navigator !== 'undefined') ? navigator.userAgent : '';
		if (/iPhone|iPad|iPod/i.test(tmpUA))
		{
			return 'ios';
		}
		// iPadOS 13+ sends a macOS user agent — detect via maxTouchPoints
		if (/Macintosh/i.test(tmpUA) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1)
		{
			return 'ios';
		}
		if (/Android/i.test(tmpUA))
		{
			return 'android';
		}
		if (/Macintosh|Mac OS X/.test(tmpUA))
		{
			return 'macos';
		}
		if (/Windows/.test(tmpUA))
		{
			return 'windows';
		}
		return 'linux';
	}

	openModal()
	{
		if (this._modalVisible)
		{
			return;
		}
		this._modalVisible = true;

		// Create the backdrop
		let tmpBackdrop = document.createElement('div');
		tmpBackdrop.className = 'retold-remote-vlc-modal-backdrop';
		tmpBackdrop.id = 'RetoldRemote-VLCSetup-Backdrop';
		tmpBackdrop.onclick = (pEvent) =>
		{
			if (pEvent.target === tmpBackdrop)
			{
				this.closeModal();
			}
		};

		// Create the modal
		let tmpModal = document.createElement('div');
		tmpModal.className = 'retold-remote-vlc-modal';

		// Header
		let tmpHeader = document.createElement('div');
		tmpHeader.className = 'retold-remote-vlc-modal-header';
		tmpHeader.innerHTML = '<span class="retold-remote-vlc-modal-title">VLC Protocol Setup</span>'
			+ '<button class="retold-remote-vlc-modal-close" onclick="pict.views[\'RetoldRemote-VLCSetup\'].closeModal()">X</button>';

		// Body
		let tmpBody = document.createElement('div');
		tmpBody.className = 'retold-remote-vlc-modal-body';
		tmpBody.id = 'RetoldRemote-VLCSetup-Container';

		tmpModal.appendChild(tmpHeader);
		tmpModal.appendChild(tmpBody);
		tmpBackdrop.appendChild(tmpModal);
		document.body.appendChild(tmpBackdrop);

		// Render content into the body
		this._renderVLCSetupContent();

		// Escape key handler
		this._boundKeyHandler = (pEvent) =>
		{
			if (pEvent.key === 'Escape')
			{
				pEvent.preventDefault();
				pEvent.stopPropagation();
				this.closeModal();
			}
		};
		document.addEventListener('keydown', this._boundKeyHandler, true);
	}

	closeModal()
	{
		if (!this._modalVisible)
		{
			return;
		}
		this._modalVisible = false;

		let tmpBackdrop = document.getElementById('RetoldRemote-VLCSetup-Backdrop');
		if (tmpBackdrop)
		{
			tmpBackdrop.remove();
		}

		if (this._boundKeyHandler)
		{
			document.removeEventListener('keydown', this._boundKeyHandler, true);
			this._boundKeyHandler = null;
		}
	}

	switchPlatformTab(pTab)
	{
		this._activePlatformTab = pTab;
		this._renderVLCSetupContent();
	}

	_renderVLCSetupContent()
	{
		let tmpContainer = document.getElementById('RetoldRemote-VLCSetup-Container');
		if (!tmpContainer)
		{
			return;
		}

		let tmpPlatform = this._activePlatformTab;
		let tmpHTML = '';

		// Description
		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-desc">';
		tmpHTML += 'Stream media directly in VLC from the browser. Press <b>v</b> in the media viewer to launch VLC with the current file.';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		// Platform status
		tmpHTML += '<div class="retold-remote-vlc-setup-status">';
		tmpHTML += '<div class="retold-remote-vlc-setup-status-dot ' + (this._detectPlatform() === tmpPlatform ? 'detected' : 'unknown') + '"></div>';
		tmpHTML += '<span>Detected platform: <b>' + this._getPlatformLabel(this._detectPlatform()) + '</b></span>';
		tmpHTML += '</div>';

		// Platform tabs
		tmpHTML += '<div class="retold-remote-vlc-setup-platform-tabs">';
		tmpHTML += this._buildPlatformTab('ios', 'iOS', tmpPlatform);
		tmpHTML += this._buildPlatformTab('android', 'Android', tmpPlatform);
		tmpHTML += this._buildPlatformTab('macos', 'macOS', tmpPlatform);
		tmpHTML += this._buildPlatformTab('windows', 'Windows', tmpPlatform);
		tmpHTML += this._buildPlatformTab('linux', 'Linux', tmpPlatform);
		tmpHTML += '</div>';

		// Platform-specific content
		tmpHTML += this._buildIOSContent(tmpPlatform);
		tmpHTML += this._buildAndroidContent(tmpPlatform);
		tmpHTML += this._buildMacOSContent(tmpPlatform);
		tmpHTML += this._buildWindowsContent(tmpPlatform);
		tmpHTML += this._buildLinuxContent(tmpPlatform);

		// Test section
		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Test</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-desc">';
		tmpHTML += 'Click below to test whether the vlc:// protocol handler is registered. VLC should open.';
		tmpHTML += '</div>';
		tmpHTML += '<button class="retold-remote-vlc-setup-btn" onclick="pict.views[\'RetoldRemote-VLCSetup\'].testProtocol()">Test VLC Protocol</button>';
		tmpHTML += '</div>';

		tmpContainer.innerHTML = tmpHTML;
	}

	_buildPlatformTab(pKey, pLabel, pActive)
	{
		let tmpClass = 'retold-remote-vlc-setup-platform-tab';
		if (pKey === pActive)
		{
			tmpClass += ' active';
		}
		return '<button class="' + tmpClass + '" onclick="pict.views[\'RetoldRemote-VLCSetup\'].switchPlatformTab(\'' + pKey + '\')">' + pLabel + '</button>';
	}

	_getPlatformLabel(pKey)
	{
		if (pKey === 'ios') return 'iOS';
		if (pKey === 'android') return 'Android';
		if (pKey === 'macos') return 'macOS';
		if (pKey === 'windows') return 'Windows';
		return 'Linux';
	}

	_buildIOSContent(pActive)
	{
		let tmpClass = 'retold-remote-vlc-setup-platform' + (pActive === 'ios' ? ' active' : '');
		let tmpHTML = '<div class="' + tmpClass + '" data-platform="ios">';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Setup (iOS)</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-desc">';
		tmpHTML += 'VLC for iOS registers the vlc:// protocol handler automatically when installed. No additional setup is needed.';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Installation</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">1</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Install <b>VLC for Mobile</b> from the App Store if you haven\'t already.</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">2</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Tap the <b>Stream with VLC</b> button on any video or audio file. Safari will ask to open VLC — tap <b>Open</b>.</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-note">If Safari shows "Cannot Open Page", VLC may not be installed or may need to be updated.</div>';
		tmpHTML += '</div>';

		tmpHTML += '</div>';
		return tmpHTML;
	}

	_buildAndroidContent(pActive)
	{
		let tmpClass = 'retold-remote-vlc-setup-platform' + (pActive === 'android' ? ' active' : '');
		let tmpHTML = '<div class="' + tmpClass + '" data-platform="android">';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Setup (Android)</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-desc">';
		tmpHTML += 'VLC for Android registers the vlc:// protocol handler automatically when installed. No additional setup is needed.';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Installation</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">1</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Install <b>VLC for Android</b> from the Google Play Store if you haven\'t already.</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">2</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Tap the <b>Stream with VLC</b> button on any video or audio file. Your browser will ask to open VLC — tap <b>Open</b>.</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-note">If your browser shows an error, VLC may not be installed or may need to be updated.</div>';
		tmpHTML += '</div>';

		tmpHTML += '</div>';
		return tmpHTML;
	}

	_buildMacOSContent(pActive)
	{
		let tmpClass = 'retold-remote-vlc-setup-platform' + (pActive === 'macos' ? ' active' : '');
		let tmpHTML = '<div class="' + tmpClass + '" data-platform="macos">';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Setup (macOS)</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-desc">';
		tmpHTML += 'VLC on macOS does not register a vlc:// protocol handler by default. ';
		tmpHTML += 'An AppleScript app bundle is needed to bridge vlc:// links to VLC. ';
		tmpHTML += 'Run the command below in Terminal to create and register the handler automatically.';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Automatic Setup</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-desc">';
		tmpHTML += 'Copy and paste this into Terminal:';
		tmpHTML += '</div>';

		let tmpScript = this._getMacSetupScript();
		tmpHTML += '<div class="retold-remote-vlc-setup-code">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpScript) + '</div>';
		tmpHTML += '<button class="retold-remote-vlc-setup-btn primary" onclick="pict.views[\'RetoldRemote-VLCSetup\'].copyMacSetup()">Copy to Clipboard</button>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">What This Does</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">1</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Creates an AppleScript at <code>/tmp/VLCProtocol.applescript</code> that handles vlc:// URLs</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">2</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Compiles it into an app bundle at <code>/Applications/VLCProtocol.app</code></div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">3</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Adds the vlc:// URL scheme to the app\'s Info.plist</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">4</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Registers the protocol handler with macOS Launch Services</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-note">Requires VLC installed at /Applications/VLC.app and Python 3 (included with macOS).</div>';
		tmpHTML += '</div>';

		tmpHTML += '</div>';
		return tmpHTML;
	}

	_buildWindowsContent(pActive)
	{
		let tmpClass = 'retold-remote-vlc-setup-platform' + (pActive === 'windows' ? ' active' : '');
		let tmpHTML = '<div class="' + tmpClass + '" data-platform="windows">';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Setup (Windows)</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-desc">';
		tmpHTML += 'VLC on Windows registers the vlc:// protocol handler during installation. ';
		tmpHTML += 'If it is not working, you can re-register it by saving and running the registry file below.';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Option A: Reinstall VLC</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">1</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Reinstall VLC and ensure "Register VLC as handler for vlc:// protocol" is checked during installation.</div>';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Option B: Registry File</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-desc">';
		tmpHTML += 'Save this as <code>vlc-protocol.reg</code> and double-click to import. ';
		tmpHTML += 'Adjust the VLC path if yours differs.';
		tmpHTML += '</div>';

		let tmpRegFile = this._getWindowsRegFile();
		tmpHTML += '<div class="retold-remote-vlc-setup-code">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpRegFile) + '</div>';
		tmpHTML += '<button class="retold-remote-vlc-setup-btn primary" onclick="pict.views[\'RetoldRemote-VLCSetup\'].copyWindowsReg()">Copy to Clipboard</button>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Option C: Batch Script</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-desc">';
		tmpHTML += 'Alternatively, save this as <code>vlc-protocol-setup.bat</code> and run as Administrator. ';
		tmpHTML += 'This creates a wrapper script that URL-decodes the vlc:// link before passing it to VLC.';
		tmpHTML += '</div>';

		let tmpBatchScript = this._getWindowsBatchScript();
		tmpHTML += '<div class="retold-remote-vlc-setup-code">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpBatchScript) + '</div>';
		tmpHTML += '<button class="retold-remote-vlc-setup-btn primary" onclick="pict.views[\'RetoldRemote-VLCSetup\'].copyWindowsBatch()">Copy to Clipboard</button>';
		tmpHTML += '</div>';

		tmpHTML += '</div>';
		return tmpHTML;
	}

	_buildLinuxContent(pActive)
	{
		let tmpClass = 'retold-remote-vlc-setup-platform' + (pActive === 'linux' ? ' active' : '');
		let tmpHTML = '<div class="' + tmpClass + '" data-platform="linux">';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Setup (Linux)</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-desc">';
		tmpHTML += 'Register a vlc:// protocol handler using a .desktop file and xdg-mime. ';
		tmpHTML += 'Run the command below in a terminal.';
		tmpHTML += '</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">Setup Command</div>';

		let tmpScript = this._getLinuxSetupScript();
		tmpHTML += '<div class="retold-remote-vlc-setup-code">' + this.pict.providers['RetoldRemote-FormattingUtilities'].escapeHTML(tmpScript) + '</div>';
		tmpHTML += '<button class="retold-remote-vlc-setup-btn primary" onclick="pict.views[\'RetoldRemote-VLCSetup\'].copyLinuxSetup()">Copy to Clipboard</button>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-section">';
		tmpHTML += '<div class="retold-remote-vlc-setup-section-title">What This Does</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">1</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Creates a handler script at <code>~/.local/bin/vlc-protocol</code> that URL-decodes and opens VLC</div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">2</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Creates a .desktop file at <code>~/.local/share/applications/vlc-protocol.desktop</code></div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-step">';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-num">3</div>';
		tmpHTML += '<div class="retold-remote-vlc-setup-step-content">Registers vlc:// as a URL scheme via <code>xdg-mime</code></div>';
		tmpHTML += '</div>';

		tmpHTML += '<div class="retold-remote-vlc-setup-note">Requires VLC and Python 3 installed.</div>';
		tmpHTML += '</div>';

		tmpHTML += '</div>';
		return tmpHTML;
	}

	_getMacSetupScript()
	{
		return [
			"# Create the AppleScript handler",
			"cat > /tmp/VLCProtocol.applescript << 'EOF'",
			"on open location theURL",
			"\tset theURL to text 7 thru -1 of theURL",
			"\tset theURL to do shell script \"python3 -c 'import sys, urllib.parse; print(urllib.parse.unquote(sys.argv[1]))' \" & quoted form of theURL",
			"\tdo shell script \"open -a VLC \" & quoted form of theURL",
			"end open location",
			"EOF",
			"",
			"# Compile into app bundle",
			"osacompile -o /Applications/VLCProtocol.app /tmp/VLCProtocol.applescript",
			"",
			"# Add vlc:// URL scheme to Info.plist",
			"/usr/libexec/PlistBuddy -c \"Add :CFBundleURLTypes array\" \\",
			"  /Applications/VLCProtocol.app/Contents/Info.plist 2>/dev/null",
			"/usr/libexec/PlistBuddy -c \"Add :CFBundleURLTypes:0 dict\" \\",
			"  /Applications/VLCProtocol.app/Contents/Info.plist 2>/dev/null",
			"/usr/libexec/PlistBuddy -c \"Add :CFBundleURLTypes:0:CFBundleURLName string 'VLC Protocol'\" \\",
			"  /Applications/VLCProtocol.app/Contents/Info.plist 2>/dev/null",
			"/usr/libexec/PlistBuddy -c \"Add :CFBundleURLTypes:0:CFBundleURLSchemes array\" \\",
			"  /Applications/VLCProtocol.app/Contents/Info.plist 2>/dev/null",
			"/usr/libexec/PlistBuddy -c \"Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string vlc\" \\",
			"  /Applications/VLCProtocol.app/Contents/Info.plist 2>/dev/null",
			"",
			"# Register with Launch Services",
			"/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \\",
			"  -f /Applications/VLCProtocol.app",
			"",
			"echo \"VLC protocol handler installed successfully.\""
		].join('\n');
	}

	_getWindowsRegFile()
	{
		return [
			"Windows Registry Editor Version 5.00",
			"",
			"[HKEY_CLASSES_ROOT\\vlc]",
			"@=\"URL:VLC Protocol\"",
			"\"URL Protocol\"=\"\"",
			"",
			"[HKEY_CLASSES_ROOT\\vlc\\shell]",
			"",
			"[HKEY_CLASSES_ROOT\\vlc\\shell\\open]",
			"",
			"[HKEY_CLASSES_ROOT\\vlc\\shell\\open\\command]",
			"@=\"\\\"C:\\\\Program Files\\\\VideoLAN\\\\VLC\\\\vlc.exe\\\" \\\"%1\\\"\""
		].join('\n');
	}

	_getWindowsBatchScript()
	{
		return [
			"@echo off",
			"REM VLC Protocol Handler Setup for Windows",
			"REM Run this as Administrator",
			"",
			"REM Create the handler script",
			"mkdir \"%APPDATA%\\VLCProtocol\" 2>nul",
			"(",
			"echo import sys, urllib.parse, subprocess",
			"echo url = sys.argv[1] if len(sys.argv^) ^> 1 else ''",
			"echo if url.startswith('vlc://'^): url = url[6:]",
			"echo url = urllib.parse.unquote(url^)",
			"echo subprocess.Popen(['C:\\\\Program Files\\\\VideoLAN\\\\VLC\\\\vlc.exe', url]^)",
			") > \"%APPDATA%\\VLCProtocol\\handler.py\"",
			"",
			"REM Register the protocol in the registry",
			"reg add \"HKCU\\Software\\Classes\\vlc\" /ve /d \"URL:VLC Protocol\" /f",
			"reg add \"HKCU\\Software\\Classes\\vlc\" /v \"URL Protocol\" /d \"\" /f",
			"reg add \"HKCU\\Software\\Classes\\vlc\\shell\\open\\command\" /ve /d \"pythonw \\\"%APPDATA%\\VLCProtocol\\handler.py\\\" \\\"%%1\\\"\" /f",
			"",
			"echo VLC protocol handler installed successfully.",
			"pause"
		].join('\n');
	}

	_getLinuxSetupScript()
	{
		return [
			"# Create handler script",
			"mkdir -p ~/.local/bin",
			"cat > ~/.local/bin/vlc-protocol << 'EOF'",
			"#!/bin/bash",
			"URL=\"$1\"",
			"URL=\"${URL#vlc://}\"",
			"URL=$(python3 -c \"import sys, urllib.parse; print(urllib.parse.unquote(sys.argv[1]))\" \"$URL\")",
			"exec vlc \"$URL\" &",
			"EOF",
			"chmod +x ~/.local/bin/vlc-protocol",
			"",
			"# Create .desktop file",
			"cat > ~/.local/share/applications/vlc-protocol.desktop << 'EOF'",
			"[Desktop Entry]",
			"Name=VLC Protocol Handler",
			"Exec=bash -c '~/.local/bin/vlc-protocol %u'",
			"Type=Application",
			"NoDisplay=true",
			"MimeType=x-scheme-handler/vlc;",
			"EOF",
			"",
			"# Register the handler",
			"xdg-mime default vlc-protocol.desktop x-scheme-handler/vlc",
			"update-desktop-database ~/.local/share/applications/",
			"",
			"echo \"VLC protocol handler installed successfully.\""
		].join('\n');
	}

	_copyToClipboard(pText, pLabel)
	{
		if (navigator.clipboard && navigator.clipboard.writeText)
		{
			navigator.clipboard.writeText(pText).then(() =>
			{
				this.pict.providers['RetoldRemote-ToastNotification'].showToast(pLabel + ' copied to clipboard');
			}).catch(() =>
			{
				this._fallbackCopy(pText, pLabel);
			});
		}
		else
		{
			this._fallbackCopy(pText, pLabel);
		}
	}

	_fallbackCopy(pText, pLabel)
	{
		let tmpTextarea = document.createElement('textarea');
		tmpTextarea.value = pText;
		tmpTextarea.style.position = 'fixed';
		tmpTextarea.style.left = '-9999px';
		document.body.appendChild(tmpTextarea);
		tmpTextarea.select();
		try
		{
			document.execCommand('copy');
			this.pict.providers['RetoldRemote-ToastNotification'].showToast(pLabel + ' copied to clipboard');
		}
		catch (pErr)
		{
			this.pict.providers['RetoldRemote-ToastNotification'].showToast('Failed to copy - please select and copy manually');
		}
		document.body.removeChild(tmpTextarea);
	}

	copyMacSetup()
	{
		this._copyToClipboard(this._getMacSetupScript(), 'macOS setup script');
	}

	copyWindowsReg()
	{
		this._copyToClipboard(this._getWindowsRegFile(), 'Registry file');
	}

	copyWindowsBatch()
	{
		this._copyToClipboard(this._getWindowsBatchScript(), 'Batch script');
	}

	copyLinuxSetup()
	{
		this._copyToClipboard(this._getLinuxSetupScript(), 'Linux setup script');
	}

	testProtocol()
	{
		let tmpIsWindows = /Windows/.test(navigator.userAgent);
		let tmpIsMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
		let tmpSampleURL = 'https://www.sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4';
		let tmpTestURL = (tmpIsWindows || tmpIsMobile)
			? ('vlc://' + tmpSampleURL)
			: ('vlc://' + encodeURIComponent(tmpSampleURL));
		let tmpLink = document.createElement('a');
		tmpLink.href = tmpTestURL;
		tmpLink.style.display = 'none';
		document.body.appendChild(tmpLink);
		tmpLink.click();
		document.body.removeChild(tmpLink);
	}
}

RetoldRemoteVLCSetupView.default_configuration = _ViewConfiguration;

module.exports = RetoldRemoteVLCSetupView;
