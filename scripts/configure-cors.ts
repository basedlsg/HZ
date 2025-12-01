import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
});

async function configureCors() {
    console.log('Configuring CORS for bucket:', process.env.R2_BUCKET);

    const command = new PutBucketCorsCommand({
        Bucket: process.env.R2_BUCKET || 'hotzones',
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedHeaders: ['*'],
                    AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
                    AllowedOrigins: ['*'], // Allow all origins for now to fix the issue
                    ExposeHeaders: ['ETag'],
                    MaxAgeSeconds: 3600,
                },
            ],
        },
    });

    try {
        await s3Client.send(command);
        console.log('✅ CORS configuration applied successfully!');
    } catch (error) {
        console.error('❌ Failed to configure CORS:', error);
    }
}

configureCors();
