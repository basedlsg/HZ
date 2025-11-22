# Deploy to Vercel - Quick Guide

## Option 1: Deploy via Vercel Dashboard (Easiest - 2 minutes)

**1. Go to Vercel:**
https://vercel.com/new

**2. Import Git Repository:**
- Click "Import Git Repository"
- Select your GitHub repo: `basedlsg/HZ`
- Select branch: `claude/fix-video-layout-01AE8dnZbaHfeRWEQcviLM5o`

**3. Configure Environment Variables:**
Click "Environment Variables" and add:

```
GOOGLE_API_KEY=AIzaSyClKy0uKAiorJbC0GKuuVyXULIJV8dlq38
```

**4. Deploy:**
- Click "Deploy"
- Wait 2-3 minutes for build
- You'll get a URL like: `https://hz-xxxxx.vercel.app`

**5. Test Gemini API:**
Once deployed, upload a video and check the logs for:
```
[AI Analyzer] Calling Google Gemini Vision API...
[AI Analyzer] Received analysis from Gemini API
✅ Successfully analyzed video
```

---

## Option 2: Deploy via Vercel CLI (if you have a token)

**1. Set your Vercel token:**
```bash
export VERCEL_TOKEN=your-vercel-token-here
```

**2. Deploy:**
```bash
cd /home/user/HZ
vercel deploy --prod --token=$VERCEL_TOKEN
```

**3. Set environment variable after deployment:**
```bash
vercel env add GOOGLE_API_KEY production
# When prompted, enter: AIzaSyClKy0uKAiorJbC0GKuuVyXULIJV8dlq38
```

---

## Option 3: Get Vercel Token and Deploy from Here

**1. Get a Vercel token:**
- Go to: https://vercel.com/account/tokens
- Click "Create Token"
- Copy the token

**2. Provide the token to me:**
Just paste the token in chat, and I'll deploy immediately.

---

## Important: FFmpeg Limitation on Vercel

⚠️ **Vercel's serverless functions don't include ffmpeg by default.**

This means the AI analysis will fail at the frame extraction step. To fix this:

### Solution A: Use Vercel with FFmpeg Layer
Add this to `package.json`:
```json
{
  "dependencies": {
    "@ffmpeg/ffmpeg": "^0.12.0",
    "@ffmpeg/core": "^0.12.0"
  }
}
```

### Solution B: Use a Different Platform
Deploy to a platform that includes ffmpeg:
- **Railway** - Has ffmpeg pre-installed
- **Fly.io** - Supports custom Docker with ffmpeg
- **AWS Lambda** with ffmpeg layer
- **Your own VPS** - Full control

### Solution C: Disable AI Analysis Temporarily
Just test the main app functionality first, then worry about AI later.

---

## Quick Test After Deployment

**1. Visit your deployed URL**

**2. Upload a test video**

**3. Check browser console logs** (F12 → Console)

**4. Check Vercel function logs:**
- Go to your Vercel dashboard
- Click on your deployment
- Go to "Functions" tab
- Click on the function that ran
- Look for logs about Gemini API

**Expected Success:**
```
[AI Analyzer] Starting analysis for video: video-abc123
[Frame Extractor] Downloading video...
[AI Analyzer] Calling Google Gemini Vision API...
✅ [AI Analyzer] Received analysis from Gemini API
✅ Successfully analyzed video video-abc123
```

**Expected Error (if ffmpeg missing):**
```
[Frame Extractor] Error: ffmpeg not found
[AI Analyzer] Failed to analyze video: Command failed: ffmpeg
```

---

## Recommended: Just Test API Connection First

If you want to verify the Gemini API works without deploying the full app, I can create a minimal test endpoint that doesn't need ffmpeg.

Would you like me to:
1. Create a simple `/api/test-gemini` endpoint that tests the API with a hardcoded image?
2. This would verify the API key works in production without needing video uploads

Let me know which option you prefer!
