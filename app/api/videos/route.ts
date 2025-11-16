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

    // Include reactions, comments count, and vote counts for each video
    const videosWithMeta = videos.map((video) => {
      const reactions = dataStore.getReactions(video.id);
      const comments = dataStore.getCommentsForVideo(video.id);
      const votes = dataStore.getVotes(video.id);

      return {
        ...video,
        reactionCounts: reactions,
        commentCount: comments.length,
        voteCounts: votes,
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
