import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { dataStore } from '@/lib/store';
import { VIDEO_STORAGE_TTL_MS } from '@/lib/config';

/**
 * GET /api/video/[videoId]
 *
 * Serves a video file by its ID.
 * - Checks if video exists and is not expired
 * - Streams the video file from disk
 * - Returns 404 if video doesn't exist or is expired
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const { videoId } = await params;

    // Get video metadata
    const video = dataStore.getVideo(videoId);

    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Check if video is expired
    const now = Date.now();
    if (now - video.timestamp > VIDEO_STORAGE_TTL_MS) {
      return NextResponse.json(
        { error: 'Video expired' },
        { status: 410 }
      );
    }

    // Check if video file exists
    if (!video.filePath) {
      return NextResponse.json(
        { error: 'Video file path not found' },
        { status: 404 }
      );
    }

    const fullPath = path.join(process.cwd(), video.filePath);

    if (!existsSync(fullPath)) {
      return NextResponse.json(
        { error: 'Video file not found on disk' },
        { status: 404 }
      );
    }

    // Read and serve the video file
    const videoBuffer = await readFile(fullPath);

    // Determine MIME type based on file extension
    const ext = video.filename.split('.').pop()?.toLowerCase();
    const mimeType = ext === 'webm' ? 'video/webm' : 'video/mp4';

    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': videoBuffer.length.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Video serving error:', error);
    return NextResponse.json(
      { error: 'Failed to serve video' },
      { status: 500 }
    );
  }
}
