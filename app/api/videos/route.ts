import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { getPresignedVideoUrl } from '@/lib/storage';

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

    // Include reactions, comments count, vote counts, and signed URLs
    const videosWithMeta = await Promise.all(videos.map(async (video) => {
      const reactions = dataStore.getReactions(video.id);
      const comments = dataStore.getCommentsForVideo(video.id);
      const votes = dataStore.getVotes(video.id);

      // Use local proxy URL to bypass CORS issues with R2
      const proxyUrl = `/api/proxy-video?id=${video.id}`;

      return {
        ...video,
        cloudUrl: proxyUrl,
        reactionCounts: reactions,
        commentCount: comments.length,
        voteCounts: votes,
      };
    }));

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
