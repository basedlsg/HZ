'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [message, setMessage] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [facingMode]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const addLog = (msg: string) => setDebugLogs(prev => [...prev.slice(-4), msg]);

  const startCamera = async () => {
    addLog('Starting camera init...');
    try {
      let stream;
      try {
        addLog('Requesting ideal constraints...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            aspectRatio: { ideal: 9 / 16 },
            width: { ideal: 1080 },
            height: { ideal: 1920 },
          },
          audio: true,
        });
        addLog('Ideal constraints success');
      } catch (e) {
        addLog('Ideal failed, trying basic...');
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facingMode },
          audio: true,
        });
        addLog('Basic constraints success');
      }

      if (videoRef.current) {
        addLog('Video ref found, assigning stream...');
        videoRef.current.srcObject = stream;

        videoRef.current.onloadedmetadata = () => {
          addLog(`Metadata loaded. Size: ${videoRef.current?.videoWidth}x${videoRef.current?.videoHeight}`);
        };

        try {
          await videoRef.current.play();
          addLog('Video playing!');
          setHasPermission(true);
          setMessage('');
        } catch (playError: any) {
          addLog(`Play failed: ${playError.message}`);
          console.error("Video play failed:", playError);
        }
      } else {
        addLog('Error: Video ref is null');
      }
    } catch (error: any) {
      console.error('Error accessing camera:', error);
      addLog(`Fatal Error: ${error.name} - ${error.message}`);
      setMessage(`Camera Error: ${error.name} - ${error.message}`);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const [mimeType, setMimeType] = useState<string>('video/webm');

  useEffect(() => {
    // Detect supported MIME type
    const types = [
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm',
      'video/webm;codecs=vp8',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        setMimeType(type);
        console.log('Using MIME type:', type);
        break;
      }
    }
  }, []);

  const startRecording = () => {
    if (!videoRef.current?.srcObject) return;

    const stream = videoRef.current.srcObject as MediaStream;

    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType,
      });

      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        if (playbackRef.current) {
          playbackRef.current.src = url;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (e) {
      console.error('Failed to start recording:', e);
      setMessage('Failed to start recording. Device not supported?');
    }
  };



  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleCamera = () => {
    stopCamera();
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const panicClose = () => {
    stopRecording();
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    chunksRef.current = [];
    setMessage('Recording discarded');
    setTimeout(() => router.push('/'), 500);
  };

  const saveAndUpload = async () => {
    if (!recordedBlob) return;

    const sessionData = localStorage.getItem('hotzones-session');
    if (!sessionData) {
      setMessage('⚠️ Please check in first');
      return;
    }
    const session = JSON.parse(sessionData);

    setIsUploading(true);
    setMessage('Initializing upload...');

    try {
      // 1. Initialize Multipart Upload
      const initRes = await fetch('/api/upload-multipart/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contentType: mimeType }),
      });

      if (!initRes.ok) throw new Error('Failed to init upload');
      const { uploadId, key, videoId } = await initRes.json();

      // 2. Upload Parts (Direct to R2)
      // S3 requires parts to be at least 5MB (except the last one)
      const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB chunks to be safe
      const totalParts = Math.ceil(recordedBlob.size / CHUNK_SIZE);
      const parts = [];

      for (let i = 0; i < totalParts; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, recordedBlob.size);
        const chunk = recordedBlob.slice(start, end);
        const partNumber = i + 1;

        setMessage(`Uploading part ${partNumber}/${totalParts}...`);

        // Get presigned URL for this part
        const partUrlRes = await fetch('/api/upload-multipart/part', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uploadId, key, partNumber }),
        });

        if (!partUrlRes.ok) throw new Error(`Failed to get URL for part ${partNumber}`);
        const { presignedUrl } = await partUrlRes.json();

        // Upload directly to R2
        const uploadRes = await fetch(presignedUrl, {
          method: 'PUT',
          body: chunk,
        });

        if (!uploadRes.ok) throw new Error(`Failed to upload part ${partNumber}`);

        // Get ETag from R2 response header
        const eTag = uploadRes.headers.get('ETag');
        if (!eTag) throw new Error(`No ETag for part ${partNumber}`);

        parts.push({ PartNumber: partNumber, ETag: eTag });
      }

      // 3. Capture Analysis Frame
      let frameBlob: Blob | null = null;
      if (playbackRef.current) {
        const video = playbackRef.current;
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          frameBlob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
        }
      }

      // 4. Complete Upload & Analyze
      setMessage('Finalizing & Analyzing...');
      const completeFormData = new FormData();
      completeFormData.append('uploadId', uploadId);
      completeFormData.append('key', key);
      completeFormData.append('videoId', videoId);
      completeFormData.append('parts', JSON.stringify(parts));
      completeFormData.append('sessionId', session.sessionId);
      completeFormData.append('duration', recordingTime.toString());
      completeFormData.append('size', recordedBlob.size.toString());
      if (frameBlob) {
        completeFormData.append('analysisImage', frameBlob, 'frame.jpg');
      }

      const completeRes = await fetch('/api/upload-multipart/complete', {
        method: 'POST',
        body: completeFormData,
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json();
        throw new Error(errData.error || 'Failed to complete upload');
      }

      const data = await completeRes.json();

      if (data.success) {
        setMessage(`✓ Upload complete!`);
        setTimeout(() => {
          if (recordedUrl) URL.revokeObjectURL(recordedUrl);
          setRecordedBlob(null);
          setRecordedUrl(null);
          router.push('/videos');
        }, 1500);
      } else {
        throw new Error(data.error || 'Unknown error');
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      setMessage(`Failed: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden z-50">
      {/* Hidden canvas for OCR */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Debug Logs Overlay */}
      <div className="absolute top-20 left-4 z-50 pointer-events-none text-xs text-green-400 font-mono bg-black/50 p-2 rounded">
        {debugLogs.map((log, i) => <div key={i}>{log}</div>)}
      </div>

      {/* Main Video Container - Full Screen */}
      <div className="absolute inset-0 bg-black">
        {!recordedBlob ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover" // object-cover forces full screen fill
          />
        ) : (
          <video
            ref={playbackRef}
            controls
            playsInline
            loop
            className="w-full h-full object-cover" // object-cover forces full screen fill
          />
        )}
      </div>

      {/* Top Overlay: Header & Status */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-purple-400 drop-shadow-md">
            HOTZONES
          </Link>

          {isRecording && (
            <div className="flex items-center gap-2 bg-red-600/80 backdrop-blur px-3 py-1 rounded-full animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="font-mono font-bold text-sm">{formatTime(recordingTime)}</span>
            </div>
          )}

          <div className="flex gap-4">
            {!isRecording && !recordedBlob && (
              <button
                onClick={toggleCamera}
                className="p-2 rounded-full bg-black/40 backdrop-blur border border-white/20"
              >
                🔄
              </button>
            )}
            <button onClick={() => router.push('/')} className="text-white/80 hover:text-white text-2xl">
              ✕
            </button>
          </div>
        </div>

        {/* Message Toast */}
        {message && (
          <div className="mt-4 flex justify-center">
            <div className="bg-black/60 backdrop-blur px-4 py-2 rounded-lg text-sm font-medium border border-white/10">
              {message}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-8 pb-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10">

        {!recordedBlob ? (
          <div className="flex flex-col items-center gap-6">
            {/* Action Bar */}
            {!isRecording && (
              <div className="flex items-center gap-8 mb-4">
                <Link href="/videos" className="flex flex-col items-center gap-1 text-gray-300 hover:text-white transition-colors">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center border border-white/20 bg-black/40 backdrop-blur">
                    📹
                  </div>
                  <span className="text-xs font-medium">Library</span>
                </Link>
              </div>
            )}

            {/* Main Shutter Button */}
            <div className="flex items-center justify-center">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                >
                  <div className="w-16 h-16 bg-red-600 rounded-full"></div>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="w-20 h-20 rounded-full border-4 border-white/50 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
                >
                  <div className="w-8 h-8 bg-red-600 rounded-sm"></div>
                </button>
              )}
            </div>

            {isRecording && (
              <button onClick={panicClose} className="text-yellow-500 font-bold text-sm mt-2 uppercase tracking-widest">
                Panic Close
              </button>
            )}
          </div>
        ) : (
          // Post-Recording Controls
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              <button
                onClick={() => {
                  if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                  setRecordedBlob(null);
                  setRecordedUrl(null);
                }}
                disabled={isUploading}
                className="flex-1 bg-gray-800/80 backdrop-blur text-white font-semibold py-4 rounded-xl disabled:opacity-50"
              >
                Discard
              </button>
              <button
                onClick={saveAndUpload}
                disabled={isUploading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-semibold py-4 rounded-xl shadow-lg shadow-purple-900/20 flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <span>Save & Upload</span>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
