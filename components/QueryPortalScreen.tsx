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

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setResult(null);

        try {
            const response = await fetch(`/api/query?id=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (data.exists) {
                setResult('found');
            } else {
                setResult('not_found');
            }
        } catch (error) {
            console.error("Query failed", error);
            setResult('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-black text-white font-sans relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-900/40 rounded-full blur-[128px] pointer-events-none" />

            {/* Background Grid Effect */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20"
                style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(124, 58, 237, .3) 25%, rgba(124, 58, 237, .3) 26%, transparent 27%, transparent 74%, rgba(124, 58, 237, .3) 75%, rgba(124, 58, 237, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(124, 58, 237, .3) 25%, rgba(124, 58, 237, .3) 26%, transparent 27%, transparent 74%, rgba(124, 58, 237, .3) 75%, rgba(124, 58, 237, .3) 76%, transparent 77%, transparent)', backgroundSize: '50px 50px' }}>
            </div>

            {/* Help Button */}
            <button
                onClick={() => setShowInstructions(true)}
                className="absolute top-6 right-6 z-20 text-white/30 hover:text-white transition-colors p-2"
            >
                <HelpCircle size={24} />
            </button>

            {/* Main Card */}
            <div className="z-10 w-full max-w-sm bg-zinc-900/60 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-8 shadow-2xl flex flex-col items-center relative overflow-hidden group hover:border-white/20 transition-all duration-500">

                {/* Subtle top shine */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-50" />

                {/* Branding */}
                <div className="flex flex-col items-center justify-center mb-8 mt-2">
                    <h1 className="font-black tracking-tighter text-4xl text-white drop-shadow-2xl mb-3 tracking-wide">OMBRIXA</h1>
                    <div className="flex items-center gap-2 text-[9px] font-mono font-bold tracking-[0.2em] uppercase px-3 py-1 rounded-full bg-black/40 border border-white/5 text-purple-300 shadow-inner">
                        <Terminal size={10} className="text-purple-500" />
                        <span>Secure Query Portal</span>
                    </div>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col gap-5 w-full">
                    <div className="relative group/input w-full">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Enter query..."
                            className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 pl-12 text-lg text-white placeholder-zinc-700 font-medium transition-all focus:outline-none focus:border-purple-500/50 focus:ring-4 focus:ring-purple-500/10 focus:bg-black/60"
                        />
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-600 group-focus-within/input:text-purple-400 transition-colors" size={20} />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="w-full bg-gradient-to-r from-purple-700 to-indigo-600 hover:from-purple-600 hover:to-indigo-500 text-white font-bold py-4 rounded-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/30 active:scale-95 flex items-center justify-center gap-2 relative overflow-hidden group/btn"
                    >
                        {/* Shimmer effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />

                        {loading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span className="tracking-widest text-xs">SEARCHING...</span>
                            </>
                        ) : (
                            <>
                                <span className="tracking-widest text-xs">INITIATE QUERY</span>
                            </>
                        )}
                    </button>
                </form>

                {result && (
                    <div className={`mt-8 p-6 rounded-2xl border flex flex-col items-center justify-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500 text-center ${result === 'found' ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' :
                            result === 'not_found' ? 'bg-red-500/10 border-red-500/20 text-red-200' :
                                'bg-yellow-500/10 border-yellow-500/20 text-yellow-200'
                        }`}>
                        {result === 'found' && (
                            <>
                                <div className="p-3 bg-purple-500/20 rounded-full mb-3 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
                                    <CheckCircle size={32} className="text-purple-400" />
                                </div>
                                <h2 className="text-lg font-bold text-white tracking-wide">DATA LOCATED</h2>
                                <p className="text-xs opacity-60 mt-1 font-mono uppercase">Record Verified</p>
                            </>
                        )}
                        {result === 'not_found' && (
                            <>
                                <div className="p-3 bg-red-500/10 rounded-full mb-3">
                                    <XCircle size={32} className="text-red-400" />
                                </div>
                                <h2 className="text-lg font-bold text-white tracking-wide">NO RECORD</h2>
                                <p className="text-xs opacity-60 mt-1 font-mono uppercase">Identifier Invalid</p>
                            </>
                        )}
                        {result === 'error' && (
                            <>
                                <AlertTriangle size={32} className="mb-3 text-yellow-500" />
                                <h2 className="text-lg font-bold text-white">ERROR</h2>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Instructions Modal - kept consistent but slightly polished */}
            {showInstructions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-zinc-950 border border-white/10 rounded-[2rem] p-8 shadow-2xl relative">
                        <button
                            onClick={() => setShowInstructions(false)}
                            className="absolute top-6 right-6 text-zinc-600 hover:text-white transition-colors"
                        >
                            <X size={24} />
                        </button>

                        <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Query Instructions</h2>
                        <p className="text-zinc-500 mb-8 text-sm leading-relaxed">
                            Enter specific identifiers to verify existence in the secure database.
                        </p>

                        <div className="space-y-3">
                            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-5">
                                <h3 className="text-purple-400 font-bold text-xs uppercase mb-4 tracking-widest flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                                    Searchable Fields
                                </h3>
                                <ul className="text-zinc-400 space-y-3 text-sm font-medium">
                                    <li className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] text-zinc-500 font-mono">01</span>
                                        Badge Number
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] text-zinc-500 font-mono">02</span>
                                        License Plate
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] text-zinc-500 font-mono">03</span>
                                        Name / Alias
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <span className="w-6 h-6 rounded-md bg-white/5 flex items-center justify-center text-[10px] text-zinc-500 font-mono">04</span>
                                        Date (ISO Format)
                                    </li>
                                </ul>
                            </div>

                            <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-purple-900/10 to-transparent rounded-2xl border border-white/5 mt-4">
                                <div className="p-2.5 bg-purple-500/10 rounded-xl text-purple-400">
                                    <Terminal size={20} />
                                </div>
                                <div>
                                    <p className="text-white text-xs font-bold uppercase tracking-wider mb-0.5">Coming Soon</p>
                                    <p className="text-zinc-500 text-xs">Facial Recognition Search</p>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setShowInstructions(false)}
                            className="w-full mt-8 bg-white text-black hover:bg-zinc-200 font-bold py-4 rounded-xl transition-all active:scale-95"
                        >
                            Understood
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
