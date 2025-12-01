import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { VideoUpload } from '@/lib/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        const videoId = formData.get('videoId') as string;
        const sessionId = formData.get('sessionId') as string;
        const duration = parseFloat(formData.get('duration') as string);
        const size = parseInt(formData.get('size') as string);
        const analysisImage = formData.get('analysisImage') as File | null;

        if (!videoId || !sessionId || isNaN(duration)) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        console.log('[Finalize Upload] Processing metadata for video:', videoId);

        // Perform AI Analysis if image provided
        let analysisResult = '';
        if (analysisImage) {
            try {
                console.log('[AI Analysis] Starting...');
                const imageBuffer = await analysisImage.arrayBuffer();
                const base64Image = Buffer.from(imageBuffer).toString('base64');
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

                const prompt = `Analyze this video frame from a security/safety perspective (HotZones app). Identify: 1. Text (OCR) - badge numbers, signs, plates. 2. Uniforms/Personnel. 3. Hazards or events. Return a concise summary (under 50 words).`;

                const analysisPromise = model.generateContent([
                    prompt,
                    { inlineData: { data: base64Image, mimeType: analysisImage.type || 'image/jpeg' } }
                ]);

                const timeoutPromise = new Promise<any>((_, reject) =>
                    setTimeout(() => reject(new Error('AI analysis timeout')), 30000)
                );

                const result = await Promise.race([analysisPromise, timeoutPromise]);
                analysisResult = await result.response.text();
                console.log('[AI Analysis] Success');
            } catch (aiError: any) {
                console.error('[AI Analysis] Failed:', aiError.message);
                analysisResult = `Analysis failed: ${aiError.message}`;
            }
        }

        // Get session for location
        const userSession = dataStore.getSession(sessionId);
        const location = userSession?.location;

        // Create video metadata
        const video: VideoUpload = {
            id: videoId,
            sessionId,
            timestamp: Date.now(),
            duration,
            size,
            filename: `${videoId}.webm`,
            cloudUrl: `${process.env.R2_PUBLIC_BASE_URL}/videos/${videoId}.webm`,
            location,
            analysis: analysisResult || undefined,
        };

        // Assign zone if location available
        if (location) {
            const nearestZone = dataStore.findNearestZone(location);
            if (nearestZone) {
                video.zoneId = nearestZone.zoneId;
            }
        }

        dataStore.addVideo(video);

        return NextResponse.json({
            success: true,
            videoId: video.id,
            cloudUrl: `/api/proxy-video?id=${videoId}`,
            analysisPreview: analysisResult,
            message: 'Video finalized successfully',
        });
    } catch (error) {
        console.error('Finalize upload error:', error);
        return NextResponse.json(
            { error: 'Failed to finalize upload' },
            { status: 500 }
        );
    }
}
