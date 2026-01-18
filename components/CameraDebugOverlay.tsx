import React, { useState, useEffect } from 'react';
import Webcam from 'react-webcam';

interface DebugOverlayProps {
    webcamRef: React.RefObject<Webcam>;
}

export const CameraDebugOverlay: React.FC<DebugOverlayProps> = ({ webcamRef }) => {
    const [stats, setStats] = useState<any>({});

    useEffect(() => {
        const interval = setInterval(() => {
            if (webcamRef.current && webcamRef.current.video && webcamRef.current.stream) {
                const video = webcamRef.current.video;
                const stream = webcamRef.current.stream;
                const track = stream.getVideoTracks()[0];
                const settings = track ? track.getSettings() : {};

                setStats({
                    videoWidth: video.videoWidth,
                    videoHeight: video.videoHeight,
                    clientWidth: video.clientWidth,
                    clientHeight: video.clientHeight,
                    trackWidth: settings.width,
                    trackHeight: settings.height,
                    trackAspectRatio: settings.aspectRatio,
                    objectFit: window.getComputedStyle(video).objectFit
                });
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [webcamRef]);

    return (
        <div className="absolute top-20 left-4 z-50 pointer-events-none bg-black/60 p-2 text-[10px] font-mono text-green-400 border border-green-500/30 rounded backdrop-blur-sm">
            <h3 className="font-bold underline mb-1">CAMERA DEBUG</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <span>Feed Res:</span> <span className="text-white">{stats.videoWidth}x{stats.videoHeight}</span>
                <span>Track Res:</span> <span className="text-white">{stats.trackWidth}x{stats.trackHeight}</span>
                <span>Display:</span> <span className="text-white">{stats.clientWidth}x{stats.clientHeight}</span>
                <span>Aspect:</span> <span className="text-white">{stats.trackAspectRatio?.toFixed(4) || 'N/A'}</span>
                <span>Fit:</span> <span className="text-white">{stats.objectFit}</span>
            </div>
        </div>
    );
};
