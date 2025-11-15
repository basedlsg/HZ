'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProximalStream } from '@/lib/types';
import { formatDistance, formatTimestamp } from '@/lib/utils';

export default function StreamsView() {
  const [streams, setStreams] = useState<ProximalStream[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchStreams();
    // Refresh every 5 seconds
    const interval = setInterval(fetchStreams, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStreams = async () => {
    try {
      // Try to get location from session or use default
      const sessionData = localStorage.getItem('hotzones-session');
      const session = sessionData ? JSON.parse(sessionData) : null;

      const params = new URLSearchParams({
        lat: '37.7749',
        lng: '-122.4194',
        maxDistance: '1000',
      });

      const response = await fetch(`/api/proximal-streams?${params}`);
      const data = await response.json();

      if (data.success) {
        setStreams(data.streams);
      }
    } catch (error) {
      console.error('Failed to fetch streams:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStabilityColor = (stability: number) => {
    if (stability > 0.8) return 'text-green-400';
    if (stability > 0.5) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStabilityLabel = (stability: number) => {
    if (stability > 0.8) return 'Stable';
    if (stability > 0.5) return 'Moderate';
    return 'Unstable';
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-purple-900/30 bg-black/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-purple-400">
            HOTZONES
          </Link>
          <div className="flex gap-4">
            <Link href="/map" className="text-gray-400 hover:text-white">
              Map
            </Link>
            <Link href="/camera" className="text-gray-400 hover:text-white">
              Camera
            </Link>
            <Link href="/profile" className="text-gray-400 hover:text-white">
              Profile
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">Proximal Streams</h2>
            <p className="text-gray-400 text-sm">Nearby presence sessions</p>
          </div>
          <button
            onClick={fetchStreams}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            🔄 Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading streams...</div>
          </div>
        ) : streams.length === 0 ? (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <p className="text-gray-400">No nearby streams detected</p>
          </div>
        ) : (
          <div className="space-y-4">
            {streams.map((stream) => (
              <div
                key={stream.id}
                className="bg-gray-900 border border-gray-800 rounded-lg p-6 hover:border-purple-600/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-900 rounded-full flex items-center justify-center font-bold">
                      {stream.alias.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{stream.alias}</h3>
                      <p className="text-sm text-gray-500">ID: {stream.id}</p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-semibold ${getStabilityColor(stream.stability)} bg-gray-800`}>
                    {getStabilityLabel(stream.stability)}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Distance</div>
                    <div className="text-lg font-semibold text-purple-400">
                      {formatDistance(stream.distance)}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Stability</div>
                    <div className="text-lg font-semibold">
                      {(stream.stability * 100).toFixed(0)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">Last Seen</div>
                    <div className="text-lg font-semibold">
                      {formatTimestamp(stream.lastSeen)}
                    </div>
                  </div>
                </div>

                {/* Signal Strength Bar */}
                <div className="mt-4">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <span>Signal Strength</span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-purple-400 h-full transition-all duration-300"
                      style={{ width: `${stream.stability * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Stats Summary */}
        <div className="mt-8 grid grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{streams.length}</div>
            <div className="text-xs text-gray-400">Active Streams</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">
              {streams.filter(s => s.stability > 0.8).length}
            </div>
            <div className="text-xs text-gray-400">Stable</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">
              {streams.length > 0 ? formatDistance(Math.min(...streams.map(s => s.distance))) : 'N/A'}
            </div>
            <div className="text-xs text-gray-400">Nearest</div>
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-2">About Proximal Streams</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>• Streams represent nearby active presence sessions</li>
            <li>• Stability indicates connection quality (higher is better)</li>
            <li>• Distance is calculated from your current location</li>
            <li>• Data refreshes automatically every 5 seconds</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
