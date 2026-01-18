import React, { useRef, useState, useCallback, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Scanner } from '@yudiel/react-qr-scanner';
import { X, Loader2, ShieldAlert, ArrowLeft, QrCode, Check, RefreshCcw, Copy, Flashlight, ZoomIn } from 'lucide-react';
import { RecorderState, FeedItem, SyncStatus } from '../types';
import { analyzeFootage } from '../services/llamaService'; // Switched from Gemini to Llama
import { db } from '../services/db';
import { loadModels, analyzeFaces } from '../services/forensicService';
// import { uploadItem } from '../services/syncService'; // Disabled for local-only testing
import { calculateDistance } from '../services/geo';
import { CameraDebugOverlay } from './CameraDebugOverlay';

interface CameraScreenProps {
    onPanic: () => void;
    onRecordingComplete: (item: FeedItem) => void;
    onViewFeed: () => void;
}

export const CameraScreen: React.FC<CameraScreenProps> = ({ onPanic, onRecordingComplete, onViewFeed }) => {
    const webcamRef = useRef<Webcam>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    const mimeTypeRef = useRef<string>(''); // Store selected MIME type

    const [recorderState, setRecorderState] = useState<RecorderState>(RecorderState.IDLE);
    const [timer, setTimer] = useState(0);
    const timerRef = useRef<number | null>(null);
    const stopFnRef = useRef<(() => void) | null>(null); // Ref to store stop function for auto-stop
    const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

    // Flash/Torch Control
    const [torchEnabled, setTorchEnabled] = useState(false);
    const [torchSupported, setTorchSupported] = useState(false);

    // Zoom Control
    const [zoomLevel, setZoomLevel] = useState(1);
    const [maxZoom, setMaxZoom] = useState(1);
    const [zoomSupported, setZoomSupported] = useState(false);

    // Identity / Scan Logic
    const [showIdentity, setShowIdentity] = useState(false);
    const [identityMode, setIdentityMode] = useState<'MY_CODE' | 'SCAN'>('MY_CODE');
    const [userId] = useState(() => 'PX-' + Math.random().toString(36).substr(2, 6).toUpperCase());
    const [scanResult, setScanResult] = useState<string | null>(null);
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [streamReady, setStreamReady] = useState(false); // Track when webcam stream is ready

    // DISABLED: face-api.js model loading causes iOS memory crashes
    // The forensic service loads ~20MB of ML models which overwhelms Safari
    // useEffect(() => {
    //     loadModels();
    // }, []);

    // Check for Torch and Zoom capabilities when camera stream is ready
    useEffect(() => {
        const checkCapabilities = async () => {
            try {
                if (webcamRef.current?.stream) {
                    const videoTrack = webcamRef.current.stream.getVideoTracks()[0];
                    if (videoTrack && typeof videoTrack.getCapabilities === 'function') {
                        const capabilities = videoTrack.getCapabilities() as any;
                        if (capabilities) {
                            setTorchSupported(!!capabilities.torch);
                            if (capabilities.zoom && capabilities.zoom.max) {
                                setZoomSupported(true);
                                setMaxZoom(Math.min(capabilities.zoom.max, 10)); // Cap at 10x for UX
                            }
                        }
                    }
                    setStreamReady(true);
                }
            } catch (e) {
                // iOS Safari may not support getCapabilities - fail silently
                console.warn("Could not check camera capabilities:", e);
            }
        };
        // Small delay to ensure stream is ready
        const timer = setTimeout(checkCapabilities, 1000);
        return () => clearTimeout(timer);
    }, [facingMode, streamReady]); // Also re-check when streamReady changes

    const toggleTorch = useCallback(async () => {
        if (webcamRef.current?.stream) {
            const videoTrack = webcamRef.current.stream.getVideoTracks()[0];
            if (videoTrack) {
                try {
                    await videoTrack.applyConstraints({
                        advanced: [{ torch: !torchEnabled } as any]
                    });
                    setTorchEnabled(!torchEnabled);
                } catch (e) {
                    console.warn("Torch not supported:", e);
                }
            }
        }
    }, [torchEnabled]);

    const handleZoomChange = useCallback(async (newZoom: number) => {
        if (webcamRef.current?.stream) {
            const videoTrack = webcamRef.current.stream.getVideoTracks()[0];
            if (videoTrack) {
                try {
                    await videoTrack.applyConstraints({
                        advanced: [{ zoom: newZoom } as any]
                    });
                    setZoomLevel(newZoom);
                } catch (e) {
                    console.warn("Zoom not supported:", e);
                }
            }
        }
    }, []);

    const toggleCamera = useCallback(() => {
        setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
        setTorchEnabled(false); // Reset torch when flipping
        setZoomLevel(1); // Reset zoom when flipping
    }, []);

    // 50m Geofence Logic
    const handleScan = useCallback((result: any[]) => {
        if (result && result.length > 0) {
            const rawValue = result[0].rawValue;
            // Prevent spamming
            if (scanResult === rawValue) return;

            try {
                const payload = JSON.parse(rawValue);
                if (payload.lat && payload.lng) {
                    navigator.geolocation.getCurrentPosition(myPos => {
                        const distanceKm = calculateDistance(
                            myPos.coords.latitude, myPos.coords.longitude,
                            payload.lat, payload.lng
                        );

                        if (distanceKm <= 0.05) { // 50 meters
                            setScanResult(payload.id);
                            if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
                        } else {
                            setScanResult("⚠️ PEER OUTSIDE GEOFENCE (>50m)");
                            if (navigator.vibrate) navigator.vibrate(200);
                        }
                    });
                } else {
                    setScanResult(rawValue);
                }
            } catch (e) {
                setScanResult(rawValue); // Fallback for simple strings
            }
        }
    }, [scanResult]);

    const startRecording = useCallback(() => {
        if (webcamRef.current && webcamRef.current.stream) {
            setRecorderState(RecorderState.RECORDING);
            setTimer(0);
            chunksRef.current = [];

            const stream = webcamRef.current.stream;

            // Dynamic MIME Type Selection for Mobile Compatibility
            const getMimeType = () => {
                const types = [
                    'video/mp4',             // Safari/iOS (Better support)
                    'video/webm;codecs=vp9', // Chrome/Android (High quality)
                    'video/webm',            // Standard Fallback
                    ''                       // Default behavior
                ];
                return types.find(t => t === '' || MediaRecorder.isTypeSupported(t)) || '';
            };

            const mimeType = getMimeType();
            mimeTypeRef.current = mimeType; // Store for Blob creation

            const options = mimeType ? { mimeType } : undefined;

            try {
                const mediaRecorder = new MediaRecorder(stream, options);

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data && event.data.size > 0) {
                        chunksRef.current.push(event.data);
                    }
                };

                mediaRecorder.start();
                mediaRecorderRef.current = mediaRecorder;

                timerRef.current = window.setInterval(() => {
                    setTimer(t => t + 1);
                }, 1000);
            } catch (e) {
                console.error("MediaRecorder Error:", e);
                setRecorderState(RecorderState.IDLE);
            }
        }
    }, []);

    // MAX RECORDING DURATION: Auto-stop at 30 seconds
    useEffect(() => {
        if (recorderState === RecorderState.RECORDING && timer >= 30) {
            // Use a small timeout to avoid calling during render
            const timeout = setTimeout(() => {
                if (stopFnRef.current) {
                    stopFnRef.current();
                }
            }, 0);
            return () => clearTimeout(timeout);
        }
    }, [timer, recorderState]);

    const stopRecordingAndAnalyze = useCallback(async () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (mediaRecorderRef.current) mediaRecorderRef.current.stop();

        setRecorderState(RecorderState.PROCESSING);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for blob

        // Create video blob with correct mime type
        const videoBlob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'video/webm' });

        // Extract Frames (Multi-Frame Analysis)
        const extractFrames = async (blob: Blob): Promise<{ thumbnail: string, frames: string[] }> => {
            return new Promise((resolve, reject) => {
                const video = document.createElement('video');
                video.playsInline = true;
                video.muted = true;
                video.src = URL.createObjectURL(blob);

                const frames: string[] = [];
                const CAPTURE_INTERVAL = 0.5; // Capture every 0.5s for detailed intel
                const MAX_FRAMES = 5; // Reduced to 5 frames to prevent timeouts/memory issues

                // Safety timeout for the entire extraction process
                const extractionTimeout = setTimeout(() => {
                    reject(new Error("Frame extraction timed out"));
                }, 5000);

                video.onloadedmetadata = async () => {
                    const duration = video.duration || 10;
                    let currentTime = 0;

                    try {
                        while (currentTime < duration && frames.length < MAX_FRAMES) {
                            await new Promise<void>((seekResolve) => {
                                // iOS Compatibility: Sometimes need to wait a tick before seeking
                                requestAnimationFrame(() => {
                                    video.currentTime = currentTime;
                                });

                                const onSeeked = () => {
                                    // Slight delay to allow decoder to paint
                                    // requestAnimationFrame double-buffer trick
                                    requestAnimationFrame(() => {
                                        const canvas = document.createElement('canvas');
                                        // Safety check for width
                                        const w = video.videoWidth || 640;
                                        const h = video.videoHeight || 480;

                                        // Resize to manageable size (max width 640)
                                        const scale = Math.min(1, 640 / w);
                                        canvas.width = w * scale;
                                        canvas.height = h * scale;

                                        const ctx = canvas.getContext('2d');
                                        if (ctx) {
                                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                                            // 0.6 quality for smaller payload
                                            frames.push(canvas.toDataURL('image/jpeg', 0.6));
                                        }
                                        video.removeEventListener('seeked', onSeeked);
                                        seekResolve();
                                    });
                                };

                                video.addEventListener('seeked', onSeeked);
                                // Shorter seek timeout
                                setTimeout(() => seekResolve(), 500);
                            });
                            currentTime += CAPTURE_INTERVAL;
                        }

                        clearTimeout(extractionTimeout);
                        URL.revokeObjectURL(video.src);
                        if (frames.length > 0) {
                            resolve({ thumbnail: frames[0], frames: frames });
                        } else {
                            reject(new Error("No frames extracted"));
                        }
                    } catch (e) {
                        clearTimeout(extractionTimeout);
                        reject(e);
                    }
                };

                video.onerror = () => {
                    clearTimeout(extractionTimeout);
                    URL.revokeObjectURL(video.src);
                    reject(new Error('Video load failed during frame extraction'));
                };
            });
        };

        let capturedData: { thumbnail: string, frames: string[] } | null = null;
        try {
            // Race frame extraction against a 5s fallback timer
            const timeoutPromise = new Promise<{ thumbnail: string, frames: string[] } | null>((_, reject) =>
                setTimeout(() => reject(new Error("Extraction global timeout")), 5000));

            capturedData = await Promise.race([extractFrames(videoBlob), timeoutPromise]).catch(e => {
                console.warn("Extraction failed or timed out:", e);
                return null;
            });
        } catch (e) {
            console.warn("Frame extraction failed, falling back to single screenshot", e);
        }

        // Fallback if extraction failed
        if (!capturedData) {
            const fallback = webcamRef.current?.getScreenshot();
            if (fallback) capturedData = { thumbnail: fallback, frames: [fallback] };
        }

        if (capturedData) {
            setRecorderState(RecorderState.ANALYZING);

            // GLOBAL ANALYSIS TIMEOUT: 30 seconds max for entire analysis pipeline
            const ANALYSIS_TIMEOUT_MS = 30000;
            let analysisTimedOut = false;
            const analysisTimer = setTimeout(() => {
                analysisTimedOut = true;
                alert("⏱️ Analysis timed out. Your video was too complex or the network is slow. Please try a shorter clip.");
                setRecorderState(RecorderState.IDLE);
            }, ANALYSIS_TIMEOUT_MS);

            try {
                const { thumbnail, frames } = capturedData;
                console.log(`Analyzing ${frames.length} frames. Est size: ${(frames.join('').length / 1024).toFixed(0)} KB`);

                const img = new Image();
                img.src = thumbnail;
                await img.decode();

                // Wrap API calls with their own timeout
                const analyzeWithTimeout = async () => {
                    const timeoutPromise = new Promise<never>((_, reject) =>
                        setTimeout(() => reject(new Error('Gemini API timeout')), 25000)
                    );
                    return Promise.race([analyzeFootage(frames), timeoutPromise]);
                };

                const [analysis, forensicResult] = await Promise.all([
                    analyzeWithTimeout(),
                    analyzeFaces(img)
                ]);

                // Check if we already timed out
                if (analysisTimedOut) return;

                let lat = 0, lng = 0;
                try {
                    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
                    });
                    lat = pos.coords.latitude;
                    lng = pos.coords.longitude;
                } catch (e) { console.warn("No location", e); }

                const newItem: FeedItem = {
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                    location: { lat, lng },
                    thumbnailUrl: thumbnail,
                    isProcessing: false,
                    isUserGenerated: true,
                    analysis: analysis,
                    encryptedForensics: forensicResult?.encryptedBiometrics,
                    iv: forensicResult?.iv,
                    syncStatus: SyncStatus.PENDING
                };

                if (chunksRef.current.length === 0) {
                    alert("⚠️ Recording Error: No video data captured.");
                    return;
                }

                // Save to DB
                await db.saveRecording(newItem, videoBlob);
                // uploadItem(newItem); // Disabled for local-only testing
                onRecordingComplete(newItem);

            } catch (error: any) {
                console.error("Processing failed", error);
                if (!analysisTimedOut) {
                    alert(`❌ Analysis Failed\n${error?.message || 'Unknown error'}\n\nYour clip was NOT saved.`);
                }
            } finally {
                clearTimeout(analysisTimer);
                if (!analysisTimedOut) {
                    setRecorderState(RecorderState.IDLE);
                }
            }
        } else {
            alert("⚠️ Capture Failed: Could not extract frames from video.");
            setRecorderState(RecorderState.IDLE);
        }
    }, [onRecordingComplete]);

    // Keep ref updated for auto-stop effect
    useEffect(() => {
        stopFnRef.current = stopRecordingAndAnalyze;
    }, [stopRecordingAndAnalyze]);

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Analyzing Loader
    if (recorderState === RecorderState.ANALYZING || recorderState === RecorderState.PROCESSING) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black text-white p-6 space-y-6">
                <div className="relative">
                    <Loader2 size={48} className="animate-spin text-brand-purple" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <ShieldAlert size={20} className="text-white opacity-80" />
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-xl font-bold tracking-wider">ANALYZING FOOTAGE</h2>
                    <p className="text-sm text-gray-400 max-w-xs mx-auto">Generative AI is assessing safety levels...</p>
                </div>
            </div>
        );
    }

    const isScanning = showIdentity && identityMode === 'SCAN';

    return (
        <div className="h-[100dvh] w-screen bg-black relative overflow-hidden flex flex-col items-center justify-center">

            {/* Conditional Rendering: Scanner OR Webcam */}
            <div className="absolute inset-0 w-full h-full z-0 flex items-center justify-center bg-black">
                {isScanning ? (
                    <div className="w-full h-full relative">
                        <Scanner
                            onScan={handleScan}
                            styles={{
                                container: { width: '100%', height: '100%' },
                                video: { objectFit: 'cover' }
                            }}
                            components={{
                                finder: false // We use our own overlay
                            }}
                        />
                        {/* Custom Finder Overlay */}
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8 pointer-events-none">
                            <div className="relative w-64 h-64 border-2 border-white/50 rounded-lg overflow-hidden">
                                <div className="absolute inset-0 border-2 border-brand-purple animate-pulse opacity-50"></div>
                                <div className="absolute top-0 left-0 w-full h-1 bg-brand-purple/50 animate-scan-line"></div>
                            </div>
                            <p className="mt-8 text-white/70 font-mono text-xs uppercase tracking-widest">Scanning for Peer...</p>
                        </div>
                    </div>
                ) : (
                    <>
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            playsInline={true}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{
                                facingMode: facingMode,
                                width: { ideal: 640 },
                                height: { ideal: 480 }
                            }}
                            style={{ width: '100%', height: '100%' }}
                            className="object-cover"
                            onUserMedia={() => setStreamReady(true)}
                            onUserMediaError={(e) => console.error("Camera Error", e)}
                        />
                        {/* DEBUG OVERLAY */}
                        {/* <CameraDebugOverlay webcamRef={webcamRef} /> */}
                    </>
                )}
            </div>

            {/* Controls Overlay (Only when not in Identity mode) */}
            {
                !showIdentity && (
                    <>
                        {/* Top Bar */}
                        <div className="absolute top-0 left-0 w-full p-6 flex justify-between z-20 pointer-events-none">
                            <button onClick={onViewFeed} className="pointer-events-auto p-3 rounded-full bg-black/20 backdrop-blur-md border border-white/10 text-white"><ArrowLeft size={20} /></button>
                            <button onClick={onPanic} className="pointer-events-auto p-3 rounded-full bg-red-500/20 backdrop-blur-md border border-red-500 text-red-500 animate-pulse"><ShieldAlert size={24} /></button>
                        </div>

                        {/* Bottom Bar */}
                        <div className="absolute bottom-0 left-0 w-full p-8 pb-12 flex flex-col items-center z-20 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none">

                            {/* Recording Timer */}
                            {recorderState === RecorderState.RECORDING && (
                                <div className="mb-6 flex items-center gap-2 px-4 py-1 rounded-full bg-red-500/20 border border-red-500/50 pointer-events-auto">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                                    <span className="text-white font-mono font-bold">{formatTime(timer)}</span>
                                </div>
                            )}

                            {/* Flash & Zoom Controls - only show when NOT recording */}
                            {recorderState !== RecorderState.RECORDING && (
                                <div className="mb-4 flex items-center gap-4 pointer-events-auto">
                                    {/* Flash Toggle */}
                                    {torchSupported && (
                                        <button
                                            onClick={toggleTorch}
                                            className={`p-3 rounded-full backdrop-blur-md border transition-all ${torchEnabled ? 'bg-yellow-500/30 border-yellow-400 text-yellow-300' : 'bg-black/40 border-white/10 text-white/70'}`}
                                        >
                                            <Flashlight size={20} />
                                        </button>
                                    )}

                                    {/* Zoom Slider */}
                                    {zoomSupported && (
                                        <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-black/40 backdrop-blur-md border border-white/10">
                                            <ZoomIn size={16} className="text-white/70" />
                                            <input
                                                type="range"
                                                min="1"
                                                max={maxZoom}
                                                step="0.1"
                                                value={zoomLevel}
                                                onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                                                className="w-20 h-1 accent-brand-purple"
                                            />
                                            <span className="text-white/70 text-xs font-mono w-8">{zoomLevel.toFixed(1)}x</span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Main Controls Row */}
                            <div className="flex items-center justify-around w-full max-w-sm pointer-events-auto">
                                {/* Identity / QR Button */}
                                <button
                                    onClick={() => setShowIdentity(true)}
                                    disabled={recorderState === RecorderState.RECORDING}
                                    className={`p-4 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white transition-opacity ${recorderState === RecorderState.RECORDING ? 'opacity-0' : 'opacity-100'}`}
                                >
                                    <QrCode size={24} />
                                </button>

                                {/* Record Button */}
                                <button
                                    onClick={recorderState === RecorderState.RECORDING ? stopRecordingAndAnalyze : startRecording}
                                    className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all transform active:scale-95 ${recorderState === RecorderState.RECORDING ? 'border-red-500 bg-red-500/20 scale-110' : 'border-white bg-white/20'}`}
                                >
                                    <div className={`transition-all duration-300 ${recorderState === RecorderState.RECORDING ? 'w-8 h-8 bg-red-500 rounded-sm' : 'w-16 h-16 bg-white rounded-full'}`}></div>
                                </button>

                                {/* Flip Camera Button */}
                                <button
                                    onClick={toggleCamera}
                                    disabled={recorderState === RecorderState.RECORDING}
                                    className={`p-4 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white transition-opacity ${recorderState === RecorderState.RECORDING ? 'opacity-0' : 'opacity-100'}`}
                                >
                                    <RefreshCcw size={24} />
                                </button>
                            </div>
                        </div>
                    </>
                )
            }

            {/* Identity Modal */}
            {
                showIdentity && (
                    <div className={`absolute inset-0 z-50 ${identityMode === 'SCAN' ? 'bg-transparent pointer-events-none' : 'bg-black/95'} flex flex-col`}>
                        <div className="flex justify-between items-center p-6 border-b border-white/10 pointer-events-auto bg-black/50 backdrop-blur-md">
                            <h2 className="text-xl font-black italic text-white">SESSION IDENTITY</h2>
                            <button onClick={() => setShowIdentity(false)} className="p-2 rounded-full bg-white/10 text-white"><X size={20} /></button>
                        </div>

                        <div className="flex p-4 pointer-events-auto">
                            <div className="flex w-full bg-white/10 rounded-lg p-1">
                                <button onClick={() => setIdentityMode('MY_CODE')} className={`flex-1 py-3 rounded-md text-xs font-bold transition-all ${identityMode === 'MY_CODE' ? 'bg-brand-purple text-white shadow-lg' : 'text-white/50'}`}>MY CODE</button>
                                <button onClick={() => setIdentityMode('SCAN')} className={`flex-1 py-3 rounded-md text-xs font-bold transition-all ${identityMode === 'SCAN' ? 'bg-brand-purple text-white shadow-lg' : 'text-white/50'}`}>SCAN PEER</button>
                            </div>
                        </div>

                        {identityMode === 'MY_CODE' && (
                            <div className="flex-1 flex flex-col items-center justify-center p-6 pointer-events-auto">
                                <div className="bg-white p-4 rounded-xl mb-8">
                                    <GenerateGeoQR userId={userId} />
                                </div>
                                <div onClick={() => { navigator.clipboard.writeText(userId); setCopyFeedback(true); setTimeout(() => setCopyFeedback(false), 2000); }} className="flex items-center gap-2 text-2xl font-bold font-mono text-white cursor-pointer">
                                    {userId}
                                    {copyFeedback ? <Check size={20} className="text-green-500" /> : <Copy size={20} className="text-zinc-600" />}
                                </div>
                            </div>
                        )}

                        {identityMode === 'SCAN' && scanResult && (
                            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-full max-w-xs pointer-events-auto">
                                <div className="bg-zinc-900 border border-white/10 rounded-xl p-4 flex items-center gap-4 shadow-2xl">
                                    <div className="w-10 h-10 rounded-full bg-brand-purple/20 flex items-center justify-center"><Check size={20} className="text-brand-purple" /></div>
                                    <div>
                                        <p className="text-xs text-zinc-500 font-mono uppercase">Status</p>
                                        <p className="text-white font-bold font-mono text-sm leading-tight">{scanResult}</p>
                                    </div>
                                    <button onClick={() => setScanResult(null)} className="ml-auto text-xs bg-white/10 px-2 py-1 rounded">Reset</button>
                                </div>
                            </div>
                        )}
                    </div>
                )
            }
        </div >
    );
};

// Helper: Generate QR with location embedded
const GenerateGeoQR = ({ userId }: { userId: string }) => {
    const [qrValue, setQrValue] = useState(userId);
    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                setQrValue(JSON.stringify({
                    id: userId,
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    t: Date.now()
                }));
            }, () => setQrValue(userId));
        }
    }, [userId]);

    return <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrValue)}`} alt="ID QR" className="w-56 h-56 mix-blend-multiply" />;
};