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
                className="absolute top-8 right-8 z-20 text-zinc-600 hover:text-white transition-colors"
            >
                <HelpCircle size={20} />
            </button>

            {/* Main Card - Minimalist */}
            <div className="z-10 w-full max-w-sm flex flex-col items-center">

                {/* Branding - Pure Text */}
                <div className="flex flex-col items-center justify-center mb-12">
                    <h1 className="font-bold tracking-tight text-3xl text-white mb-2">OMBRIXA</h1>
                </div>

                <form onSubmit={handleSearch} className="flex flex-col gap-4 w-full">
                    <div className="relative group w-full">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Enter query..."
                            className="w-full bg-zinc-900 border border-transparent focus:border-zinc-700 rounded-lg p-4 pl-4 text-base text-white placeholder-zinc-600 outline-none transition-all"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || !query.trim()}
                        className="w-full bg-white hover:bg-zinc-200 text-black font-medium py-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <span className="w-4 h-4 border-2 border-zinc-400 border-t-black rounded-full animate-spin" />
                            </>
                        ) : (
                            <>
                                <span>Check Database</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Minimalist Result Display */}
                {result && (
                    <div className="mt-8 w-full flex flex-col items-center text-center animate-in fade-in duration-300">
                        {result === 'found' && (
                            <div className="flex items-center gap-2 text-green-500">
                                <CheckCircle size={20} />
                                <span className="font-medium">Verified Record Found</span>
                            </div>
                        )}
                        {result === 'not_found' && (
                            <div className="flex items-center gap-2 text-zinc-500">
                                <XCircle size={20} />
                                <span className="font-medium">No Record Found</span>
                            </div>
                        )}
                        {result === 'error' && (
                            <div className="flex flex-col items-center gap-2 text-red-500">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle size={20} />
                                    <span className="font-medium">Error</span>
                                </div>
                                <span className="text-xs text-zinc-600 font-mono">{errorMsg}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Instructions Modal - Clean */}
            {showInstructions && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-8 relative">
                        <button
                            onClick={() => setShowInstructions(false)}
                            className="absolute top-4 right-4 text-zinc-600 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-lg font-bold text-white mb-2">Instructions</h2>
                        <p className="text-zinc-500 mb-6 text-sm">
                            Query the secure database for:
                        </p>

                        <ul className="space-y-3 mb-8">
                            <li className="text-sm text-zinc-300 flex items-center gap-3">
                                <span className="w-1 h-1 bg-zinc-500 rounded-full" />
                                Badge Number
                            </li>
                            <li className="text-sm text-zinc-300 flex items-center gap-3">
                                <span className="w-1 h-1 bg-zinc-500 rounded-full" />
                                License Plate
                            </li>
                            <li className="text-sm text-zinc-300 flex items-center gap-3">
                                <span className="w-1 h-1 bg-zinc-500 rounded-full" />
                                Name / Alias
                            </li>
                        </ul>

                        <button
                            onClick={() => setShowInstructions(false)}
                            className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium py-3 rounded-lg transition-all"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
