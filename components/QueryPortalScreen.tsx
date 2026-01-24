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
        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-black text-green-500 font-mono relative overflow-hidden">
            {/* Background Grid Effect */}
            <div className="absolute inset-0 z-0 pointer-events-none opacity-10"
                style={{ backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(0, 255, 0, .3) 25%, rgba(0, 255, 0, .3) 26%, transparent 27%, transparent 74%, rgba(0, 255, 0, .3) 75%, rgba(0, 255, 0, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(0, 255, 0, .3) 25%, rgba(0, 255, 0, .3) 26%, transparent 27%, transparent 74%, rgba(0, 255, 0, .3) 75%, rgba(0, 255, 0, .3) 76%, transparent 77%, transparent)', backgroundSize: '50px 50px' }}>
            </div>

            <div className="z-10 w-full max-w-md bg-zinc-900/80 backdrop-blur-md border border-green-500/30 rounded-lg p-8 shadow-[0_0_20px_rgba(0,255,0,0.1)]">
                <div className="flex items-center justify-center mb-8">
                    <Terminal className="text-green-500 mr-3" size={32} />
                    <h1 className="text-2xl font-bold tracking-widest uppercase">Ombrixa Query</h1>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col gap-4">
                    <div className="relative group">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="ENTER IDENTIFIER..."
                            className="w-full bg-black/50 border border-green-500/50 rounded p-4 pl-12 text-lg focus:outline-none focus:border-green-400 focus:shadow-[0_0_10px_rgba(0,255,0,0.3)] transition-all uppercase placeholder-green-800"
                        />
                        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-green-600 group-focus-within:text-green-400 transition-colors" size={20} />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="w-full bg-green-900/30 hover:bg-green-800/50 border border-green-500/50 text-green-400 font-bold py-4 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-[0_0_15px_rgba(0,255,0,0.2)]"
                    >
                        {loading ? 'SEARCHING DATABASE...' : 'INITIATE QUERY'}
                    </button>
                </form>

                {result && (
                    <div className={`mt-8 p-6 rounded border flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300 ${result === 'found' ? 'bg-green-900/20 border-green-500 text-green-400' :
                            result === 'not_found' ? 'bg-red-900/20 border-red-500 text-red-500' :
                                'bg-yellow-900/20 border-yellow-500 text-yellow-500'
                        }`}>
                        {result === 'found' && (
                            <>
                                <CheckCircle size={48} className="mb-2" />
                                <h2 className="text-xl font-bold">DATA LOCATED</h2>
                                <p className="text-sm opacity-70 mt-1">Record exists in database.</p>
                            </>
                        )}
                        {result === 'not_found' && (
                            <>
                                <XCircle size={48} className="mb-2" />
                                <h2 className="text-xl font-bold">NO RECORD FOUND</h2>
                                <p className="text-sm opacity-70 mt-1">Identifier not verified.</p>
                            </>
                        )}
                        {result === 'error' && (
                            <>
                                <AlertTriangle size={48} className="mb-2" />
                                <h2 className="text-xl font-bold">SYSTEM ERROR</h2>
                                <p className="text-sm opacity-70 mt-1">Connection failed. Retry.</p>
                            </>
                        )}
                    </div>
                )}
            </div>

            <div className="absolute bottom-4 text-xs text-green-900/50 uppercase">
                Restricted Access Only // Omni-Corp Systems v4.0
            </div>
        </div>
    );
};
