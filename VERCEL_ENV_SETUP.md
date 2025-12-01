# Vercel Environment Variables Setup

Your app has been deployed to: **https://hotzones-5d58nzc87-basedlsgs-projects.vercel.app**

## Required Action: Add Environment Variables

Go to: **https://vercel.com/basedlsgs-projects/hotzones-app/settings/environment-variables**

Add the following environment variables (for **Production**, **Preview**, and **Development**):

### Cloudflare R2 Storage
```
R2_ACCESS_KEY_ID=57cb497b6912020e94d09b6cce36357b
R2_SECRET_ACCESS_KEY=72dde665a4a84371009d1ea850385c644d1a7477b6188adf5cb706f5985eef09
R2_BUCKET=hotzones
R2_ENDPOINT=https://e6d72476685366150b6a2c3c5386d771.r2.cloudflarestorage.com
R2_PUBLIC_BASE_URL=https://e6d72476685366150b6a2c3c5386d771.r2.cloudflarestorage.com/hotzones
```

### Google Gemini API
```
GOOGLE_API_KEY=AIzaSyBPaZYUAFWWymRQL31NWMm81N4mMfFNGnw
```

## After Adding Variables

1. Go back to the Deployments page
2. Click "Redeploy" on the latest deployment
3. The app will be fully functional with video upload, AI analysis, and playback

## Testing

Once redeployed, you can:
- Record videos using the `/camera` page
- View uploaded videos with AI analysis on the `/videos` page
- Videos will be stored in your Cloudflare R2 bucket
- AI analysis will use the Gemini API
