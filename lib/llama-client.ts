/**
 * Llama Vision API client for video frame analysis.
 * Includes retry logic, error handling, and privacy-constrained prompts.
 */

import {
  DEFAULT_LLAMA_CONFIG,
  LlamaVisionRequest,
  LlamaVisionResponse,
  AIVideoMetadata,
} from './ai-metadata';

/**
 * Privacy-constrained system prompt for Llama Vision API.
 * Explicitly instructs the model to avoid identifying information.
 */
const SYSTEM_PROMPT = `You are analyzing a short video clip from an anonymous event reporting system.
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
 * Call Llama Vision API with base64-encoded frames.
 *
 * @param frames - Array of base64-encoded JPEG frames (data:image/jpeg;base64,...)
 * @returns Parsed AI metadata from API response
 * @throws Error if API call fails after retries
 */
export async function analyzFramesWithLlama(
  frames: string[]
): Promise<Omit<AIVideoMetadata, 'videoId' | 'analyzedAt' | 'modelVersion'>> {
  const config = DEFAULT_LLAMA_CONFIG;

  // Build request payload
  const request: LlamaVisionRequest = {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze these frames from a video event:',
          },
          ...frames.map((frame) => ({
            type: 'image_url' as const,
            image_url: {
              url: frame,
            },
          })),
        ],
      },
    ],
    max_tokens: 500,
    temperature: 0.3, // Lower temperature for factual, consistent output
  };

  // Attempt API call with retry logic
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      const response = await callLlamaAPI(request, config.timeoutMs);
      const parsed = parseAPIResponse(response);
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
        `Llama API call failed (attempt ${attempt + 1}/${config.maxRetries}), retrying in ${backoffMs}ms:`,
        error
      );

      await new Promise((resolve) => setTimeout(resolve, backoffMs));
    }
  }

  // All retries exhausted
  throw new Error(
    `Llama API call failed after ${config.maxRetries} attempts: ${lastError?.message}`
  );
}

/**
 * Make HTTP request to Llama Vision API.
 *
 * @param request - Llama Vision request payload
 * @param timeoutMs - Request timeout in milliseconds
 * @returns API response
 */
async function callLlamaAPI(
  request: LlamaVisionRequest,
  timeoutMs: number
): Promise<LlamaVisionResponse> {
  const config = DEFAULT_LLAMA_CONFIG;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Llama API error (${response.status}): ${errorText}`
      );
    }

    const data = await response.json();
    return data as LlamaVisionResponse;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Parse Llama Vision API response into AI metadata.
 *
 * @param response - Raw API response
 * @returns Parsed AI metadata
 * @throws Error if response format is invalid
 */
function parseAPIResponse(
  response: LlamaVisionResponse
): Omit<AIVideoMetadata, 'videoId' | 'analyzedAt' | 'modelVersion'> {
  if (!response.choices || response.choices.length === 0) {
    throw new Error('Invalid Llama API response: no choices returned');
  }

  const content = response.choices[0].message.content;

  // Parse JSON from content
  let parsed: any;
  try {
    // Remove markdown code blocks if present
    const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (error) {
    throw new Error(`Failed to parse JSON from Llama response: ${error}`);
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
      'Invalid Llama response structure: missing required fields'
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
