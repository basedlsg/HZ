import React, { useState, useEffect } from 'react';
import { Share, PlusSquare, X } from 'lucide-react';

export const InstallPrompt: React.FC = () => {
    const [showPrompt, setShowPrompt] = useState(false);

    useEffect(() => {
        // Dynamic detection: iOS && Browser (not standalone)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;

        // Show after a short delay if on iOS web
        if (isIOS && !isStandalone) {
            const timer = setTimeout(() => setShowPrompt(true), 2000);
            return () => clearTimeout(timer);
        }
    }, []);

    if (!showPrompt) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-end pb-12 animate-in fade-in duration-500">
            {/* Close Button */}
            <button
                onClick={() => setShowPrompt(false)}
                className="absolute top-6 right-6 p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
                <X size={24} />
            </button>

            <div className="w-[90%] max-w-md bg-zinc-900 rounded-3xl border border-white/10 p-8 shadow-2xl flex flex-col items-center text-center">

                {/* App Icon Placeholder */}
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-purple to-blue-600 mb-6 shadow-glow"></div>

                <h2 className="text-xl font-bold text-white mb-2">Install Ombrixa</h2>
                <p className="text-zinc-400 text-sm mb-8 leading-relaxed">
                    Add this app to your Home Screen for the best full-screen experience and quick access.
                </p>

                <div className="w-full space-y-6">
                    <div className="flex items-center gap-4 text-left p-4 rounded-xl bg-white/5 border border-white/5">
                        <Share className="text-blue-400 shrink-0" size={24} />
                        <div>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Step 1</p>
                            <p className="text-white text-sm">Tap the <span className="font-bold text-blue-400">Share</span> button in your browser toolbar.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-left p-4 rounded-xl bg-white/5 border border-white/5">
                        <PlusSquare className="text-white shrink-0" size={24} />
                        <div>
                            <p className="text-xs text-zinc-500 uppercase tracking-wider font-bold">Step 2</p>
                            <p className="text-white text-sm">Scroll down and select <span className="font-bold text-white">Add to Home Screen</span>.</p>
                        </div>
                    </div>
                </div>

                <div className="mt-8 text-xs text-zinc-600 font-mono">
                    WEB-BASED TACTICAL SUITE
                </div>
            </div>

            {/* Pointer arrow for Safari bottom bar */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 animate-bounce">
                <div className="w-0 h-0 border-l-[10px] border-l-transparent border-t-[10px] border-t-white/20 border-r-[10px] border-r-transparent"></div>
            </div>
        </div>
    );
};
