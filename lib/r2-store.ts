import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { VideoUpload } from './types';

const s3Client = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    },
    forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET || 'hotzones';
const VIDEOS_JSON_KEY = 'metadata/videos.json';

export async function getVideosFromR2(): Promise<VideoUpload[]> {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET,
            Key: VIDEOS_JSON_KEY,
        });

        const response = await s3Client.send(command);
        if (!response.Body) return [];

        const str = await response.Body.transformToString();
        return JSON.parse(str);
    } catch (error: any) {
        if (error.name === 'NoSuchKey') {
            return []; // File doesn't exist yet
        }
        console.error('Failed to fetch videos from R2:', error);
        return [];
    }
}

export async function saveVideoToR2(video: VideoUpload): Promise<void> {
    try {
        // 1. Get existing videos
        const videos = await getVideosFromR2();

        // 2. Add new video (prepend to keep newest first)
        videos.unshift(video);

        // 3. Save back to R2
        const command = new PutObjectCommand({
            Bucket: BUCKET,
            Key: VIDEOS_JSON_KEY,
            Body: JSON.stringify(videos),
            ContentType: 'application/json',
        });

        await s3Client.send(command);
        console.log('Saved video metadata to R2');
    } catch (error) {
        console.error('Failed to save video to R2:', error);
        throw error;
    }
}
