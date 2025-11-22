# AI Analysis Layer Design for Hotzones

**Status**: Design Phase (Implementation Pending)
**Last Updated**: 2025-11-22
**Version**: 1.0

---

## Table of Contents

1. [Overview and Goals](#overview-and-goals)
2. [Privacy Constraints (CRITICAL)](#privacy-constraints-critical)
3. [Architecture and Data Flow](#architecture-and-data-flow)
4. [Committee Member Contributions](#committee-member-contributions)
5. [AI Metadata Schema](#ai-metadata-schema)
6. [Llama API Integration](#llama-api-integration)
7. [Frame Extraction Pipeline](#frame-extraction-pipeline)
8. [Privacy Filtering System](#privacy-filtering-system)
9. [Storage Strategy](#storage-strategy)
10. [UI Integration Points](#ui-integration-points)
11. [Error Handling and Resilience](#error-handling-and-resilience)
12. [Future Considerations](#future-considerations)

---

## Overview and Goals

### Purpose

The AI Analysis Layer is an **optional, thin metadata layer** that provides automated scene understanding for uploaded videos. It uses Llama Vision API to generate privacy-preserving, aggregate-level descriptions of video content without changing the core Hotzones product.

### Key Principles

1. **Privacy-First**: NO tracking of individuals, faces, license plates, or identifiable information
2. **Thin Layer**: Fully optional - videos work perfectly without AI metadata
3. **Graceful Degradation**: If AI analysis fails, the system continues normally
4. **Factual Only**: Neutral scene descriptions, no interpretation or judgment
5. **Aggregate-Level**: Only population-level observations (counts, activity levels, scene types)

### Goals

- ✅ Provide contextual tags for video search and filtering
- ✅ Generate brief scene summaries for quick scanning
- ✅ Enable aggregate analytics (activity patterns, location types)
- ✅ Maintain strict privacy guarantees
- ❌ NOT attempting to identify individuals
- ❌ NOT tracking specific people, vehicles, or equipment
- ❌ NOT providing detailed surveillance capabilities

---

## Privacy Constraints (CRITICAL)

### What is NEVER Tracked

The following information **MUST NEVER** be included in AI-generated metadata:

#### Prohibited Content
- ❌ Individual identities, names, or descriptors of specific people
- ❌ Facial recognition or face descriptions
- ❌ License plate numbers or vehicle identifiers
- ❌ Specific clothing descriptions that could identify individuals
- ❌ Badge numbers, unit identifiers, or agency-specific markers
- ❌ Physical characteristics of individuals (age, height, ethnicity, etc.)
- ❌ Personal property details (bags, phones, specific items)
- ❌ Any information that could be used to track a specific person across videos

### What IS Acceptable

The following aggregate, anonymized information is acceptable:

#### Allowed Content
- ✅ Scene type (urban, park, street, intersection, plaza)
- ✅ Approximate counts using coarse ranges ("0", "1-3", "4-10", "10-20", "20+")
- ✅ Time of day (daytime, nighttime, dawn, dusk)
- ✅ Weather conditions (clear, cloudy, rainy, foggy)
- ✅ Activity level (low, medium, high)
- ✅ General movement patterns (stationary, pedestrian-traffic, vehicle-traffic)
- ✅ Location characteristics (crowded, sparse, commercial, residential)
- ✅ Environmental features (trees, buildings, water visible)

### Privacy Validation Strategy

Every AI response goes through a **mandatory privacy filter** before being stored:

1. **Pattern Matching**: Check for prohibited keywords and patterns
2. **Specificity Detection**: Flag overly-detailed descriptions
3. **Redaction**: Remove or generalize suspicious content
4. **Rejection**: Discard entire analysis if it cannot be cleaned

See [Privacy Filtering System](#privacy-filtering-system) for implementation details.

---

## Architecture and Data Flow

### High-Level Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                     VIDEO UPLOAD FLOW                                │
└─────────────────────────────────────────────────────────────────────┘

1. User uploads video → POST /api/upload-video
   ↓
2. Video saved to Cloudflare R2
   ↓
3. Metadata stored in dataStore (in-memory)
   ↓
4. Return success to client
   ↓
5. [ASYNC] Trigger AI analysis in background
   ↓
   ┌─────────────────────────────────────────────────┐
   │         AI ANALYSIS PIPELINE                     │
   ├─────────────────────────────────────────────────┤
   │ a) Fetch video from R2                          │
   │ b) Extract 3 frames (first, middle, last)       │
   │ c) Resize frames to 512x512                     │
   │ d) Encode frames as base64                      │
   │ e) Send to Llama Vision API with prompt         │
   │ f) Parse JSON response                          │
   │ g) Run privacy filter on response               │
   │ h) Store AI metadata (separate from video)      │
   │ i) Log any errors (don't fail video upload)     │
   └─────────────────────────────────────────────────┘
   ↓
6. AI metadata available for queries (optional)
```

### Component Interaction Diagram

```
┌──────────────┐
│   Client     │
│  (Browser)   │
└──────┬───────┘
       │
       │ POST /api/upload-video
       ↓
┌──────────────────────────┐
│  Upload Video Route      │
│  /api/upload-video       │
├──────────────────────────┤
│ - Validate form data     │
│ - Upload to R2           │
│ - Store in dataStore     │
│ - Queue AI job (async)   │
└──────┬───────────────────┘
       │
       ├─────────────────────────┐
       ↓                         ↓
┌──────────────┐         ┌──────────────────┐
│  Cloudflare  │         │   Data Store     │
│      R2      │         │  (in-memory)     │
│   Storage    │         │                  │
│              │         │ - VideoUpload    │
│ - .webm file │         │ - AIMetadata     │
└──────────────┘         └──────────────────┘
       ↑
       │ Fetch video for analysis
       │
┌──────────────────────────┐
│  AI Analysis Worker      │
│  (Background/Async)      │
├──────────────────────────┤
│ 1. Frame Extractor       │────┐
│ 2. Llama API Client      │    │
│ 3. Privacy Filter        │    │
│ 4. Metadata Persister    │    │
└──────┬───────────────────┘    │
       │                        │
       ↓                        │
┌──────────────────────────┐    │
│   Llama Vision API       │    │
│   (External Service)     │    │
│                          │    │
│ - Scene analysis         │    │
│ - Returns JSON           │    │
└──────────────────────────┘    │
                                │
                                ↓
                    ┌───────────────────────┐
                    │  Frame Extraction     │
                    │  Utility              │
                    ├───────────────────────┤
                    │ - FFmpeg (optional)   │
                    │ - Canvas API (Node)   │
                    │ - Sharp (image proc)  │
                    └───────────────────────┘
```

---

## Committee Member Contributions

### 1. API Integration Engineer

**Name**: Alex Chen
**Responsibility**: Llama API integration, error handling, rate limiting

#### Key Decisions

**When to Call the API**
- ✅ **After upload completes** (asynchronous, non-blocking)
- Triggered at the end of `POST /api/upload-video`
- Uses background job queue to avoid blocking upload response
- Videos are immediately available; AI metadata populates later

**What to Send**
- 3 frames extracted from video (first, middle, last)
- Resized to 512x512 to reduce API payload size
- Base64-encoded JPEG format
- Structured prompt with privacy constraints

**Model/Endpoint**
- **Model**: `llama-3.2-90b-vision-instruct`
- **Endpoint**: `https://api.llama-api.com/chat/completions`
- **API Key**: Stored in environment variable `LLAMA_API_KEY`
- Chat completion format with vision input

**Error Handling**
- Network errors: Retry with exponential backoff (1s, 2s, 4s)
- API errors (4xx): Log and skip (don't retry)
- Timeout: 30-second timeout per request
- Parse errors: Log and mark as failed analysis
- **Critical**: Never fail video upload if AI analysis fails

**Rate Limiting and Retry Logic**
```typescript
// Exponential backoff configuration
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 1000; // Start with 1 second
const MAX_BACKOFF_MS = 10000; // Cap at 10 seconds

// Retry only on network/timeout errors (5xx, timeouts)
// Don't retry on 4xx (bad request, auth error)
```

**Cost Optimization**
- Only analyze first 3 frames (not full video)
- Downscale frames to minimize token usage
- Consider batching if API supports multiple images per request
- Monitor API usage and set daily/monthly caps

---

### 2. Video/Frame Pipeline Engineer

**Name**: Jordan Martinez
**Responsibility**: Frame extraction, video processing, encoding

#### Key Decisions

**How Many Frames**
- **3 frames** per video
- Rationale: Balances cost (API tokens) with coverage (captures scene changes)
- More frames = higher cost with diminishing returns for short event clips

**Frame Selection Strategy**
- **First-Middle-Last approach**
  - Frame 1: 10% into video (skip black lead-in)
  - Frame 2: 50% into video (middle)
  - Frame 3: 90% into video (skip black tail)
- Alternative: Evenly spaced (25%, 50%, 75%)
- Future: Key frame detection if needed

**Resolution and Downscaling**
- Target: **512x512 pixels**
- Maintains aspect ratio with letterboxing if needed
- Original .webm videos are typically 720p or 1080p
- Downscaling reduces:
  - API payload size (base64 encoding)
  - Token consumption
  - Processing time

**Format for API Submission**
- **JPEG format** (better compression than PNG)
- **Base64 encoding** for direct inclusion in JSON
- Format: `data:image/jpeg;base64,/9j/4AAQ...`
- Quality: 85% (balance size vs. clarity)

**Processing Location**
- ✅ **Server-side** processing
- After video is uploaded to R2
- Uses Node.js libraries (Sharp, ffmpeg-static)
- Client never handles frame extraction

#### Frame Extraction Implementation

```typescript
// Pseudo-code for frame extraction
async function extractFrames(videoUrl: string): Promise<string[]> {
  // 1. Download video from R2 to temporary buffer
  const videoBuffer = await fetchFromR2(videoUrl);

  // 2. Get video metadata (duration)
  const metadata = await getVideoMetadata(videoBuffer);
  const duration = metadata.duration;

  // 3. Calculate timestamp positions (10%, 50%, 90%)
  const timestamps = [
    duration * 0.10,
    duration * 0.50,
    duration * 0.90
  ];

  // 4. Extract frames at each timestamp
  const frames = await Promise.all(
    timestamps.map(ts => extractFrameAtTime(videoBuffer, ts))
  );

  // 5. Resize to 512x512 with letterboxing
  const resizedFrames = await Promise.all(
    frames.map(frame => resizeImage(frame, 512, 512))
  );

  // 6. Encode as base64 JPEG
  const base64Frames = resizedFrames.map(frame =>
    `data:image/jpeg;base64,${frame.toString('base64')}`
  );

  return base64Frames;
}
```

**Technology Stack**
- **Sharp**: Image resizing and format conversion
- **ffmpeg-static**: Frame extraction from .webm
- **fluent-ffmpeg**: Wrapper for ffmpeg commands
- Alternative: Canvas API (pure Node, no dependencies)

---

### 3. Data/Schema Designer

**Name**: Taylor Kim
**Responsibility**: AI metadata schema, data modeling, type definitions

#### Key Decisions

**Schema Structure**

The AI metadata is a **separate, optional object** linked to VideoUpload by `videoId`.

```typescript
interface AIVideoMetadata {
  videoId: string;
  summary: string;
  tags: string[];
  counts: {
    people: CountRange;
    vehicles: CountRange;
  };
  activityLevel: ActivityLevel;
  confidence: number;
  analyzedAt: number;
  modelVersion: string;
  error?: {
    code: string;
    message: string;
  };
}
```

**Field Specifications**

| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `videoId` | string | Links to VideoUpload.id | `"video-abc123"` |
| `summary` | string | 1-2 sentence description | `"Urban intersection with moderate vehicle traffic. Daytime with clear weather."` |
| `tags` | string[] | Flat array of descriptors | `["urban", "daytime", "clear", "intersection", "vehicle-traffic"]` |
| `counts.people` | CountRange | Approximate people count | `"4-10"` |
| `counts.vehicles` | CountRange | Approximate vehicle count | `"1-3"` |
| `activityLevel` | ActivityLevel | Overall activity | `"medium"` |
| `confidence` | number | Model confidence (0-1) | `0.87` |
| `analyzedAt` | number | Timestamp (Unix ms) | `1700000000000` |
| `modelVersion` | string | Llama model used | `"llama-3.2-90b-vision"` |
| `error` | object? | Optional error info | `{ code: "timeout", message: "..." }` |

**Tag Taxonomy**

Tags are grouped into categories but stored as a flat array:

**Location Types**
- `urban`, `suburban`, `rural`
- `street`, `intersection`, `plaza`, `park`, `parking-lot`
- `commercial`, `residential`, `industrial`

**Time of Day**
- `daytime`, `nighttime`, `dawn`, `dusk`

**Weather**
- `clear`, `cloudy`, `overcast`, `rainy`, `foggy`, `snowy`

**Activity Patterns**
- `pedestrian-traffic`, `vehicle-traffic`, `stationary`
- `crowded`, `sparse`, `empty`
- `event`, `gathering`, `dispersed`

**Environmental**
- `trees-visible`, `buildings-visible`, `water-visible`
- `indoor`, `outdoor`

**Count Ranges**

Privacy-preserving count ranges (never exact counts):

```typescript
type CountRange = "0" | "1-3" | "4-10" | "10-20" | "20+";
```

**Activity Levels**

```typescript
type ActivityLevel = "low" | "medium" | "high";
```

- **low**: Minimal movement, few or no entities, quiet scene
- **medium**: Moderate activity, some movement, typical traffic
- **high**: Significant activity, many moving entities, busy scene

**Integration with Existing Types**

The schema extends the existing type system in `lib/types.ts`:

```typescript
// lib/types.ts (existing)
export interface VideoUpload {
  id: string;
  sessionId: string;
  timestamp: number;
  duration: number;
  size: number;
  filename: string;
  cloudUrl?: string;
  location?: GeoLocation;
  zoneId?: string;
}

// lib/ai-metadata.ts (new)
export interface AIVideoMetadata {
  videoId: string; // References VideoUpload.id
  // ... rest of fields
}
```

**Storage Relationship**

```typescript
// In DataStore (lib/store.ts)
class DataStore {
  private videos: Map<string, VideoUpload>;
  private aiMetadata: Map<string, AIVideoMetadata>; // NEW

  getVideoWithAI(id: string): VideoUpload & { ai?: AIVideoMetadata } {
    const video = this.videos.get(id);
    const ai = this.aiMetadata.get(id);
    return { ...video, ai };
  }
}
```

---

### 4. Privacy & Product Designer

**Name**: Morgan Reeves
**Responsibility**: Privacy constraints, prompt engineering, product integrity

#### Key Decisions

**Privacy Philosophy**

The AI layer is **metadata enrichment**, not surveillance. Every decision must reinforce:
1. Anonymity of individuals
2. Aggregate-only observations
3. Factual, neutral descriptions
4. User trust and safety

**Prompt Engineering for Privacy**

The system prompt sent to Llama Vision API must explicitly constrain the model:

```
System Prompt (sent with every request):

You are analyzing a short video clip from an anonymous event reporting system.
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
Be factual, neutral, and privacy-preserving.
```

**What to Do If API Returns Inappropriate Content**

If the privacy filter detects violations:

1. **Log the violation** (for monitoring)
2. **Attempt redaction** (remove problematic phrases)
3. **If uncleanable**: Discard entire analysis
4. **Never store** content that fails privacy check
5. **Mark video** with error: `{ error: { code: "privacy-violation", message: "..." } }`

Example violations:
- ❌ "A man wearing a red jacket..."
- ❌ "License plate ABC-1234 visible"
- ❌ "Officer with badge #5423"
- ❌ "Individual appears to be approximately 30 years old"

**Keeping This a Thin Layer**

**What Does NOT Change**:
- Video upload flow (still works without AI)
- Video playback (no dependency on AI metadata)
- Reactions, comments, votes (unchanged)
- Map visualization (AI is optional enrichment)

**What IS Enhanced**:
- Video search (filter by tags: "daytime", "urban", etc.)
- Quick scan (read summary instead of watching)
- Analytics (aggregate activity patterns)
- Future features (trend detection, zone characterization)

**Product Integrity Checklist**

Before shipping, verify:
- [ ] Videos work perfectly with AI analysis disabled
- [ ] Failed AI analysis never blocks video upload
- [ ] No user-facing errors if AI is down
- [ ] Privacy filter catches test violations (red team testing)
- [ ] Documentation clearly states what is/isn't tracked
- [ ] Users can understand what the AI sees (transparency)

**Ethical Considerations**

- **Transparency**: Users should know videos may be analyzed
- **Opt-out**: Consider allowing users to disable AI analysis
- **Data retention**: AI metadata should expire with videos (2-hour TTL)
- **Model bias**: Monitor for biased scene descriptions (e.g., over-flagging certain locations)
- **Mission alignment**: Does this help anonymous reporting, or enable tracking?

**Red Lines (Never Cross)**

Even if technically possible, we will NEVER:
- Build individual tracking across videos
- Create person re-identification features
- Store biometric data (face embeddings, etc.)
- Sell or share AI metadata with third parties
- Use AI to identify "suspicious" individuals
- Enable law enforcement queries on specific people

---

## AI Metadata Schema

### Complete Schema Definition

See **lib/ai-metadata.ts** for the full TypeScript implementation.

### Example JSON Output

```json
{
  "videoId": "video-abc123",
  "summary": "Urban street intersection with moderate vehicle traffic. Daytime with clear weather conditions.",
  "tags": [
    "urban",
    "intersection",
    "daytime",
    "clear",
    "vehicle-traffic",
    "outdoor"
  ],
  "counts": {
    "people": "1-3",
    "vehicles": "4-10"
  },
  "activityLevel": "medium",
  "confidence": 0.87,
  "analyzedAt": 1700000000000,
  "modelVersion": "llama-3.2-90b-vision-instruct"
}
```

### Example with Error

```json
{
  "videoId": "video-xyz789",
  "summary": "",
  "tags": [],
  "counts": {
    "people": "0",
    "vehicles": "0"
  },
  "activityLevel": "low",
  "confidence": 0.0,
  "analyzedAt": 1700000100000,
  "modelVersion": "llama-3.2-90b-vision-instruct",
  "error": {
    "code": "api_timeout",
    "message": "Llama API request timed out after 30s"
  }
}
```

---

## Llama API Integration

### API Configuration

```typescript
const LLAMA_CONFIG = {
  apiKey: process.env.LLAMA_API_KEY,
  endpoint: "https://api.llama-api.com/chat/completions",
  model: "llama-3.2-90b-vision-instruct",
  timeout: 30000, // 30 seconds
  maxRetries: 3,
  retryBackoff: 1000, // Start with 1s
};
```

### Request Format

```typescript
interface LlamaVisionRequest {
  model: string;
  messages: [
    {
      role: "system";
      content: string; // Privacy-constrained system prompt
    },
    {
      role: "user";
      content: [
        { type: "text"; text: "Analyze these frames from a video event:" },
        { type: "image_url"; image_url: { url: "data:image/jpeg;base64,..." } },
        { type: "image_url"; image_url: { url: "data:image/jpeg;base64,..." } },
        { type: "image_url"; image_url: { url: "data:image/jpeg;base64,..." } }
      ];
    }
  ];
  max_tokens: 500;
  temperature: 0.3; // Lower temp for more consistent, factual output
}
```

### Response Format

```typescript
interface LlamaVisionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: [
    {
      index: 0;
      message: {
        role: "assistant";
        content: string; // JSON string to parse
      };
      finish_reason: "stop" | "length" | "content_filter";
    }
  ];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}
```

### Error Handling

**Network Errors (Retry)**
- Connection timeout
- DNS resolution failure
- 500/502/503 server errors

**API Errors (Don't Retry)**
- 400 Bad Request (malformed request)
- 401 Unauthorized (bad API key)
- 429 Rate Limit (wait and retry with backoff)
- 413 Payload Too Large (reduce frame count)

**Parsing Errors**
- Invalid JSON in response
- Missing required fields
- Type mismatches

### Rate Limiting Strategy

```typescript
// Simple in-memory rate limiter
class RateLimiter {
  private requests: number[] = []; // Timestamps
  private maxRequestsPerMinute = 60;

  async checkLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Remove old requests
    this.requests = this.requests.filter(ts => ts > oneMinuteAgo);

    if (this.requests.length >= this.maxRequestsPerMinute) {
      const oldestRequest = this.requests[0];
      const waitTime = 60000 - (now - oldestRequest);
      await sleep(waitTime);
    }

    this.requests.push(now);
  }
}
```

---

## Frame Extraction Pipeline

### Technology Stack

**Option 1: FFmpeg (Recommended)**
```bash
npm install fluent-ffmpeg ffmpeg-static
```

**Option 2: Canvas API (Fallback)**
```bash
npm install canvas
```

### Implementation Approach

```typescript
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import sharp from 'sharp';

ffmpeg.setFfmpegPath(ffmpegStatic);

async function extractFrames(
  videoBuffer: Buffer,
  timestamps: number[]
): Promise<Buffer[]> {
  const frames: Buffer[] = [];

  for (const timestamp of timestamps) {
    const frameBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];

      ffmpeg(Readable.from(videoBuffer))
        .seekInput(timestamp)
        .frames(1)
        .format('image2')
        .outputOptions('-vcodec mjpeg')
        .on('error', reject)
        .pipe()
        .on('data', (chunk) => chunks.push(chunk))
        .on('end', () => resolve(Buffer.concat(chunks)));
    });

    frames.push(frameBuffer);
  }

  return frames;
}

async function resizeFrame(
  frameBuffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(frameBuffer)
    .resize(width, height, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0 }
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}
```

### Frame Selection Algorithm

```typescript
function calculateFrameTimestamps(
  videoDuration: number,
  frameCount: number = 3
): number[] {
  // Strategy: First-Middle-Last with 10% margin
  // Avoids black frames at start/end

  const margin = 0.10; // 10% margin
  const startTime = videoDuration * margin;
  const endTime = videoDuration * (1 - margin);
  const middleTime = videoDuration * 0.5;

  if (frameCount === 3) {
    return [startTime, middleTime, endTime];
  }

  // For other frame counts, evenly space between start and end
  const step = (endTime - startTime) / (frameCount - 1);
  return Array.from({ length: frameCount }, (_, i) => startTime + step * i);
}
```

---

## Privacy Filtering System

### Filter Implementation

```typescript
function checkPrivacyViolations(content: string): PrivacyFilterResult {
  const violations: PrivacyFilterResult['violations'] = [];

  // Check each pattern category
  for (const pattern of PRIVACY_VIOLATION_PATTERNS.identity) {
    if (pattern.test(content)) {
      violations.push({
        type: 'identity',
        description: 'Contains potential identity markers'
      });
    }
  }

  for (const pattern of PRIVACY_VIOLATION_PATTERNS.licensePlate) {
    if (pattern.test(content)) {
      violations.push({
        type: 'license-plate',
        description: 'Contains potential license plate information'
      });
    }
  }

  // ... check other patterns ...

  const isClean = violations.length === 0;

  return {
    isClean,
    violations,
    cleanedContent: isClean ? content : redactContent(content, violations)
  };
}

function redactContent(
  content: string,
  violations: PrivacyFilterResult['violations']
): string {
  let cleaned = content;

  // Attempt to redact specific violations
  // If too many violations, return empty/generic content

  if (violations.length > 3) {
    return "Scene analysis unavailable due to privacy constraints.";
  }

  // Redact specific patterns
  cleaned = cleaned.replace(/\b(wearing|dressed in)\s+[^.]+/gi, '');
  cleaned = cleaned.replace(/\b[A-Z0-9]{2,3}[-\s]?[A-Z0-9]{3,4}\b/g, '[REDACTED]');

  return cleaned;
}
```

### Privacy Validation Workflow

```
AI Response
    ↓
Parse JSON
    ↓
Extract summary + tags
    ↓
Run privacy filter
    ↓
┌─────────────┐
│  Is Clean?  │
└─────┬───────┘
      │
      ├─── YES → Store metadata
      │
      └─── NO → ┌──────────────────┐
                │ Can redact?      │
                └────┬─────────────┘
                     │
                     ├─── YES → Store redacted version
                     │
                     └─── NO → Discard analysis, log error
```

---

## Storage Strategy

### In-Memory Storage (Current MVP)

```typescript
// lib/store.ts
class DataStore {
  private videos: Map<string, VideoUpload> = new Map();
  private aiMetadata: Map<string, AIVideoMetadata> = new Map(); // NEW

  addAIMetadata(metadata: AIVideoMetadata): void {
    this.aiMetadata.set(metadata.videoId, metadata);
  }

  getAIMetadata(videoId: string): AIVideoMetadata | undefined {
    return this.aiMetadata.get(videoId);
  }

  getVideoWithAI(videoId: string): VideoUpload & { ai?: AIVideoMetadata } {
    const video = this.videos.get(videoId);
    const ai = this.aiMetadata.get(videoId);

    if (!video) return undefined;

    return {
      ...video,
      ai: ai || undefined
    };
  }

  getAllVideosWithAI(): Array<VideoUpload & { ai?: AIVideoMetadata }> {
    return this.getAllVideos().map(video => ({
      ...video,
      ai: this.aiMetadata.get(video.id)
    }));
  }
}
```

### Future: Database Storage

When migrating to a persistent database (PostgreSQL, MongoDB, etc.):

**Option 1: Separate Table**
```sql
CREATE TABLE videos (
  id VARCHAR PRIMARY KEY,
  session_id VARCHAR NOT NULL,
  timestamp BIGINT NOT NULL,
  -- ... other video fields
);

CREATE TABLE ai_metadata (
  video_id VARCHAR PRIMARY KEY REFERENCES videos(id),
  summary TEXT,
  tags TEXT[], -- PostgreSQL array
  people_count VARCHAR,
  vehicles_count VARCHAR,
  activity_level VARCHAR,
  confidence DECIMAL,
  analyzed_at BIGINT,
  model_version VARCHAR,
  error_code VARCHAR,
  error_message TEXT
);

CREATE INDEX idx_ai_tags ON ai_metadata USING GIN (tags);
```

**Option 2: Embedded JSON Column**
```sql
CREATE TABLE videos (
  id VARCHAR PRIMARY KEY,
  -- ... video fields ...
  ai_metadata JSONB -- PostgreSQL JSONB type
);

CREATE INDEX idx_ai_tags ON videos USING GIN ((ai_metadata -> 'tags'));
```

**Recommendation**: Separate table for cleaner schema and optional relationship.

---

## UI Integration Points

### 1. Video List Page (Search/Filter)

```typescript
// Example: Filter videos by AI tags
function VideoList() {
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  const filteredVideos = videos.filter(video => {
    if (!video.ai || tagFilter.length === 0) return true;
    return tagFilter.some(tag => video.ai.tags.includes(tag));
  });

  return (
    <div>
      <TagFilter onTagsChange={setTagFilter} />
      {filteredVideos.map(video => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
```

**Possible filters**:
- Time of day (daytime, nighttime)
- Activity level (low, medium, high)
- Scene type (urban, park, etc.)
- People count ranges
- Vehicle count ranges

### 2. Video Card (Quick Summary)

```typescript
function VideoCard({ video }: { video: VideoUpload & { ai?: AIVideoMetadata } }) {
  return (
    <div className="video-card">
      <video src={video.cloudUrl} />

      {video.ai && (
        <div className="ai-summary">
          <p className="summary">{video.ai.summary}</p>
          <div className="tags">
            {video.ai.tags.map(tag => (
              <span key={tag} className="tag">{tag}</span>
            ))}
          </div>
          <div className="stats">
            <span>People: {video.ai.counts.people}</span>
            <span>Vehicles: {video.ai.counts.vehicles}</span>
            <span>Activity: {video.ai.activityLevel}</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3. Map Visualization (Zone Characterization)

```typescript
// Aggregate AI metadata for a zone
function getZoneCharacteristics(zoneId: string): ZoneStats {
  const videos = dataStore.getVideosInZone(zoneId);
  const videosWithAI = videos
    .map(v => ({ ...v, ai: dataStore.getAIMetadata(v.id) }))
    .filter(v => v.ai);

  const tagCounts = new Map<string, number>();
  let totalActivity = 0;

  for (const video of videosWithAI) {
    // Count tag frequencies
    video.ai.tags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
    });

    // Sum activity levels
    const activityValue = { low: 1, medium: 2, high: 3 }[video.ai.activityLevel];
    totalActivity += activityValue;
  }

  // Find most common tags
  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([tag]) => tag);

  const avgActivity = totalActivity / videosWithAI.length;
  const activityLevel = avgActivity < 1.5 ? 'low' : avgActivity < 2.5 ? 'medium' : 'high';

  return {
    videoCount: videos.length,
    analyzedCount: videosWithAI.length,
    topTags,
    activityLevel
  };
}
```

### 4. Analytics Dashboard (Aggregate Trends)

```typescript
// Example: Activity trends over time
function ActivityTrends() {
  const videos = dataStore.getAllVideosWithAI();

  // Group by hour
  const hourlyActivity = videos
    .filter(v => v.ai)
    .reduce((acc, video) => {
      const hour = new Date(video.timestamp).getHours();
      acc[hour] = acc[hour] || [];
      acc[hour].push(video.ai.activityLevel);
      return acc;
    }, {} as Record<number, string[]>);

  // Calculate average activity per hour
  const trendData = Object.entries(hourlyActivity).map(([hour, levels]) => {
    const avgActivity = levels.reduce((sum, level) => {
      return sum + { low: 1, medium: 2, high: 3 }[level];
    }, 0) / levels.length;

    return { hour: parseInt(hour), activity: avgActivity };
  });

  return <LineChart data={trendData} />;
}
```

---

## Error Handling and Resilience

### Error Categories

| Error Type | Retry? | Impact | Action |
|------------|--------|--------|--------|
| Network timeout | Yes (3x) | Delayed metadata | Retry with backoff |
| API 500 error | Yes (3x) | Delayed metadata | Retry with backoff |
| API 4xx error | No | No metadata | Log and skip |
| Parse error | No | No metadata | Log and skip |
| Privacy violation | No | No metadata | Log and discard |
| Frame extraction failure | No | No metadata | Log and skip |

### Graceful Degradation

```typescript
async function analyzeVideo(videoId: string): Promise<void> {
  try {
    // 1. Fetch video
    const video = dataStore.getVideo(videoId);
    if (!video?.cloudUrl) {
      throw new Error('Video not found or missing URL');
    }

    // 2. Extract frames
    const frames = await extractFramesFromVideo(video.cloudUrl);

    // 3. Call Llama API
    const response = await callLlamaAPI(frames);

    // 4. Parse response
    const metadata = parseAIResponse(response);

    // 5. Privacy filter
    const privacyCheck = checkPrivacyViolations(metadata.summary);
    if (!privacyCheck.isClean) {
      throw new PrivacyViolationError('AI response failed privacy check');
    }

    // 6. Store metadata
    dataStore.addAIMetadata(metadata);

  } catch (error) {
    // Log error but DON'T fail video upload
    console.error(`AI analysis failed for video ${videoId}:`, error);

    // Store error metadata
    dataStore.addAIMetadata({
      videoId,
      summary: '',
      tags: [],
      counts: { people: '0', vehicles: '0' },
      activityLevel: 'low',
      confidence: 0,
      analyzedAt: Date.now(),
      modelVersion: LLAMA_CONFIG.model,
      error: {
        code: error.code || 'unknown',
        message: error.message
      }
    });
  }
}
```

### Monitoring and Alerts

**Key Metrics to Track**:
- AI analysis success rate (%)
- Average analysis time (ms)
- API error rates by type (4xx, 5xx, timeout)
- Privacy violation rate (%)
- Token usage per video
- Cost per analyzed video

**Alert Thresholds**:
- Success rate < 80% (investigate API issues)
- Privacy violation rate > 5% (review prompts)
- Average time > 60s (optimize pipeline)
- Daily cost > budget threshold

---

## Future Considerations

### Phase 2 Enhancements

1. **Real-time Analysis**
   - Stream video during upload
   - Analyze first frame immediately for instant tags
   - Progressive enhancement as more frames arrive

2. **Batch Processing**
   - Queue system for analyzing multiple videos
   - Prioritize recent videos over backlog
   - Off-peak batch jobs for cost optimization

3. **Advanced Privacy Features**
   - Automatic face/plate blurring in frames before API
   - On-device pre-filtering (client-side)
   - User-controlled privacy levels

4. **Richer Metadata**
   - Audio analysis (crowd noise, sirens, etc.)
   - Motion vectors (direction of movement)
   - Scene change detection
   - Object relationships (e.g., "vehicles near intersection")

5. **Semantic Search**
   - Natural language queries: "Find daytime videos with high activity"
   - Embedding-based similarity search
   - Cross-video event correlation

### Phase 3: Advanced Analytics

1. **Zone Characterization**
   - Automatic zone labeling based on video patterns
   - "This is a high-traffic intersection" vs. "This is a quiet park"
   - Time-of-day activity profiles per zone

2. **Trend Detection**
   - Activity spikes (e.g., "unusual activity at 2 AM")
   - Pattern changes (e.g., "normally quiet, now busy")
   - Anomaly detection (statistical outliers)

3. **Multi-Video Analysis**
   - Correlate videos from same zone
   - Temporal sequence understanding
   - Event evolution tracking (escalation/de-escalation)

### Database Migration Prep

**When to Migrate**:
- When in-memory storage becomes impractical (>1000 active videos)
- When persistence is required (server restarts lose data)
- When querying/filtering becomes slow

**Migration Checklist**:
- [ ] Choose database (PostgreSQL recommended for JSONB support)
- [ ] Design schema (see [Storage Strategy](#storage-strategy))
- [ ] Create migration scripts for existing data
- [ ] Update DataStore methods to use DB queries
- [ ] Add connection pooling and error handling
- [ ] Set up automatic TTL cleanup (cron job)
- [ ] Index tags and common filters
- [ ] Test with production-like data volume

### Cost Optimization

**Current Estimate** (assuming Llama API pricing):
- 3 frames per video @ 512x512 = ~0.8M pixels
- Base64 encoding = ~1-2 KB per frame
- Llama Vision cost: ~$0.01-0.05 per video (estimate)

**Optimization Strategies**:
- Cache frame extraction results
- Use smaller frames (256x256) if acceptable
- Reduce to 2 frames (first + middle)
- Batch requests if API supports
- Only analyze high-priority videos (e.g., with reactions)
- Set daily budget caps

### Model Updates

**When Llama Releases New Models**:
1. Test new model with sample videos
2. Compare quality vs. current model
3. Update `modelVersion` in config
4. Re-analyze existing videos (optional)
5. Track both models in parallel (A/B test)

**Model Version Tracking**:
- Store `modelVersion` in each metadata record
- Allow filtering by model version
- Compare results across model versions
- Gradually migrate to better models

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Create `lib/ai-metadata.ts` with types
- [ ] Set up Llama API client with retry logic
- [ ] Implement frame extraction pipeline
- [ ] Build privacy filter system
- [ ] Add AI metadata storage to DataStore
- [ ] Write unit tests for each component

### Phase 2: Integration (Week 2-3)
- [ ] Integrate AI analysis into upload flow
- [ ] Add background job queue
- [ ] Test with sample videos
- [ ] Tune prompts for best results
- [ ] Validate privacy filter effectiveness

### Phase 3: UI (Week 3-4)
- [ ] Add AI summary to video cards
- [ ] Implement tag-based filtering
- [ ] Show activity levels on map
- [ ] Build analytics dashboard
- [ ] User documentation

### Phase 4: Production (Week 4+)
- [ ] Load testing with realistic traffic
- [ ] Monitor API costs and performance
- [ ] Set up alerts and monitoring
- [ ] Security audit
- [ ] Privacy red team testing
- [ ] Launch with opt-out option

---

## Appendix

### A. Sample API Request/Response

**Request**:
```json
{
  "model": "llama-3.2-90b-vision-instruct",
  "messages": [
    {
      "role": "system",
      "content": "[Privacy-constrained system prompt - see Prompt Engineering section]"
    },
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Analyze these 3 frames from a video event. Provide scene-level observations following the privacy rules."
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA..."
          }
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA..."
          }
        },
        {
          "type": "image_url",
          "image_url": {
            "url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEA..."
          }
        }
      ]
    }
  ],
  "max_tokens": 500,
  "temperature": 0.3
}
```

**Response**:
```json
{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "llama-3.2-90b-vision-instruct",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"summary\": \"Urban intersection with moderate vehicle traffic. Daytime with clear weather conditions.\", \"tags\": [\"urban\", \"intersection\", \"daytime\", \"clear\", \"vehicle-traffic\", \"outdoor\"], \"counts\": {\"people\": \"1-3\", \"vehicles\": \"4-10\"}, \"activityLevel\": \"medium\", \"confidence\": 0.87}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 1250,
    "completion_tokens": 95,
    "total_tokens": 1345
  }
}
```

### B. Privacy Testing Checklist

Test the privacy filter with these scenarios:

- [ ] AI mentions specific person description → REJECT
- [ ] AI includes license plate → REJECT
- [ ] AI describes clothing in detail → REJECT
- [ ] AI mentions badge numbers → REJECT
- [ ] AI says "approximately 5-7 people" → REDACT to "4-10"
- [ ] AI says "empty street" → ACCEPT
- [ ] AI says "crowded plaza" → ACCEPT
- [ ] AI says "individual wearing red" → REJECT
- [ ] AI says "pedestrian traffic visible" → ACCEPT

### C. Configuration Template

```env
# .env.local

# Llama API Configuration
LLAMA_API_KEY=LLM|1469017110898899|mJOyVVo1xc4vbUj6y1Wj-svovnE
LLAMA_MODEL=llama-3.2-90b-vision-instruct
LLAMA_ENDPOINT=https://api.llama-api.com/chat/completions
LLAMA_TIMEOUT_MS=30000
LLAMA_MAX_RETRIES=3

# Frame Extraction Configuration
FRAME_COUNT=3
FRAME_WIDTH=512
FRAME_HEIGHT=512
FRAME_STRATEGY=first-middle-last

# Feature Flags
AI_ANALYSIS_ENABLED=true
AI_PRIVACY_FILTER_ENABLED=true
AI_DEBUG_MODE=false

# Rate Limiting
AI_MAX_REQUESTS_PER_MINUTE=60
AI_DAILY_BUDGET_USD=50
```

---

## Document Changelog

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-11-22 | Committee | Initial design document |

---

**End of Design Document**
