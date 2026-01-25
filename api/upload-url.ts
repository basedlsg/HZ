import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';



// Initialize S3 Client
const R2 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

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

        // Generate Key based on type
        // For Metadata (JSON): deterministic key 'metadata/${id}.json' to allow easy lookup
        // For Video: timestamped key to avoid collisions (though ID collision is unlikely)
        let key;
        if (contentType === 'application/json') {
            // For metadata, we want to be able to query by ID.
            // Filename is expected to be `${id}.json`
            key = `metadata/${filename}`;
        } else {
            // For videos or others
            const cleanName = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
            key = `uploads/${Date.now()}_${cleanName}`;
        }

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET || 'hotzones',
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
