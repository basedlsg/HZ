import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { dataStore } from '@/lib/store';
import { generateId } from '@/lib/utils';
import { VideoUpload } from '@/lib/types';

/**
 * POST /api/upload-video
 *
 * Accepts multipart/form-data with:
 * - video: the video file blob
 * - sessionId: user session identifier
 * - duration: recording duration in seconds
 *
 * Saves the video file to uploads/ directory and stores metadata.
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

    // Generate unique video ID and filename
    const videoId = generateId('video');
    const fileExtension = videoFile.name.split('.').pop() || 'webm';
    const uniqueFilename = `${videoId}.${fileExtension}`;

    // Define upload directory path (relative to project root)
    const uploadsDir = path.join(process.cwd(), 'uploads');

    // Create uploads directory if it doesn't exist
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true });
    }

    // Full file path
    const filePath = path.join(uploadsDir, uniqueFilename);

    // Convert File to Buffer and write to disk
    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

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
      filename: uniqueFilename,
      filePath: `uploads/${uniqueFilename}`, // Store relative path
      location,
    };

    // Find and assign nearest zone if location available
    if (location) {
      const nearestZone = dataStore.findNearestZone(location);
      if (nearestZone) {
        video.zoneId = nearestZone.zoneId;
      }
    }

    // Store video metadata
    dataStore.addVideo(video);

    return NextResponse.json({
      success: true,
      videoId: video.id,
      message: 'Video uploaded and saved successfully',
    });
  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}
