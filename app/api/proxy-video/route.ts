import { NextRequest, NextResponse } from 'next/server';
import { getPresignedVideoUrl } from '@/lib/storage';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('id');

    if (!videoId) {
        return new NextResponse('Video ID required', { status: 400 });
    }

    try {
        // Get the presigned URL (or we could use GetObjectCommand directly)
        const signedUrl = await getPresignedVideoUrl(videoId);

        // Fetch the video from R2
        const response = await fetch(signedUrl);

        if (!response.ok) {
            return new NextResponse(`Failed to fetch video: ${response.statusText}`, { status: response.status });
        }

        // Stream the response back to the client
        // We forward the Content-Type and Content-Length if available
        const headers = new Headers();
        headers.set('Content-Type', response.headers.get('Content-Type') || 'video/webm');
        if (response.headers.get('Content-Length')) {
            headers.set('Content-Length', response.headers.get('Content-Length')!);
        }
        headers.set('Access-Control-Allow-Origin', '*'); // Allow all origins for this proxy

        return new NextResponse(response.body, {
            status: 200,
            headers,
        });

    } catch (error) {
        console.error('Proxy error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
