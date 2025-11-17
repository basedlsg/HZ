import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { generateId } from '@/lib/utils';
import { VideoUpload } from '@/lib/types';
import { uploadVideoToR2 } from '@/lib/storage';

/**
 * POST /api/upload-video
 *
 * Accepts multipart/form-data with:
 * - video: the video file blob
 * - sessionId: user session identifier
 * - duration: recording duration in seconds
 *
 * Uploads the video to Cloudflare R2 storage and stores metadata in memory.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const videoFile = formData.get('video') as File | null;
    const sessionId = formData.get('sessionId') as string;
    const duration = parseFloat(formData.get('duration') as string);

    // Validate inputs
    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    if (!sessionId || isNaN(duration)) {
      return NextResponse.json(
        { error: 'Invalid session or duration data' },
        { status: 400 }
      );
    }

    // Generate unique video ID
    const videoId = generateId('video');

    // Convert File to Buffer for R2 upload
    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudflare R2
    const cloudUrl = await uploadVideoToR2(
      videoId,
      videoFile.type || 'video/webm',
      buffer
    );

    // Get session to extract location for zone assignment
    const session = dataStore.getSession(sessionId);
    const location = session?.location;

    // Create video metadata record
    const video: VideoUpload = {
      id: videoId,
      sessionId,
      timestamp: Date.now(),
      duration,
      size: videoFile.size,
      filename: `${videoId}.webm`,
      cloudUrl, // R2 public URL
      location,
    };

    // Find and assign nearest zone if location available
    if (location) {
      const nearestZone = dataStore.findNearestZone(location);
      if (nearestZone) {
        video.zoneId = nearestZone.zoneId;
      }
    }

    // Store video metadata in memory
    dataStore.addVideo(video);

    return NextResponse.json({
      success: true,
      videoId: video.id,
      cloudUrl: video.cloudUrl,
      message: 'Video uploaded to R2 successfully',
    });
  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload video to R2' },
      { status: 500 }
    );
  }
}
