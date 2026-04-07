/**
 * Retold Remote -- Ultravisor Operations
 *
 * Declares media processing workflow Operations that retold-remote
 * registers with Ultravisor on beacon connection.
 *
 * Each operation is a full explicit pipeline:
 *   Start → ResolveAddress → FileTransfer → Process → SendResult → End
 *
 * No magic — every data operation is a visible card in the flow editor
 * with its own timing in the manifest.
 *
 * @license MIT
 */


// ================================================================
// Node builders
// ================================================================

function _startNode(pHash, pX, pY)
{
	return {
		Hash: pHash + '-start',
		Type: 'start',
		X: pX || 50, Y: pY || 200,
		Width: 140, Height: 80,
		Title: 'Start',
		Ports: [{ Hash: pHash + '-start-out', Direction: 'output', Side: 'right-bottom', Label: 'Out' }],
		Data: {}
	};
}

function _endNode(pHash, pX, pY)
{
	return {
		Hash: pHash + '-end',
		Type: 'end',
		X: pX || 1220, Y: pY || 260,
		Width: 140, Height: 80,
		Title: 'End',
		Ports: [{ Hash: pHash + '-end-in', Direction: 'input', Side: 'left-bottom', Label: 'In' }],
		Data: {}
	};
}

function _taskNode(pNodeHash, pType, pTitle, pX, pY, pData, pSettingNames, pOutputNames)
{
	let tmpPorts = [];

	let tmpSettings = pSettingNames || [];
	for (let i = 0; i < tmpSettings.length; i++)
	{
		tmpPorts.push({ Hash: pNodeHash + '-si-' + tmpSettings[i], Direction: 'input', Side: 'left-top', Label: tmpSettings[i] });
	}

	tmpPorts.push({ Hash: pNodeHash + '-in', Direction: 'input', Side: 'left-bottom', Label: 'Trigger' });
	tmpPorts.push({ Hash: pNodeHash + '-done', Direction: 'output', Side: 'right-bottom', Label: 'Complete' });
	tmpPorts.push({ Hash: pNodeHash + '-err', Direction: 'output', Side: 'bottom', Label: 'Error' });

	let tmpOutputs = pOutputNames || [];
	for (let i = 0; i < tmpOutputs.length; i++)
	{
		tmpPorts.push({ Hash: pNodeHash + '-so-' + tmpOutputs[i], Direction: 'output', Side: 'right-top', Label: tmpOutputs[i] });
	}

	return {
		Hash: pNodeHash,
		Type: pType,
		X: pX, Y: pY,
		Width: 240, Height: 140,
		Title: pTitle,
		Ports: tmpPorts,
		Data: pData
	};
}

/**
 * Chain connections: each node's Complete → next node's Trigger,
 * and each node's Error → end node.
 */
function _chainConnections(pHash, pNodeHashes, pEndHash)
{
	let tmpConnections = [];
	let tmpIdx = 1;

	for (let i = 0; i < pNodeHashes.length - 1; i++)
	{
		// Complete → next Trigger
		tmpConnections.push({
			Hash: pHash + '-c' + tmpIdx++,
			SourceNodeHash: pNodeHashes[i],
			SourcePortHash: pNodeHashes[i] + (i === 0 ? '-out' : '-done'),
			TargetNodeHash: pNodeHashes[i + 1],
			TargetPortHash: pNodeHashes[i + 1] + '-in',
			Data: {}
		});
	}

	// Last node Complete → end
	let tmpLast = pNodeHashes[pNodeHashes.length - 1];
	tmpConnections.push({
		Hash: pHash + '-c' + tmpIdx++,
		SourceNodeHash: tmpLast,
		SourcePortHash: tmpLast + '-done',
		TargetNodeHash: pEndHash,
		TargetPortHash: pEndHash + '-in',
		Data: {}
	});

	// Error connections: every non-start, non-end node → end
	for (let i = 1; i < pNodeHashes.length; i++)
	{
		tmpConnections.push({
			Hash: pHash + '-ce' + i,
			SourceNodeHash: pNodeHashes[i],
			SourcePortHash: pNodeHashes[i] + '-err',
			TargetNodeHash: pEndHash,
			TargetPortHash: pEndHash + '-in',
			Data: {}
		});
	}

	return tmpConnections;
}

