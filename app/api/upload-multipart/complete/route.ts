import { NextRequest, NextResponse } from 'next/server';
import { S3Client, CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { dataStore } from '@/lib/store';
import { VideoUpload } from '@/lib/types';
import { GoogleGenerativeAI } from '@google/generative-ai';

const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
});

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const uploadId = formData.get('uploadId') as string;
        const key = formData.get('key') as string;
        const videoId = formData.get('videoId') as string;
        const partsRaw = JSON.parse(formData.get('parts') as string);

        // Ensure parts are sorted by PartNumber and have correct shape
        const parts = partsRaw
            .map((p: any) => ({
                PartNumber: Number(p.PartNumber),
                ETag: p.ETag.replace(/"/g, ''), // Remove extra quotes if present
            }))
            .sort((a: any, b: any) => a.PartNumber - b.PartNumber);

        console.log('[Complete Upload] Parts:', JSON.stringify(parts));

        const sessionId = formData.get('sessionId') as string;
        const duration = parseFloat(formData.get('duration') as string);
        const size = parseInt(formData.get('size') as string);
        const analysisImage = formData.get('analysisImage') as File | null;

        // 1. Complete Multipart Upload
        const command = new CompleteMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET || 'hotzones',
            Key: key,
            UploadId: uploadId,
            MultipartUpload: { Parts: parts },
        });

        const completeRes = await s3Client.send(command);
        console.log('[Complete Upload] S3 Response:', completeRes);

        // 2. Run AI Analysis (if image provided)
        let analysisResult = '';
        if (analysisImage) {
            try {
                const imageBuffer = await analysisImage.arrayBuffer();
                const base64Image = Buffer.from(imageBuffer).toString('base64');
                const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

                const prompt = `Analyze this video frame from a security/safety perspective (HotZones app). Identify: 1. Text (OCR) - badge numbers, signs, plates. 2. Uniforms/Personnel. 3. Hazards or events. Return a concise summary (under 50 words).`;

                const result = await model.generateContent([
                    prompt,
                    { inlineData: { data: base64Image, mimeType: analysisImage.type || 'image/jpeg' } }
                ]);

                analysisResult = await result.response.text();
            } catch (e) {
                console.error('AI Analysis failed:', e);
                analysisResult = 'Analysis failed';
            }
        }

        // 3. Save Metadata
        const userSession = dataStore.getSession(sessionId);
        const location = userSession?.location;

        const video: VideoUpload = {
            id: videoId,
            sessionId,
            timestamp: Date.now(),
            duration,
            size,
            filename: `${videoId}.webm`,
            cloudUrl: `/api/proxy-video?id=${videoId}`, // Use proxy for playback
            location,
            analysis: analysisResult || undefined,
        };

        if (location) {
            const nearestZone = dataStore.findNearestZone(location);
            if (nearestZone) video.zoneId = nearestZone.zoneId;
        }

        dataStore.addVideo(video);

        return NextResponse.json({
            success: true,
            videoId,
            analysisPreview: analysisResult,
        });

    } catch (error: any) {
        console.error('Complete upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
