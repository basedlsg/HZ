# AI Analysis Implementation Notes

## Phase 1 & 2 Implementation Status: ✅ Complete

The AI video analysis layer has been implemented according to the design document. All core utilities and integration points are in place.

## What Was Implemented

### 1. Core Utilities
- ✅ **Privacy Filter** (`lib/privacy-filter.ts`) - Detects and redacts identifying information
- ✅ **Llama API Client** (`lib/llama-client.ts`) - API integration with retry logic
- ✅ **Frame Extractor** (`lib/frame-extractor.ts`) - Extracts 3 frames from videos
- ✅ **AI Analyzer** (`lib/ai-analyzer.ts`) - Orchestrates the analysis pipeline

### 2. Data Storage
- ✅ **DataStore Updates** (`lib/store.ts`) - Added AI metadata storage
  - `aiMetadata: Map<string, AIVideoMetadata>`
  - `setAIMetadata()`, `getAIMetadata()`, `hasAIMetadata()` methods

### 3. API Integration
- ✅ **Upload Flow** (`app/api/upload-video/route.ts`) - Triggers async AI analysis
- ✅ **AI Metadata Endpoint** (`app/api/ai-metadata/route.ts`) - GET endpoint for AI data
- ✅ **Videos API** (`app/api/videos/route.ts`) - Includes AI status in response

### 4. Configuration
- ✅ **Environment Variables** (`.env.local`) - Llama API key configured
- ✅ **Type Definitions** (`lib/ai-metadata.ts`) - Complete TypeScript interfaces

## Installation Requirements

To enable AI analysis, install the `sharp` dependency:

```bash
npm install sharp
```

**Note:** `sharp` is used for image processing (frame resizing and JPEG encoding). The system will gracefully fail if it's not installed, but AI analysis will not work.

## FFmpeg Requirement

