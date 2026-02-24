const libPictProvider = require('pict-provider');

const _ProviderConfiguration =
{
	ProviderIdentifier: 'RetoldRemote-Theme',
	AutoInitialize: true,
	AutoInitializeOrdinal: 0
};

/**
 * Theme provider for retold-remote.
 *
 * Manages 15 themes (5 grey-only + 10 fun) via CSS custom properties.
 * Injects a <style id="retold-remote-theme"> block into <head> with
 * :root { --retold-* } variables.  Calls the icon provider's setColors()
 * to keep SVG icons in sync with the active theme.
 */
class RetoldRemoteThemeProvider extends libPictProvider
{
	constructor(pFable, pOptions, pServiceHash)
	{
		super(pFable, pOptions, pServiceHash);

		this._themes = {};
		this._themeOrder = [];
		this._currentTheme = 'twilight';

		this._buildThemes();
	}

	_buildThemes()
	{
		let tmpSelf = this;

		// ===================================================================
		// GREY-ONLY THEMES (pure greyscale, no hue)
		// ===================================================================

		tmpSelf._addTheme('daylight',
		{
			Name: 'Daylight',
			Category: 'Grey',
			Description: 'Bright white, dark text',
			Variables:
			{
				'--retold-bg-primary': '#FFFFFF',
				'--retold-bg-secondary': '#F0F0F0',
				'--retold-bg-tertiary': '#E8E8E8',
				'--retold-bg-panel': '#F5F5F5',
				'--retold-bg-viewer': '#FAFAFA',
				'--retold-bg-hover': '#E0E0E0',
				'--retold-bg-selected': '#C8C8C8',
				'--retold-bg-thumb': '#F0F0F0',
				'--retold-text-primary': '#1A1A1A',
				'--retold-text-secondary': '#333333',
				'--retold-text-muted': '#666666',
				'--retold-text-dim': '#888888',
				'--retold-text-placeholder': '#AAAAAA',
				'--retold-accent': '#444444',
				'--retold-accent-hover': '#222222',
				'--retold-border': '#D0D0D0',
				'--retold-border-light': '#E0E0E0',
				'--retold-danger': '#CC0000',
				'--retold-danger-muted': '#884444',
				'--retold-scrollbar': '#C0C0C0',
				'--retold-scrollbar-hover': '#A0A0A0',
				'--retold-selection-bg': 'rgba(68, 68, 68, 0.2)',
				'--retold-focus-outline': '#444444',
				'--retold-font-family': "'Segoe UI', system-ui, -apple-system, sans-serif",
				'--retold-font-mono': "'SF Mono', 'Fira Code', 'Consolas', monospace"
			},
			IconColors:
			{
				Primary: '#333333',
				Accent: '#444444',
				Muted: '#888888',
				Light: '#E8E8E8',
				WarmBeige: '#F0F0F0',
				TealTint: '#E0E0E0',
				Lavender: '#EBEBEB',
				AmberTint: '#F0EDE8',
				PdfFill: '#F0E0E0',
				PdfText: '#CC0000'
			}
		});

		tmpSelf._addTheme('afternoon',
		{
			Name: 'Afternoon',
			Category: 'Grey',
			Description: 'Warm light grey, softer contrast',
			Variables:
			{
				'--retold-bg-primary': '#E8E4E0',
				'--retold-bg-secondary': '#DAD6D2',
				'--retold-bg-tertiary': '#D0CCC8',
				'--retold-bg-panel': '#DDD9D5',
				'--retold-bg-viewer': '#F0ECE8',
				'--retold-bg-hover': '#CCC8C4',
				'--retold-bg-selected': '#B8B4B0',
				'--retold-bg-thumb': '#DAD6D2',
				'--retold-text-primary': '#2A2A2A',
				'--retold-text-secondary': '#404040',
				'--retold-text-muted': '#707070',
				'--retold-text-dim': '#909090',
				'--retold-text-placeholder': '#B0B0B0',
				'--retold-accent': '#555555',
				'--retold-accent-hover': '#333333',
				'--retold-border': '#C0BCB8',
				'--retold-border-light': '#D0CCC8',
				'--retold-danger': '#AA3333',
				'--retold-danger-muted': '#886655',
				'--retold-scrollbar': '#B8B4B0',
				'--retold-scrollbar-hover': '#A0A09C',
				'--retold-selection-bg': 'rgba(85, 85, 85, 0.2)',
				'--retold-focus-outline': '#555555',
				'--retold-font-family': "Georgia, 'Times New Roman', serif",
				'--retold-font-mono': "'Courier New', Courier, monospace"
			},
			IconColors:
			{
				Primary: '#404040',
				Accent: '#555555',
				Muted: '#909090',
				Light: '#D0CCC8',
				WarmBeige: '#DAD6D2',
				TealTint: '#CCC8C4',
				Lavender: '#D2D0CE',
				AmberTint: '#D8D2C8',
				PdfFill: '#D8C8C0',
				PdfText: '#AA3333'
			}
		});

		tmpSelf._addTheme('evening',
		{
			Name: 'Evening',
			Category: 'Grey',
			Description: 'Medium grey, transitional',
			Variables:
			{
				'--retold-bg-primary': '#484848',
				'--retold-bg-secondary': '#3C3C3C',
				'--retold-bg-tertiary': '#424242',
				'--retold-bg-panel': '#454545',
				'--retold-bg-viewer': '#363636',
				'--retold-bg-hover': '#525252',
				'--retold-bg-selected': '#606060',
				'--retold-bg-thumb': '#3C3C3C',
				'--retold-text-primary': '#E0E0E0',
				'--retold-text-secondary': '#D0D0D0',
				'--retold-text-muted': '#A0A0A0',
				'--retold-text-dim': '#888888',
				'--retold-text-placeholder': '#707070',
				'--retold-accent': '#C0C0C0',
				'--retold-accent-hover': '#E0E0E0',
				'--retold-border': '#585858',
				'--retold-border-light': '#606060',
				'--retold-danger': '#FF6666',
				'--retold-danger-muted': '#AA6666',
				'--retold-scrollbar': '#585858',
				'--retold-scrollbar-hover': '#686868',
				'--retold-selection-bg': 'rgba(192, 192, 192, 0.25)',
				'--retold-focus-outline': '#C0C0C0',
				'--retold-font-family': "system-ui, -apple-system, sans-serif",
				'--retold-font-mono': "'SF Mono', 'Fira Code', 'Consolas', monospace"
			},
			IconColors:
			{
				Primary: '#D0D0D0',
				Accent: '#C0C0C0',
				Muted: '#888888',
				Light: '#424242',
				WarmBeige: '#484848',
				TealTint: '#3E3E3E',
				Lavender: '#444444',
				AmberTint: '#4A4640',
				PdfFill: '#4A3C3C',
				PdfText: '#FF6666'
			}
		});

		tmpSelf._addTheme('twilight',
		{
			Name: 'Twilight',
			Category: 'Grey',
			Description: 'Dark grey, low light (default)',
			Variables:
			{
				'--retold-bg-primary': '#1E1E1E',
				'--retold-bg-secondary': '#181818',
				'--retold-bg-tertiary': '#252525',
				'--retold-bg-panel': '#202020',
				'--retold-bg-viewer': '#141414',
				'--retold-bg-hover': '#2E2E2E',
				'--retold-bg-selected': '#404040',
				'--retold-bg-thumb': '#181818',
				'--retold-text-primary': '#E0E0E0',
				'--retold-text-secondary': '#C8C8C8',
				'--retold-text-muted': '#909090',
				'--retold-text-dim': '#707070',
				'--retold-text-placeholder': '#585858',
				'--retold-accent': '#A0A0A0',
				'--retold-accent-hover': '#C0C0C0',
				'--retold-border': '#333333',
				'--retold-border-light': '#404040',
				'--retold-danger': '#FF6666',
				'--retold-danger-muted': '#AA6666',
				'--retold-scrollbar': '#404040',
				'--retold-scrollbar-hover': '#505050',
				'--retold-selection-bg': 'rgba(160, 160, 160, 0.25)',
				'--retold-focus-outline': '#A0A0A0',
				'--retold-font-family': "system-ui, -apple-system, sans-serif",
				'--retold-font-mono': "'SF Mono', 'Fira Code', 'Consolas', monospace"
			},
			IconColors:
			{
				Primary: '#C8C8C8',
				Accent: '#A0A0A0',
				Muted: '#707070',
				Light: '#252525',
				WarmBeige: '#2A2A2A',
				TealTint: '#222222',
				Lavender: '#282828',
				AmberTint: '#2E2A24',
				PdfFill: '#2E2224',
				PdfText: '#E06060'
			}
		});

		tmpSelf._addTheme('night',
		{
			Name: 'Night',
			Category: 'Grey',
			Description: 'Near-black, minimal contrast',
			Variables:
			{
				'--retold-bg-primary': '#0A0A0A',
				'--retold-bg-secondary': '#060606',
				'--retold-bg-tertiary': '#0E0E0E',
				'--retold-bg-panel': '#0C0C0C',
				'--retold-bg-viewer': '#040404',
				'--retold-bg-hover': '#161616',
				'--retold-bg-selected': '#252525',
				'--retold-bg-thumb': '#060606',
				'--retold-text-primary': '#888888',
				'--retold-text-secondary': '#707070',
				'--retold-text-muted': '#555555',
				'--retold-text-dim': '#444444',
				'--retold-text-placeholder': '#333333',
				'--retold-accent': '#666666',
				'--retold-accent-hover': '#808080',
				'--retold-border': '#1A1A1A',
				'--retold-border-light': '#222222',
				'--retold-danger': '#AA4444',
				'--retold-danger-muted': '#663333',
				'--retold-scrollbar': '#1A1A1A',
				'--retold-scrollbar-hover': '#2A2A2A',
				'--retold-selection-bg': 'rgba(102, 102, 102, 0.2)',
				'--retold-focus-outline': '#666666',
				'--retold-font-family': "system-ui, -apple-system, sans-serif",
				'--retold-font-mono': "'SF Mono', 'Fira Code', 'Consolas', monospace"
			},
			IconColors:
			{
				Primary: '#707070',
				Accent: '#666666',
				Muted: '#444444',
				Light: '#0E0E0E',
				WarmBeige: '#121212',
				TealTint: '#0C0C0C',
				Lavender: '#101010',
				AmberTint: '#141210',
				PdfFill: '#141010',
				PdfText: '#AA4444'
			}
		});

		// ===================================================================
		// FUN THEMES
		// ===================================================================

		tmpSelf._addTheme('neo-tokyo',
		{
			Name: 'Neo-Tokyo',
			Category: 'Fun',
			Description: 'Neon pink on dark navy',
			Variables:
			{
				'--retold-bg-primary': '#0D0D2B',
				'--retold-bg-secondary': '#080820',
				'--retold-bg-tertiary': '#121235',
				'--retold-bg-panel': '#0F0F28',
				'--retold-bg-viewer': '#060615',
				'--retold-bg-hover': '#1A1A42',
				'--retold-bg-selected': '#2A1845',
				'--retold-bg-thumb': '#080820',
				'--retold-text-primary': '#E8E0F0',
				'--retold-text-secondary': '#D0C8E0',
				'--retold-text-muted': '#9088A8',
				'--retold-text-dim': '#6860A0',
				'--retold-text-placeholder': '#504888',
				'--retold-accent': '#FF2D8A',
				'--retold-accent-hover': '#FF5AA0',
				'--retold-border': '#2A2050',
				'--retold-border-light': '#382868',
				'--retold-danger': '#FF4466',
				'--retold-danger-muted': '#AA3355',
				'--retold-scrollbar': '#2A2050',
				'--retold-scrollbar-hover': '#3A3068',
				'--retold-selection-bg': 'rgba(255, 45, 138, 0.25)',
				'--retold-focus-outline': '#FF2D8A',
				'--retold-font-family': "'Courier New', monospace",
				'--retold-font-mono': "'Courier New', monospace"
			},
			IconColors:
			{
				Primary: '#D0C8E0',
				Accent: '#FF2D8A',
				Muted: '#6860A0',
				Light: '#121235',
				WarmBeige: '#141438',
				TealTint: '#100E30',
				Lavender: '#141232',
				AmberTint: '#1A1228',
				PdfFill: '#1A1028',
				PdfText: '#FF4466'
			}
		});

		tmpSelf._addTheme('cyberpunk',
		{
			Name: 'Cyberpunk',
			Category: 'Fun',
			Description: 'Electric green on black',
			Variables:
			{
				'--retold-bg-primary': '#0A0E0A',
				'--retold-bg-secondary': '#060806',
				'--retold-bg-tertiary': '#0E120E',
				'--retold-bg-panel': '#0C100C',
				'--retold-bg-viewer': '#040604',
				'--retold-bg-hover': '#142014',
				'--retold-bg-selected': '#1A3A1A',
				'--retold-bg-thumb': '#060806',
				'--retold-text-primary': '#C8FFC8',
				'--retold-text-secondary': '#A0D8A0',
				'--retold-text-muted': '#608860',
				'--retold-text-dim': '#406040',
				'--retold-text-placeholder': '#305030',
				'--retold-accent': '#00FF41',
				'--retold-accent-hover': '#44FF77',
				'--retold-border': '#1A2A1A',
				'--retold-border-light': '#224022',
				'--retold-danger': '#FF3333',
				'--retold-danger-muted': '#AA2222',
				'--retold-scrollbar': '#1A2A1A',
				'--retold-scrollbar-hover': '#2A4A2A',
				'--retold-selection-bg': 'rgba(0, 255, 65, 0.2)',
				'--retold-focus-outline': '#00FF41',
				'--retold-font-family': "'Lucida Console', 'Courier New', monospace",
				'--retold-font-mono': "'Lucida Console', 'Courier New', monospace"
			},
			IconColors:
			{
				Primary: '#A0D8A0',
				Accent: '#00FF41',
				Muted: '#406040',
				Light: '#0E120E',
				WarmBeige: '#101610',
				TealTint: '#0C140C',
				Lavender: '#0E120E',
				AmberTint: '#141810',
				PdfFill: '#181010',
				PdfText: '#FF3333'
			}
		});

		tmpSelf._addTheme('hotdog',
		{
			Name: 'Hotdog',
			Category: 'Fun',
			Description: 'Red and mustard yellow, garish',
			Variables:
			{
				'--retold-bg-primary': '#8B0000',
				'--retold-bg-secondary': '#6B0000',
				'--retold-bg-tertiary': '#7B0000',
				'--retold-bg-panel': '#750000',
				'--retold-bg-viewer': '#550000',
				'--retold-bg-hover': '#AA1111',
				'--retold-bg-selected': '#BB3300',
				'--retold-bg-thumb': '#6B0000',
				'--retold-text-primary': '#FFD700',
				'--retold-text-secondary': '#FFC000',
				'--retold-text-muted': '#CC9900',
				'--retold-text-dim': '#AA7700',
				'--retold-text-placeholder': '#886600',
				'--retold-accent': '#FFD700',
				'--retold-accent-hover': '#FFEE44',
				'--retold-border': '#AA2222',
				'--retold-border-light': '#BB3333',
				'--retold-danger': '#FFFF00',
				'--retold-danger-muted': '#CCCC00',
				'--retold-scrollbar': '#AA2222',
				'--retold-scrollbar-hover': '#CC3333',
				'--retold-selection-bg': 'rgba(255, 215, 0, 0.3)',
				'--retold-focus-outline': '#FFD700',
				'--retold-font-family': "Impact, 'Arial Black', sans-serif",
				'--retold-font-mono': "'Courier New', monospace"
			},
			IconColors:
			{
				Primary: '#FFC000',
				Accent: '#FFD700',
				Muted: '#AA7700',
				Light: '#7B0000',
				WarmBeige: '#800000',
				TealTint: '#6B0000',
				Lavender: '#780000',
				AmberTint: '#7A1000',
				PdfFill: '#6B0000',
				PdfText: '#FFFF00'
			}
		});

		tmpSelf._addTheme('1970s-console',
		{
			Name: '1970s Console',
			Category: 'Fun',
			Description: 'Amber phosphor on brown-black',
			Variables:
			{
				'--retold-bg-primary': '#1A1000',
				'--retold-bg-secondary': '#140C00',
				'--retold-bg-tertiary': '#1E1400',
				'--retold-bg-panel': '#1C1200',
				'--retold-bg-viewer': '#100A00',
				'--retold-bg-hover': '#2A1C00',
				'--retold-bg-selected': '#3A2800',
				'--retold-bg-thumb': '#140C00',
				'--retold-text-primary': '#FFAA00',
				'--retold-text-secondary': '#DD8800',
				'--retold-text-muted': '#AA6600',
				'--retold-text-dim': '#884400',
				'--retold-text-placeholder': '#663300',
				'--retold-accent': '#FFCC00',
				'--retold-accent-hover': '#FFDD44',
				'--retold-border': '#2A1800',
				'--retold-border-light': '#3A2200',
				'--retold-danger': '#FF4400',
				'--retold-danger-muted': '#AA3300',
				'--retold-scrollbar': '#2A1800',
				'--retold-scrollbar-hover': '#3A2800',
				'--retold-selection-bg': 'rgba(255, 204, 0, 0.2)',
				'--retold-focus-outline': '#FFCC00',
				'--retold-font-family': "'Courier New', 'Lucida Console', monospace",
				'--retold-font-mono': "'Courier New', 'Lucida Console', monospace"
			},
			IconColors:
			{
				Primary: '#DD8800',
				Accent: '#FFCC00',
				Muted: '#884400',
				Light: '#1E1400',
				WarmBeige: '#201800',
				TealTint: '#1A1000',
				Lavender: '#1C1200',
				AmberTint: '#221800',
				PdfFill: '#201000',
				PdfText: '#FF4400'
			}
		});

		tmpSelf._addTheme('1980s-console',
		{
			Name: '1980s Console',
			Category: 'Fun',
			Description: 'Green phosphor on black',
			Variables:
			{
				'--retold-bg-primary': '#001200',
				'--retold-bg-secondary': '#000E00',
				'--retold-bg-tertiary': '#001600',
				'--retold-bg-panel': '#001400',
				'--retold-bg-viewer': '#000A00',
				'--retold-bg-hover': '#002200',
				'--retold-bg-selected': '#003800',
				'--retold-bg-thumb': '#000E00',
				'--retold-text-primary': '#00FF00',
				'--retold-text-secondary': '#00CC00',
				'--retold-text-muted': '#009900',
				'--retold-text-dim': '#006600',
				'--retold-text-placeholder': '#004400',
				'--retold-accent': '#00FF66',
				'--retold-accent-hover': '#44FF88',
				'--retold-border': '#002A00',
				'--retold-border-light': '#003A00',
				'--retold-danger': '#FF0000',
				'--retold-danger-muted': '#AA0000',
				'--retold-scrollbar': '#002A00',
				'--retold-scrollbar-hover': '#004400',
				'--retold-selection-bg': 'rgba(0, 255, 102, 0.2)',
				'--retold-focus-outline': '#00FF66',
				'--retold-font-family': "'Courier New', monospace",
				'--retold-font-mono': "'Courier New', monospace"
			},
			IconColors:
			{
				Primary: '#00CC00',
				Accent: '#00FF66',
				Muted: '#006600',
				Light: '#001600',
				WarmBeige: '#001A00',
				TealTint: '#001200',
				Lavender: '#001400',
				AmberTint: '#001800',
				PdfFill: '#140000',
				PdfText: '#FF0000'
			}
		});

		tmpSelf._addTheme('1990s-website',
		{
			Name: '1990s Web Site',
			Category: 'Fun',
			Description: 'Blue links on grey, beveled',
			Variables:
			{
				'--retold-bg-primary': '#C0C0C0',
				'--retold-bg-secondary': '#B0B0B0',
				'--retold-bg-tertiary': '#A8A8A8',
				'--retold-bg-panel': '#B8B8B8',
				'--retold-bg-viewer': '#D0D0D0',
				'--retold-bg-hover': '#B8B8D0',
				'--retold-bg-selected': '#000080',
				'--retold-bg-thumb': '#B0B0B0',
				'--retold-text-primary': '#000000',
				'--retold-text-secondary': '#000080',
				'--retold-text-muted': '#404040',
				'--retold-text-dim': '#606060',
				'--retold-text-placeholder': '#808080',
				'--retold-accent': '#0000FF',
				'--retold-accent-hover': '#0000CC',
				'--retold-border': '#808080',
				'--retold-border-light': '#A0A0A0',
				'--retold-danger': '#FF0000',
				'--retold-danger-muted': '#990000',
				'--retold-scrollbar': '#808080',
				'--retold-scrollbar-hover': '#606060',
				'--retold-selection-bg': 'rgba(0, 0, 128, 0.3)',
				'--retold-focus-outline': '#0000FF',
				'--retold-font-family': "'Times New Roman', Times, serif",
				'--retold-font-mono': "'Courier New', Courier, monospace"
			},
			IconColors:
			{
				Primary: '#000080',
				Accent: '#0000FF',
				Muted: '#606060',
				Light: '#A8A8A8',
				WarmBeige: '#B0B0B0',
				TealTint: '#A0A0A0',
				Lavender: '#ABABD0',
				AmberTint: '#B8B0A0',
				PdfFill: '#C0A0A0',
				PdfText: '#FF0000'
			}
		});

		tmpSelf._addTheme('early-2000s',
		{
			Name: 'Early 2000s Web',
			Category: 'Fun',
			Description: 'Teal and silver, Web 2.0',
			Variables:
			{
				'--retold-bg-primary': '#E8F4F8',
				'--retold-bg-secondary': '#D0E8EE',
				'--retold-bg-tertiary': '#C0DDE6',
				'--retold-bg-panel': '#D8EEF2',
				'--retold-bg-viewer': '#F0F8FA',
				'--retold-bg-hover': '#B0D4E0',
				'--retold-bg-selected': '#88C4D8',
				'--retold-bg-thumb': '#D0E8EE',
				'--retold-text-primary': '#1A3A4A',
				'--retold-text-secondary': '#2A4A5A',
				'--retold-text-muted': '#5A7A8A',
				'--retold-text-dim': '#7A9AAA',
				'--retold-text-placeholder': '#9ABACA',
				'--retold-accent': '#0099CC',
				'--retold-accent-hover': '#00AADD',
				'--retold-border': '#A0C8D8',
				'--retold-border-light': '#B8D8E4',
				'--retold-danger': '#CC3300',
				'--retold-danger-muted': '#994422',
				'--retold-scrollbar': '#A0C8D8',
				'--retold-scrollbar-hover': '#88B8CC',
				'--retold-selection-bg': 'rgba(0, 153, 204, 0.2)',
				'--retold-focus-outline': '#0099CC',
				'--retold-font-family': "Verdana, Geneva, Tahoma, sans-serif",
				'--retold-font-mono': "'Lucida Console', Monaco, monospace"
			},
			IconColors:
			{
				Primary: '#2A4A5A',
				Accent: '#0099CC',
				Muted: '#7A9AAA',
				Light: '#C0DDE6',
				WarmBeige: '#D0E8EE',
				TealTint: '#B0D8E4',
				Lavender: '#C8DCE6',
				AmberTint: '#D8E0D0',
				PdfFill: '#E0C8C0',
				PdfText: '#CC3300'
			}
		});

		tmpSelf._addTheme('synthwave',
		{
			Name: 'Synthwave',
			Category: 'Fun',
			Description: 'Purple and pink neon',
			Variables:
			{
				'--retold-bg-primary': '#1A0A2E',
				'--retold-bg-secondary': '#140824',
				'--retold-bg-tertiary': '#200E38',
				'--retold-bg-panel': '#1C0C32',
				'--retold-bg-viewer': '#100620',
				'--retold-bg-hover': '#2A1848',
				'--retold-bg-selected': '#3A2060',
				'--retold-bg-thumb': '#140824',
				'--retold-text-primary': '#E8C0F8',
				'--retold-text-secondary': '#D0A8E8',
				'--retold-text-muted': '#9878B8',
				'--retold-text-dim': '#7858A8',
				'--retold-text-placeholder': '#584088',
				'--retold-accent': '#FF71CE',
				'--retold-accent-hover': '#FF99DD',
				'--retold-border': '#302050',
				'--retold-border-light': '#402868',
				'--retold-danger': '#FF4488',
				'--retold-danger-muted': '#AA3366',
				'--retold-scrollbar': '#302050',
				'--retold-scrollbar-hover': '#402868',
				'--retold-selection-bg': 'rgba(255, 113, 206, 0.25)',
				'--retold-focus-outline': '#FF71CE',
				'--retold-font-family': "'Trebuchet MS', sans-serif",
				'--retold-font-mono': "'Courier New', monospace"
			},
			IconColors:
			{
				Primary: '#D0A8E8',
				Accent: '#FF71CE',
				Muted: '#7858A8',
				Light: '#200E38',
				WarmBeige: '#221040',
				TealTint: '#1A0C30',
				Lavender: '#1E0E36',
				AmberTint: '#241028',
				PdfFill: '#241020',
				PdfText: '#FF4488'
			}
		});

		tmpSelf._addTheme('solarized-dark',
		{
			Name: 'Solarized Dark',
			Category: 'Fun',
			Description: "Schoonover's classic palette",
			Variables:
			{
				'--retold-bg-primary': '#002B36',
				'--retold-bg-secondary': '#073642',
				'--retold-bg-tertiary': '#003B4A',
				'--retold-bg-panel': '#00303C',
				'--retold-bg-viewer': '#001E28',
				'--retold-bg-hover': '#0A4858',
				'--retold-bg-selected': '#155868',
				'--retold-bg-thumb': '#073642',
				'--retold-text-primary': '#FDF6E3',
				'--retold-text-secondary': '#EEE8D5',
				'--retold-text-muted': '#93A1A1',
				'--retold-text-dim': '#839496',
				'--retold-text-placeholder': '#657B83',
				'--retold-accent': '#268BD2',
				'--retold-accent-hover': '#45A0E0',
				'--retold-border': '#0A4050',
				'--retold-border-light': '#125868',
				'--retold-danger': '#DC322F',
				'--retold-danger-muted': '#AA2A28',
				'--retold-scrollbar': '#0A4050',
				'--retold-scrollbar-hover': '#125868',
				'--retold-selection-bg': 'rgba(38, 139, 210, 0.25)',
				'--retold-focus-outline': '#268BD2',
				'--retold-font-family': "'Source Code Pro', 'Fira Code', monospace",
				'--retold-font-mono': "'Source Code Pro', 'Fira Code', monospace"
			},
			IconColors:
			{
				Primary: '#EEE8D5',
				Accent: '#268BD2',
				Muted: '#839496',
				Light: '#003B4A',
				WarmBeige: '#073642',
				TealTint: '#004050',
				Lavender: '#003848',
				AmberTint: '#0A3A30',
				PdfFill: '#0A3028',
				PdfText: '#DC322F'
			}
		});

		tmpSelf._addTheme('forest',
		{
			Name: 'Forest',
			Category: 'Fun',
			Description: 'Deep greens and earth browns',
			Variables:
			{
				'--retold-bg-primary': '#1A2018',
				'--retold-bg-secondary': '#141A12',
				'--retold-bg-tertiary': '#1E2620',
				'--retold-bg-panel': '#1C221A',
				'--retold-bg-viewer': '#101410',
				'--retold-bg-hover': '#283828',
				'--retold-bg-selected': '#344834',
				'--retold-bg-thumb': '#141A12',
				'--retold-text-primary': '#D0DCC8',
				'--retold-text-secondary': '#B0C4A8',
				'--retold-text-muted': '#809878',
				'--retold-text-dim': '#607858',
				'--retold-text-placeholder': '#486040',
				'--retold-accent': '#6AAF5C',
				'--retold-accent-hover': '#88CC78',
				'--retold-border': '#2A3A28',
				'--retold-border-light': '#3A4A38',
				'--retold-danger': '#CC4422',
				'--retold-danger-muted': '#884422',
				'--retold-scrollbar': '#2A3A28',
				'--retold-scrollbar-hover': '#3A4A38',
				'--retold-selection-bg': 'rgba(106, 175, 92, 0.25)',
				'--retold-focus-outline': '#6AAF5C',
				'--retold-font-family': "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
				'--retold-font-mono': "'Courier New', monospace"
			},
			IconColors:
			{
				Primary: '#B0C4A8',
				Accent: '#6AAF5C',
				Muted: '#607858',
				Light: '#1E2620',
				WarmBeige: '#22281E',
				TealTint: '#1A221A',
				Lavender: '#1E2420',
				AmberTint: '#262218',
				PdfFill: '#261A18',
				PdfText: '#CC4422'
			}
		});
	}

