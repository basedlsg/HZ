import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { generateId } from '@/lib/utils';
import { VideoUpload } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, duration, size, filename } = body;

    if (!sessionId || typeof duration !== 'number' || typeof size !== 'number') {
      return NextResponse.json(
        { error: 'Invalid video data' },
        { status: 400 }
      );
    }

    const video: VideoUpload = {
      id: generateId('video'),
      sessionId,
      timestamp: Date.now(),
      duration,
      size,
      filename: filename || 'video.webm',
    };

    dataStore.addVideo(video);

    return NextResponse.json({
      success: true,
      videoId: video.id,
      message: 'Video uploaded successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to upload video' },
      { status: 500 }
    );
  }
}
