import React, { useState, useEffect, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { AppPhase, FeedItem } from './types';
import { InstallPrompt } from './components/InstallPrompt';
import { CheckInScreen } from './components/CheckInScreen';
import { CameraScreen } from './components/CameraScreen';
import { FeedScreen } from './components/FeedScreen';
import { QueryPortalScreen } from './components/QueryPortalScreen';
import { db } from './services/db';
import { calculateDistance } from './services/geo'; // Import Geo service
import { Moon, Sun } from 'lucide-react';

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>(AppPhase.CHECK_IN);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('ombrixa_theme');
    if (saved) return saved === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Force Update Logic
  const APP_VERSION = 'v4.1-dev'; // Bumping version to force reload

  useEffect(() => {
    // Simple routing check
    if (window.location.pathname.startsWith('/query')) {
      setPhase(AppPhase.QUERY);
    }

    // Version Check
    const storedVersion = localStorage.getItem('ombrixa_version');
    if (storedVersion !== APP_VERSION) {
      console.log(`Version Sync: ${storedVersion} -> ${APP_VERSION}`);
      localStorage.setItem('ombrixa_version', APP_VERSION);

      if (storedVersion) {
        console.log("Forcing hard reload for update...");
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function (registrations) {
            for (let registration of registrations) {
              registration.unregister();
            }
          });
        }
        window.location.reload();
      }
    }
  }, []);

  // Root class sync for Tailwind dark: classes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ombrixa_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ombrixa_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  // Load Feed Data & Apply Proximal Logic
  const loadFeed = useCallback(async () => {
    try {
      const allItems = await db.getFeed();

      if (userLocation) {
        // Filter items within 50km radius
        const RADIUS_KM = 50;
        const localItems = allItems.filter(item => {
          const dist = calculateDistance(
            userLocation.lat, userLocation.lng,
            item.location.lat, item.location.lng
          );
          return dist <= RADIUS_KM;
        }).sort((a, b) => {
          // Smart Curation: Priority to higher Safety Score (Danger)
          const scoreA = a.analysis?.safetyScore || 0;
          const scoreB = b.analysis?.safetyScore || 0;
          if (scoreB !== scoreA) return scoreB - scoreA;
          return b.timestamp - a.timestamp; // Tie-break with specific time
        });
        setFeedItems(localItems);
      } else {
        // If no location yet, show all (or maybe user hasn't checked in)
        setFeedItems(allItems);
      }
    } catch (err) {
      console.error("Failed to load feed", err);
    }
  }, [userLocation]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  const handleCheckIn = useCallback((lat: number, lng: number) => {
    setUserLocation({ lat, lng });
    setPhase(AppPhase.FEED);
  }, []);

  const handlePanic = useCallback(() => {
    setPhase(AppPhase.CHECK_IN);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  }, []);

  const handleRecordingComplete = useCallback(async (newItem: FeedItem) => {
    // Reload feed to get the new item (and potentially others)
    await loadFeed();
    setPhase(AppPhase.FEED);
  }, [loadFeed]);

  const handleBackToCamera = useCallback(() => {
    setPhase(AppPhase.CAMERA);
  }, []);

  return (
    <div className={`w-full h-screen overflow-hidden font-sans relative transition-colors duration-500 ${isDarkMode ? 'bg-black text-white' : 'bg-zinc-100 text-zinc-900'}`}>

      {/* Theme Toggle (Hidden on Camera to avoid clutter/light pollution) */}
      {phase !== AppPhase.CAMERA && (
        <button
          onClick={toggleTheme}
          className={`absolute top-24 right-6 z-[60] p-2 rounded-full shadow-xl backdrop-blur-md transition-all ${isDarkMode ? 'bg-zinc-800/50 text-yellow-400' : 'bg-white/50 text-orange-500'}`}
        >
          {isDarkMode ? <Moon size={20} /> : <Sun size={20} />}
        </button>
      )}

      {phase === AppPhase.CHECK_IN && (
        <CheckInScreen onCheckIn={handleCheckIn} isDarkMode={isDarkMode} />
      )}

      {phase === AppPhase.CAMERA && (
        <CameraScreen
          onPanic={handlePanic}
          onRecordingComplete={handleRecordingComplete}
          onViewFeed={() => setPhase(AppPhase.FEED)}
        />
      )}

      {phase === AppPhase.FEED && (
        <FeedScreen
          items={feedItems}
          onRecordNew={handleBackToCamera}
          onPanic={handlePanic}
          isDarkMode={isDarkMode}
          onRefresh={loadFeed}
        />
      )}

      {phase === AppPhase.QUERY && (
        <QueryPortalScreen onBack={() => {
          window.history.pushState({}, '', '/');
          setPhase(AppPhase.CHECK_IN);
        }} />
      )}
      <InstallPrompt />
    </div>
  );
};

export default App;