```typescript
import { NextRequest, NextResponse } from 'next/server';
import { S3Client, UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
        const { uploadId, key, partNumber } = await request.json();

        if (!uploadId || !key || !partNumber) {
            return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
        }

        const command = new UploadPartCommand({
            Bucket: process.env.R2_BUCKET || 'hotzones',
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
        });

        // Generate presigned URL for client to upload this part directly
        const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });

        return NextResponse.json({
            success: true,
            presignedUrl,
        });
    } catch (error: any) {
        console.error('Get part URL error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
```
