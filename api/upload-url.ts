
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const { filename, contentType } = await request.json();

        if (!filename || !contentType) {
            return new Response(JSON.stringify({ error: 'Missing filename or contentType' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        const endpoint = process.env.R2_ENDPOINT;
        const bucket = process.env.R2_BUCKET || 'hotzones';

        if (!accessKeyId || !secretAccessKey || !endpoint) {
            return new Response(JSON.stringify({ error: 'Misconfigured Server' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const R2 = new S3Client({
            region: 'auto',
            endpoint: endpoint,
            credentials: {
                accessKeyId,
                secretAccessKey: secretAccessKey
            },
        });

        let key;
        if (contentType === 'application/json') {
            key = `metadata/${filename}`;
        } else {
            const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
            key = `uploads/${Date.now()}_${cleanName}`;
        }

        const command = new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            ContentType: contentType,
        });

        // Generate Presigned URL (valid for 10 minutes)
        const uploadUrl = await getSignedUrl(R2, command, { expiresIn: 600 });

        return new Response(
            JSON.stringify({
                uploadUrl,
                key
            }),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    } catch (e: any) {
        console.error("Upload URL Generation Error:", e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
