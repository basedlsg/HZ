import React, { useState, useEffect } from 'react';
import { FeedItem } from '../types';
import { EventCard } from './EventCard';
import { MapVisualization } from './MapVisualization';
import { Camera, ShieldAlert, Map, LayoutGrid } from 'lucide-react';

interface FeedScreenProps {
   items: FeedItem[];
   onRecordNew: () => void;
   onPanic: () => void;
   isDarkMode: boolean;
   onRefresh: () => void;
}

export const FeedScreen: React.FC<FeedScreenProps> = ({ items, onRecordNew, onPanic, isDarkMode, onRefresh }) => {
   const [viewMode, setViewMode] = useState<'FEED' | 'MAP'>('FEED');

   return (
      <div className={`relative h-full w-full overflow-hidden font-sans transition-colors duration-500`}>
         {/* Top Floating Layer (Header & Panic) */}
         <div className={`absolute top-0 left-0 w-full z-50 p-6 flex justify-between items-start pointer-events-none h-32 bg-gradient-to-b ${isDarkMode ? 'from-black/80' : 'from-white/80'} to-transparent`}>
            {/* Brand / Status */}
            <div className="pointer-events-auto">
               <h1 className={`font-black tracking-tighter text-xl drop-shadow-md ${isDarkMode ? 'text-white' : 'text-zinc-900'}`}>
                  OMBRIXA <span className="text-[9px] font-mono opacity-50 ml-1">v3.4</span>
               </h1>
               <div className={`flex items-center gap-2 text-[10px] font-mono font-bold tracking-widest uppercase backdrop-blur border px-2 py-1 rounded mt-1 shadow-lg inline-flex ${isDarkMode ? 'bg-zinc-900/80 border-brand-purple/20 text-brand-purple' : 'bg-white/80 border-brand-purple/20 text-brand-purple'}`}>
                  <div className="w-1.5 h-1.5 bg-brand-purple rounded-full animate-pulse"></div>
                  Live Zone
               </div>
            </div>

            {/* Panic Button */}
            <button
               onClick={onPanic}
               className="pointer-events-auto bg-brand-alert hover:bg-red-600 text-white px-4 py-2.5 rounded-full font-bold text-xs shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center gap-2 active:scale-95 transition-all"
            >
               <ShieldAlert size={16} />
               <span className="tracking-wide">PANIC</span>
            </button>
         </div>

         {/* Main Content Area */}
         <div className="h-[100dvh] w-full relative">
            {viewMode === 'FEED' ? (
               // Vertical Scroll Container - Strict 100dvh snapping
               <div className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar touch-pan-y">
                  {items.length === 0 && (
                     <div className="h-full flex items-center justify-center p-8 text-center opacity-50">
                        <div>
                           <p className="text-sm font-bold">NO ACTIVITY</p>
                           <p className="text-xs mt-2">Zone is quiet. Be the first to report.</p>
                        </div>
                     </div>
                  )}
                  {items.map(item => (
                     <EventCard key={item.id} item={item} isDarkMode={isDarkMode} />
                  ))}
               </div>
            ) : (
               <MapVisualization items={items} isDarkMode={isDarkMode} />
            )}
         </div>

         {/* Bottom Unified Dock - Respect Safe Area */}
         <div className="fixed bottom-[calc(2rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full flex justify-center">
            <div className={`pointer-events-auto flex items-center p-1.5 backdrop-blur-2xl border rounded-full shadow-2xl ${isDarkMode ? 'bg-zinc-950/80 border-white/10' : 'bg-white/80 border-black/10'}`}>

               {/* Feed Tab */}
               <button
                  onClick={() => setViewMode('FEED')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300 ${viewMode === 'FEED' ? (isDarkMode ? 'bg-zinc-800 text-white shadow-lg' : 'bg-zinc-200 text-black shadow-lg') : 'text-zinc-500 hover:text-zinc-400'}`}
               >
                  <LayoutGrid size={18} />
                  <span className={`text-[10px] font-bold tracking-wide ${viewMode === 'FEED' ? 'block' : 'hidden'}`}>FEED</span>
               </button>

               {/* Central Record Button */}
               <button
                  onClick={onRecordNew}
                  className={`mx-3 w-12 h-12 rounded-full flex items-center justify-center shadow-[0_0_25px_rgba(124,58,237,0.3)] active:scale-90 transition-all ${isDarkMode ? 'bg-white hover:bg-zinc-200' : 'bg-zinc-900 hover:bg-zinc-800'}`}
               >
                  <Camera size={22} className={isDarkMode ? 'text-black' : 'text-white'} />
               </button>

               {/* Map Tab */}
               <button
                  onClick={() => setViewMode('MAP')}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full transition-all duration-300 ${viewMode === 'MAP' ? 'bg-brand-purple text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]' : 'text-zinc-500 hover:text-zinc-400'}`}
               >
                  <Map size={18} />
                  <span className={`text-[10px] font-bold tracking-wide ${viewMode === 'MAP' ? 'block' : 'hidden'}`}>ZONE</span>
               </button>
            </div>
         </div>
      </div>
   );
};