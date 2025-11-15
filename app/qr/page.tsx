'use client';

import { useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { QRData } from '@/lib/types';

export default function QRView() {
  const [qrType, setQrType] = useState<'admin' | 'self'>('self');
  const [geocell, setGeocell] = useState('SF-MISSION-01');
  const [ttl, setTtl] = useState(3600);
  const [radius, setRadius] = useState(100);

  const generateQRData = (): QRData => {
    return {
      type: qrType,
      geocell,
      ttl,
      radius,
      timestamp: Date.now(),
    };
  };

  const qrDataString = JSON.stringify(generateQRData(), null, 2);

  const downloadQR = () => {
    const svg = document.getElementById('qr-code');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');

      const downloadLink = document.createElement('a');
      downloadLink.download = `hotzones-${qrType}-qr.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
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
            <Link href="/streams" className="text-gray-400 hover:text-white">
              Streams
            </Link>
            <Link href="/profile" className="text-gray-400 hover:text-white">
              Profile
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">QR Code Generator</h2>
          <p className="text-gray-400 text-sm">Create admin or self QR codes</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Configuration Panel */}
          <div className="space-y-6">
            {/* QR Type Selection */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4">QR Type</h3>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setQrType('self')}
                  className={`py-3 px-4 rounded-lg font-semibold transition-colors ${
                    qrType === 'self'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Self QR
                </button>
                <button
                  onClick={() => setQrType('admin')}
                  className={`py-3 px-4 rounded-lg font-semibold transition-colors ${
                    qrType === 'admin'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  Admin QR
                </button>
              </div>
            </div>

            {/* Configuration Fields */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 space-y-4">
              <h3 className="font-semibold mb-4">Configuration</h3>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">
                  Geocell ID
                </label>
                <input
                  type="text"
                  value={geocell}
                  onChange={(e) => setGeocell(e.target.value)}
                  placeholder="e.g., SF-MISSION-01"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">
                  TTL (seconds)
                </label>
                <input
                  type="number"
                  value={ttl}
                  onChange={(e) => setTtl(parseInt(e.target.value) || 0)}
                  placeholder="3600"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-600"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {Math.floor(ttl / 60)} minutes
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-400 mb-2">
                  Radius (meters)
                </label>
                <input
                  type="number"
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value) || 0)}
                  placeholder="100"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-600"
                />
              </div>
            </div>

            {/* QR Data Preview */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Encoded Data</h3>
              <pre className="bg-black rounded-lg p-4 text-xs text-green-400 overflow-x-auto">
                {qrDataString}
              </pre>
            </div>
          </div>

          {/* QR Display Panel */}
          <div className="space-y-6">
            {/* QR Code Display */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-4 text-center">
                {qrType === 'admin' ? '🔐 Admin QR Code' : '👤 Self QR Code'}
              </h3>

              <div className="bg-white p-6 rounded-lg flex items-center justify-center">
                <QRCodeSVG
                  id="qr-code"
                  value={qrDataString}
                  size={256}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <button
                onClick={downloadQR}
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                💾 Download QR Code
              </button>
            </div>

            {/* Quick Presets */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h3 className="font-semibold mb-3">Quick Presets</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setGeocell('SF-MISSION-01');
                    setTtl(3600);
                    setRadius(100);
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-left px-4 py-3 rounded-lg transition-colors"
                >
                  <div className="font-semibold">Mission District</div>
                  <div className="text-xs text-gray-400">1hr, 100m radius</div>
                </button>
                <button
                  onClick={() => {
                    setGeocell('SF-CASTRO-01');
                    setTtl(7200);
                    setRadius(200);
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-left px-4 py-3 rounded-lg transition-colors"
                >
                  <div className="font-semibold">Castro</div>
                  <div className="text-xs text-gray-400">2hr, 200m radius</div>
                </button>
                <button
                  onClick={() => {
                    setGeocell('SF-HAIGHT-01');
                    setTtl(1800);
                    setRadius(50);
                  }}
                  className="w-full bg-gray-800 hover:bg-gray-700 text-left px-4 py-3 rounded-lg transition-colors"
                >
                  <div className="font-semibold">Haight-Ashbury</div>
                  <div className="text-xs text-gray-400">30min, 50m radius</div>
                </button>
              </div>
            </div>

            {/* Info */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-4">
              <h3 className="font-semibold text-sm mb-2">QR Code Types</h3>
              <ul className="text-sm text-gray-400 space-y-1">
                <li>• <strong>Self QR:</strong> Personal check-in code</li>
                <li>• <strong>Admin QR:</strong> Organizer code with elevated permissions</li>
                <li>• All codes include geocell, TTL, and radius parameters</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
