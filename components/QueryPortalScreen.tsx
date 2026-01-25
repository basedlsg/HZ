import React, { useState } from 'react';
import { Search, CheckCircle, XCircle, AlertTriangle, Terminal, HelpCircle, X } from 'lucide-react';

interface QueryPortalScreenProps {
    onBack?: () => void;
}

export const QueryPortalScreen: React.FC<QueryPortalScreenProps> = ({ onBack }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<'found' | 'not_found' | 'error' | null>(null);
    const [showInstructions, setShowInstructions] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setResult(null);
        setErrorMsg('');

        try {
            const response = await fetch(`/api/query?id=${encodeURIComponent(query)}`);

            // Handle non-JSON responses (crashes/timeouts returning HTML)
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                const text = await response.text();
                throw new Error(`Server Error (${response.status}): ${text.substring(0, 50)}...`);
            }

            const data = await response.json();

            if (data.exists) {
                setResult('found');
            } else {
                setResult('not_found');
            }
        } catch (error: any) {
            console.error("Query failed", error);
            setResult('error');
            setErrorMsg(error.message || "Connection failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-black text-white font-sans relative">

            {/* Help Button - Subtle */}
            <button
                onClick={() => setShowInstructions(true)}
                className="absolute top-8 right-8 z-20 text-zinc-600 hover:text-purple-400 transition-colors"
            >
                <HelpCircle size={24} />
            </button>

            {/* Main Card - Minimalist but Branded */}
            <div className="z-10 w-full max-w-sm flex flex-col items-center">

                {/* Branding - BIG BOLD */}
                <div className="flex flex-col items-center justify-center mb-12">
                    <h1 className="font-black tracking-tighter text-5xl text-white mb-2 tracking-wide drop-shadow-2xl">OMBRIXA</h1>
                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-[0.3em] uppercase px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-purple-500">
                        <span>Secure Query Portal</span>
                    </div>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col gap-6 w-full">
                    <div className="relative group w-full">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Enter unique identifier..."
                            className="w-full bg-zinc-950 border border-zinc-800 focus:border-purple-500/50 rounded-xl p-5 text-lg text-white placeholder-zinc-700 outline-none transition-all focus:ring-1 focus:ring-purple-500/20"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-lg py-5 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20 active:scale-95"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-3">
                                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="text-sm tracking-widest uppercase">Searching...</span>
                            </div>
                        ) : (
                            <span>INITIATE QUERY</span>
                        )}
                    </button>
                </form>

                {/* Minimalist Result Display */}
                {result && (
                    <div className="mt-10 w-full flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {result === 'found' && (
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-3 bg-purple-500/10 rounded-full mb-1">
                                    <CheckCircle size={32} className="text-purple-400" />
                                </div>
                                <h2 className="text-xl font-bold text-white">DATA LOCATED</h2>
                                <p className="text-zinc-500 text-sm">Record verified in secure storage.</p>
                            </div>
                        )}
                        {result === 'not_found' && (
                            <div className="flex flex-col items-center gap-2">
                                <div className="p-3 bg-zinc-900 rounded-full mb-1">
                                    <XCircle size={32} className="text-zinc-500" />
                                </div>
                                <h2 className="text-xl font-bold text-zinc-400">NO RECORD FOUND</h2>
                            </div>
                        )}
                        {result === 'error' && (
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl w-full flex flex-col items-center gap-2">
                                <div className="flex items-center gap-2 text-red-400">
                                    <AlertTriangle size={20} />
                                    <span className="font-bold">System Error</span>
                                </div>
                                <span className="text-xs text-red-300/70 font-mono text-center break-all">{errorMsg}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Instructions Modal - Consistent Style */}
            {showInstructions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-8 relative shadow-2xl">
                        <button
                            onClick={() => setShowInstructions(false)}
                            className="absolute top-5 right-5 text-zinc-600 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-xl font-bold text-white mb-2">Instructions</h2>
                        <p className="text-zinc-500 mb-8 text-sm">
                            Query the secure database for:
                        </p>

                        <div className="space-y-4 mb-8">
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-xs">01</div>
                                <span className="text-zinc-300 text-sm font-medium">Badge Number</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-xs">02</div>
                                <span className="text-zinc-300 text-sm font-medium">License Plate</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 font-bold text-xs">03</div>
                                <span className="text-zinc-300 text-sm font-medium">Name / Alias</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowInstructions(false)}
                            className="w-full bg-white hover:bg-zinc-200 text-black font-bold py-4 rounded-xl transition-all active:scale-95"
                        >
                            Understood
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
