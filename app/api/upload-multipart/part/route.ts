import { NextRequest, NextResponse } from 'next/server';
import { S3Client, UploadPartCommand } from '@aws-sdk/client-s3';

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
        const formData = await request.formData();
        const uploadId = formData.get('uploadId') as string;
        const key = formData.get('key') as string;
        const partNumber = parseInt(formData.get('partNumber') as string);
        const body = formData.get('body') as File;

        if (!uploadId || !key || !partNumber || !body) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const buffer = Buffer.from(await body.arrayBuffer());

        const command = new UploadPartCommand({
            Bucket: process.env.R2_BUCKET || 'hotzones',
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: buffer,
        });

        const { ETag } = await s3Client.send(command);

        return NextResponse.json({
            success: true,
            ETag,
        });
    } catch (error: any) {
        console.error('Upload part error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
