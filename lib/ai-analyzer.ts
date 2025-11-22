/**
 * AI video analyzer orchestrator.
 * Coordinates frame extraction, API calls, privacy filtering, and storage.
 */

import { AIVideoMetadata, DEFAULT_LLAMA_CONFIG } from './ai-metadata';
import { extractFramesFromVideo } from './frame-extractor';
import { analyzFramesWithLlama } from './llama-client';
import { validateAIMetadata } from './privacy-filter';
import { dataStore } from './store';

/**
 * Analyze a video and store AI-generated metadata.
 * This is the main entry point for AI analysis.
 *
 * @param videoId - ID of the video to analyze
 * @param videoUrl - URL to video file (R2 cloudUrl)
 * @returns AI metadata if successful, or error metadata if failed
 */
export async function analyzeVideo(
  videoId: string,
  videoUrl: string
): Promise<AIVideoMetadata> {
  console.log(`[AI Analyzer] Starting analysis for video: ${videoId}`);

  try {
    // Step 1: Extract frames from video
    console.log('[AI Analyzer] Extracting frames...');
    const frames = await extractFramesFromVideo(videoUrl);

    if (frames.length === 0) {
      throw new Error('No frames extracted from video');
    }

    console.log(`[AI Analyzer] Extracted ${frames.length} frames`);

    // Step 2: Call Llama Vision API
    console.log('[AI Analyzer] Calling Llama Vision API...');
    const analysisResult = await analyzFramesWithLlama(frames);

    console.log('[AI Analyzer] Received analysis from Llama API');

    // Step 3: Privacy filter
    console.log('[AI Analyzer] Running privacy filter...');
    const privacyCheck = validateAIMetadata(
      analysisResult.summary,
      analysisResult.tags
    );

    if (!privacyCheck.isClean) {
      console.warn(
        `[AI Analyzer] Privacy violations detected for video ${videoId}:`,
        privacyCheck.violations
      );

      // If privacy filter fails, store error metadata
      const errorMetadata: AIVideoMetadata = {
        videoId,
        summary: '',
        tags: [],
        counts: { people: '0', vehicles: '0' },
        activityLevel: 'low',
        confidence: 0,
        analyzedAt: Date.now(),
        modelVersion: DEFAULT_LLAMA_CONFIG.model,
        error: {
          code: 'privacy_violation',
          message: `Privacy filter rejected analysis: ${privacyCheck.violations.length} violations detected`,
        },
      };

      // Store error metadata
      dataStore.setAIMetadata(videoId, errorMetadata);
      return errorMetadata;
    }

    // Step 4: Create metadata object
    const metadata: AIVideoMetadata = {
      videoId,
      summary: analysisResult.summary,
      tags: analysisResult.tags,
      counts: analysisResult.counts,
      activityLevel: analysisResult.activityLevel,
      confidence: analysisResult.confidence,
      analyzedAt: Date.now(),
      modelVersion: DEFAULT_LLAMA_CONFIG.model,
    };

    // Step 5: Store in dataStore
    dataStore.setAIMetadata(videoId, metadata);
    console.log(`[AI Analyzer] Successfully analyzed video ${videoId}`);

    return metadata;
  } catch (error) {
    console.error(`[AI Analyzer] Failed to analyze video ${videoId}:`, error);

    // Store error metadata so we don't retry indefinitely
    const errorMetadata: AIVideoMetadata = {
      videoId,
      summary: '',
      tags: [],
      counts: { people: '0', vehicles: '0' },
      activityLevel: 'low',
      confidence: 0,
      analyzedAt: Date.now(),
      modelVersion: DEFAULT_LLAMA_CONFIG.model,
      error: {
        code: 'analysis_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };

    dataStore.setAIMetadata(videoId, errorMetadata);
    return errorMetadata;
  }
}

/**
 * Analyze a video asynchronously (fire-and-forget).
 * Does not block on analysis completion.
 *
 * @param videoId - ID of the video to analyze
 * @param videoUrl - URL to video file
 */
export function analyzeVideoAsync(videoId: string, videoUrl: string): void {
  // Fire-and-forget: don't await
  analyzeVideo(videoId, videoUrl).catch((error) => {
    console.error(`[AI Analyzer] Async analysis failed for ${videoId}:`, error);
  });
}
