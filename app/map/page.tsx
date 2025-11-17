'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { HeatBubble } from '@/lib/types';
import { calculateRecencyDecay, formatTimestamp } from '@/lib/utils';

// Dynamically import Leaflet components (client-side only)
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
);
const Circle = dynamic(
  () => import('react-leaflet').then(mod => mod.Circle),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
);

interface PulseData {
  zoneId: string;
  shouldPulse: boolean;
  recentVideoCount: number;
  lastVideoTimestamp: number | null;
  pulseIntensity: number;
}

export default function MapView() {
  const [bubbles, setBubbles] = useState<HeatBubble[]>([]);
  const [pulseData, setPulseData] = useState<Record<string, PulseData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  useEffect(() => {
    // Get user location from session
    const sessionData = localStorage.getItem('hotzones-session');
    if (sessionData) {
      const session = JSON.parse(sessionData);
      if (session.location) {
        setUserLocation([session.location.lat, session.location.lng]);
      }
    }

    // If no session location, use default (SF)
    if (!userLocation) {
      setUserLocation([37.7749, -122.4194]);
    }

    fetchData();
    // Refresh every 5 seconds to show time decay and pulse updates
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      // Fetch heatmap and pulse data in parallel
      const [heatmapResponse, pulseResponse] = await Promise.all([
        fetch('/api/heatmap'),
        fetch('/api/heatmap-pulse'),
      ]);

      const heatmapData = await heatmapResponse.json();
      const pulseDataResponse = await pulseResponse.json();

      if (heatmapData.success) {
        setBubbles(heatmapData.bubbles);
      }

      if (pulseDataResponse.success) {
        // Convert pulse data array to lookup object
        const pulseLookup: Record<string, PulseData> = {};
        pulseDataResponse.pulseData.forEach((pd: PulseData) => {
          pulseLookup[pd.zoneId] = pd;
        });
        setPulseData(pulseLookup);
      }
    } catch (error) {
      console.error('Failed to fetch map data:', error);
    } finally {
      setIsLoading(false);
    }
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
            <Link href="/videos" className="text-gray-400 hover:text-white">
              Videos
            </Link>
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
                Each purple circle represents a <strong>presence zone</strong> - a geographic area with recent activity.
                Circle <strong>size</strong> shows intensity (more sessions = larger).
                Circle <strong>opacity</strong> shows recency (newer = brighter, older = faded).
                The number inside is the <strong>session count</strong>. <span className="text-yellow-400">Yellow pulses</span> indicate recent video uploads.
                The map is centered on <strong className="text-blue-400">your location</strong>.
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
                Sessions within 500m of each other are clustered into a single zone.
              </p>
              <p className="mb-2">
                <strong>Real map tiles:</strong> Uses OpenStreetMap for actual street and terrain data.
              </p>
              <p className="mb-2">
                <strong>Video pulses:</strong> When someone uploads a video in a zone, the circle pulses yellow for about 20 seconds.
              </p>
              <p>
                <strong>Check in to contribute:</strong> Your check-in creates a presence session that appears on the map.
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
            {/* Leaflet Map */}
            <div className="rounded-lg overflow-hidden" style={{ width: '100%', maxWidth: '1200px', height: '600px' }}>
              {userLocation && (
                <MapContainer
                  center={userLocation}
                  zoom={14}
                  style={{ width: '100%', height: '100%' }}
                  className="z-0"
                >
                  {/* OpenStreetMap tiles */}
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  />

                  {/* User location marker */}
                  <Marker position={userLocation}>
                    <Popup>
                      <div className="text-black">
                        <strong>You are here</strong>
                      </div>
                    </Popup>
                  </Marker>

                  {/* Heat bubbles (zones) */}
                  {bubbles.map((bubble) => {
                    const recencyMultiplier = calculateRecencyDecay(bubble.lastActivity);
                    const opacity = bubble.intensity * recencyMultiplier * 0.5;
                    const pulse = pulseData[bubble.id];
                    const shouldPulse = pulse?.shouldPulse || false;

                    return (
                      <Circle
                        key={bubble.id}
                        center={[bubble.location.lat, bubble.location.lng]}
                        radius={bubble.radius}
                        pathOptions={{
                          color: shouldPulse ? '#facc15' : '#a855f7',
                          fillColor: shouldPulse ? '#facc15' : '#9333ea',
                          fillOpacity: opacity,
                          weight: shouldPulse ? 3 : 2,
                          className: shouldPulse ? 'animate-pulse' : '',
                        }}
                      >
                        <Popup>
                          <div className="text-black p-2">
                            <div className="font-bold text-purple-600 mb-2">
                              {bubble.label || bubble.id}
                            </div>
                            <div className="space-y-1 text-sm">
                              <div>
                                <span className="font-semibold">Sessions:</span> {bubble.sessionCount}
                              </div>
                              <div>
                                <span className="font-semibold">Intensity:</span> {(bubble.intensity * 100).toFixed(0)}%
                              </div>
                              <div>
                                <span className="font-semibold">Radius:</span> {Math.round(bubble.radius)}m
                              </div>
                              <div>
                                <span className="font-semibold">Last Activity:</span>{' '}
                                {formatTimestamp(bubble.lastActivity)}
                              </div>
                              {shouldPulse && (
                                <div className="mt-2 text-yellow-600 font-semibold">
                                  🎥 {pulse.recentVideoCount} recent video{pulse.recentVideoCount !== 1 ? 's' : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        </Popup>
                      </Circle>
                    );
                  })}
                </MapContainer>
              )}
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-4 gap-4 max-w-4xl">
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
                <div className="text-2xl font-bold text-yellow-400">
                  {Object.values(pulseData).filter(p => p.shouldPulse).length}
                </div>
                <div className="text-xs text-gray-400">Video Alerts</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-400">
                  {bubbles.filter(b => (Date.now() - b.lastActivity) < 60000).length}
                </div>
                <div className="text-xs text-gray-400">Fresh (&lt;1min)</div>
              </div>
            </div>

            {/* Legend */}
            <div className="mt-4 bg-gray-900 rounded-lg p-4 max-w-4xl">
              <h3 className="font-semibold text-sm mb-2">Map Legend</h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-purple-600"></div>
                  <span>Active Zone (purple)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-400 animate-pulse"></div>
                  <span>Recent Video (yellow pulse)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <span>Your Location</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-purple-600 opacity-30"></div>
                  <span>Fading Zone (old activity)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
