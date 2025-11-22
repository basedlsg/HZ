import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';

/**
 * GET /api/ai-metadata?videoId={id}
 *
 * Get AI-generated metadata for a video (if available).
 * Returns null if analysis is still pending or failed.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId required' },
        { status: 400 }
      );
    }

    // Check if video exists
    const video = dataStore.getVideo(videoId);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    // Get AI metadata (may be null if not analyzed yet)
    const aiMetadata = dataStore.getAIMetadata(videoId);

    return NextResponse.json({
      success: true,
      metadata: aiMetadata,
    });
  } catch (error) {
    console.error('Get AI metadata error:', error);
    return NextResponse.json(
      { error: 'Failed to get AI metadata' },
      { status: 500 }
    );
  }
}
