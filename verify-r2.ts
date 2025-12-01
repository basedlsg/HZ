import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET = process.env.R2_BUCKET;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

async function listR2Objects() {
    console.log('🔍 Checking Cloudflare R2 Bucket Contents...');
    console.log(`Bucket: ${R2_BUCKET}`);
    console.log(`Endpoint: ${R2_ENDPOINT}`);

    if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
        console.error('❌ Missing credentials');
        return;
    }

    const s3Client = new S3Client({
        region: 'auto',
        endpoint: R2_ENDPOINT,
        credentials: {
            accessKeyId: R2_ACCESS_KEY_ID,
            secretAccessKey: R2_SECRET_ACCESS_KEY,
        },
        forcePathStyle: true,
    });

    try {
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET,
            MaxKeys: 10, // Just show the last few
        });

        const response = await s3Client.send(command);

        if (response.Contents && response.Contents.length > 0) {
            console.log(`\n✅ Found ${response.KeyCount} objects (showing recent):`);
            response.Contents.forEach((item) => {
                console.log(`- ${item.Key} (Size: ${item.Size} bytes, LastModified: ${item.LastModified})`);
            });
            console.log('\n🎉 CONFIRMED: Files are being stored in the cloud!');
        } else {
            console.log('\n⚠️  Bucket is empty or no objects found.');
        }
    } catch (error) {
        console.error('❌ Failed to list objects:', error);
    }
}

listR2Objects();
