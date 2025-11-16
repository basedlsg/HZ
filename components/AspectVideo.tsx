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
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/*
        16:9 aspect ratio container using the padding-bottom trick.
        The aspect-video utility from Tailwind is equivalent to:
        aspect-ratio: 16 / 9

        This ensures the container maintains 16:9 regardless of parent width.
      */}
      <div className="aspect-video w-full">
        {/*
          Children (typically <video> elements) are positioned absolutely
          to fill the container while maintaining object-fit: cover
        */}
        <div className="absolute inset-0">
          {children}
        </div>
      </div>
    </div>
  );
}
