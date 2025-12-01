/**
 * Cloudflare R2 Storage Helper
 *
 * Uses AWS SDK v3 S3 client to interact with Cloudflare R2 (S3-compatible).
 *
 * Environment Variables (set these in Vercel via `vercel env add`):
 * - R2_ACCESS_KEY_ID (example: "57cb497b6912020e94d09b6cce36357b")
 * - R2_SECRET_ACCESS_KEY (example: "72dde665a4a84371009d1ea850385c644d1a7477b6188adf5cb706f5985eef09")
 * - R2_ENDPOINT (default: "https://e6d72476685366150b6a2c3c5386d771.r2.cloudflarestorage.com")
 * - R2_BUCKET (default: "hotzones")
 * - R2_PUBLIC_BASE_URL (default: "https://e6d72476685366150b6a2c3c5386d771.r2.cloudflarestorage.com/hotzones")
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// R2 configuration from environment variables with fallback defaults
const R2_ENDPOINT = process.env.R2_ENDPOINT || 'https://e6d72476685366150b6a2c3c5386d771.r2.cloudflarestorage.com';
const R2_BUCKET = process.env.R2_BUCKET || 'hotzones';
const R2_PUBLIC_BASE_URL = process.env.R2_PUBLIC_BASE_URL || 'https://e6d72476685366150b6a2c3c5386d771.r2.cloudflarestorage.com/hotzones';

const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.warn(
    '⚠️  R2 credentials not found in environment variables. ' +
    'Video uploads will fail. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.'
  );
}

// Initialize S3 client configured for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto', // R2 ignores region, but SDK requires it
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID || '',
    secretAccessKey: R2_SECRET_ACCESS_KEY || '',
  },
  forcePathStyle: true, // Required for R2 compatibility
});

/**
 * Upload a video file to Cloudflare R2 storage.
 */
export async function uploadVideoToR2(
  videoId: string,
  contentType: string,
  data: Buffer | Uint8Array
): Promise<string> {
  const key = `videos/${videoId}.webm`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: data,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Return a presigned URL for immediate playback
  return getPresignedVideoUrl(videoId);
}

/**
 * Get a presigned URL for a video stored in R2.
 * Valid for 1 hour.
 */
export async function getPresignedVideoUrl(videoId: string): Promise<string> {
  const key = `videos/${videoId}.webm`;
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
  });

  // Generate signed URL valid for 3600 seconds (1 hour)
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
}

/**
 * @deprecated Use getPresignedVideoUrl instead for private buckets
 */
export function getVideoUrl(videoId: string): string {
  return `${R2_PUBLIC_BASE_URL}/videos/${videoId}.webm`;
}
