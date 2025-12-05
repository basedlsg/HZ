'use client';

import { useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// Version for debugging deployment
const VERSION = 'v2.1.0-ios-gesture';

export default function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [phase, setPhase] = useState<'start' | 'init' | 'ready' | 'recording' | 'preview' | 'uploading'>('start');
  const [error, setError] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadProgress, setUploadProgress] = useState('');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [useFrontCamera, setUseFrontCamera] = useState(false);
  const [logs, setLogs] = useState<string[]>([`${VERSION} loaded`]);
  const [mimeType, setMimeType] = useState<string>('video/webm');

  const router = useRouter();

  const log = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[Camera] ${msg}`);
    setLogs(prev => [...prev.slice(-8), `${timestamp}: ${msg}`]);
  }, []);

  // Detect best MIME type for this device
  const detectMimeType = useCallback(() => {
    if (typeof MediaRecorder === 'undefined') return 'video/webm';
    const types = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        log(`MIME: ${type}`);
        return type;
      }
    }
    return 'video/webm';
  }, [log]);

  // Initialize camera - MUST be called from user gesture on iOS
  const startCamera = useCallback(async () => {
    log('startCamera() - user triggered');
    setPhase('init');
    setError(null);

    // Detect MIME type
    const detectedMime = detectMimeType();
    setMimeType(detectedMime);

    // Check secure context
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      log('ERROR: Not HTTPS');
      setError('HTTPS required for camera access. Please use https://');
      return;
    }

    // Check API availability
    if (!navigator.mediaDevices?.getUserMedia) {
      log('ERROR: getUserMedia not available');
      setError('Camera API not available on this browser');
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

      // Assign to video element
      if (videoRef.current) {
        const video = videoRef.current;
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

      // Provide user-friendly error messages
      let userMessage = err.message;
      if (err.name === 'NotAllowedError') {
        userMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        userMessage = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError') {
        userMessage = 'Camera is in use by another app. Please close other apps using the camera.';
      } else if (err.name === 'OverconstrainedError') {
        userMessage = 'Camera settings not supported. Trying again with defaults...';
        // Retry with minimal constraints
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play();
            setPhase('ready');
            return;
          }
        } catch (retryErr: any) {
          userMessage = `Camera error: ${retryErr.message}`;
        }
      }

      setError(userMessage);
    }
  }, [useFrontCamera, log, detectMimeType]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      log('Camera stopped');
    }
  }, [log]);

  const startRecording = () => {
    if (!streamRef.current) {
      log('Cannot record: no stream');
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
        log(`Blob: ${(blob.size / 1024 / 1024).toFixed(2)} MB`);
        setPhase('preview');
        stopCamera(); // Release camera after recording
      };

      // Recording timer
      const startTime = Date.now();
      const timer = setInterval(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
        } else {
          clearInterval(timer);
        }
      }, 1000);

      recorder.start(1000);
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
    setPhase('start'); // Go back to start screen
    log('Recording discarded');
  };

  const switchCamera = () => {
    log('Switching camera...');
    stopCamera();
    setUseFrontCamera(prev => !prev);
    setPhase('start'); // Go back to start to re-trigger with new camera
  };

  const uploadVideo = async () => {
    if (!recordedBlob) return;

    const session = localStorage.getItem('hotzones-session');
    if (!session) {
      setError('Please check in first before uploading');
      return;
    }

    setPhase('uploading');
    setUploadProgress('Initializing...');
    log('Starting upload...');

    try {
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

        setUploadProgress(`Uploading ${partNum}/${totalParts}...`);

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
        log(`Part ${partNum}/${totalParts} done`);
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
      setUploadProgress('✓ Uploaded!');

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
        {/* Hidden video element for camera feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover ${phase === 'ready' || phase === 'recording' ? '' : 'hidden'}`}
          style={{ transform: useFrontCamera ? 'scaleX(-1)' : 'none' }}
        />

        {/* Playback video for preview */}
        {phase === 'preview' && recordedUrl && (
          <video
            ref={playbackRef}
            src={recordedUrl}
            controls
            playsInline
            loop
            autoPlay
            className="absolute inset-0 w-full h-full object-contain"
          />
        )}

        {/* START SCREEN - User must tap to start camera (iOS requirement) */}
        {phase === 'start' && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
            <div className="text-center p-8">
              <div className="text-6xl mb-6">📹</div>
              <h1 className="text-2xl font-bold mb-4">Record Video</h1>
              <p className="text-gray-400 mb-8 max-w-xs">Tap the button below to start the camera</p>
              <button
                onClick={startCamera}
                className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-bold py-4 px-8 rounded-2xl text-lg shadow-lg"
              >
                Start Camera
              </button>
            </div>
          </div>
        )}

        {/* Loading overlay */}
        {phase === 'init' && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
              <p className="text-lg">Starting camera...</p>
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90">
            <div className="text-center p-6 max-w-sm">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-lg mb-6">{error}</p>
              <button
                onClick={() => { setError(null); setPhase('start'); }}
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
        {phase === 'ready' && (
          <div className="flex items-center justify-center gap-8">
            <button
              onClick={switchCamera}
              className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-2xl active:bg-white/20"
            >
              🔄
            </button>
            <button
              onClick={startRecording}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center"
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

        {(phase === 'start' || phase === 'init') && (
          <div className="flex justify-center">
            <Link
              href="/"
              className="text-gray-400 hover:text-white py-2 px-4"
            >
              ← Back to Home
            </Link>
          </div>
        )}
      </div>

      {/* Debug panel - at very top */}
      <div className="fixed top-0 left-0 right-0 z-[99999] bg-black/95 border-b border-green-500/30 p-2 text-xs font-mono text-green-400 max-h-24 overflow-y-auto">
        <div className="flex justify-between items-center mb-1">
          <span className="font-bold text-green-300">{VERSION}</span>
          <span className="text-green-500">{phase}</span>
        </div>
        {logs.slice(-3).map((l, i) => <div key={i} className="opacity-80 truncate">{l}</div>)}
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