/**
 * Build a standard media pipeline operation:
 *   Start → ResolveAddress → FileTransfer → [ProcessNode] → SendResult → End
 *
 * @param {object} pConfig
 * @param {string} pConfig.Hash           - Operation hash
 * @param {string} pConfig.Name           - Display name
 * @param {string} pConfig.Description    - Description
 * @param {string[]} pConfig.Tags         - Tags
 * @param {string} pConfig.AddressParam   - Parameter name for the universal address (e.g. 'ImageAddress')
 * @param {string} pConfig.ProcessType    - Task type hash for the processing card
 * @param {string} pConfig.ProcessTitle   - Title for the processing card
 * @param {object} pConfig.ProcessData    - Data/settings for the processing card
 * @param {string[]} pConfig.ProcessSettings - Settings input names for the processing card
 * @param {string[]} pConfig.ProcessOutputs  - State output names for the processing card
 * @param {string} pConfig.OutputFile     - Filename of the output in staging (e.g. 'thumbnail.jpg')
 */
function _buildPipelineOperation(pConfig)
{
	let tmpHash = pConfig.Hash;
	let tmpResolveHash = tmpHash + '-resolve';
	let tmpTransferHash = tmpHash + '-transfer';
	let tmpProcessHash = tmpHash + '-process';
	let tmpResultHash = tmpHash + '-result';
	let tmpStartHash = tmpHash + '-start';
	let tmpEndHash = tmpHash + '-end';

	let tmpNodes = [
		_startNode(tmpHash, 50, 200),

		_taskNode(tmpResolveHash, 'resolve-address', 'Resolve Address', 220, 180,
			{
				Address: '{~D:Record.Operation.' + pConfig.AddressParam + '~}'
			},
			['Address'],
			['URL', 'Filename', 'BeaconName', 'LocalPath', 'Strategy']),

		_taskNode(tmpTransferHash, 'file-transfer', 'File Transfer', 490, 180,
			{
				SourceURL: '{~D:Record.TaskOutputs.' + tmpResolveHash + '.URL~}',
				SourceLocalPath: '{~D:Record.TaskOutputs.' + tmpResolveHash + '.LocalPath~}',
				Filename: '{~D:Record.TaskOutputs.' + tmpResolveHash + '.Filename~}',
				TimeoutMs: pConfig.TransferTimeoutMs || 300000
			},
			['SourceURL', 'SourceLocalPath', 'Filename', 'TimeoutMs'],
			['LocalPath', 'BytesTransferred', 'DurationMs', 'Strategy']),

		_taskNode(tmpProcessHash, pConfig.ProcessType, pConfig.ProcessTitle, 760, 180,
			pConfig.ProcessData,
			pConfig.ProcessSettings || [],
			pConfig.ProcessOutputs || ['Result', 'StdOut']),

		_taskNode(tmpResultHash, 'send-result', 'Send Result', 1030, 180,
			{
				FilePath: pConfig.OutputFile,
				OutputKey: 'ResultFile'
			},
			['FilePath'],
			['BytesSent', 'DurationMs']),

		_endNode(tmpHash, 1300, 260)
	];

	let tmpNodeHashes = [tmpStartHash, tmpResolveHash, tmpTransferHash, tmpProcessHash, tmpResultHash];
	let tmpConnections = _chainConnections(tmpHash, tmpNodeHashes, tmpEndHash);

	// Add state connections: resolve URL → transfer SourceURL, resolve Filename → transfer Filename
	tmpConnections.push({
		Hash: tmpHash + '-s1',
		SourceNodeHash: tmpResolveHash,
		SourcePortHash: tmpResolveHash + '-so-URL',
		TargetNodeHash: tmpTransferHash,
		TargetPortHash: tmpTransferHash + '-si-SourceURL',
		Data: {}
	});
	tmpConnections.push({
		Hash: tmpHash + '-s2',
		SourceNodeHash: tmpResolveHash,
		SourcePortHash: tmpResolveHash + '-so-Filename',
		TargetNodeHash: tmpTransferHash,
		TargetPortHash: tmpTransferHash + '-si-Filename',
		Data: {}
	});

	// Resolve LocalPath → transfer SourceLocalPath (shared-fs zero-copy fast path)
	tmpConnections.push({
		Hash: tmpHash + '-s4',
		SourceNodeHash: tmpResolveHash,
		SourcePortHash: tmpResolveHash + '-so-LocalPath',
		TargetNodeHash: tmpTransferHash,
		TargetPortHash: tmpTransferHash + '-si-SourceLocalPath',
		Data: {}
	});

	// Transfer LocalPath → process InputFile
	tmpConnections.push({
		Hash: tmpHash + '-s3',
		SourceNodeHash: tmpTransferHash,
		SourcePortHash: tmpTransferHash + '-so-LocalPath',
		TargetNodeHash: tmpProcessHash,
		TargetPortHash: tmpProcessHash + '-si-InputFile',
		Data: {}
	});

	return {
		Hash: tmpHash,
		Name: pConfig.Name,
		Description: pConfig.Description,
		Tags: ['retold-remote'].concat(pConfig.Tags || []),
		Author: 'retold-remote',
		Version: '3.0.0',
		Graph:
		{
			Nodes: tmpNodes,
			Connections: tmpConnections,
			ViewState: { PanX: 0, PanY: 0, Zoom: 1, SelectedNodeHash: null, SelectedConnectionHash: null }
		},
		SavedLayouts: [],
		InitialGlobalState: {},
		InitialOperationState: {}
	};
}


