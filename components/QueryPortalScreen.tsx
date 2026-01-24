import React, { useState } from 'react';
import { Search, CheckCircle, XCircle, AlertTriangle, Terminal } from 'lucide-react';

interface QueryPortalScreenProps {
    onBack?: () => void;
}

export const QueryPortalScreen: React.FC<QueryPortalScreenProps> = ({ onBack }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<'found' | 'not_found' | 'error' | null>(null);

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
            {/* Background Grid Effect */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-20"
                style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(124, 58, 237, .3) 25%, rgba(124, 58, 237, .3) 26%, transparent 27%, transparent 74%, rgba(124, 58, 237, .3) 75%, rgba(124, 58, 237, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(124, 58, 237, .3) 25%, rgba(124, 58, 237, .3) 26%, transparent 27%, transparent 74%, rgba(124, 58, 237, .3) 75%, rgba(124, 58, 237, .3) 76%, transparent 77%, transparent)', backgroundSize: '50px 50px' }}>
            </div>

            <div className="z-10 w-full max-w-md bg-zinc-900/90 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center">

                {/* Branding */}
                <div className="flex flex-col items-center justify-center mb-10">
                    <h1 className="font-black tracking-tighter text-3xl text-white drop-shadow-md mb-2">OMBRIXA</h1>
                    <div className="flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        <Terminal size={12} />
                        <span>Secure Query Portal</span>
                    </div>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col gap-4 w-full">
                    <div className="relative group w-full">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="ENTER IDENTIFIER..."
                            className="w-full bg-black/50 border border-white/10 rounded-xl p-4 pl-12 text-lg text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all uppercase placeholder-zinc-600 font-mono"
                        />
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-zinc-500 group-focus-within:text-purple-400 transition-colors" size={20} />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="w-full bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-900/20 active:scale-95 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>SEARCHING DATABASE...</span>
                            </>
                        ) : (
                            <>
                                <span>INITIATE QUERY</span>
                            </>
                        )}
                    </button>
                </form>

                {result && (
                    <div className={`mt-8 p-6 rounded-2xl border flex flex-col items-center justify-center w-full animate-in fade-in zoom-in duration-300 text-center ${result === 'found' ? 'bg-purple-900/20 border-purple-500/50 text-purple-300' :
                            result === 'not_found' ? 'bg-red-900/10 border-red-500/30 text-red-400' :
                                'bg-yellow-900/10 border-yellow-500/30 text-yellow-500'
                        }`}>
                        {result === 'found' && (
                            <>
                                <CheckCircle size={48} className="mb-3 text-purple-400" />
                                <h2 className="text-xl font-bold text-white">DATA LOCATED</h2>
                                <p className="text-sm opacity-70 mt-1">Record verified in secure storage.</p>
                            </>
                        )}
                        {result === 'not_found' && (
                            <>
                                <XCircle size={48} className="mb-3" />
                                <h2 className="text-xl font-bold text-white">NO RECORD FOUND</h2>
                                <p className="text-sm opacity-70 mt-1">Identifier invalid or not yet synced.</p>
                            </>
                        )}
                        {result === 'error' && (
                            <>
                                <AlertTriangle size={48} className="mb-3" />
                                <h2 className="text-xl font-bold text-white">SYSTEM ERROR</h2>
                                <p className="text-sm opacity-70 mt-1">Connection failed. Please retry.</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 text-xs text-zinc-600 uppercase font-mono tracking-widest">
                Restricted Access // Omni-Corp v4.0
            </div>
        </div>
    );
};
