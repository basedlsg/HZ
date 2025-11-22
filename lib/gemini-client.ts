/**
 * Google Gemini Vision API client for video frame analysis.
 * Includes retry logic, error handling, and privacy-constrained prompts.
 */

import { AIVideoMetadata } from './ai-metadata';

/**
 * Gemini API configuration
 */
interface GeminiConfig {
  apiKey: string;
  model: string;
  endpoint: string;
  timeoutMs: number;
  maxRetries: number;
  retryBackoffMs: number;
}

const DEFAULT_GEMINI_CONFIG: GeminiConfig = {
  apiKey: process.env.GOOGLE_API_KEY || '',
  model: 'gemini-1.5-flash',
  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
  timeoutMs: 30000,
  maxRetries: 3,
  retryBackoffMs: 1000,
};

/**
 * Gemini API request/response types
 */
interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

interface GeminiRequest {
  contents: {
    parts: GeminiPart[];
  }[];
  generationConfig?: {
    temperature?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates?: {
    content: {
      parts: {
        text: string;
      }[];
    };
    finishReason?: string;
  }[];
  error?: {
    code: number;
    message: string;
    status: string;
  };
}

/**
 * Privacy-constrained system prompt for Gemini Vision API.
 * Explicitly instructs the model to avoid identifying information.
 */
const PRIVACY_INSTRUCTIONS = `You are analyzing a short video clip from an anonymous event reporting system.
Your task is to provide a brief, factual scene description following strict privacy rules.

CRITICAL PRIVACY RULES:
- NEVER describe specific individuals, faces, or identifiable people
- NEVER mention license plates, vehicle IDs, or registration numbers
- NEVER describe specific clothing, accessories, or personal items
- NEVER mention badge numbers, agency identifiers, or unit numbers
- NEVER include age, ethnicity, height, or physical characteristics
- NEVER track individuals across frames

WHAT TO INCLUDE:
- Scene type (e.g., urban street, park, intersection)
- Approximate counts using ONLY these ranges: "0", "1-3", "4-10", "10-20", "20+"
- Time of day (daytime, nighttime, dawn, dusk)
- Weather conditions (clear, cloudy, rainy, foggy)
- Activity level (low, medium, high)
- General movement patterns (stationary, pedestrian-traffic, vehicle-traffic)

OUTPUT FORMAT:
Return ONLY valid JSON with this exact structure:
{
  "summary": "1-2 sentence factual description",
  "tags": ["tag1", "tag2", "tag3"],
  "counts": {
    "people": "1-3",
    "vehicles": "0"
  },
  "activityLevel": "low",
  "confidence": 0.85
}

Remember: This is for aggregate situational awareness, not individual tracking.
Be factual, neutral, and privacy-preserving.`;

/**
 * Call Gemini Vision API with base64-encoded frames.
 *
 * @param frames - Array of base64-encoded JPEG frames (data:image/jpeg;base64,...)
 * @returns Parsed AI metadata from API response
 * @throws Error if API call fails after retries
 */
export async function analyzeFramesWithGemini(
  frames: string[]
): Promise<Omit<AIVideoMetadata, 'videoId' | 'analyzedAt' | 'modelVersion'>> {
  const config = DEFAULT_GEMINI_CONFIG;

  // Build Gemini request parts
  const parts: GeminiPart[] = [
    {
      text: PRIVACY_INSTRUCTIONS,
    },
    {
      text: 'Analyze these frames from a video event:',
    },
  ];

  // Add each frame as inline data
  for (const frame of frames) {
    // Extract base64 data from data URL
    const base64Data = frame.replace(/^data:image\/[a-z]+;base64,/, '');
    parts.push({
      inlineData: {
        mimeType: 'image/jpeg',
        data: base64Data,
      },
    });
  }

  const request: GeminiRequest = {
    contents: [
      {
        parts,
      },
    ],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 500,
    },
  };