// ================================================================
// Operation Definitions
// ================================================================

function getOperations()
{
	let tmpOperations = [];

	// ── 1. Image Thumbnail ──────────────────────────────────────
	tmpOperations.push(_buildPipelineOperation(
	{
		Hash: 'rr-image-thumbnail',
		Name: 'Image Thumbnail',
		Description: 'Generate a thumbnail from an image file. Pipeline: resolve address → download → resize → send result. Trigger with Parameters: { ImageAddress, Width, Height, Format, Quality }.',
		Tags: ['media', 'image', 'thumbnail'],
		AddressParam: 'ImageAddress',
		ProcessType: 'beacon-mediaconversion-imageresize',
		ProcessTitle: 'Resize Image',
		ProcessData:
		{
			OutputFile: 'thumbnail.jpg',
			Width: '{~D:Record.Operation.Width~}',
			Height: '{~D:Record.Operation.Height~}',
			Format: '{~D:Record.Operation.Format~}',
			Quality: '{~D:Record.Operation.Quality~}',
			TimeoutMs: 300000
		},
		ProcessSettings: ['InputFile', 'OutputFile', 'Width', 'Height', 'Format', 'Quality'],
		ProcessOutputs: ['Result', 'StdOut'],
		OutputFile: 'thumbnail.jpg'
	}));

	// ── 2. Video Thumbnail ──────────────────────────────────────
	tmpOperations.push(_buildPipelineOperation(
	{
		Hash: 'rr-video-thumbnail',
		Name: 'Video Thumbnail',
		Description: 'Generate a thumbnail from a video file. Pipeline: resolve → download → extract frame → send result. Trigger with Parameters: { VideoAddress, Timestamp, Width }.',
		Tags: ['media', 'video', 'thumbnail'],
		AddressParam: 'VideoAddress',
		TransferTimeoutMs: 1800000,
		ProcessType: 'beacon-mediaconversion-videothumbnail',
		ProcessTitle: 'Extract Thumbnail',
		ProcessData:
		{
			OutputFile: 'thumbnail.jpg',
			Timestamp: '{~D:Record.Operation.Timestamp~}',
			Width: '{~D:Record.Operation.Width~}',
			TimeoutMs: 600000
		},
		ProcessSettings: ['InputFile', 'OutputFile', 'Timestamp', 'Width'],
		ProcessOutputs: ['Result', 'StdOut'],
		OutputFile: 'thumbnail.jpg'
	}));

	// ── 3. Video Frame Extraction ───────────────────────────────
	// Two processing steps: probe then extract. Custom graph (not pipeline helper).
	let tmpVfe = 'rr-video-frame-extraction';
	let tmpVfeNodes = [
		_startNode(tmpVfe, 50, 200),
		_taskNode(tmpVfe + '-resolve', 'resolve-address', 'Resolve Address', 220, 180,
			{ Address: '{~D:Record.Operation.VideoAddress~}' },
			['Address'], ['URL', 'Filename', 'BeaconName', 'LocalPath', 'Strategy']),
		_taskNode(tmpVfe + '-transfer', 'file-transfer', 'File Transfer', 440, 180,
			{
				SourceURL: '{~D:Record.TaskOutputs.' + tmpVfe + '-resolve.URL~}',
				SourceLocalPath: '{~D:Record.TaskOutputs.' + tmpVfe + '-resolve.LocalPath~}',
				Filename: '{~D:Record.TaskOutputs.' + tmpVfe + '-resolve.Filename~}',
				TimeoutMs: 1800000
			},
			['SourceURL', 'SourceLocalPath', 'Filename', 'TimeoutMs'], ['LocalPath', 'BytesTransferred', 'DurationMs', 'Strategy']),
		_taskNode(tmpVfe + '-probe', 'beacon-mediaconversion-mediaprobe', 'Probe Video', 660, 180,
			{
				AffinityKey: '{~D:Record.Operation.VideoAddress~}',
				TimeoutMs: 600000
			},
			['InputFile'], ['Result', 'StdOut']),
		_taskNode(tmpVfe + '-extract', 'beacon-mediaconversion-videoextractframe', 'Extract Frame', 880, 180,
			{
				OutputFile: 'frame.jpg',
				Timestamp: '{~D:Record.Operation.Timestamp~}',
				Width: '{~D:Record.Operation.Width~}',
				AffinityKey: '{~D:Record.Operation.VideoAddress~}',
				TimeoutMs: 600000
			},
			['InputFile', 'OutputFile', 'Timestamp', 'Width'], ['Result', 'StdOut']),
		_taskNode(tmpVfe + '-result', 'send-result', 'Send Result', 1100, 180,
			{ FilePath: 'frame.jpg', OutputKey: 'ResultFile' },
			['FilePath'], ['BytesSent', 'DurationMs']),
		_endNode(tmpVfe, 1320, 260)
	];
	let tmpVfeConns = _chainConnections(tmpVfe,
		[tmpVfe + '-start', tmpVfe + '-resolve', tmpVfe + '-transfer', tmpVfe + '-probe', tmpVfe + '-extract', tmpVfe + '-result'],
		tmpVfe + '-end');
	// State wires
	tmpVfeConns.push({ Hash: tmpVfe + '-s1', SourceNodeHash: tmpVfe + '-resolve', SourcePortHash: tmpVfe + '-resolve-so-URL', TargetNodeHash: tmpVfe + '-transfer', TargetPortHash: tmpVfe + '-transfer-si-SourceURL', Data: {} });
	tmpVfeConns.push({ Hash: tmpVfe + '-s2', SourceNodeHash: tmpVfe + '-resolve', SourcePortHash: tmpVfe + '-resolve-so-Filename', TargetNodeHash: tmpVfe + '-transfer', TargetPortHash: tmpVfe + '-transfer-si-Filename', Data: {} });
	tmpVfeConns.push({ Hash: tmpVfe + '-s3', SourceNodeHash: tmpVfe + '-transfer', SourcePortHash: tmpVfe + '-transfer-so-LocalPath', TargetNodeHash: tmpVfe + '-probe', TargetPortHash: tmpVfe + '-probe-si-InputFile', Data: {} });
	tmpVfeConns.push({ Hash: tmpVfe + '-s4', SourceNodeHash: tmpVfe + '-transfer', SourcePortHash: tmpVfe + '-transfer-so-LocalPath', TargetNodeHash: tmpVfe + '-extract', TargetPortHash: tmpVfe + '-extract-si-InputFile', Data: {} });
	// Resolve LocalPath → transfer SourceLocalPath (shared-fs zero-copy fast path)
	tmpVfeConns.push({ Hash: tmpVfe + '-s5', SourceNodeHash: tmpVfe + '-resolve', SourcePortHash: tmpVfe + '-resolve-so-LocalPath', TargetNodeHash: tmpVfe + '-transfer', TargetPortHash: tmpVfe + '-transfer-si-SourceLocalPath', Data: {} });
	tmpOperations.push({
		Hash: tmpVfe,
		Name: 'Video Frame Extraction',
		Description: 'Full pipeline: resolve → download → probe → extract frame → send result. Trigger with Parameters: { VideoAddress, Timestamp, Width }.',
		Tags: ['retold-remote', 'media', 'video', 'frames'],
		Author: 'retold-remote',
		Version: '3.0.0',
		Graph: { Nodes: tmpVfeNodes, Connections: tmpVfeConns, ViewState: { PanX: 0, PanY: 0, Zoom: 1, SelectedNodeHash: null, SelectedConnectionHash: null } },
		SavedLayouts: [],
		InitialGlobalState: {},
		InitialOperationState: {}
	});

	// ── 3b. Video Frames (BATCH) ────────────────────────────────
	// Single dispatch that resolves the address once, transfers the file
	// once (with shared-fs zero-copy when available), and extracts ALL N
	// frames in a single beacon work item. Used by the video explorer to
	// avoid the previous N×operation-graph dispatch storm where N frames
	// produced 21 separate file transfers (1 probe + N extracts).
	//
	// Trigger Parameters:
	//   { VideoAddress, OutputDir, Frames, Width }
	//   OutputDir — absolute writable directory where frames will land. Set
	//               to retold-remote's per-video cache directory; works in
	//               stack mode (shared filesystem) and on multi-host setups
	//               that bind-mount the same content tree.
	//   Frames    — JSON-encoded [{ Timestamp, Filename }, ...]
	//
	// Returns (no send-result; read TaskOutputs[<extract-node>].Result):
	//   JSON string with { FrameCount, SuccessCount, OutputDir, Frames: [...] }
	let tmpVfb = 'rr-video-frames-batch';
	let tmpVfbNodes = [
		_startNode(tmpVfb, 50, 200),
		_taskNode(tmpVfb + '-resolve', 'resolve-address', 'Resolve Address', 220, 180,
			{ Address: '{~D:Record.Operation.VideoAddress~}' },
			['Address'], ['URL', 'Filename', 'BeaconName', 'LocalPath', 'Strategy']),
		_taskNode(tmpVfb + '-transfer', 'file-transfer', 'File Transfer', 440, 180,
			{
				SourceURL: '{~D:Record.TaskOutputs.' + tmpVfb + '-resolve.URL~}',
				SourceLocalPath: '{~D:Record.TaskOutputs.' + tmpVfb + '-resolve.LocalPath~}',
				Filename: '{~D:Record.TaskOutputs.' + tmpVfb + '-resolve.Filename~}',
				TimeoutMs: 1800000
			},
			['SourceURL', 'SourceLocalPath', 'Filename', 'TimeoutMs'],
			['LocalPath', 'BytesTransferred', 'DurationMs', 'Strategy']),
		_taskNode(tmpVfb + '-extract', 'beacon-mediaconversion-videoextractframes', 'Extract Frames Batch', 660, 180,
			{
				OutputDir: '{~D:Record.Operation.OutputDir~}',
				Frames: '{~D:Record.Operation.Frames~}',
				Width: '{~D:Record.Operation.Width~}',
				AffinityKey: '{~D:Record.Operation.VideoAddress~}',
				TimeoutMs: 1800000
			},
			['InputFile', 'OutputDir', 'Frames', 'Width'],
			['Result', 'StdOut']),
		_endNode(tmpVfb, 880, 260)
	];
	let tmpVfbConns = _chainConnections(tmpVfb,
		[tmpVfb + '-start', tmpVfb + '-resolve', tmpVfb + '-transfer', tmpVfb + '-extract'],
		tmpVfb + '-end');
	// State wires
	tmpVfbConns.push({ Hash: tmpVfb + '-s1', SourceNodeHash: tmpVfb + '-resolve', SourcePortHash: tmpVfb + '-resolve-so-URL', TargetNodeHash: tmpVfb + '-transfer', TargetPortHash: tmpVfb + '-transfer-si-SourceURL', Data: {} });
	tmpVfbConns.push({ Hash: tmpVfb + '-s2', SourceNodeHash: tmpVfb + '-resolve', SourcePortHash: tmpVfb + '-resolve-so-Filename', TargetNodeHash: tmpVfb + '-transfer', TargetPortHash: tmpVfb + '-transfer-si-Filename', Data: {} });
	tmpVfbConns.push({ Hash: tmpVfb + '-s3', SourceNodeHash: tmpVfb + '-transfer', SourcePortHash: tmpVfb + '-transfer-so-LocalPath', TargetNodeHash: tmpVfb + '-extract', TargetPortHash: tmpVfb + '-extract-si-InputFile', Data: {} });
	// Resolve LocalPath → transfer SourceLocalPath (shared-fs zero-copy fast path)
	tmpVfbConns.push({ Hash: tmpVfb + '-s4', SourceNodeHash: tmpVfb + '-resolve', SourcePortHash: tmpVfb + '-resolve-so-LocalPath', TargetNodeHash: tmpVfb + '-transfer', TargetPortHash: tmpVfb + '-transfer-si-SourceLocalPath', Data: {} });
	tmpOperations.push({
		Hash: tmpVfb,
		Name: 'Video Frames Batch',
		Description: 'Single-dispatch batch frame extraction. resolve → transfer → extract-many. Trigger with Parameters: { VideoAddress, OutputDir, Frames (JSON), Width }. Result is JSON metadata only — frames are written to OutputDir and read directly by the dispatcher.',
		Tags: ['retold-remote', 'media', 'video', 'frames', 'batch'],
		Author: 'retold-remote',
		Version: '3.0.0',
		Graph: { Nodes: tmpVfbNodes, Connections: tmpVfbConns, ViewState: { PanX: 0, PanY: 0, Zoom: 1, SelectedNodeHash: null, SelectedConnectionHash: null } },
		SavedLayouts: [],
		InitialGlobalState: {},
		InitialOperationState: {}
	});

	// ── 4. Audio Waveform ───────────────────────────────────────
	tmpOperations.push(_buildPipelineOperation(
	{
		Hash: 'rr-audio-waveform',
		Name: 'Audio Waveform',
		Description: 'Extract waveform peak data from an audio file. Pipeline: resolve → download → extract waveform → send result. Trigger with Parameters: { AudioAddress, SampleRate, Samples }.',
		Tags: ['media', 'audio', 'waveform'],
		AddressParam: 'AudioAddress',
		TransferTimeoutMs: 600000,
		ProcessType: 'beacon-mediaconversion-audiowaveform',
		ProcessTitle: 'Extract Waveform',
		ProcessData:
		{
			SampleRate: '{~D:Record.Operation.SampleRate~}',
			Samples: '{~D:Record.Operation.Samples~}',
			TimeoutMs: 120000
		},
		ProcessSettings: ['InputFile', 'SampleRate', 'Samples'],
		ProcessOutputs: ['Result', 'StdOut'],
		OutputFile: 'waveform.json'
	}));

	// ── 5. Audio Segment Extract ────────────────────────────────
	tmpOperations.push(_buildPipelineOperation(
	{
		Hash: 'rr-audio-segment',
		Name: 'Audio Segment Extract',
		Description: 'Extract a time-range segment from an audio file. Pipeline: resolve → download → extract segment → send result. Trigger with Parameters: { AudioAddress, Start, Duration, Codec }.',
		Tags: ['media', 'audio', 'segment'],
		AddressParam: 'AudioAddress',
		TransferTimeoutMs: 600000,
		ProcessType: 'beacon-mediaconversion-audioextractsegment',
		ProcessTitle: 'Extract Segment',
		ProcessData:
		{
			OutputFile: 'segment.mp3',
			Start: '{~D:Record.Operation.Start~}',
			Duration: '{~D:Record.Operation.Duration~}',
			Codec: '{~D:Record.Operation.Codec~}',
			TimeoutMs: 60000
		},
		ProcessSettings: ['InputFile', 'OutputFile', 'Start', 'Duration', 'Codec'],
		ProcessOutputs: ['Result', 'StdOut'],
		OutputFile: 'segment.mp3'
	}));

	// ── 6. PDF Page Render ──────────────────────────────────────
	tmpOperations.push(_buildPipelineOperation(
	{
		Hash: 'rr-pdf-page-render',
		Name: 'PDF Page Render',
		Description: 'Render a PDF page as a PNG image. Pipeline: resolve → download → render → send result. Trigger with Parameters: { PdfAddress, Page, LongSidePixels }.',
		Tags: ['media', 'document', 'pdf'],
		AddressParam: 'PdfAddress',
		ProcessType: 'beacon-mediaconversion-pdfpagetopngsized',
		ProcessTitle: 'Render PDF Page',
		ProcessData:
		{
			OutputFile: 'page.png',
			Page: '{~D:Record.Operation.Page~}',
			LongSidePixels: '{~D:Record.Operation.LongSidePixels~}',
			TimeoutMs: 300000
		},
		ProcessSettings: ['InputFile', 'OutputFile', 'Page', 'LongSidePixels'],
		ProcessOutputs: ['Result', 'StdOut'],
		OutputFile: 'page.png'
	}));

	// ── 7. Image Format Convert ─────────────────────────────────
	tmpOperations.push(_buildPipelineOperation(
	{
		Hash: 'rr-image-convert',
		Name: 'Image Format Convert',
		Description: 'Convert an image between formats. Pipeline: resolve → download → convert → send result. Trigger with Parameters: { ImageAddress, Format, Quality }.',
		Tags: ['media', 'image', 'convert'],
		AddressParam: 'ImageAddress',
		ProcessType: 'beacon-mediaconversion-imageconvert',
		ProcessTitle: 'Convert Format',
		ProcessData:
		{
			OutputFile: 'converted.jpg',
			Format: '{~D:Record.Operation.Format~}',
			Quality: '{~D:Record.Operation.Quality~}',
			TimeoutMs: 120000
		},
		ProcessSettings: ['InputFile', 'OutputFile', 'Format', 'Quality'],
		ProcessOutputs: ['Result', 'StdOut'],
		OutputFile: 'converted.jpg'
	}));

	// ── 8. Ebook Convert ────────────────────────────────────────
	tmpOperations.push(_buildPipelineOperation(
	{
		Hash: 'rr-ebook-convert',
		Name: 'Ebook Convert',
		Description: 'Convert an ebook (MOBI, AZW) to EPUB. Pipeline: resolve → download → convert → send result. Trigger with Parameters: { EbookAddress }.',
		Tags: ['media', 'ebook', 'conversion'],
		AddressParam: 'EbookAddress',
		ProcessType: 'beacon-dispatch',
		ProcessTitle: 'Convert to EPUB',
		ProcessData:
		{
			RemoteCapability: 'Shell',
			RemoteAction: 'Execute',
			Command: 'ebook-convert "{SourcePath}" "{OutputPath}"',
			TimeoutMs: 180000
		},
		ProcessSettings: ['InputFile', 'RemoteCapability', 'RemoteAction', 'Command'],
		ProcessOutputs: ['Result', 'StdOut', 'ExitCode', 'BeaconID'],
		OutputFile: 'converted.epub'
	}));

	// ── 9. Media Probe ─────────────────────────────────────────
	tmpOperations.push(_buildPipelineOperation(
	{
		Hash: 'rr-media-probe',
		Name: 'Media Probe',
		Description: 'Extract metadata from a media file via ffprobe. Pipeline: resolve → download → probe → send result. Trigger with Parameters: { MediaAddress }.',
		Tags: ['media', 'probe', 'metadata'],
		AddressParam: 'MediaAddress',
		ProcessType: 'beacon-mediaconversion-mediaprobe',
		ProcessTitle: 'Probe Metadata',
		ProcessData:
		{
			TimeoutMs: 300000
		},
		ProcessSettings: ['InputFile'],
		ProcessOutputs: ['Result', 'StdOut'],
		OutputFile: 'probe.json'
	}));

	return tmpOperations;
}


module.exports = { getOperations };
