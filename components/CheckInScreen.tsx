import React, { useState, useEffect } from 'react';
import { MapPin, Lock } from 'lucide-react';

interface CheckInScreenProps {
  onCheckIn: (lat: number, lng: number) => void;
  isDarkMode: boolean;
}

export const CheckInScreen: React.FC<CheckInScreenProps> = ({ onCheckIn, isDarkMode }) => {
  const [locating, setLocating] = useState(true);
  const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
  const [progress, setProgress] = useState(0);
  const [checkingIn, setCheckingIn] = useState(false);

  // GPS Location Logic
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocating(false);
        },
        () => setLocating(false)
      );
    } else {
      setLocating(false);
    }
  }, []);

  // Hold-to-Check-In Logic
  useEffect(() => {
    let interval: number;
    if (checkingIn) {
      interval = window.setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            return 100;
          }
          return prev + 2; // Speed of fill
        });
      }, 20);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [checkingIn]);

  // Trigger check-in when progress reaches 100
  useEffect(() => {
    if (progress >= 100) {
      onCheckIn(location?.lat || 0, location?.lng || 0);
    }
  }, [progress, location, onCheckIn]);

  const handleStart = () => setCheckingIn(true);
  const handleEnd = () => setCheckingIn(false);

  return (
    <div className={`flex flex-col h-full relative overflow-hidden font-sans items-center justify-center transition-colors duration-500 ${isDarkMode ? 'bg-zinc-950 text-white' : 'bg-zinc-50 text-zinc-900'}`}>

      {/* Background Ambient Glow */}
      <div className={`absolute top-[-20%] left-[-20%] w-[140%] h-[60%] blur-[100px] pointer-events-none transition-colors duration-500 ${isDarkMode ? 'bg-brand-purple/10' : 'bg-brand-purple/5'}`} />

      {/* Header */}
      <div className="absolute top-12 w-full text-center z-10">
        <h1 className="text-4xl font-black tracking-tighter mb-2">OMBRIXA</h1>
        <p className="text-zinc-500 font-mono text-[10px] uppercase tracking-[0.2em]">
          Secure Presence Protocol
        </p>
      </div>

      {/* Main Check-In Button */}
      <div className="flex flex-col items-center animate-pulse-fast z-20">
        <div className="relative w-72 h-72 flex items-center justify-center">
          {/* Glowing Ring */}
          <div className={`absolute inset-0 rounded-full border border-brand-purple/30 transition-all duration-300 ${checkingIn ? 'scale-110 border-brand-purple opacity-100' : 'scale-100 opacity-50'}`}></div>
          <div className={`absolute inset-0 rounded-full border border-brand-purple/10 transition-all duration-500 delay-75 ${checkingIn ? 'scale-125 opacity-100' : 'scale-100 opacity-0'}`}></div>

          {/* SVG Progress */}
          <svg className="absolute inset-0 w-full h-full rotate-[-90deg] pointer-events-none drop-shadow-[0_0_20px_rgba(124,58,237,0.8)]" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="46"
              fill="transparent"
              stroke="#7c3aed"
              strokeWidth="3"
              strokeDasharray={2 * Math.PI * 46}
              strokeDashoffset={(2 * Math.PI * 46) * (1 - progress / 100)}
              strokeLinecap="round"
            />
          </svg>

          <button
            onMouseDown={handleStart}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchEnd={handleEnd}
            style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none' }}
            className="select-none touch-none w-56 h-56 rounded-full bg-zinc-900 border border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800 flex flex-col items-center justify-center transition-all active:scale-95 shadow-2xl relative overflow-hidden group"
          >
            <div className={`absolute inset-0 bg-brand-purple/20 transition-opacity duration-300 ${checkingIn ? 'opacity-100' : 'opacity-0'}`}></div>
            <MapPin size={40} className={`mb-4 transition-colors ${checkingIn ? 'text-white' : 'text-zinc-500'}`} />
            <span className="text-lg font-black tracking-widest text-white">CHECK IN</span>
            <span className="text-[10px] font-mono text-zinc-500 mt-2 uppercase">Hold to Verify</span>
          </button>
        </div>
        {locating && <p className="mt-8 text-xs font-mono text-zinc-600 animate-pulse">TRIANGULATING POSITION...</p>}
      </div>

      <div className="absolute bottom-12 flex items-center justify-center gap-2 text-zinc-700 text-[10px] uppercase tracking-widest font-mono">
        <Lock size={12} />
        <span>End-to-End Encrypted</span>
      </div>

    </div>
  );
};