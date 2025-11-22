/**
 * Video frame extraction utility for AI analysis.
 * Extracts key frames from uploaded videos and encodes them for Llama API.
 */

import { DEFAULT_FRAME_CONFIG, FrameExtractionConfig } from './ai-metadata';
import sharp from 'sharp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Extract frames from a video URL and encode as base64 JPEG.
 *
 * @param videoUrl - URL to video file (typically R2 cloudUrl)
 * @param config - Frame extraction configuration
 * @returns Array of base64-encoded JPEG frames
 */
export async function extractFramesFromVideo(
  videoUrl: string,
  config: FrameExtractionConfig = DEFAULT_FRAME_CONFIG
): Promise<string[]> {
  let tempDir: string | null = null;
  let videoPath: string | null = null;

  try {
    // Create temporary directory for frame extraction
    tempDir = path.join(os.tmpdir(), `hotzones-frames-${Date.now()}`);
    if (!existsSync(tempDir)) {
      await mkdir(tempDir, { recursive: true });
    }

    // Download video to temp file
    console.log('[Frame Extractor] Downloading video:', videoUrl);
    const videoBuffer = await fetchVideoBuffer(videoUrl);
    videoPath = path.join(tempDir, 'video.webm');
    await writeFile(videoPath, videoBuffer);

    // Get video duration
    const duration = await getVideoDuration(videoPath);
    console.log('[Frame Extractor] Video duration:', duration, 'seconds');

    // Calculate frame timestamps based on strategy
    const timestamps = calculateFrameTimestamps(
      duration,
      config.frameCount,
      config.strategy
    );
    console.log('[Frame Extractor] Frame timestamps:', timestamps);

    // Extract frames using ffmpeg
    const framePaths = await extractFramesWithFFmpeg(
      videoPath,
      timestamps,
      tempDir
    );

    // Resize and encode frames
    const encodedFrames: string[] = [];
    for (const framePath of framePaths) {
      const encoded = await resizeAndEncodeFrame(
        framePath,
        config.targetWidth,
        config.targetHeight
      );
      encodedFrames.push(encoded);
    }

    console.log('[Frame Extractor] Successfully extracted', encodedFrames.length, 'frames');
    return encodedFrames;
  } finally {
    // Cleanup temp files
    if (tempDir) {
      try {
        await execAsync(`rm -rf "${tempDir}"`);
      } catch (error) {
        console.warn('[Frame Extractor] Failed to cleanup temp directory:', error);
      }
    }
  }
}

/**
 * Fetch video file from URL as a buffer.
 *
 * @param url - Video URL
 * @returns Video file buffer
 */
async function fetchVideoBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Get video duration in seconds using ffprobe.
 *
 * @param videoPath - Path to video file
 * @returns Duration in seconds
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  try {
    const { stdout } = await execAsync(
      `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`
    );
    return parseFloat(stdout.trim());
  } catch (error) {
    console.warn('[Frame Extractor] ffprobe not available, using fallback duration');
    // Fallback: assume 10 second clips (typical for Hotzones)
    return 10;
  }
}

/**
 * Calculate frame extraction timestamps based on strategy.
 *
 * @param duration - Video duration in seconds
 * @param frameCount - Number of frames to extract
 * @param strategy - Frame selection strategy
 * @returns Array of timestamps in seconds
 */
function calculateFrameTimestamps(
  duration: number,
  frameCount: number,
  strategy: FrameExtractionConfig['strategy']
): number[] {
  if (strategy === 'first-middle-last') {
    // Extract at 10%, 50%, 90% to avoid black lead-in/tail
    return [
      duration * 0.1,
      duration * 0.5,
      duration * 0.9,
    ].slice(0, frameCount);
  } else if (strategy === 'evenly-spaced') {
    // Evenly space frames across video duration
    const timestamps: number[] = [];
    for (let i = 0; i < frameCount; i++) {
      timestamps.push((duration / (frameCount + 1)) * (i + 1));
    }
    return timestamps;
  } else {
    // Default to first-middle-last
    return [duration * 0.1, duration * 0.5, duration * 0.9].slice(0, frameCount);
  }
}

/**
 * Extract frames from video at specific timestamps using ffmpeg.
 *
 * @param videoPath - Path to video file
 * @param timestamps - Array of timestamps in seconds
 * @param outputDir - Directory to save extracted frames
 * @returns Array of paths to extracted frame files
 */
async function extractFramesWithFFmpeg(
  videoPath: string,
  timestamps: number[],
  outputDir: string
): Promise<string[]> {
  const framePaths: string[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const outputPath = path.join(outputDir, `frame-${i}.jpg`);

    try {
      // Extract single frame at timestamp
      await execAsync(
        `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 "${outputPath}"`
      );
      framePaths.push(outputPath);
    } catch (error) {
      console.warn(`[Frame Extractor] Failed to extract frame at ${timestamp}s:`, error);
      // Continue with other frames
    }
  }

  if (framePaths.length === 0) {
    throw new Error('Failed to extract any frames from video');
  }

  return framePaths;
}

/**
 * Resize frame to target dimensions and encode as base64 JPEG.
 *
 * @param framePath - Path to frame image file
 * @param targetWidth - Target width in pixels
 * @param targetHeight - Target height in pixels
 * @returns Base64-encoded JPEG string (data:image/jpeg;base64,...)
 */
async function resizeAndEncodeFrame(
  framePath: string,
  targetWidth: number,
  targetHeight: number
): Promise<string> {
  // Resize with sharp, maintaining aspect ratio with letterboxing
  const resized = await sharp(framePath)
    .resize(targetWidth, targetHeight, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0 }, // Black letterboxing
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  // Encode as base64
  const base64 = resized.toString('base64');
  return `data:image/jpeg;base64,${base64}`;
}