	/**
	 * Register a theme in the internal map and order list.
	 */
	_addTheme(pKey, pTheme)
	{
		this._themes[pKey] = pTheme;
		this._themeOrder.push(pKey);
	}

	/**
	 * Apply a theme by key.  Injects CSS variables into a dedicated <style>
	 * element and updates the icon provider colors.
	 *
	 * @param {string} pThemeName - Theme key (e.g. 'twilight', 'neo-tokyo')
	 * @returns {boolean} True if theme was applied successfully
	 */
	applyTheme(pThemeName)
	{
		let tmpTheme = this._themes[pThemeName];
		if (!tmpTheme)
		{
			// Fall back to twilight if unknown theme key
			tmpTheme = this._themes['twilight'];
			pThemeName = 'twilight';
		}

		this._currentTheme = pThemeName;

		// Build CSS variable block
		let tmpCSS = ':root {\n';
		let tmpVars = tmpTheme.Variables;
		let tmpKeys = Object.keys(tmpVars);
		for (let i = 0; i < tmpKeys.length; i++)
		{
			tmpCSS += '\t' + tmpKeys[i] + ': ' + tmpVars[tmpKeys[i]] + ';\n';
		}
		tmpCSS += '}\n';

		// Inject into dedicated style element
		if (typeof document !== 'undefined')
		{
			let tmpStyleEl = document.getElementById('retold-remote-theme');
			if (!tmpStyleEl)
			{
				tmpStyleEl = document.createElement('style');
				tmpStyleEl.id = 'retold-remote-theme';
				document.head.appendChild(tmpStyleEl);
			}
			tmpStyleEl.textContent = tmpCSS;
		}

		// Update icon provider colors
		let tmpIconProvider = this.pict.providers['RetoldRemote-Icons'];
		if (tmpIconProvider && tmpTheme.IconColors)
		{
			tmpIconProvider.setColors(tmpTheme.IconColors);
		}

		// Update AppData
		let tmpRemote = this.pict.AppData.RetoldRemote;
		if (tmpRemote)
		{
			tmpRemote.Theme = pThemeName;
		}

		return true;
	}

	/**
	 * Get the ordered list of themes for building a dropdown.
	 *
	 * @returns {Array<Object>} Array of { key, name, category, description }
	 */
	getThemeList()
	{
		let tmpList = [];
		for (let i = 0; i < this._themeOrder.length; i++)
		{
			let tmpKey = this._themeOrder[i];
			let tmpTheme = this._themes[tmpKey];
			tmpList.push(
			{
				key: tmpKey,
				name: tmpTheme.Name,
				category: tmpTheme.Category,
				description: tmpTheme.Description
			});
		}
		return tmpList;
	}

	/**
	 * Get the currently active theme key.
	 *
	 * @returns {string}
	 */
	getCurrentTheme()
	{
		return this._currentTheme;
	}

	/**
	 * Get a theme definition by key.
	 *
	 * @param {string} pThemeKey
	 * @returns {Object|null}
	 */
	getTheme(pThemeKey)
	{
		return this._themes[pThemeKey] || null;
	}
}

RetoldRemoteThemeProvider.default_configuration = _ProviderConfiguration;

module.exports = RetoldRemoteThemeProvider;
