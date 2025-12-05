'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/**
 * CAMERA v3.0.0 - BULLETPROOF iOS BUILD
 * 
 * This is a minimal rebuild with:
 * - Maximum visibility of state (no hidden debug panels)
 * - Timeout wrapper for getUserMedia
 * - Simple CSS (no absolute/fixed positioning for video)
 * - Explicit feature detection
 * - Every step logged to visible UI
 */

const VERSION = 'v3.0.0-bulletproof';

// Timeout wrapper for getUserMedia
async function getUserMediaWithTimeout(
  constraints: MediaStreamConstraints,
  timeoutMs: number = 10000
): Promise<MediaStream> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`getUserMedia timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    navigator.mediaDevices
      .getUserMedia(constraints)
      .then((stream) => {
        clearTimeout(timer);
        resolve(stream);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export default function CameraView() {
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // State
  const [logs, setLogs] = useState<string[]>([`[${VERSION}] Page loaded`]);
  const [status, setStatus] = useState<string>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');

  const router = useRouter();

  // Logging function - adds to UI
  const log = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    const entry = `[${time}] ${msg}`;
    console.log(entry);
    setLogs((prev) => [...prev.slice(-15), entry]);
  };

  // STEP 1: Check browser capabilities
  const checkCapabilities = (): boolean => {
    log('Checking capabilities...');

    if (typeof window === 'undefined') {
      log('ERROR: Running on server');
      return false;
    }

    if (!window.isSecureContext) {
      log('ERROR: Not HTTPS');
      setError('HTTPS required. Please use https://');
      return false;
    }

    if (!navigator.mediaDevices) {
      log('ERROR: mediaDevices not available');
      setError('Your browser does not support camera access');
      return false;
    }

    if (!navigator.mediaDevices.getUserMedia) {
      log('ERROR: getUserMedia not available');
      setError('Your browser does not support getUserMedia');
      return false;
    }

    log('All capabilities OK');
    return true;
  };

  // STEP 2: Start camera (called by user tap)
  const handleStartCamera = async () => {
    log('START CAMERA button pressed');
    setStatus('REQUESTING_CAMERA');
    setError(null);

    if (!checkCapabilities()) {
      setStatus('ERROR');
      return;
    }

    try {
      log('Calling getUserMedia (10s timeout)...');

      const stream = await getUserMediaWithTimeout(
        {
          video: { facingMode: 'environment' },
          audio: true,
        },
        10000
      );

      log(`Stream obtained: ${stream.getTracks().length} tracks`);
      stream.getTracks().forEach((track) => {
        log(`  Track: ${track.kind} - ${track.label}`);
      });

      streamRef.current = stream;

      // Assign to video element
      if (!videoRef.current) {
        throw new Error('Video element not found in DOM');
      }

      log('Assigning stream to video element...');
      videoRef.current.srcObject = stream;

      log('Waiting for video loadedmetadata...');
      await new Promise<void>((resolve, reject) => {
        const video = videoRef.current!;
        const timeout = setTimeout(() => reject(new Error('loadedmetadata timeout')), 5000);
        video.onloadedmetadata = () => {
          clearTimeout(timeout);
          log(`Video metadata: ${video.videoWidth}x${video.videoHeight}`);
          resolve();
        };
        video.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Video element error'));
        };
      });

      log('Calling video.play()...');
      await videoRef.current.play();
      log('Video is now playing!');

      setCameraActive(true);
      setStatus('CAMERA_READY');

    } catch (err: any) {
      log(`ERROR: ${err.name || 'Unknown'} - ${err.message}`);
      setError(err.message || 'Camera failed to start');
      setStatus('ERROR');
      setCameraActive(false);
    }
  };

  // STEP 3: Start recording
  const handleStartRecording = () => {
    if (!streamRef.current) {
      log('Cannot record: no stream');
      return;
    }

    log('Starting recording...');
    chunksRef.current = [];

    // Detect MIME type
    let mimeType = 'video/webm';
    for (const type of ['video/mp4', 'video/webm;codecs=vp9', 'video/webm']) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type;
        break;
      }
    }
    log(`Using MIME: ${mimeType}`);

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
          log(`Chunk received: ${(e.data.size / 1024).toFixed(1)} KB`);
        }
      };

      recorder.onstop = () => {
        log('Recorder stopped');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        log(`Final blob: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setStatus('PREVIEW');

        // Stop camera after recording
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        setCameraActive(false);
      };

      recorder.start(1000); // chunk every second
      setIsRecording(true);
      setRecordingTime(0);
      setStatus('RECORDING');

      // Timer
      const startTime = Date.now();
      const timer = setInterval(() => {
        if (recorderRef.current?.state === 'recording') {
          setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
        } else {
          clearInterval(timer);
        }
      }, 500);

      log('Recording started');
    } catch (err: any) {
      log(`Record error: ${err.message}`);
      setError(`Recording failed: ${err.message}`);
    }
  };

  // STEP 4: Stop recording
  const handleStopRecording = () => {
    if (recorderRef.current && isRecording) {
      log('Stopping recording...');
      recorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Discard recording
  const handleDiscard = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setStatus('IDLE');
    log('Recording discarded');
  };

  // Upload recording
  const handleUpload = async () => {
    if (!recordedBlob) return;

    const session = localStorage.getItem('hotzones-session');
    if (!session) {
      setError('Please check in first');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Initializing...');
    log('Starting upload...');

    try {
      // Detect MIME type
      let mimeType = 'video/webm';
      for (const type of ['video/mp4', 'video/webm;codecs=vp9', 'video/webm']) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type;
          break;
        }
      }

      // Init
      const initRes = await fetch('/api/upload-multipart/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: mimeType }),
      });
      if (!initRes.ok) throw new Error('Init failed');
      const { uploadId, key, videoId } = await initRes.json();
      log('Upload initialized');

      // Upload parts
      const CHUNK = 6 * 1024 * 1024;
      const total = Math.ceil(recordedBlob.size / CHUNK);
      const parts: { PartNumber: number; ETag: string }[] = [];

      for (let i = 0; i < total; i++) {
        const chunk = recordedBlob.slice(i * CHUNK, Math.min((i + 1) * CHUNK, recordedBlob.size));
        setUploadStatus(`Part ${i + 1}/${total}`);

        const partRes = await fetch('/api/upload-multipart/part', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, key, partNumber: i + 1 }),
        });
        if (!partRes.ok) throw new Error(`Part ${i + 1} URL failed`);
        const { presignedUrl } = await partRes.json();

        const upRes = await fetch(presignedUrl, { method: 'PUT', body: chunk });
        if (!upRes.ok) throw new Error(`Part ${i + 1} upload failed`);

        const eTag = upRes.headers.get('ETag');
        if (!eTag) throw new Error(`No ETag for part ${i + 1}`);
        parts.push({ PartNumber: i + 1, ETag: eTag });
        log(`Part ${i + 1}/${total} done`);
      }

      // Complete
      setUploadStatus('Finalizing...');
      const sessionData = JSON.parse(session);
      const form = new FormData();
      form.append('uploadId', uploadId);
      form.append('key', key);
      form.append('videoId', videoId);
      form.append('parts', JSON.stringify(parts));
      form.append('sessionId', sessionData.sessionId);
      form.append('duration', recordingTime.toString());
      form.append('size', recordedBlob.size.toString());

      const compRes = await fetch('/api/upload-multipart/complete', { method: 'POST', body: form });
      if (!compRes.ok) throw new Error('Complete failed');

      log('Upload complete!');
      setUploadStatus('✓ Done!');
      setTimeout(() => router.push('/videos'), 1500);
    } catch (err: any) {
      log(`Upload error: ${err.message}`);
      setError(`Upload failed: ${err.message}`);
      setIsUploading(false);
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#000',
      color: '#fff',
      padding: '10px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      {/* HEADER */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        padding: '5px',
        backgroundColor: '#111',
        borderRadius: '5px'
      }}>
        <Link href="/" style={{ color: '#a78bfa', textDecoration: 'none' }}>← Home</Link>
        <span style={{ fontSize: '12px', color: '#4ade80' }}>{VERSION}</span>
        <span style={{ fontSize: '12px', color: '#facc15' }}>{status}</span>
      </div>

      {/* PAGE IDENTIFIER - Very visible */}
      <div style={{
        backgroundColor: '#7c3aed',
        padding: '10px',
        textAlign: 'center',
        borderRadius: '5px',
        marginBottom: '10px',
        fontWeight: 'bold'
      }}>
        📹 CAMERA PAGE - /camera
      </div>

      {/* VIDEO CONTAINER */}
      <div style={{
        width: '100%',
        aspectRatio: '9/16',
        maxHeight: '50vh',
        backgroundColor: '#1f2937',
        borderRadius: '10px',
        overflow: 'hidden',
        marginBottom: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        {/* Video element - always in DOM */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: cameraActive ? 'block' : 'none'
          }}
        />

        {/* Preview video */}
        {recordedUrl && status === 'PREVIEW' && (
          <video
            src={recordedUrl}
            controls
            playsInline
            loop
            autoPlay
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        )}

        {/* Placeholder when no camera */}
        {!cameraActive && !recordedUrl && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>📷</div>
            <div style={{ color: '#9ca3af' }}>Camera not started</div>
          </div>
        )}

        {/* Recording overlay */}
        {isRecording && (
          <div style={{
            position: 'absolute',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#dc2626',
            padding: '5px 15px',
            borderRadius: '20px',
            fontWeight: 'bold'
          }}>
            ● {formatTime(recordingTime)}
          </div>
        )}
      </div>

      {/* ERROR DISPLAY */}
      {error && (
        <div style={{
          backgroundColor: '#7f1d1d',
          padding: '15px',
          borderRadius: '5px',
          marginBottom: '10px',
          textAlign: 'center'
        }}>
          ⚠️ {error}
          <button
            onClick={() => setError(null)}
            style={{
              marginLeft: '10px',
              padding: '5px 10px',
              backgroundColor: '#991b1b',
              border: 'none',
              borderRadius: '3px',
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* CONTROLS */}
      <div style={{ marginBottom: '10px' }}>
        {status === 'IDLE' && (
          <button
            onClick={handleStartCamera}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#7c3aed',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            📹 Start Camera
          </button>
        )}

        {status === 'REQUESTING_CAMERA' && (
          <div style={{ textAlign: 'center', padding: '15px' }}>
            <div style={{ fontSize: '24px', marginBottom: '5px' }}>⏳</div>
            <div>Requesting camera access...</div>
          </div>
        )}

        {status === 'CAMERA_READY' && (
          <button
            onClick={handleStartRecording}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#dc2626',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ⏺ Start Recording
          </button>
        )}

        {status === 'RECORDING' && (
          <button
            onClick={handleStopRecording}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#991b1b',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            ⏹ Stop Recording
          </button>
        )}

        {status === 'PREVIEW' && !isUploading && (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleDiscard}
              style={{
                flex: 1,
                padding: '15px',
                backgroundColor: '#374151',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              🗑 Discard
            </button>
            <button
              onClick={handleUpload}
              style={{
                flex: 1,
                padding: '15px',
                backgroundColor: '#059669',
                border: 'none',
                borderRadius: '10px',
                color: '#fff',
                fontSize: '16px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
            >
              ⬆ Upload
            </button>
          </div>
        )}

        {isUploading && (
          <div style={{ textAlign: 'center', padding: '15px' }}>
            <div style={{ fontSize: '24px', marginBottom: '5px' }}>⬆️</div>
            <div>{uploadStatus}</div>
          </div>
        )}

        {status === 'ERROR' && (
          <button
            onClick={() => { setError(null); setStatus('IDLE'); }}
            style={{
              width: '100%',
              padding: '15px',
              backgroundColor: '#7c3aed',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '18px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            🔄 Try Again
          </button>
        )}
      </div>

      {/* LOG DISPLAY - Always visible */}
      <div style={{
        backgroundColor: '#0f172a',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '11px',
        fontFamily: 'monospace',
        maxHeight: '150px',
        overflowY: 'auto',
        border: '1px solid #334155'
      }}>
        <div style={{
          color: '#4ade80',
          marginBottom: '5px',
          fontWeight: 'bold',
          borderBottom: '1px solid #334155',
          paddingBottom: '5px'
        }}>
          DEBUG LOGS
        </div>
        {logs.map((log, i) => (
          <div key={i} style={{ color: '#94a3b8', marginBottom: '2px' }}>{log}</div>
        ))}
      </div>

      {/* QUICK LINKS */}
      <div style={{
        display: 'flex',
        gap: '10px',
        marginTop: '10px',
        justifyContent: 'center'
      }}>
        <Link href="/" style={{ color: '#a78bfa', fontSize: '14px' }}>🏠 Home</Link>
        <Link href="/videos" style={{ color: '#a78bfa', fontSize: '14px' }}>📹 Videos</Link>
      </div>
    </div>
  );
}
