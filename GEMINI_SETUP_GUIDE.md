# Google Gemini API Setup - Complete Guide

## Current Issue: 403 Forbidden

Your API requests are being blocked with `403 Forbidden` errors. Based on research, here's what's happening:

---

## Understanding the Two Systems

### Google AI Studio (What you likely have)
- **Endpoint:** `https://generativelanguage.googleapis.com`
- **Auth:** Simple API key (AIza...)
- **Where to get it:** https://aistudio.google.com/apikey
- **API to enable:** "Generative Language API"

### Google Cloud / Vertex AI (Different system)
- **Endpoint:** `https://aiplatform.googleapis.com`
- **Auth:** OAuth2 / Service Account
- **Where to configure:** Google Cloud Console
- **Different API entirely**

**Your API key format (`AIzaSy...`) indicates Google AI Studio.**

---

## Why You're Getting 403

Based on extensive research, here are the most common causes:

### 1. API Not Enabled in Correct Project

**The Problem:**
- You have an API key from Project A
- You enabled "Generative Language API" in Project B
- They don't match → 403 Forbidden

**How to Check:**
1. Go to https://console.cloud.google.com/apis/credentials
2. Click on your API key: `AIzaSyD7JLZ7gt4bE5i87zcycGJS2_Nvfv1VNwI`
3. Note the **project name/number** at the top
4. Go to https://console.cloud.google.com/apis/dashboard
5. **Verify you're in the SAME project**
6. Check if "Generative Language API" shows as enabled

### 2. Wrong API Enabled

**The Problem:**
- You might have enabled "Vertex AI API" instead of "Generative Language API"
- Or enabled "Cloud Vision API" by mistake
- These are different APIs

**How to Fix:**
1. Go to: https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
2. **Make sure you're in the same project as your API key**
3. Click "Enable"
4. Wait 5-10 minutes for full propagation

### 3. API Key Created from Wrong Source

**The Problem:**
- API key was created in Google Cloud Console (for Vertex AI)
- But you're trying to use it with Google AI Studio endpoint
- They're incompatible

**How to Fix - Get a NEW API key:**
1. Go to: https://aistudio.google.com/apikey
2. Click "Create API key"
3. Select project (or create new one)
4. Use the NEW key

### 4. API Restrictions (You said this isn't the issue, but double-check)

**How to Verify:**
1. https://console.cloud.google.com/apis/credentials
2. Click your API key
3. Under "Application restrictions": Should say **"None"**
4. Under "API restrictions": Should say **"Don't restrict key"** OR include "Generative Language API"

---

## Step-by-Step Fix

### Option A: Use Google AI Studio (Recommended - Simpler)

**1. Get a NEW API key from Google AI Studio:**
```
https://aistudio.google.com/apikey
```

**2. Click "Create API key"**
- This automatically creates a key that works with generativelanguage.googleapis.com
- No need to manually enable APIs
- It just works™

**3. Update your `.env.local`:**
```bash
GOOGLE_API_KEY=<your-new-key-from-ai-studio>
```

**4. Test:**
```bash
bash scripts/test-gemini-vision.sh
```

### Option B: Fix Current Key in Google Cloud

**1. Identify which project your key belongs to:**
- https://console.cloud.google.com/apis/credentials
- Click on `AIzaSyD7JLZ7gt4bE5i87zcycGJS2_Nvfv1VNwI`
- Note the project name/ID at the top (e.g., "My Project - 123456")

**2. Switch to that EXACT project:**
- Use the project selector at the top of Google Cloud Console
- Make absolutely sure you're in the right project

**3. Enable the Generative Language API IN THAT PROJECT:**
```
https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com
```

**4. Remove any restrictions on the key:**
- Application restrictions: **None**
- API restrictions: **Don't restrict key**

**5. Wait 5-10 minutes** for changes to propagate

**6. Test:**
```bash
bash scripts/test-gemini-vision.sh
```

---

## If Still Getting 403

### Check Billing

Some users report that even with free tier, the project needs billing enabled:

1. https://console.cloud.google.com/billing
2. Make sure the project has a billing account attached
3. Don't worry - Gemini API has free tier (1,500 requests/day)
4. You won't be charged if you stay within free limits

### Check Quota

1. https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
2. Verify quotas are not set to zero
3. Verify you haven't hit daily limits

### Try a Different Model

The `gemini-1.5-flash` model might not be available. Try:

```bash
# Test with gemini-pro instead
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Hello"}]}]}'
```

---

## Alternative: Use OpenAI Vision API Instead

If Google Gemini continues to have issues, we can switch to OpenAI's GPT-4 Vision API:

**Pros:**
- More reliable documentation
- Clearer error messages
- Simpler auth
- Well-tested in production

**Cons:**
- No free tier (but very cheap: ~$0.01/image)
- Requires OpenAI account

Let me know if you want me to implement OpenAI Vision as a backup.

---

## Testing Commands

**After making changes, run:**

```bash
# Quick test
bash scripts/test-gemini-vision.sh

# List available models (this should work if API is enabled)
curl "https://generativelanguage.googleapis.com/v1beta/models?key=${GOOGLE_API_KEY}"

# Test simple generation
curl -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello"}]}]}'
```

---

## Expected Success Output

When it works, you should see:

```json
{
  "candidates": [
    {
      "content": {
        "parts": [
          {
            "text": "Hello! 👋 How can I help you today?\n"
          }
        ],
        "role": "model"
      },
      "finishReason": "STOP",
      "index": 0,
      "safetyRatings": [...]
    }
  ],
  "usageMetadata": {
    "promptTokenCount": 2,
    "candidatesTokenCount": 11,
    "totalTokenCount": 13
  }
}
```

---

## My Recommendation

**Try Option A first** - Get a fresh API key from Google AI Studio:
- https://aistudio.google.com/apikey
- This bypasses all the Google Cloud Console complexity
- It's designed specifically for the generativelanguage.googleapis.com endpoint

If that still doesn't work, we should consider:
1. OpenAI Vision API (proven, reliable)
2. Anthropic Claude with vision (also very good)
3. Azure OpenAI (enterprise-grade)

Let me know which approach you want to take!
