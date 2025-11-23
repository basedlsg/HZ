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
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment'); // Default to back camera
  const isPanicMode = useRef(false); // Track if PANIC was triggered
  const router = useRouter();

  // Location gating
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      // Clean up blob URL on unmount
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [facingMode]); // Restart camera when facingMode changes

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
          facingMode: facingMode,
          // Enforce 16:9 aspect ratio more strictly
          aspectRatio: { exact: 16 / 9 },
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
        setMessage('');
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      // If exact aspect ratio fails, try with ideal
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: facingMode,
            aspectRatio: { ideal: 16 / 9 },
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30, max: 30 },
          },
          audio: true,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setHasPermission(true);
          setMessage('');
        }
      } catch (fallbackError) {
        console.error('Fallback camera access failed:', fallbackError);
        setMessage('Failed to access camera. Please grant permissions.');
      }
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
    }
  };

  /**
   * Request user's location using Geolocation API.
   * This must be called before recording can start.
   */
  const requestLocation = async () => {
    if (hasLocationPermission && location) {
      // Already have location, don't request again
      return true;
    }

    if (!navigator.geolocation) {
      setMessage('Geolocation is not supported by your browser');
      return false;
    }

    setIsRequestingLocation(true);
    setMessage('Requesting location...');

    return new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(coords);
          setHasLocationPermission(true);
          setIsRequestingLocation(false);
          setMessage('✓ Location shared');
          setTimeout(() => setMessage(''), 2000);
          resolve(true);
        },
        (error) => {
          console.error('Error getting location:', error);
          setIsRequestingLocation(false);

          let errorMessage = 'Failed to get location. ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'Please enable location permissions.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'Location unavailable.';
              break;
            case error.TIMEOUT:
              errorMessage += 'Location request timed out.';
              break;
            default:
              errorMessage += 'Unknown error.';
          }
          setMessage(errorMessage);
          resolve(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes - allow cached location
        }
      );
    });
  };

  const startRecording = async () => {
    if (!videoRef.current?.srcObject) return;

    // GATE: Must have location before recording
    if (!hasLocationPermission || !location) {
      const granted = await requestLocation();
      if (!granted) {
        // Location not granted, can't record
        return;
      }
    }

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

      // If PANIC mode was triggered, auto-upload immediately
      if (isPanicMode.current) {
        isPanicMode.current = false;
        uploadVideoBlob(blob);
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

  const toggleCamera = () => {
    // Stop current camera before switching
    stopCamera();
    // Toggle between front and back camera
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  /**
   * Shared helper to upload a video blob to the server.
   * Used by both normal Save & Upload flow and PANIC flow.
   */
  const uploadVideoBlob = async (blob: Blob) => {
    try {
      const sessionData = localStorage.getItem('hotzones-session');
      const session = sessionData ? JSON.parse(sessionData) : null;

      // Create FormData to send the actual video file
      const formData = new FormData();
      formData.append('video', blob, `video-${Date.now()}.webm`);
      formData.append('sessionId', session?.sessionId || 'unknown');
      formData.append('duration', recordingTime.toString());

      // Include location data
      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
      }

      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✓ Video uploaded! ID: ${data.videoId}`);
        // Quick exit - navigate to map after brief delay
        setTimeout(() => {
          if (recordedUrl) {
            URL.revokeObjectURL(recordedUrl);
          }
          setRecordedBlob(null);
          setRecordedUrl(null);
          setMessage('');
          router.push('/map');
        }, 500);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to upload video');
    }
  };

  /**
   * PANIC CLOSE - Now auto-saves and uploads the current clip instead of discarding it.
   *
   * When triggered:
   * - If currently recording: stops recording and triggers auto-upload via onstop handler
   * - If already have a blob: uploads it immediately
   * - Exits quickly to map screen with no additional prompts
   */
  const panicClose = () => {
    setMessage('Saving...');

    if (isRecording) {
      // Set panic mode flag so onstop handler will auto-upload
      isPanicMode.current = true;
      stopRecording();
    } else if (recordedBlob) {
      // Already have a blob, upload it immediately
      uploadVideoBlob(recordedBlob);
    } else {
      // No recording to save, just exit
      setMessage('No recording to save');
      setTimeout(() => {
        router.push('/map');
      }, 500);
    }
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

      // Include location data
      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
      }

      const response = await fetch('/api/upload-video', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setMessage(`✓ Video uploaded! ID: ${data.videoId}`);
        // Normal flow: show success message longer, navigate to videos page
        setTimeout(() => {
          if (recordedUrl) {
            URL.revokeObjectURL(recordedUrl);
          }
          setRecordedBlob(null);
          setRecordedUrl(null);
          setMessage('');
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
    <div className="min-h-screen bg-black text-white md:flex md:flex-col">
      {/* Header - Hidden on mobile, shown on desktop */}
      <header className="hidden md:block border-b border-purple-900/30 bg-black/50 backdrop-blur">
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

      {/* Main Content - Full screen on mobile, centered on desktop */}
      <main className="flex-1 md:mx-auto md:max-w-4xl md:px-4 md:py-8">
        {/* Title - Hidden on mobile, shown on desktop */}
        <div className="hidden md:block mb-4">
          <h2 className="text-2xl font-bold mb-1">Secure Camera</h2>
          <p className="text-gray-400 text-sm">Record short video segments in 16:9 format</p>
        </div>

        {/* Video Container - Full viewport on mobile, aspect ratio on desktop */}
        <div className="relative h-screen md:h-auto md:space-y-6">
          {/* Video Display - Live Feed or Playback */}
          {!recordedBlob ? (
            // Live camera feed - Full screen on mobile
            <div className="relative w-full h-full md:h-auto">
              <div className="md:hidden absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full max-h-screen">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-cover bg-black"
                  />
                </div>
              </div>

              {/* Desktop view - maintains aspect ratio */}
              <div className="hidden md:block">
                <AspectVideo>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                  />
                </AspectVideo>
              </div>

              {/* Recording Indicator - Overlaid on video */}
              {isRecording && (
                <div className="absolute top-4 left-4 md:top-4 md:left-4 flex items-center gap-2 bg-red-600 px-3 py-2 rounded-full z-20">
                  <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
                  <span className="font-semibold">{formatTime(recordingTime)}</span>
                </div>
              )}

              {/* Back button - Mobile only */}
              {!isRecording && (
                <Link
                  href="/map"
                  className="md:hidden absolute top-4 left-4 bg-black/50 hover:bg-black/70 backdrop-blur px-4 py-2 rounded-full z-20 transition-colors border border-white/20"
                >
                  <span className="font-semibold text-sm">← Back</span>
                </Link>
              )}

              {/* Camera Toggle Button */}
              {!isRecording && hasPermission && (
                <button
                  onClick={toggleCamera}
                  className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 backdrop-blur px-4 py-2 rounded-full z-20 transition-colors border border-white/20"
                >
                  <span className="font-semibold text-sm">
                    {facingMode === 'user' ? '🔄 Back' : '🔄 Selfie'}
                  </span>
                </button>
              )}

              {/* No Permission Message */}
              {!hasPermission && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-20">
                  <p className="text-gray-400">Requesting camera access...</p>
                </div>
              )}
            </div>
          ) : (
            // Playback preview of recorded video - Full screen on mobile
            <div className="relative w-full h-full md:h-auto">
              <div className="md:hidden absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full max-h-screen">
                  <video
                    ref={playbackRef}
                    controls
                    playsInline
                    className="absolute inset-0 w-full h-full object-cover bg-black"
                  />
                </div>
              </div>

              {/* Desktop view */}
              <div className="hidden md:block">
                <AspectVideo>
                  <video
                    ref={playbackRef}
                    controls
                    playsInline
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                  />
                </AspectVideo>
              </div>

              <div className="absolute top-4 left-4 bg-green-600 px-3 py-2 rounded-full z-20">
                <span className="font-semibold text-sm">Preview</span>
              </div>
            </div>
          )}

          {/* Location Status Indicator */}
          {hasLocationPermission && location && !isRecording && (
            <div className="absolute top-20 left-4 md:top-4 md:left-4 bg-green-600/90 backdrop-blur px-3 py-2 rounded-full z-20 flex items-center gap-2">
              <span className="text-sm">📍 Location shared</span>
            </div>
          )}

          {/* Controls - Overlaid at bottom on mobile, below video on desktop */}
          <div className="absolute bottom-0 left-0 right-0 md:relative md:bottom-auto md:left-auto md:right-auto md:space-y-4 p-4 md:p-0 z-30">
            {!isRecording && !recordedBlob && (
              <div className="space-y-2">
                <button
                  onClick={startRecording}
                  disabled={!hasPermission || isRequestingLocation}
                  className="w-full bg-red-600/90 hover:bg-red-700/90 disabled:bg-gray-700/90 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-full md:rounded-lg transition-colors backdrop-blur-sm"
                >
                  {isRequestingLocation ? '📍 Requesting location...' : '🔴 Start Recording'}
                </button>
                {!hasLocationPermission && !isRequestingLocation && (
                  <p className="text-xs text-gray-400 text-center backdrop-blur-sm bg-black/50 py-2 px-3 rounded-full md:rounded-lg">
                    Location permission required to record
                  </p>
                )}
              </div>
            )}

            {isRecording && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={stopRecording}
                  className="bg-purple-600/90 hover:bg-purple-700/90 text-white font-semibold py-4 px-6 rounded-full md:rounded-lg transition-colors backdrop-blur-sm"
                >
                  ⏹️ Stop
                </button>
                <button
                  onClick={panicClose}
                  className="bg-yellow-600/90 hover:bg-yellow-700/90 text-white font-semibold py-4 px-6 rounded-full md:rounded-lg transition-colors backdrop-blur-sm"
                >
                  ⚠️ PANIC
                </button>
              </div>
            )}

            {/* Save & Upload Drawer */}
            {recordedBlob && (
              <div className="bg-gray-900/95 md:bg-gray-900 border border-gray-800 rounded-2xl md:rounded-lg p-6 space-y-4 backdrop-blur-md">
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
                    className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-full md:rounded-lg transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={saveAndUpload}
                    className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-full md:rounded-lg transition-colors"
                  >
                    💾 Save & Upload
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Message Display - Overlaid at top on mobile */}
          {message && (
            <div className={`absolute top-20 left-4 right-4 md:relative md:top-auto md:left-auto md:right-auto p-4 rounded-2xl md:rounded-lg z-30 backdrop-blur-md ${message.includes('✓') ? 'bg-green-900/90 border border-green-900/50 text-green-400' : 'bg-red-900/90 border border-red-900/50 text-red-400'}`}>
              {message}
            </div>
          )}

          {/* Info - Hidden on mobile, shown on desktop */}
          <div className="hidden md:block bg-gray-900/50 border border-gray-800 rounded-lg p-4">
            <h3 className="font-semibold text-sm mb-2">Recording Features</h3>
            <ul className="text-sm text-gray-400 space-y-1">
              <li>• Videos captured in 16:9 aspect ratio (720p preferred)</li>
              <li>• Preview your recording before uploading</li>
              <li>• Use PANIC CLOSE to immediately save & upload, then exit</li>
              <li>• Recordings stored locally until uploaded</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
