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

      // Use direct R2 public URL (CORS is now fixed)
      // If cloudUrl is already a full URL, use it. Otherwise construct it.
      let videoUrl = video.cloudUrl;
      if (!videoUrl.startsWith('http')) {
        videoUrl = `${process.env.R2_PUBLIC_BASE_URL}/${video.cloudUrl}`;
      }

      // Fallback if cloudUrl is just the key
      if (!videoUrl.includes(process.env.R2_PUBLIC_BASE_URL || '')) {
        videoUrl = `${process.env.R2_PUBLIC_BASE_URL}/videos/${video.id}.webm`;
      }

      return {
        ...video,
        cloudUrl: videoUrl,
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
