'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const router = useRouter();

  const handleUseMyLocation = async () => {
    setIsLoading(true);
    setMessage('Requesting location access...');

    if (!navigator.geolocation) {
      setMessage('Geolocation is not supported by your browser');
      setIsLoading(false);
      return;
    }

    // Options for geolocation request
    const options = {
      enableHighAccuracy: true,
      timeout: 10000, // 10 second timeout
      maximumAge: 0 // Don't use cached position
    };

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await checkIn(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        let errorMessage = '';

        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please enable location permissions in your browser settings and try again.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable. Please check your device settings.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please try again.';
            break;
          default:
            errorMessage = `Error getting location: ${error.message}`;
        }

        setMessage(errorMessage);
        setIsLoading(false);
      },
      options
    );
  };

  const handleManualCheckIn = async () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);

    if (isNaN(lat) || isNaN(lng)) {
      setMessage('Please enter valid coordinates');
      return;
    }

    await checkIn(lat, lng);
  };

  const checkIn = async (lat: number, lng: number) => {
    setIsLoading(true);
    setMessage('');

    try {
      // Get user profile from localStorage
      const profileData = localStorage.getItem('hotzones-profile');
      const profile = profileData ? JSON.parse(profileData) : null;

      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          alias: profile?.alias || 'anonymous',
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Store session info
        localStorage.setItem('hotzones-session', JSON.stringify({
          sessionId: data.sessionId,
          token: data.token,
          timestamp: Date.now(),
        }));

        setMessage(`✓ Checked in! Token: ${data.token.substring(0, 12)}...`);

        // Redirect to map after 1 second
        setTimeout(() => {
          router.push('/map');
        }, 1000);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch (error) {
      setMessage('Failed to check in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-purple-900/30 bg-black/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <h1 className="text-2xl font-bold text-purple-400">HOTZONES</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-16">
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-2">Check In</h2>
            <p className="text-gray-400">Start your presence session</p>
          </div>

          {/* Use My Location Button */}
          <div className="space-y-4">
            <button
              onClick={handleUseMyLocation}
              disabled={isLoading}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-colors"
            >
              {isLoading ? 'Checking in...' : '📍 Use My Location'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-black px-4 text-gray-500">or enter manually</span>
              </div>
            </div>

            {/* Manual Location Input */}
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Latitude (e.g., 37.7749)"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-600"
              />
              <input
                type="text"
                placeholder="Longitude (e.g., -122.4194)"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="w-full bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-600"
              />
              <button
                onClick={handleManualCheckIn}
                disabled={isLoading}
                className="w-full bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Check In
              </button>
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <div className={`p-4 rounded-lg ${message.includes('✓') ? 'bg-green-900/20 border border-green-900/30 text-green-400' : 'bg-red-900/20 border border-red-900/30 text-red-400'}`}>
              {message}
            </div>
          )}

          {/* Quick Links */}
          <div className="pt-8 border-t border-gray-800">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Quick Access</h3>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/map" className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-3 text-center transition-colors">
                🗺️ Map
              </Link>
              <Link href="/videos" className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-3 text-center transition-colors">
                📹 Videos
              </Link>
              <Link href="/camera" className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-3 text-center transition-colors">
                🎥 Camera
              </Link>
              <Link href="/streams" className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-3 text-center transition-colors">
                📡 Streams
              </Link>
              <Link href="/profile" className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-3 text-center transition-colors">
                👤 Profile
              </Link>
              <Link href="/qr" className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-lg px-4 py-3 text-center transition-colors">
                🔲 QR Codes
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
