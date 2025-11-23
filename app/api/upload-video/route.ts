import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { generateId } from '@/lib/utils';
import { VideoUpload } from '@/lib/types';
import { uploadVideoToR2 } from '@/lib/storage';
import { analyzeVideoAsync } from '@/lib/ai-analyzer';

/**
 * POST /api/upload-video
 *
 * Accepts multipart/form-data with:
 * - video: the video file blob
 * - sessionId: user session identifier
 * - duration: recording duration in seconds
 * - latitude: GPS latitude coordinate (optional, but required for recording)
 * - longitude: GPS longitude coordinate (optional, but required for recording)
 *
 * Uploads the video to Cloudflare R2 storage and stores metadata in memory.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const videoFile = formData.get('video') as File | null;
    const sessionId = formData.get('sessionId') as string;
    const duration = parseFloat(formData.get('duration') as string);
    const latitude = formData.get('latitude') ? parseFloat(formData.get('latitude') as string) : null;
    const longitude = formData.get('longitude') ? parseFloat(formData.get('longitude') as string) : null;

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

    if (latitude === null || longitude === null || isNaN(latitude) || isNaN(longitude)) {
      return NextResponse.json(
        { error: 'Location coordinates required to upload video' },
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

    // Use the location coordinates from the video recording
    const location = { lat: latitude, lng: longitude };

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

    // Find and assign nearest zone based on video's location
    const nearestZone = dataStore.findNearestZone(location);
    if (nearestZone) {
      video.zoneId = nearestZone.zoneId;
    }

    // Store video metadata in memory
    dataStore.addVideo(video);

    // Trigger AI analysis asynchronously (fire-and-forget, non-blocking)
    // AI analysis will extract frames, call Llama API, and store metadata
    if (cloudUrl) {
      analyzeVideoAsync(video.id, cloudUrl);
    }

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
