/**
 * AI-generated metadata types for video analysis
 *
 * This module defines the structure for AI-analyzed video metadata using Llama Vision API.
 * All analysis is privacy-preserving and focuses on scene-level aggregates, never individuals.
 */

// ============================================================================
// Core AI Metadata Interface
// ============================================================================

/**
 * AI-generated metadata for a video.
 *
 * This is an OPTIONAL layer on top of the core VideoUpload type.
 * If AI analysis fails or is disabled, videos function normally without this data.
 */
export interface AIVideoMetadata {
  /** The video ID this metadata belongs to */
  videoId: string;

  /**
   * Brief, factual summary of the scene (1-2 sentences).
   * Example: "Urban street scene with moderate pedestrian traffic. Daytime with clear weather."
   *
   * NEVER includes: specific identities, faces, license plates, individual descriptions
   */
  summary: string;

  /**
   * Flat array of scene descriptors.
   * Examples: ["urban", "daytime", "clear-weather", "street", "pedestrian-traffic"]
   *
   * Categories typically include:
   * - Location type: "urban", "suburban", "park", "street", "intersection", "plaza"
   * - Time: "daytime", "nighttime", "dawn", "dusk"
   * - Weather: "clear", "cloudy", "rainy", "foggy"
   * - Activity: "pedestrian-traffic", "vehicle-traffic", "stationary", "crowded", "sparse"
   */
  tags: string[];

  /**
   * Approximate counts using privacy-preserving ranges.
   * Counts are intentionally coarse to prevent individual tracking.
   */
  counts: {
    /** Approximate people count: "0", "1-3", "4-10", "10-20", "20+" */
    people: CountRange;

    /** Approximate vehicle count: "0", "1-3", "4-10", "10-20", "20+" */
    vehicles: CountRange;
  };

  /**
   * Overall activity level assessment.
   * - "low": minimal movement, few entities
   * - "medium": moderate activity, some movement
   * - "high": significant activity, many moving entities
   */
  activityLevel: ActivityLevel;

  /**
   * Model's confidence in the analysis (0.0 to 1.0).
   * Lower confidence might indicate poor lighting, camera shake, or unclear scenes.
   */
  confidence: number;

  /** Unix timestamp (ms) when this analysis was performed */
  analyzedAt: number;

  /**
   * Model identifier used for analysis.
   * Example: "llama-3.2-90b-vision"
   * Useful for tracking model version changes over time.
   */
  modelVersion: string;

  /**
   * Optional error information if analysis partially failed.
   * If present, indicates degraded/incomplete analysis.
   */
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// Supporting Types
// ============================================================================

/**
 * Privacy-preserving count ranges.
 * Using ranges instead of exact counts prevents individual tracking.
 */
export type CountRange = "0" | "1-3" | "4-10" | "10-20" | "20+";

/**
 * Activity level classification
 */
export type ActivityLevel = "low" | "medium" | "high";

// ============================================================================
// Frame Extraction Configuration
// ============================================================================

/**
 * Configuration for frame extraction from videos.
 * These settings balance API cost, analysis quality, and processing time.
 */
export interface FrameExtractionConfig {
  /** Number of frames to extract per video */
  frameCount: number;

  /** Target width for resized frames (maintains aspect ratio) */
  targetWidth: number;

  /** Target height for resized frames */
  targetHeight: number;

  /**
   * Frame selection strategy:
   * - "evenly-spaced": Extract frames at regular intervals
   * - "keyframes": Extract key frames (if video codec supports)
   * - "first-middle-last": Extract first, middle, and last frames
   */
  strategy: "evenly-spaced" | "keyframes" | "first-middle-last";

  /**
   * Output format for frame encoding
   * - "base64": Encode frames as base64 strings (for direct API submission)
   * - "buffer": Return raw buffers (for further processing)
   */
  outputFormat: "base64" | "buffer";
}

/**
 * Default frame extraction configuration.
 * Optimized for cost-effectiveness and quality balance.
 */
export const DEFAULT_FRAME_CONFIG: FrameExtractionConfig = {
  frameCount: 3,
  targetWidth: 512,
  targetHeight: 512,
  strategy: "first-middle-last",
  outputFormat: "base64",
};

// ============================================================================
// Llama API Integration Types
// ============================================================================

/**
 * Configuration for Llama Vision API calls
 */
export interface LlamaAPIConfig {
  /** API key for Llama API */
  apiKey: string;

  /** Model to use for vision analysis */
  model: string;

  /** API endpoint URL */
  endpoint: string;

  /** Request timeout in milliseconds */
  timeoutMs: number;

  /** Maximum retries for failed requests */
  maxRetries: number;

  /** Backoff multiplier for retries (exponential backoff) */
  retryBackoffMs: number;
}

/**
 * Default Llama API configuration
 */
export const DEFAULT_LLAMA_CONFIG: LlamaAPIConfig = {
  apiKey: process.env.LLAMA_API_KEY || "",
  model: "llama-3.2-90b-vision-instruct",
  endpoint: "https://api.llama-api.com/chat/completions",
  timeoutMs: 30000, // 30 seconds
  maxRetries: 3,
  retryBackoffMs: 1000, // Start with 1s, then 2s, then 4s
};

/**
 * Request payload for Llama Vision API
 */
export interface LlamaVisionRequest {
  model: string;
  messages: Array<{
    role: "user" | "system";
    content: string | Array<{
      type: "text" | "image_url";
      text?: string;
      image_url?: {
        url: string; // data:image/jpeg;base64,... format
      };
    }>;
  }>;
  max_tokens?: number;
  temperature?: number;
}

/**
 * Response from Llama Vision API
 */
export interface LlamaVisionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// ============================================================================
// Privacy Analysis Result
// ============================================================================

/**
 * Result from privacy filter analysis.
 * Used to detect and redact potentially identifying information.
 */
export interface PrivacyFilterResult {
  /** Whether the content passes privacy checks */
  isClean: boolean;

  /** Detected violations (if any) */
  violations: Array<{
    type: "identity" | "license-plate" | "specific-person" | "agency" | "other";
    description: string;
  }>;

  /** Cleaned/redacted version of the content (if violations found) */
  cleanedContent?: string;
}

/**
 * Keywords and patterns that should trigger privacy filters.
 * These indicate overly-specific analysis that violates privacy constraints.
 */
export const PRIVACY_VIOLATION_PATTERNS = {
  // Specific identity markers
  identity: [
    /\b(name|named|called|identified as)\b/i,
    /\b(face|facial recognition|person identified)\b/i,
    /\b(individual|specific person)\b/i,
  ],

  // License plate patterns
  licensePlate: [
    /\b[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{3,4}\b/,
    /\b(license plate|plate number|vehicle registration)\b/i,
  ],

  // Specific person descriptions
  specificPerson: [
    /\b(wearing|dressed in|person with|individual with)\b/i,
    /\b(age \d+|years old|height|weight)\b/i,
    /\b(ethnicity|race|skin color|hair color)\b/i,
  ],

  // Law enforcement / agency specifics
  agency: [
    /\b(officer|badge|unit number|department|precinct)\b/i,
    /\b(patrol car #|vehicle #)\b/i,
  ],
};
