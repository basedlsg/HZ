import React, { useState, useEffect, useCallback } from 'react';
import 'leaflet/dist/leaflet.css';
import { AppPhase, FeedItem } from './types';
import { InstallPrompt } from './components/InstallPrompt';
import { CheckInScreen } from './components/CheckInScreen';
import { CameraScreen } from './components/CameraScreen';
import { FeedScreen } from './components/FeedScreen';
import { db } from './services/db';
import { calculateDistance } from './services/geo'; // Import Geo service
import { Moon, Sun } from 'lucide-react';

const App: React.FC = () => {
  const [phase, setPhase] = useState<AppPhase>(AppPhase.CHECK_IN);
  const [userLocation, setUserLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Force Update Logic
  const APP_VERSION = 'v4.0-dev'; // MUST MATCH UI DISPLAY

  useEffect(() => {
    const hour = new Date().getHours();
    const isDay = hour >= 6 && hour < 18;
    setIsDarkMode(!isDay); // Default based on time

    // Version Check
    const storedVersion = localStorage.getItem('ombrixa_version');
    if (storedVersion !== APP_VERSION) {
      console.log(`Version Sync: ${storedVersion} -> ${APP_VERSION}`);
      localStorage.setItem('ombrixa_version', APP_VERSION);

      // If we jumped major versions or simply mismatch, force a hard reload
      // to clear any stale Service Worker caches affecting crucial files
      if (storedVersion) {
        // Only force reload if it's not a fresh install (to avoid infinite loops on fresh load if logic is buggy)
        // But here we want to solve "stuck on v1.1" so we are aggressive
        console.log("Forcing hard reload for update...");
        // Unregister SW to be safe
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
      <InstallPrompt />
    </div>
  );
};

export default App;