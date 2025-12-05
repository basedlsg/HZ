'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [status, setStatus] = useState<'loading' | 'ready' | 'recording' | 'preview' | 'uploading' | 'error'>('loading');
  const [recordingTime, setRecordingTime] = useState(0);
  const [message, setMessage] = useState('Initializing camera...');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [mimeType, setMimeType] = useState<string>('video/webm');
  const [debugLogs, setDebugLogs] = useState<string[]>(['Camera page loaded']);

  const router = useRouter();

  const addLog = (msg: string) => {
    console.log('[Camera]', msg);
    setDebugLogs(prev => [...prev.slice(-6), `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  // Detect MIME type on mount
  useEffect(() => {
    addLog('Detecting MIME type...');
    const types = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm', 'video/webm;codecs=vp8'];
    for (const type of types) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
        setMimeType(type);
        addLog(`MIME: ${type}`);
        break;
      }
    }
  }, []);

  // Start camera on mount and when facingMode changes
  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [facingMode]);

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'recording') {
      interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [status]);

  const startCamera = async () => {
    addLog('startCamera() called');
    setStatus('loading');
    setMessage('Requesting camera access...');

    // Check secure context
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      addLog('ERROR: Not secure context');
      setStatus('error');
      setMessage('HTTPS is required for camera access');
      return;
    }

    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addLog('ERROR: getUserMedia not available');
      setStatus('error');
      setMessage('Camera API not available on this device');
      return;
    }

    try {
      addLog('Requesting stream...');

      // Try with simple constraints first (more compatible)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: true,
        });
        addLog('Got stream with basic constraints');
      } catch (e: any) {
        addLog(`Basic failed: ${e.message}, trying video-only...`);
        // Try without audio as fallback
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: false,
        });
        addLog('Got stream without audio');
      }

      if (!videoRef.current) {
        addLog('ERROR: videoRef is null');
        setStatus('error');
        setMessage('Video element not found');
        return;
      }

      addLog('Setting srcObject...');
      videoRef.current.srcObject = stream;

      // Wait for video to be ready
      videoRef.current.onloadedmetadata = () => {
        addLog(`Metadata loaded: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
      };

      videoRef.current.oncanplay = () => {
        addLog('canplay event fired');
      };

      // Try to play
      addLog('Calling play()...');
      await videoRef.current.play();
      addLog('Video playing successfully!');

      setStatus('ready');
      setMessage('');

    } catch (error: any) {
      addLog(`ERROR: ${error.name} - ${error.message}`);
      setStatus('error');
      setMessage(`Camera Error: ${error.message}`);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      addLog('Camera stopped');
    }
  };

  const startRecording = () => {
    if (!videoRef.current?.srcObject) {
      addLog('Cannot record: no stream');
      return;
    }

    addLog('Starting recording...');
    const stream = videoRef.current.srcObject as MediaStream;

    try {
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        addLog('Recording stopped');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setStatus('preview');
      };

      recorder.start();
      setStatus('recording');
      setRecordingTime(0);
      addLog('Recording started');
    } catch (e: any) {
      addLog(`Record error: ${e.message}`);
      setMessage(`Recording failed: ${e.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && status === 'recording') {
      mediaRecorderRef.current.stop();
      addLog('Stopping recording...');
    }
  };

  const discardRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setStatus('ready');
    addLog('Recording discarded');
  };

  const toggleCamera = () => {
    stopCamera();
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
    addLog(`Switching to ${facingMode === 'user' ? 'back' : 'front'} camera`);
  };

  const uploadVideo = async () => {
    if (!recordedBlob) return;

    const sessionData = localStorage.getItem('hotzones-session');
    if (!sessionData) {
      setMessage('⚠️ Please check in first');
      return;
    }
    const session = JSON.parse(sessionData);

    setStatus('uploading');
    setMessage('Uploading...');
    addLog('Starting upload...');

    try {
      // 1. Init multipart
      const initRes = await fetch('/api/upload-multipart/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: mimeType }),
      });
      if (!initRes.ok) throw new Error('Init failed');
      const { uploadId, key, videoId } = await initRes.json();
      addLog('Upload initialized');

      // 2. Upload parts
      const CHUNK_SIZE = 6 * 1024 * 1024;
      const totalParts = Math.ceil(recordedBlob.size / CHUNK_SIZE);
      const parts = [];

      for (let i = 0; i < totalParts; i++) {
        const chunk = recordedBlob.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, recordedBlob.size));
        const partNumber = i + 1;
        setMessage(`Uploading ${partNumber}/${totalParts}...`);

        const partRes = await fetch('/api/upload-multipart/part', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, key, partNumber }),
        });
        if (!partRes.ok) throw new Error(`Part ${partNumber} URL failed`);
        const { presignedUrl } = await partRes.json();

        const uploadRes = await fetch(presignedUrl, { method: 'PUT', body: chunk });
        if (!uploadRes.ok) throw new Error(`Part ${partNumber} upload failed`);

        const eTag = uploadRes.headers.get('ETag');
        if (!eTag) throw new Error(`No ETag for part ${partNumber}`);
        parts.push({ PartNumber: partNumber, ETag: eTag });
        addLog(`Part ${partNumber}/${totalParts} done`);
      }

      // 3. Complete
      setMessage('Finalizing...');
      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('key', key);
      formData.append('videoId', videoId);
      formData.append('parts', JSON.stringify(parts));
      formData.append('sessionId', session.sessionId);
      formData.append('duration', recordingTime.toString());
      formData.append('size', recordedBlob.size.toString());

      const completeRes = await fetch('/api/upload-multipart/complete', { method: 'POST', body: formData });
      if (!completeRes.ok) throw new Error('Complete failed');

      addLog('Upload complete!');
      setMessage('✓ Uploaded!');
      setTimeout(() => router.push('/videos'), 1500);

    } catch (error: any) {
      addLog(`Upload error: ${error.message}`);
      setMessage(`Upload failed: ${error.message}`);
      setStatus('preview');
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">

      {/* Video Area */}
      <div className="flex-1 relative bg-gray-900">
        {status !== 'preview' ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : recordedUrl ? (
          <video
            ref={playbackRef}
            src={recordedUrl}
            controls
            playsInline
            loop
            className="absolute inset-0 w-full h-full object-contain bg-black"
          />
        ) : null}

        {/* Loading/Error overlay */}
        {(status === 'loading' || status === 'error') && (
          <div className="absolute inset-0 flex items-center justify-center bg-black">
            <div className="text-center p-4">
              {status === 'loading' && (
                <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
              )}
              <p className="text-lg">{message}</p>
              {status === 'error' && (
                <button onClick={startCamera} className="mt-4 bg-purple-600 px-6 py-2 rounded-lg">
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Recording indicator */}
        {status === 'recording' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-600/80 px-4 py-2 rounded-full">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="font-mono font-bold">{formatTime(recordingTime)}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="bg-black p-4 pb-8 safe-area-inset-bottom">
        {status === 'ready' && (
          <div className="flex items-center justify-center gap-8">
            <button onClick={toggleCamera} className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
              🔄
            </button>
            <button onClick={startRecording} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center">
              <div className="w-16 h-16 bg-red-600 rounded-full" />
            </button>
            <Link href="/videos" className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl">
              📹
            </Link>
          </div>
        )}

        {status === 'recording' && (
          <div className="flex flex-col items-center gap-4">
            <button onClick={stopRecording} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center">
              <div className="w-8 h-8 bg-red-600 rounded-sm" />
            </button>
          </div>
        )}

        {status === 'preview' && (
          <div className="flex gap-4">
            <button onClick={discardRecording} className="flex-1 bg-gray-700 py-4 rounded-xl font-semibold">
              Discard
            </button>
            <button onClick={uploadVideo} className="flex-1 bg-purple-600 py-4 rounded-xl font-semibold">
              Upload
            </button>
          </div>
        )}

        {status === 'uploading' && (
          <div className="text-center py-4">
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2" />
            <p>{message}</p>
          </div>
        )}
      </div>

      {/* Debug overlay - LAST ELEMENT for highest z-index */}
      <div className="fixed top-4 left-4 right-4 z-[9999] pointer-events-none">
        <div className="bg-black/90 border border-green-500/50 rounded-lg p-3 text-xs font-mono text-green-400 max-h-48 overflow-y-auto">
          <div className="font-bold text-green-300 mb-1">DEBUG ({status})</div>
          {debugLogs.map((log, i) => (
            <div key={i} className="opacity-80">{log}</div>
          ))}
        </div>
      </div>

      {/* Back button */}
      <Link href="/" className="fixed top-4 right-4 z-[9998] w-10 h-10 flex items-center justify-center bg-black/50 backdrop-blur rounded-full text-xl">
        ✕
      </Link>
    </div>
  );
}
