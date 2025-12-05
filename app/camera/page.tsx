'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Version for debugging deployment
const VERSION = 'v2.0.0-ios-fix';

export default function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [phase, setPhase] = useState<'init' | 'ready' | 'recording' | 'preview' | 'uploading'>('init');
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadProgress, setUploadProgress] = useState('');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const [logs, setLogs] = useState<string[]>([`${VERSION} loaded`]);

  const router = useRouter();

  const log = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[Camera] ${msg}`);
    setLogs(prev => [...prev.slice(-8), `${timestamp}: ${msg}`]);
  }, []);

  // Detect best MIME type for this device
  const getMimeType = useCallback(() => {
    if (typeof MediaRecorder === 'undefined') return null;
    const types = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        log(`Using MIME: ${type}`);
        return type;
      }
    }
    return null;
  }, [log]);

  // Initialize camera - wrapped in useCallback to avoid re-creation
  const initCamera = useCallback(async () => {
    log('initCamera() starting...');
    setPhase('init');
    setError(null);

    // Check secure context
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      log('ERROR: Not HTTPS');
      setError('HTTPS required for camera access');
      return;
    }

    // Check API availability
    if (!navigator.mediaDevices?.getUserMedia) {
      log('ERROR: getUserMedia not available');
      setError('Camera API not available');
      return;
    }

    try {
      // Stop any existing stream first
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }

      log(`Requesting camera (front: ${useFrontCamera})...`);

      // Use simplest possible constraints for maximum iOS compatibility
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: useFrontCamera ? 'user' : 'environment' },
        audio: true
      });

      log(`Got stream: ${stream.getVideoTracks().length} video, ${stream.getAudioTracks().length} audio`);
      streamRef.current = stream;

      // CRITICAL: Set video element properties BEFORE assigning srcObject
      if (videoRef.current) {
        const video = videoRef.current;
        video.setAttribute('autoplay', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('muted', '');
        video.muted = true;
        video.playsInline = true;

        video.srcObject = stream;

        // iOS requires explicit play() call
        log('Calling video.play()...');
        await video.play();
        log(`Playing! ${video.videoWidth}x${video.videoHeight}`);

        setPhase('ready');
      } else {
        throw new Error('Video element not found');
      }

    } catch (err: any) {
      log(`ERROR: ${err.name} - ${err.message}`);
      setError(`Camera error: ${err.message}`);
    }
  }, [useFrontCamera, log]);

  // Start camera on mount
  useEffect(() => {
    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [initCamera]);

  // Recording timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (phase === 'recording') {
      interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [phase]);

  const startRecording = () => {
    if (!streamRef.current) {
      log('Cannot record: no stream');
      return;
    }

    const mimeType = getMimeType();
    if (!mimeType) {
      setError('Recording not supported on this device');
      return;
    }

    log('Starting recording...');
    chunksRef.current = [];

    try {
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        log('Recording stopped, creating blob...');
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        log(`Blob created: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        setPhase('preview');
      };

      recorder.start(1000); // Get data every second for more reliable recording
      setRecordingTime(0);
      setPhase('recording');
      log('Recording started');

    } catch (err: any) {
      log(`Record error: ${err.message}`);
      setError(`Recording failed: ${err.message}`);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && phase === 'recording') {
      log('Stopping recording...');
      mediaRecorderRef.current.stop();
    }
  };

  const discardRecording = () => {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setPhase('ready');
    log('Recording discarded');
  };

  const switchCamera = async () => {
    log('Switching camera...');
    setUseFrontCamera(prev => !prev);
    // initCamera will be called automatically due to useEffect dependency
  };

  // Re-init when camera direction changes
  useEffect(() => {
    if (phase === 'ready' || phase === 'init') {
      initCamera();
    }
  }, [useFrontCamera]);

  const uploadVideo = async () => {
    if (!recordedBlob) return;

    const session = localStorage.getItem('hotzones-session');
    if (!session) {
      setError('Please check in first');
      return;
    }

    setPhase('uploading');
    setUploadProgress('Initializing...');
    log('Starting upload...');

    try {
      const mimeType = getMimeType() || 'video/webm';

      // 1. Initialize upload
      const initRes = await fetch('/api/upload-multipart/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: mimeType }),
      });

      if (!initRes.ok) throw new Error('Failed to initialize upload');
      const { uploadId, key, videoId } = await initRes.json();
      log('Upload initialized');

      // 2. Upload in chunks
      const CHUNK_SIZE = 6 * 1024 * 1024;
      const totalParts = Math.ceil(recordedBlob.size / CHUNK_SIZE);
      const parts: { PartNumber: number; ETag: string }[] = [];

      for (let i = 0; i < totalParts; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, recordedBlob.size);
        const chunk = recordedBlob.slice(start, end);
        const partNum = i + 1;

        setUploadProgress(`Part ${partNum}/${totalParts}`);

        // Get presigned URL
        const partRes = await fetch('/api/upload-multipart/part', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, key, partNumber: partNum }),
        });

        if (!partRes.ok) throw new Error(`Failed to get URL for part ${partNum}`);
        const { presignedUrl } = await partRes.json();

        // Upload to R2
        const uploadRes = await fetch(presignedUrl, { method: 'PUT', body: chunk });
        if (!uploadRes.ok) throw new Error(`Failed to upload part ${partNum}`);

        const eTag = uploadRes.headers.get('ETag');
        if (!eTag) throw new Error(`No ETag for part ${partNum}`);

        parts.push({ PartNumber: partNum, ETag: eTag });
        log(`Part ${partNum}/${totalParts} uploaded`);
      }

      // 3. Complete upload
      setUploadProgress('Finalizing...');
      const sessionData = JSON.parse(session);

      const formData = new FormData();
      formData.append('uploadId', uploadId);
      formData.append('key', key);
      formData.append('videoId', videoId);
      formData.append('parts', JSON.stringify(parts));
      formData.append('sessionId', sessionData.sessionId);
      formData.append('duration', recordingTime.toString());
      formData.append('size', recordedBlob.size.toString());

      const completeRes = await fetch('/api/upload-multipart/complete', {
        method: 'POST',
        body: formData,
      });

      if (!completeRes.ok) throw new Error('Failed to complete upload');

      log('Upload complete!');
      setUploadProgress('Success!');

      setTimeout(() => router.push('/videos'), 1500);

    } catch (err: any) {
      log(`Upload error: ${err.message}`);
      setError(`Upload failed: ${err.message}`);
      setPhase('preview');
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col">
      {/* Video display area */}
      <div className="flex-1 relative bg-gray-900 overflow-hidden">
        {phase !== 'preview' ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute inset-0 w-full h-full object-cover"
            style={{ transform: useFrontCamera ? 'scaleX(-1)' : 'none' }}
          />
        ) : recordedUrl ? (
          <video
            ref={playbackRef}
            src={recordedUrl}
            controls
            playsInline
            loop
            className="absolute inset-0 w-full h-full object-contain"
          />
        ) : null}

        {/* Loading overlay */}
        {phase === 'init' && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <p className="text-lg">Initializing camera...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center p-6 max-w-sm">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-lg mb-4">{error}</p>
              <button
                onClick={() => { setError(null); initCamera(); }}
                className="bg-purple-600 px-8 py-3 rounded-xl font-semibold"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Recording indicator */}
        {phase === 'recording' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-600 px-4 py-2 rounded-full shadow-lg">
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
            <span className="font-mono font-bold text-lg">{formatTime(recordingTime)}</span>
          </div>
        )}

        {/* Uploading overlay */}
        {phase === 'uploading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
              <p className="text-lg">{uploadProgress}</p>
            </div>
          </div>
        )}
      </div>

      {/* Control bar */}
      <div className="bg-black/90 p-4 pb-8 border-t border-white/10">
        {(phase === 'init' || phase === 'ready') && !error && (
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={switchCamera}
              className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl active:bg-white/20"
            >
              🔄
            </button>
            <button
              onClick={startRecording}
              disabled={phase !== 'ready'}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center disabled:opacity-50"
            >
              <div className="w-14 h-14 bg-red-500 rounded-full" />
            </button>
            <Link
              href="/videos"
              className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl"
            >
              📹
            </Link>
          </div>
        )}

        {phase === 'recording' && (
          <div className="flex justify-center">
            <button
              onClick={stopRecording}
              className="w-20 h-20 rounded-full border-4 border-red-500 flex items-center justify-center"
            >
              <div className="w-8 h-8 bg-red-500 rounded" />
            </button>
          </div>
        )}

        {phase === 'preview' && (
          <div className="flex gap-4">
            <button
              onClick={discardRecording}
              className="flex-1 bg-gray-700 py-4 rounded-xl font-semibold active:bg-gray-600"
            >
              Discard
            </button>
            <button
              onClick={uploadVideo}
              className="flex-1 bg-purple-600 py-4 rounded-xl font-semibold active:bg-purple-500"
            >
              Upload
            </button>
          </div>
        )}
      </div>

      {/* Debug panel - always visible, at very top of z-stack */}
      <div className="fixed top-0 left-0 right-0 z-[99999] bg-black/95 border-b border-green-500/30 p-2 text-xs font-mono text-green-400 max-h-32 overflow-y-auto">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-green-300">DEBUG {VERSION}</span>
          <span className="text-green-500">Phase: {phase}</span>
        </div>
        {logs.map((l, i) => <div key={i} className="opacity-80 truncate">{l}</div>)}
      </div>

      {/* Home button */}
      <Link
        href="/"
        className="fixed bottom-24 right-4 z-[99998] w-12 h-12 bg-white/10 backdrop-blur rounded-full flex items-center justify-center text-xl shadow-lg"
      >
        🏠
      </Link>
    </div>
  );
}
