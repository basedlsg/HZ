import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';

/**
 * GET /api/videos
 * Get all active (non-expired) videos
 *
 * Query params:
 * - zoneId (optional): filter videos by zone
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zoneId = searchParams.get('zoneId');

    let videos;
    if (zoneId) {
      videos = dataStore.getVideosInZone(zoneId);
    } else {
      videos = dataStore.getActiveVideos();
    }

    // Include reactions, comments count, vote counts, and AI metadata for each video
    const videosWithMeta = videos.map((video) => {
      const reactions = dataStore.getReactions(video.id);
      const comments = dataStore.getCommentsForVideo(video.id);
      const votes = dataStore.getVotes(video.id);
      const aiMetadata = dataStore.getAIMetadata(video.id);

      // Determine AI status for UI display
      let aiStatus: 'none' | 'pending' | 'available' | 'error' = 'none';
      if (aiMetadata) {
        if (aiMetadata.error) {
          aiStatus = 'error';
        } else {
          aiStatus = 'available';
        }
      } else {
        // No metadata yet - could be pending or disabled
        // For now, assume pending if video is recent (< 5 min old)
        const age = Date.now() - video.timestamp;
        if (age < 5 * 60 * 1000) {
          aiStatus = 'pending';
        }
      }

      return {
        ...video,
        reactionCounts: reactions,
        commentCount: comments.length,
        voteCounts: votes,
        aiMetadata: aiMetadata || undefined, // Include AI metadata if available
        aiStatus, // AI analysis status flag
      };
    });

    return NextResponse.json({
      success: true,
      videos: videosWithMeta,
    });
  } catch (error) {
    console.error('Get videos error:', error);
    return NextResponse.json(
      { error: 'Failed to get videos' },
      { status: 500 }
    );
  }
}
