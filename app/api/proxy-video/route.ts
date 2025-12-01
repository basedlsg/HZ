import { NextRequest, NextResponse } from 'next/server';
import { getPresignedVideoUrl } from '@/lib/storage';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
        return new NextResponse('Video ID required', { status: 400 });
    }

    try {
        // Get the presigned URL
        const signedUrl = await getPresignedVideoUrl(videoId);

        // Fetch from R2
        const response = await fetch(signedUrl);

        if (!response.ok) {
            console.error('Proxy fetch failed:', response.status, response.statusText);
            return new NextResponse(`Failed to fetch video: ${response.statusText}`, { status: response.status });
        }

        // Forward the video stream with correct headers
        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'video/webm');
        headers.set('Content-Length', response.headers.get('Content-Length') || '');
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');

        return new NextResponse(response.body, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('Proxy error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
