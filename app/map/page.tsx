'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { HeatBubble } from '@/lib/types';

export default function MapView() {
  const [bubbles, setBubbles] = useState<HeatBubble[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchHeatmap();
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

  // Simple coordinate to pixel conversion for visualization
  // Center on SF area (37.7749, -122.4194)
  const coordToPixel = (lat: number, lng: number) => {
    const centerLat = 37.7749;
    const centerLng = -122.4194;
    const scale = 5000; // pixels per degree

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
        <div className="mb-4">
          <h2 className="text-2xl font-bold mb-1">Activity Map</h2>
          <p className="text-gray-400 text-sm">Purple bubbles show presence zones</p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <div className="text-gray-400">Loading map...</div>
          </div>
        ) : (
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

            {/* Heat bubbles */}
            {bubbles.map((bubble) => {
              const { x, y } = coordToPixel(bubble.location.lat, bubble.location.lng);
              const radius = Math.sqrt(bubble.intensity) * 50 + 20; // Scale radius based on intensity

              return (
                <div
                  key={bubble.id}
                  className="absolute rounded-full transition-all duration-300"
                  style={{
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${radius * 2}px`,
                    height: `${radius * 2}px`,
                    transform: 'translate(-50%, -50%)',
                    background: `radial-gradient(circle, rgba(168, 85, 247, ${bubble.intensity * 0.4}) 0%, rgba(147, 51, 234, ${bubble.intensity * 0.2}) 50%, transparent 100%)`,
                    border: `2px solid rgba(168, 85, 247, ${bubble.intensity * 0.6})`,
                  }}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-purple-200">
                    {bubble.sessionCount}
                  </div>
                </div>
              );
            })}

            {/* Center marker */}
            <div
              className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white"
              style={{
                left: '300px',
                top: '300px',
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-blue-400 whitespace-nowrap">
                You
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 bg-gray-900 rounded-lg p-4 max-w-md">
          <h3 className="font-semibold mb-3 text-sm">Legend</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-600/40 border-2 border-purple-600/60"></div>
              <span className="text-gray-400">Heat zone (size = intensity, number = sessions)</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-blue-500 rounded-full border-2 border-white"></div>
              <span className="text-gray-400">Your location</span>
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
              {Math.max(...bubbles.map(b => b.sessionCount), 0)}
            </div>
            <div className="text-xs text-gray-400">Peak Zone</div>
          </div>
        </div>
      </main>
    </div>
  );
}
