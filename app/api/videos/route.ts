import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true,
});

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
    const videosWithSignedUrls = await Promise.all(videos.map(async (video) => {
      const reactions = dataStore.getReactions(video.id);
      const comments = dataStore.getCommentsForVideo(video.id);
      const votes = dataStore.getVotes(video.id);

      let signedUrl = video.cloudUrl; // Fallback to existing cloudUrl if signing fails or isn't needed

      // We need to extract the key from the video object.
      // Assuming video.filename holds the key (e.g., "video-123.webm")
      let key = video.filename;
      if (!key.startsWith('videos/')) {
        key = `videos/${key}`;
      }

      try {
        const command = new GetObjectCommand({
          Bucket: process.env.R2_BUCKET || 'hotzones', // Use R2_BUCKET from env or default
          Key: key,
        });
        // Generate a presigned URL valid for 1 hour (3600 seconds)
        signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
      } catch (e) {
        console.error('Failed to sign URL for', key, e);
        // Fallback to existing URL or an empty string if signing fails
        // The original cloudUrl might be a direct public URL, so keep it as a fallback.
        signedUrl = video.cloudUrl || '';
      }

      return {
        ...video,
        cloudUrl: signedUrl,
        reactionCounts: reactions,
        commentCount: comments.length,
        voteCounts: votes,
      };
    }));

    return NextResponse.json(videosWithSignedUrls);
  } catch (error) {
    console.error('Get videos error:', error);
    return NextResponse.json(
      { error: 'Failed to get videos' },
      { status: 500 }
    );
  }
}
