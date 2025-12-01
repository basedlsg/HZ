import { NextRequest, NextResponse } from 'next/server';
import { S3Client, CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { generateId } from '@/lib/utils';

const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
});

export async function POST(request: NextRequest) {
    try {
        const { contentType } = await request.json();
        const videoId = generateId('video');
        const key = `videos/${videoId}.webm`;

        const command = new CreateMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET || 'hotzones',
            Key: key,
            ContentType: contentType || 'video/webm',
        });

        const { UploadId } = await s3Client.send(command);

        return NextResponse.json({
            success: true,
            uploadId: UploadId,
            key,
            videoId,
        });
    } catch (error: any) {
        console.error('Init upload error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
