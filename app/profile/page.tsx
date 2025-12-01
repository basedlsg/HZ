'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { generateHexHandle } from '@/lib/utils';
import { UserProfile } from '@/lib/types';

export default function ProfileView() {
  const [alias, setAlias] = useState('');
  const [hexHandle, setHexHandle] = useState('');
  const [message, setMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = () => {
    const profileData = localStorage.getItem('hotzones-profile');
    if (profileData) {
      const profile: UserProfile = JSON.parse(profileData);
      setAlias(profile.alias);
      setHexHandle(profile.hexHandle);
    } else {
      // Generate a random default alias
      const randomAlias = `user_${Math.floor(Math.random() * 10000)}`;
      setAlias(randomAlias);
      setHexHandle(generateHexHandle(randomAlias));
    }
  };

  const saveProfile = () => {
    if (!alias.trim()) {
      setMessage('Alias cannot be empty');
      return;
    }

    const newHexHandle = generateHexHandle(alias);
    const profile: UserProfile = {
      alias: alias.trim(),
      hexHandle: newHexHandle,
    };

    localStorage.setItem('hotzones-profile', JSON.stringify(profile));
    setHexHandle(newHexHandle);
    setMessage('✓ Profile saved!');
    setIsEditing(false);

    setTimeout(() => setMessage(''), 3000);
  };

  const generateRandomAlias = () => {
    const adjectives = ['ghost', 'cyber', 'neon', 'void', 'pixel', 'shadow', 'quantum', 'nova'];
    const nouns = ['walker', 'rider', 'cat', 'sage', 'knight', 'fox', 'phoenix', 'wolf'];
    const randomAlias = `${adjectives[Math.floor(Math.random() * adjectives.length)]}_${nouns[Math.floor(Math.random() * nouns.length)]}`;
    setAlias(randomAlias);
    setIsEditing(true);
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
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">Profile</h2>
          <p className="text-gray-400 text-sm">Manage your burner identity</p>
        </div>

        <div className="space-y-6">
          {/* Profile Card */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-purple-900 rounded-full flex items-center justify-center text-3xl font-bold">
                {alias.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold">{alias}</h3>
                <p className="text-sm text-gray-400 font-mono">#{hexHandle}</p>
              </div>
            </div>

            <div className="space-y-4">
              {isEditing ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-400 mb-2">
                      Burner Alias
                    </label>
                    <input
                      type="text"
                      value={alias}
                      onChange={(e) => setAlias(e.target.value)}
                      placeholder="Enter your alias"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-600"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={saveProfile}
                      className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                      💾 Save
                    </button>
                    <button
                      onClick={() => {
                        loadProfile();
                        setIsEditing(false);
                        setMessage('');
                      }}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  ✏️ Edit Alias
                </button>
              )}

              <button
                onClick={generateRandomAlias}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                🎲 Generate Random Alias
              </button>
            </div>
          </div>

          {/* Message Display */}
          {message && (
            <div className={`p-4 rounded-lg ${message.includes('✓') ? 'bg-green-900/20 border border-green-900/30 text-green-400' : 'bg-red-900/20 border border-red-900/30 text-red-400'}`}>
              {message}
            </div>
          )}

          {/* Hex Handle Info */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Hex Handle</h3>
            <div className="bg-black rounded-lg p-4 font-mono text-2xl text-purple-400 text-center">
              #{hexHandle}
            </div>
            <p className="text-sm text-gray-400 mt-3">
              Your hex handle is automatically generated from your alias. It provides a unique identifier
              while maintaining anonymity.
            </p>
          </div>

          {/* Session Info */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-6">
            <h3 className="font-semibold mb-3">Session Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Storage</span>
                <span className="font-mono">localStorage</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Persistence</span>
                <span>Browser session</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Privacy Mode</span>
                <span className="text-green-400">Enabled</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Link
              href="/qr"
              className="block w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors"
            >
              🔲 Generate QR Codes
            </Link>

            <button
              onClick={() => {
                if (confirm('Are you sure you want to clear all local data?')) {
                  localStorage.removeItem('hotzones-profile');
                  localStorage.removeItem('hotzones-session');
                  setMessage('✓ All data cleared');
                  loadProfile();
                }
              }}
              className="w-full bg-red-900 hover:bg-red-800 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              🗑️ Clear All Data
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
