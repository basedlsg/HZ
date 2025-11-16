'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AspectVideo from '@/components/AspectVideo';

export default function CameraView() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playbackRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [message, setMessage] = useState('');
  const [hasPermission, setHasPermission] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      // Clean up blob URL on unmount
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording]);

  /**
   * Start camera with 16:9 aspect ratio constraints.
   *
   * We request common 16:9 resolutions in order of preference:
   * - 1920x1080 (1080p) - ideal for high-quality capture
   * - 1280x720 (720p) - good balance of quality and file size
   * - 640x360 (360p) - fallback for low-end devices
   *
   * The browser will try to match the closest supported resolution.
   */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          // Request 16:9 aspect ratio
          aspectRatio: { ideal: 16 / 9 },
          // Prefer 720p as a good balance
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // Fallback constraints
          frameRate: { ideal: 30, max: 30 },
        },
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setHasPermission(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      setMessage('Failed to access camera. Please grant permissions.');
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  const startRecording = () => {
    if (!videoRef.current?.srcObject) return;

    const stream = videoRef.current.srcObject as MediaStream;
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm',
    });

    mediaRecorderRef.current = mediaRecorder;
    chunksRef.current = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);

      // Create a URL for playback preview
      const url = URL.createObjectURL(blob);
      setRecordedUrl(url);

      // Load the video for playback
      if (playbackRef.current) {
        playbackRef.current.src = url;
      }
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    setMessage('');
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const panicClose = () => {
    stopRecording();
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl(null);
    chunksRef.current = [];
    setMessage('Recording discarded');
    setTimeout(() => {
      router.push('/');
    }, 500);
  };

  const saveAndUpload = async () => {
    if (!recordedBlob) return;

    try {
      const sessionData = localStorage.getItem('hotzones-session');
      const session = sessionData ? JSON.parse(sessionData) : null;

      // Create FormData to send the actual video file
      const formData = new FormData();
      formData.append('video', recordedBlob, `video-${Date.now()}.webm`);
      formData.append('sessionId', session?.sessionId || 'unknown');
      formData.append('duration', recordingTime.toString());

      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData, // Send FormData (no Content-Type header needed, browser sets it)
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✓ Video uploaded! ID: ${data.videoId}`);
        setTimeout(() => {
          if (recordedUrl) {
            URL.revokeObjectURL(recordedUrl);
          }
          setRecordedBlob(null);
          setRecordedUrl(null);
          setMessage('');
          // Redirect to videos page to see the upload
          router.push('/videos');
        }, 2000);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to upload video');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-purple-900/30 bg-black/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-purple-400">
            HOTZONES
          </Link>
          <div className="flex gap-4">
            <Link href="/map" className="text-gray-400 hover:text-white">
              Map
            </Link>
            <Link href="/videos" className="text-gray-400 hover:text-white">
              Videos
            </Link>
            <Link href="/streams" className="text-gray-400 hover:text-white">
              Streams
            </Link>
            <Link href="/profile" className="text-gray-400 hover:text-white">
              Profile
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-4">
          <h2 className="text-2xl font-bold mb-1">Secure Camera</h2>
          <p className="text-gray-400 text-sm">Record short video segments in 16:9 format</p>
        </div>

        <div className="space-y-6">
          {/* Video Display - Live Feed or Playback */}
          {!recordedBlob ? (
            // Live camera feed
            <AspectVideo>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Recording Indicator */}
              {isRecording && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600 px-3 py-2 rounded-full z-10">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  <span className="font-semibold">{formatTime(recordingTime)}</span>
                </div>
              )}

              {/* No Permission Message */}
              {!hasPermission && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                  <p className="text-gray-400">Requesting camera access...</p>
                </div>
              )}
            </AspectVideo>
          ) : (
            // Playback preview of recorded video
            <AspectVideo>
              <video
                ref={playbackRef}
                controls
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute top-4 left-4 bg-green-600 px-3 py-2 rounded-full z-10">
                <span className="font-semibold text-sm">Preview</span>
              </div>
            </AspectVideo>
          )}

          {/* Controls */}
          <div className="space-y-4">
            {!isRecording && !recordedBlob && (
              <button
                onClick={startRecording}
                disabled={!hasPermission}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors"
              >
                🔴 Start Recording
              </button>
            )}

            {isRecording && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={stopRecording}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
                >
                  ⏹️ Stop Recording
                </button>
                <button
                  onClick={panicClose}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-4 px-6 rounded-lg transition-colors"
                >
                  ⚠️ PANIC CLOSE
                </button>
              </div>
            )}

            {/* Save & Upload Drawer */}
            {recordedBlob && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg">Recording Ready</h3>
                    <p className="text-sm text-gray-400">
                      Duration: {formatTime(recordingTime)} • Size: {Math.round(recordedBlob.size / 1024)}KB
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => {
                      if (recordedUrl) {
                        URL.revokeObjectURL(recordedUrl);
                      }
                      setRecordedBlob(null);
                      setRecordedUrl(null);
                    }}
                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={saveAndUpload}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                  >
                    💾 Save & Upload
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Message Display */}
          {message && (
            <div className={`p-4 rounded-lg ${message.includes('✓') ? 'bg-green-900/20 border border-green-900/30 text-green-400' : 'bg-red-900/20 border border-red-900/30 text-red-400'}`}>
              {message}
            </div>
          )}

          {/* Info */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-2">Recording Features</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Videos captured in 16:9 aspect ratio (720p preferred)</li>
              <li>• Preview your recording before uploading</li>
              <li>• Use PANIC CLOSE to immediately discard recording</li>
              <li>• Recordings stored locally until uploaded</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
