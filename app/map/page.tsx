'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HeatBubble } from '@/lib/types';
import { calculateRecencyDecay, getZoneStability, formatTimestamp } from '@/lib/utils';

export default function MapView() {
  const [bubbles, setBubbles] = useState<HeatBubble[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredBubble, setHoveredBubble] = useState<HeatBubble | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    fetchHeatmap();
    // Refresh every 5 seconds to show time decay
    const interval = setInterval(fetchHeatmap, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchHeatmap = async () => {
    try {
      const response = await fetch('/api/heatmap');
      const data = await response.json();
      if (data.success) {
        setBubbles(data.bubbles);
      }
    } catch (error) {
      console.error('Failed to fetch heatmap:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Convert geographic coordinates to pixel positions for visualization.
   * This is a simple linear projection centered on SF (37.7749, -122.4194).
   *
   * The map is ego-centric: "You" are at the center, and all zones are
   * positioned relative to your location.
   */
  const coordToPixel = (lat: number, lng: number) => {
    const centerLat = 37.7749;
    const centerLng = -122.4194;
    const scale = 5000; // pixels per degree (not to scale, just for demo)

    const x = (lng - centerLng) * scale + 300;
    const y = (centerLat - lat) * scale + 300;

    return { x, y };
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
            <Link href="/streams" className="text-gray-400 hover:text-white">
              Streams
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
      <main className="p-4">
        {/* Explanatory Header */}
        <div className="mb-6 max-w-4xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Activity Map</h2>
              <p className="text-gray-300 text-sm leading-relaxed max-w-2xl">
                Each purple bubble represents a <strong>presence zone</strong> - a geographic area with recent activity.
                Bubble <strong>size</strong> shows intensity (more sessions = larger).
                Bubble <strong>brightness</strong> shows recency (newer = brighter, older = faded).
                The number inside is the <strong>session count</strong>. Everything is centered around <strong className="text-blue-400">You</strong>.
              </p>
            </div>
            <button
              onClick={() => setShowAbout(!showAbout)}
              className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-1"
            >
              <span className="text-lg">ℹ️</span>
              <span>About</span>
            </button>
          </div>

          {/* About Tooltip */}
          {showAbout && (
            <div className="mt-4 bg-purple-900/20 border border-purple-800/40 rounded-lg p-4 text-sm text-gray-300">
              <p className="mb-2">
                <strong>What you're seeing:</strong> This map shows aggregated presence data in coarse geographic zones.
                Each zone collects activity from nearby sessions and displays it as a single bubble.
              </p>
              <p className="mb-2">
                <strong>Why ego-centric?</strong> The map is centered on "You" because presence is fundamentally relative.
                You see what's happening around your location, not a global view.
              </p>
              <p>
                <strong>Future evolution:</strong> Real deployments would use geospatial cell systems (like H3 or S2),
                add movement tracking, density overlays, and safety indicators. This MVP uses simple zones to demonstrate the concept.
              </p>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-400">Loading map...</div>
          </div>
        ) : (
          <div className="relative">
            {/* Map Canvas */}
            <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{ width: '600px', height: '600px' }}>
              {/* Simple grid background */}
              <svg className="absolute inset-0 w-full h-full opacity-20">
                <defs>
                  <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path d="M 50 0 L 0 0 0 50" fill="none" stroke="gray" strokeWidth="0.5"/>
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
              </svg>

              {/* Heat bubbles with time decay and hover */}
              {bubbles.map((bubble) => {
                const { x, y } = coordToPixel(bubble.location.lat, bubble.location.lng);
                const baseRadius = Math.sqrt(bubble.intensity) * 50 + 20;

                // Apply time decay to opacity
                const recencyMultiplier = calculateRecencyDecay(bubble.lastActivity);
                const opacity = bubble.intensity * recencyMultiplier;

                // Determine if bubble is fresh enough for pulse animation
                const ageInSeconds = (Date.now() - bubble.lastActivity) / 1000;
                const isFresh = ageInSeconds < 30;

                const stability = getZoneStability(bubble.lastActivity, bubble.intensity);

                return (
                  <div
                    key={bubble.id}
                    className={`absolute rounded-full transition-all duration-300 cursor-pointer ${
                      isFresh ? 'animate-pulse-subtle' : ''
                    }`}
                    style={{
                      left: `${x}px`,
                      top: `${y}px`,
                      width: `${baseRadius * 2}px`,
                      height: `${baseRadius * 2}px`,
                      transform: 'translate(-50%, -50%)',
                      background: `radial-gradient(circle, rgba(168, 85, 247, ${opacity * 0.5}) 0%, rgba(147, 51, 234, ${opacity * 0.25}) 50%, transparent 100%)`,
                      border: `2px solid rgba(168, 85, 247, ${opacity * 0.8})`,
                    }}
                    onMouseEnter={() => setHoveredBubble(bubble)}
                    onMouseLeave={() => setHoveredBubble(null)}
                  >
                    <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-purple-200">
                      {bubble.sessionCount}
                    </div>
                  </div>
                );
              })}

              {/* Center marker - "You" */}
              <div
                className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white z-10"
                style={{
                  left: '300px',
                  top: '300px',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-blue-400 whitespace-nowrap font-semibold">
                  You
                </div>
              </div>
            </div>

            {/* Hover Tooltip */}
            {hoveredBubble && (
              <div className="absolute left-[620px] top-0 bg-gray-900 border border-purple-800/50 rounded-lg p-4 w-64 shadow-xl">
                <h3 className="font-semibold text-purple-400 mb-3">
                  {hoveredBubble.label || hoveredBubble.id}
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Sessions:</span>
                    <span className="font-semibold">{hoveredBubble.sessionCount}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Intensity:</span>
                    <span className="font-semibold">{(hoveredBubble.intensity * 100).toFixed(0)}%</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Activity:</span>
                    <span className="font-semibold">{formatTimestamp(hoveredBubble.lastActivity)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-gray-400">Status:</span>
                    <span className={`font-semibold ${
                      getZoneStability(hoveredBubble.lastActivity, hoveredBubble.intensity) === 'active'
                        ? 'text-green-400'
                        : getZoneStability(hoveredBubble.lastActivity, hoveredBubble.intensity) === 'stable'
                        ? 'text-yellow-400'
                        : 'text-orange-400'
                    }`}>
                      {getZoneStability(hoveredBubble.lastActivity, hoveredBubble.intensity)}
                    </span>
                  </div>

                  <div className="pt-2 mt-2 border-t border-gray-800 text-xs text-gray-500">
                    Radius: {hoveredBubble.radius.toFixed(0)}m
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Enhanced Legend */}
        <div className="mt-6 bg-gray-900 rounded-lg p-4 max-w-2xl">
          <h3 className="font-semibold mb-3 text-sm">Legend</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-full bg-purple-600/60 border-2 border-purple-600/80 flex items-center justify-center text-xs font-semibold">
                  5
                </div>
                <div className="text-gray-400">
                  <div className="font-semibold text-white">Presence Zone</div>
                  <div className="text-xs">Size = intensity • Number = sessions</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-blue-500 rounded-full border-2 border-white"></div>
                <div className="text-gray-400">
                  <div className="font-semibold text-white">Your Location</div>
                  <div className="text-xs">Everything relative to you</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs text-gray-400 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500 animate-pulse-subtle"></div>
                  <span><strong className="text-green-400">Active:</strong> Fresh (≤30s), bright</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500/70"></div>
                  <span><strong className="text-yellow-400">Stable:</strong> Recent (≤2min)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500/30"></div>
                  <span><strong className="text-orange-400">Fading:</strong> Older (&gt;2min)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4 max-w-md">
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{bubbles.length}</div>
            <div className="text-xs text-gray-400">Active Zones</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">
              {bubbles.reduce((sum, b) => sum + b.sessionCount, 0)}
            </div>
            <div className="text-xs text-gray-400">Total Sessions</div>
          </div>
          <div className="bg-gray-900 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">
              {bubbles.filter(b => (Date.now() - b.lastActivity) / 1000 < 30).length}
            </div>
            <div className="text-xs text-gray-400">Fresh Zones</div>
          </div>
        </div>
      </main>

      {/* Custom CSS for subtle pulse animation */}
      <style jsx>{`
        @keyframes pulse-subtle {
          0%, 100% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            opacity: 0.85;
            transform: translate(-50%, -50%) scale(1.05);
          }
        }

        .animate-pulse-subtle {
          animation: pulse-subtle 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
