import React, { useRef, useState, useEffect } from 'react';
import { FeedItem, SyncStatus } from '../types';
import { Play, Pause, MapPin, Shield, AlertTriangle, Cloud, CloudUpload, CloudCheck, CloudOff, Info, X, Car, User, Fingerprint, Siren, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { db } from '../services/db';

interface EventCardProps {
    item: FeedItem;
    isDarkMode?: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({ item, isDarkMode = true }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [videoSrc, setVideoSrc] = useState<string | undefined>(item.videoUrl);
    const [loadingVideo, setLoadingVideo] = useState(false);
    const [blobStats, setBlobStats] = useState<{ size: number, type: string } | null>(null);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [votes, setVotes] = useState<{ up: number; down: number }>({ up: 0, down: 0 });
    const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);
    const [viewCount] = useState(() => Math.floor(Math.random() * 50) + 12); // Stable view count

    // Intersection Observer for Lazy Loading and Auto-play
    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsVisible(entry.isIntersecting);
            },
            { threshold: 0.6 } // Standard TikTok-style focus
        );

        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        let objectUrl: string | null = null;

        const loadVideo = async () => {
            if (item.videoUrl) {
                // If remote URL or (legacy) base64 URL exists, use it
                setVideoSrc(item.videoUrl);
                // Try to extract size/type from data URL for debugging
                if (item.videoUrl.startsWith('data:')) {
                    const match = item.videoUrl.match(/^data:([^;]+);base64,(.*)$/);
                    if (match) {
                        const mimeType = match[1];
                        const base64Length = match[2].length;
                        const sizeBytes = (base64Length * 3) / 4;
                        setBlobStats({ size: sizeBytes, type: mimeType });
                    }
                }
            } else if (item.isUserGenerated) {
                // LAZY LOAD: Fetch blob from IndexedDB only when needed
                try {
                    setLoadingVideo(true);
                    const blob = await db.getVideoBlob(item.id);
                    if (blob) {
                        objectUrl = URL.createObjectURL(blob);
                        setVideoSrc(objectUrl);
                        setBlobStats({ size: blob.size, type: blob.type });
                    } else {
                        setVideoError("Video not found on device");
                    }
                } catch (e) {
                    console.error("Failed to load video", e);
                    setVideoError("Failed to load video");
                } finally {
                    setLoadingVideo(false);
                }
            }
        };

        if (isVisible && !videoSrc) {
            loadVideo();
        }

        return () => {
            if (objectUrl) {
                URL.revokeObjectURL(objectUrl);
            }
        };
    }, [item.id, item.videoUrl, item.isUserGenerated, isVisible]); // Dependency on isVisible ensures lazy loading

    // Handle visibility state (NO auto-play - Safari blocks it)
    useEffect(() => {
        if (!videoRef.current) return;

        // If not visible, pause the video
        if (!isVisible) {
            videoRef.current.pause();
            setIsPlaying(false);
        }
        // If visible - do NOT auto-play, let user tap native controls
    }, [isVisible, videoSrc]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
            } else {
                videoRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const safetyColor = (score: number) => {
        if (score > 70) return 'text-red-500';
        if (score > 40) return 'text-orange-500';
        return 'text-green-500';
    };

    return (
        <div
            ref={containerRef}
            className={`w-full h-[100dvh] snap-start relative flex flex-col justify-end ${isDarkMode ? 'bg-black' : 'bg-gray-100'}`}
        >

            {/* Video Content */}
            <div className="absolute inset-0 z-0 bg-black">
                {videoSrc ? (
                    <video
                        key={videoSrc} // Force re-render when source loads
                        ref={videoRef}
                        className="w-full h-full object-cover opacity-90 transition-opacity duration-500"
                        loop
                        playsInline
                        webkit-playsinline="true"
                        muted={true}
                        autoPlay={false}
                        preload="metadata"
                        controls={true}
                        onClick={togglePlay}
                        onError={(e) => {
                            const err = (e.target as HTMLVideoElement).error;
                            setVideoError(`Error ${err?.code}: ${err?.message || 'Unknown'}`);
                        }}
                        onLoadedData={() => setVideoError(null)}
                    >
                        <source src={videoSrc} type={blobStats?.type || 'video/mp4'} />
                        Your browser does not support video playback.
                    </video>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center relative">
                        <img src={item.thumbnailUrl} className="w-full h-full object-cover blur-sm opacity-50" />
                        {loadingVideo && (
                            <div className="absolute flex flex-col items-center gap-3">
                                <span className="text-white text-xs font-mono animate-pulse tracking-widest text-brand-purple">DECRYPTING SIGNAL...</span>
                                <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-brand-purple animate-[loading_2s_infinite]"></div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Debug Overlay Removed */}

                {/* Play Overlay */}
                {!isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="bg-white/10 backdrop-blur-md p-6 rounded-full border border-white/20 shadow-2xl animate-pulse">
                            <Play size={32} className="text-white fill-white ml-1" />
                        </div>
                    </div>
                )}
            </div>

            {/* Info Layer - Glassmorphism */}
            <div className="relative z-10 w-full px-6 pt-12 pb-[calc(5rem+env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/60 to-transparent pointer-events-none">

                <div className="flex justify-between items-end mb-4 pointer-events-auto">
                    <div className="w-full">
                        {/* Status Line */}
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full backdrop-blur-xl border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
                                <Shield size={12} className={safetyColor(item.analysis?.safetyScore || 0)} />
                                <span className="text-[10px] font-bold tracking-widest uppercase text-white/80">
                                    Safe: {item.analysis?.safetyScore || 0}%
                                </span>
                            </div>

                            {/* Sync Status */}
                            <div className="ml-auto">
                                {item.syncStatus === SyncStatus.UPLOADING && <CloudUpload size={14} className="text-blue-400 animate-bounce" />}
                                {item.syncStatus === SyncStatus.SYNCED && <CloudCheck size={14} className="text-emerald-400" />}
                                {item.syncStatus === SyncStatus.FAILED && <CloudOff size={14} className="text-red-400" />}
                                {(item.syncStatus === SyncStatus.PENDING || !item.syncStatus) && <Cloud size={14} className="text-zinc-500" />}
                            </div>
                        </div>

                        {/* Title - Bigger & bolder */}
                        <div onClick={() => setIsSummaryExpanded(!isSummaryExpanded)} className="relative group cursor-pointer">
                            <h3 className={`text-xl font-black leading-tight mb-2 text-white drop-shadow-lg tracking-tight transition-all duration-300 pr-16 ${isSummaryExpanded ? '' : 'line-clamp-3'}`}>
                                {item.analysis?.summary}
                            </h3>
                            {item.analysis?.summary && item.analysis.summary.length > 100 && (
                                <div className="text-xs text-brand-purple font-bold uppercase tracking-widest mb-3 flex items-center gap-1">
                                    {isSummaryExpanded ? (
                                        <><span>Show Less</span> <ChevronUp size={12} /></>
                                    ) : (
                                        <><span>Read Full Report</span> <ChevronDown size={12} /></>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Tags */}
                        <div className="flex flex-wrap gap-2 text-[10px] font-mono uppercase tracking-wide opacity-90">
                            {/* Officer Count Badge */}
                            {item.analysis?.peopleDetails && item.analysis.peopleDetails.filter(p => p.isUniformed).length > 0 && (
                                <span className="px-2.5 py-1 rounded-md bg-brand-purple/20 border border-brand-purple/30 text-brand-purple font-bold flex items-center gap-1.5">
                                    <User size={10} />
                                    {item.analysis.peopleDetails.filter(p => p.isUniformed).length} OFFICER{item.analysis.peopleDetails.filter(p => p.isUniformed).length !== 1 ? 'S' : ''}
                                </span>
                            )}

                            {item.analysis?.detectedCivicDetails.slice(0, 3).map((tag, i) => (
                                <span key={i} className="px-2.5 py-1 rounded-md bg-white/10 border border-white/10 text-zinc-200">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-4 text-[10px] font-mono uppercase tracking-widest text-zinc-400 border-t border-white/10 pt-4 mt-2">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5">
                            <MapPin size={10} />
                            <span>{item.location.lat.toFixed(4)}, {item.location.lng.toFixed(4)}</span>
                        </div>
                        <span className="opacity-30">|</span>
                        <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <button
                        onClick={(e) => { e.stopPropagation(); setShowDetails(true); }}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-purple/20 border border-brand-purple/30 text-brand-purple pointer-events-auto active:scale-95 transition-all"
                    >
                        <Info size={10} />
                        <span className="font-bold">INTEL</span>
                    </button>
                </div>

            </div>

            {/* Detailed Intel Overlay */}
            {showDetails && <IntelOverlay item={item} onClose={() => setShowDetails(false)} />}

            {/* Action Bar (Right Side) */}
            <div className="absolute right-4 bottom-48 z-20 flex flex-col gap-6 pointer-events-auto items-center">

                {/* Download Button */}
                <button
                    onClick={async (e) => {
                        e.stopPropagation();
                        try {
                            const blob = await db.getVideoBlob(item.id);
                            if (blob) {
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `ombrixa-evidence-${item.id.slice(0, 8)}.webm`;
                                document.body.appendChild(a);
                                a.click();
                                document.body.removeChild(a);
                                URL.revokeObjectURL(url);
                            } else {
                                alert("Video file not found on device.");
                            }
                        } catch (err) {
                            console.error("Download failed", err);
                            alert("Download failed.");
                        }
                    }}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className="w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center bg-black/40 border-white/20 text-white group-hover:bg-white/10 active:scale-90 transition-all">
                        <CloudUpload size={24} className="rotate-180" /> {/* Reuse CloudUpload as Download */}
                    </div>
                </button>

                {/* Siren - PANIC / UNSAFE */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (userVote === 'down') {
                            setUserVote(null);
                            setVotes(prev => ({ ...prev, down: Math.max(0, prev.down - 1) }));
                        } else {
                            if (userVote === 'up') setVotes(prev => ({ ...prev, up: Math.max(0, prev.up - 1) }));
                            setUserVote('down');
                            setVotes(prev => ({ ...prev, down: prev.down + 1 }));
                        }
                    }}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-all active:scale-90 shadow-lg ${userVote === 'down' ? 'bg-red-500/80 border-red-400 text-white animate-pulse' : 'bg-black/40 border-white/20 text-white group-hover:bg-white/10'}`}>
                        <Siren size={24} className={userVote === 'down' ? "fill-white" : ""} />
                    </div>
                    <span className="text-[10px] font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                        {votes.down}
                    </span>
                </button>

                {/* Shield - SAFE / VERIFY */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        if (userVote === 'up') {
                            setUserVote(null);
                            setVotes(prev => ({ ...prev, up: Math.max(0, prev.up - 1) }));
                        } else {
                            if (userVote === 'down') setVotes(prev => ({ ...prev, down: Math.max(0, prev.down - 1) }));
                            setUserVote('up');
                            setVotes(prev => ({ ...prev, up: prev.up + 1 }));
                        }
                    }}
                    className="flex flex-col items-center gap-1 group"
                >
                    <div className={`w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center transition-all active:scale-90 shadow-lg ${userVote === 'up' ? 'bg-blue-500/80 border-blue-400 text-white' : 'bg-black/40 border-white/20 text-white group-hover:bg-white/10'}`}>
                        <Shield size={24} className={userVote === 'up' ? "fill-white" : ""} />
                    </div>
                    <span className="text-[10px] font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                        {votes.up}
                    </span>
                </button>

                {/* Eye - VIEW / WITNESS */}
                <div className="flex flex-col items-center gap-1 group">
                    <div className="w-12 h-12 rounded-full backdrop-blur-md border flex items-center justify-center bg-black/40 border-white/20 text-white">
                        <Eye size={24} />
                    </div>
                    <span className="text-[10px] font-bold text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
                        {viewCount}
                    </span>
                </div>

            </div>
        </div >
    );
};

// Helper for Editable Intel
const IntelOverlay = ({ item, onClose }: { item: FeedItem, onClose: () => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [analysis, setAnalysis] = useState(item.analysis);

    const handleSave = async () => {
        try {
            // Update in DB
            const updatedItem = { ...item, analysis: analysis };
            await db.feedItems.put(updatedItem);
            setIsEditing(false);
            // Ideally notify parent to refresh, but local mutation works for display
            item.analysis = analysis;
        } catch (e) {
            console.error("Failed to save changes", e);
            alert("Failed to save changes.");
        }
    };

    return (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex flex-col p-6 animate-in fade-in slide-in-from-bottom-5 duration-300">
            <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-2">
                    <Fingerprint className="text-brand-purple" size={20} />
                    <h2 className="text-xl font-black tracking-tighter text-white uppercase italic">Detailed Intelligence</h2>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                        className={`px-4 py-2 rounded-full text-xs font-bold font-mono uppercase transition-all ${isEditing ? 'bg-green-500 text-white' : 'bg-white/10 text-zinc-400 hover:bg-white/20'}`}
                    >
                        {isEditing ? 'Save Changes' : 'Edit Data'}
                    </button>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 pb-12">
                {/* SITREP Section */}
                <section>
                    <div className="flex items-center gap-2 mb-4 text-brand-purple">
                        <AlertTriangle size={16} />
                        <h3 className="text-xs font-bold tracking-widest uppercase">Situation Report</h3>
                    </div>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 font-mono text-xs leading-relaxed text-zinc-300">
                        {isEditing ? (
                            <textarea
                                value={analysis?.summary || ''}
                                onChange={e => setAnalysis({ ...analysis!, summary: e.target.value })}
                                className="w-full h-32 bg-black/50 p-2 text-white border border-brand-purple/50 rounded-md focus:outline-none"
                            />
                        ) : (
                            <p>{analysis?.summary || 'Analysis pending...'}</p>
                        )}
                    </div>
                </section>

                {/* Vehicles Section */}
                {analysis?.vehicleDetails && analysis.vehicleDetails.length > 0 && (
                    <section>
                        <div className="flex items-center gap-2 mb-4 text-brand-purple">
                            <Car size={16} />
                            <h3 className="text-xs font-bold tracking-widest uppercase">Detected Vehicles</h3>
                        </div>
                        <div className="grid gap-3">
                            {analysis.vehicleDetails.map((v, i) => (
                                <div key={i} className="p-4 rounded-xl bg-white/5 border border-white/10 font-mono text-[11px]">
                                    <div className="grid grid-cols-2 gap-y-2 items-center">
                                        <div className="text-zinc-500 uppercase">Make/Model</div>
                                        {isEditing ? (
                                            <div className="flex gap-1 justify-end">
                                                <input value={v.make} onChange={e => {
                                                    const newV = [...analysis.vehicleDetails]; newV[i].make = e.target.value; setAnalysis({ ...analysis, vehicleDetails: newV });
                                                }} className="bg-black/50 text-white p-1 rounded w-16 text-right" placeholder="Make" />
                                                <input value={v.model} onChange={e => {
                                                    const newV = [...analysis.vehicleDetails]; newV[i].model = e.target.value; setAnalysis({ ...analysis, vehicleDetails: newV });
                                                }} className="bg-black/50 text-white p-1 rounded w-16 text-right" placeholder="Model" />
                                            </div>
                                        ) : (
                                            <div className="text-white text-right font-bold">{v.make || 'Unknown'} {v.model || ''}</div>
                                        )}

                                        <div className="text-zinc-500 uppercase">License Plate</div>
                                        {isEditing ? (
                                            <input value={v.licensePlate} onChange={e => {
                                                const newV = [...analysis.vehicleDetails]; newV[i].licensePlate = e.target.value; setAnalysis({ ...analysis, vehicleDetails: newV });
                                            }} className="bg-black/50 text-brand-purple font-bold p-1 rounded w-full text-right" placeholder="Plate" />
                                        ) : (
                                            <div className="text-brand-purple text-right font-bold">{v.licensePlate || 'N/A'}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
};