  // Attempt API call with retry logic
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      const response = await callGeminiAPI(request, config.timeoutMs);
      const parsed = parseGeminiResponse(response);
      return parsed;
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      if (!isRetryableError(error)) {
        throw error;
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffMs = config.retryBackoffMs * Math.pow(2, attempt);
      console.warn(
        `Gemini API call failed (attempt ${attempt + 1}/${config.maxRetries}), retrying in ${backoffMs}ms:`,
        error
      );

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  // All retries exhausted
  throw new Error(
    `Gemini API call failed after ${config.maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Make HTTP request to Gemini Vision API.
 *
 * @param request - Gemini request payload
 * @param timeoutMs - Request timeout in milliseconds
 * @returns API response
 */
async function callGeminiAPI(
  request: GeminiRequest,
  timeoutMs: number
): Promise<GeminiResponse> {
  const config = DEFAULT_GEMINI_CONFIG;

  if (!config.apiKey) {
    throw new Error(
      'GOOGLE_API_KEY environment variable is not set. ' +
        'Please set it in .env.local or enable the API at: ' +
        'https://console.cloud.google.com/apis/library'
    );
  }

  // Build full endpoint URL with API key
  const url = `${config.endpoint}/${config.model}:generateContent?key=${config.apiKey}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log('[Gemini Client] Calling Google Gemini Vision API...');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    // Check for API errors in response
    if (data.error) {
      // Check if it's an API enablement error
      if (
        data.error.status === 'PERMISSION_DENIED' ||
        data.error.message?.includes('API has not been used') ||
        data.error.message?.includes('is disabled')
      ) {
        throw new Error(
          `Google API not enabled: ${data.error.message}\n\n` +
            'To enable the API:\n' +
            '1. Visit: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com\n' +
            '2. Click "Enable API"\n' +
            '3. Retry your request'
        );
      }

      throw new Error(
        `Gemini API error (${data.error.code || response.status}): ${data.error.message || data.error.status}`
      );
    }

    if (!response.ok) {
      throw new Error(
        `Gemini API HTTP error (${response.status}): ${JSON.stringify(data)}`
      );
    }

    return data as GeminiResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Parse Gemini API response into AI metadata.
 *
 * @param response - Raw API response
 * @returns Parsed AI metadata
 * @throws Error if response format is invalid
 */
function parseGeminiResponse(
  response: GeminiResponse
): Omit<AIVideoMetadata, 'videoId' | 'analyzedAt' | 'modelVersion'> {
  if (!response.candidates || response.candidates.length === 0) {
    throw new Error('Invalid Gemini API response: no candidates returned');
  }

  const candidate = response.candidates[0];
  if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
    throw new Error('Invalid Gemini API response: no content parts');
  }

  const content = candidate.content.parts[0].text;

  // Parse JSON from content
  let parsed: any;
  try {
    // Remove markdown code blocks if present
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Failed to parse JSON from Gemini response: ${error}\nContent: ${content}`);
  }

  // Validate required fields
  if (
    !parsed.summary ||
    !parsed.tags ||
    !parsed.counts ||
    !parsed.activityLevel ||
    typeof parsed.confidence !== 'number'
  ) {
    throw new Error(
      'Invalid Gemini response structure: missing required fields\n' +
        `Received: ${JSON.stringify(parsed)}`
    );
  }

  return {
    summary: parsed.summary,
    tags: parsed.tags,
    counts: {
      people: parsed.counts.people || '0',
      vehicles: parsed.counts.vehicles || '0',
    },
    activityLevel: parsed.activityLevel,
    confidence: parsed.confidence,
  };
}

/**
 * Check if an error is retryable (network/timeout errors).
 *
 * @param error - Error to check
 * @returns true if error should be retried
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    // Don't retry permission/auth errors
    if (error.message.includes('PERMISSION_DENIED')) return false;
    if (error.message.includes('API not enabled')) return false;
    if (error.message.includes('Invalid API key')) return false;
    if (error.message.includes('401')) return false;
    if (error.message.includes('403')) return false;

    // Network errors, timeouts
    if (error.name === 'AbortError') return true;
    if (error.message.includes('timeout')) return true;
    if (error.message.includes('network')) return true;
    if (error.message.includes('ECONNREFUSED')) return true;

    // 5xx server errors
    if (error.message.includes('500')) return true;
    if (error.message.includes('502')) return true;
    if (error.message.includes('503')) return true;

    // Rate limiting (429) - retry with backoff
    if (error.message.includes('429')) return true;
  }

  return false;
}