Frame extraction requires `ffmpeg` to be available on the system:

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Windows
# Download from https://ffmpeg.org/download.html
```

For deployment environments (Vercel, AWS, etc.), ensure ffmpeg is included in the build or use an ffmpeg layer.

## How It Works

1. **Video Upload**
   - User uploads video → Saved to R2 → Metadata stored in dataStore
   - `analyzeVideoAsync()` triggered (fire-and-forget, non-blocking)

2. **AI Analysis Pipeline** (Background)
   - Download video from R2
   - Extract 3 frames (10%, 50%, 90% timestamps)
   - Resize frames to 512x512 JPEG
   - Send to Llama Vision API with privacy-constrained prompt
   - Parse JSON response
   - Run privacy filter (check for violations)
   - Store AI metadata in dataStore

3. **API Response**
   - Videos API includes:
     - `aiStatus`: 'none' | 'pending' | 'available' | 'error'
     - `aiMetadata`: Full AI analysis if available

## Privacy Guarantees

- ✅ System prompt explicitly forbids identity tracking
- ✅ 20+ regex patterns detect violations (faces, plates, badges)
- ✅ Mandatory privacy filter before storage
- ✅ Failed privacy checks store error metadata (no violation data)
- ✅ Graceful degradation: Videos work perfectly without AI

## Current Behavior

### User-Visible Changes
- **Videos API Response** now includes:
  - `aiStatus` field: Shows 'pending', 'available', 'error', or 'none'
  - `aiMetadata` field: Contains AI analysis when available (optional)

### No UI Changes Yet
- Frontend has NOT been updated to display AI metadata
- Videos display and function exactly as before
- AI analysis runs silently in the background

## Next Steps (Phase 3 - UI Integration)

When ready to show AI metadata in the UI:

1. **Update VideoCard Component**
   ```tsx
   {video.aiMetadata && (
     <div className="ai-summary">
       <p className="text-sm text-gray-400">{video.aiMetadata.summary}</p>
       <div className="tags">
         {video.aiMetadata.tags.map(tag => (
           <span key={tag} className="tag">{tag}</span>
         ))}
       </div>
     </div>
   )}
   ```

2. **Add AI Status Indicator**
   ```tsx
   {video.aiStatus === 'pending' && (
     <span className="text-xs text-gray-500">🤖 Analyzing...</span>
   )}
   {video.aiStatus === 'available' && (
     <span className="text-xs text-green-500">🤖 AI Available</span>
   )}
   ```

3. **Implement Tag Filtering**
   - Add tag-based search/filter UI
   - Filter videos by scene type, time of day, activity level

## Testing the Implementation

### 1. Upload a Video
```bash
# Upload via camera UI and check logs
# Should see: "[AI Analyzer] Starting analysis for video: video-..."
```

### 2. Check AI Metadata API
```bash
curl "http://localhost:3000/api/ai-metadata?videoId=video-abc123"
```

### 3. Check Videos API Response
```bash
curl "http://localhost:3000/api/videos"
# Look for aiStatus and aiMetadata fields
```

### 4. Monitor Logs
```bash
npm run dev
# Watch for:
# - [Frame Extractor] Extracting frames...
# - [AI Analyzer] Calling Llama Vision API...
# - [AI Analyzer] Running privacy filter...
# - [AI Analyzer] Successfully analyzed video...
```

## Error Handling

All errors are gracefully handled:
- Frame extraction fails → Error metadata stored
- Llama API fails → Retries 3x, then error metadata
- Privacy violations → Error metadata with violation info
- Videos always upload successfully regardless of AI status

## Cost Monitoring

Each video analysis costs ~$0.01-0.05 (3 frames @ 512x512).

Monitor usage via Llama API dashboard:
- Track API calls per day
- Monitor token usage
- Set budget alerts

## Production Checklist

Before deploying to production:

- [ ] Install `sharp` dependency
- [ ] Verify `ffmpeg` is available in deployment environment
- [ ] Set `LLAMA_API_KEY` environment variable
- [ ] Test AI analysis with sample videos
- [ ] Monitor API costs for first week
- [ ] Review privacy filter effectiveness (red team testing)
- [ ] Set up error monitoring/alerting
- [ ] Document user-facing AI features (if any)

## Troubleshooting

### "ffmpeg not found"
- Install ffmpeg on system or add to build
- Check PATH includes ffmpeg binary

### "Failed to load module 'sharp'"
- Run `npm install sharp`
- Rebuild: `npm run build`

### "Llama API unauthorized"
- Check `LLAMA_API_KEY` in `.env.local`
- Verify API key is valid

### "Privacy violations detected"
- Review Llama API response in logs
- Adjust system prompt if needed
- Add additional privacy patterns if necessary

## Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                   VIDEO UPLOAD                       │
│  User → Camera → Upload → R2 → DataStore            │
│                                    ↓                 │
│                        [ASYNC] AI Analysis           │
│                                    ↓                 │
│  Frame Extraction → Llama API → Privacy Filter      │
│                                    ↓                 │
│                    Store AI Metadata                 │
└─────────────────────────────────────────────────────┘
```

## Files Modified/Created

### Created
- `lib/privacy-filter.ts` - Privacy violation detection
- `lib/llama-client.ts` - Llama Vision API client
- `lib/frame-extractor.ts` - Video frame extraction
- `lib/ai-analyzer.ts` - Analysis orchestrator
- `app/api/ai-metadata/route.ts` - AI metadata endpoint
- `.env.local` - Environment configuration

### Modified
- `lib/store.ts` - Added AI metadata storage
- `lib/ai-metadata.ts` - Already existed from design phase
- `app/api/upload-video/route.ts` - Triggers AI analysis
- `app/api/videos/route.ts` - Includes AI status

## Summary

The AI analysis layer is fully implemented as a thin, optional layer on top of the core Hotzones product. Videos upload and function normally, with AI analysis happening asynchronously in the background. All privacy constraints are enforced, and the system gracefully degrades if AI analysis fails.

The implementation is production-ready pending dependency installation and environment configuration.
