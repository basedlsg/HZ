/**
 * AspectVideo - A reusable 16:9 aspect ratio container for video elements
 *
 * This component ensures all videos (live camera feeds, recordings, playback)
 * are displayed in a consistent 16:9 aspect ratio, regardless of the actual
 * video resolution captured.
 *
 * Usage:
 *   <AspectVideo>
 *     <video ref={videoRef} ... />
 *   </AspectVideo>
 */

import { ReactNode } from 'react';

interface AspectVideoProps {
  children: ReactNode;
  className?: string;
}

export default function AspectVideo({ children, className = '' }: AspectVideoProps) {
  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/*
        16:9 LAYOUT ENFORCED HERE - Full-width responsive 16:9 box.

        The aspect-video utility creates a 16:9 aspect ratio container.
        Combined with w-full, it expands to full available width while
        maintaining the 16:9 ratio.

        The 'relative' positioning ensures absolutely positioned children
        (video elements, overlays) fill this 16:9 box correctly.
      */}
      <div className="relative aspect-video w-full">
        {children}
      </div>
    </div>
  );
}
