import { uploadVideoToR2 } from './lib/storage';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function testUpload() {
    console.log('Testing R2 Upload...');

    try {
        const dummyData = Buffer.from('This is a test video file content', 'utf-8');
        const videoId = `test-${Date.now()}`;

        console.log(`Uploading test file: ${videoId}.webm`);

        const url = await uploadVideoToR2(videoId, 'video/webm', dummyData);

        console.log('✅ Upload successful!');
        console.log('Public URL:', url);
    } catch (error) {
        console.error('❌ Upload failed:', error);
    }
}

testUpload();
