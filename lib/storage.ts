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

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

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
 *
 * @param videoId - Unique video identifier (used as filename)
 * @param contentType - MIME type (e.g., "video/webm")
 * @param data - Video file data as Buffer or Uint8Array
 * @returns Public URL where the video can be accessed
 *
 * @example
 * const url = await uploadVideoToR2('video-abc123', 'video/webm', buffer);
 * // Returns: "https://...r2.cloudflarestorage.com/hotzones/videos/video-abc123.webm"
 */
export async function uploadVideoToR2(
  videoId: string,
  contentType: string,
  data: Buffer | Uint8Array
): Promise<string> {
  // Construct S3 key: videos/{videoId}.webm
  const key = `videos/${videoId}.webm`;

  // Upload to R2
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: data,
    ContentType: contentType,
  });

  await s3Client.send(command);

  // Construct public URL
  // Example: https://e6d72476685366150b6a2c3c5386d771.r2.cloudflarestorage.com/hotzones/videos/video-abc123.webm
  const publicUrl = `${R2_PUBLIC_BASE_URL}/videos/${videoId}.webm`;

  return publicUrl;
}

/**
 * Get the public URL for a video stored in R2.
 * This doesn't check if the file exists - just constructs the URL.
 *
 * @param videoId - Unique video identifier
 * @returns Public URL where the video should be accessible
 */
export function getVideoUrl(videoId: string): string {
  return `${R2_PUBLIC_BASE_URL}/videos/${videoId}.webm`;
}
