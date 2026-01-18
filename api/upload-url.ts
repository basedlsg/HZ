import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Initialize S3 Client for Cloudflare R2
const R2 = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
});

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { filename, contentType } = req.body;

        if (!filename || !contentType) {
            return res.status(400).json({ error: 'Missing filename or contentType' });
        }

        // Sanitize filename and add path
        const safeName = filename.replace(/[^a-zA-Z0-9-_\.]/g, '');
        const key = `uploads/${Date.now()}_${safeName}`;

        // Generate Signed URL (valid for 5 minutes)
        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            ContentType: contentType,
            ACL: 'public-read', // R2 doesn't enforce ACLs strictly but good practice
        });

        const uploadUrl = await getSignedUrl(R2, command, { expiresIn: 300 });

        // Construct public URL (assuming bucket public access or custom domain)
        // Cloudflare R2 Public URL format depends on setup, usually requires a custom domain or .r2.dev
        // For now, we will assume standard R2 dev domain or let user configure it.
        // However, without a custom domain, R2 buckets are private by default.
        // User needs to enable 'R2.dev subdomain' in dashboard or map a custom entry.
        // We'll return the key so frontend can construct whatever public URL logic we choose.

        return res.status(200).json({
            uploadUrl,
            key
        });

    } catch (error) {
        console.error('R2 Signing Error:', error);
        return res.status(500).json({ error: 'Failed to generate upload URL' });
    }
}
