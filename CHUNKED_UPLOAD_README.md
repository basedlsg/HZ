# Chunked Multipart Upload Implementation

## Problem Solved
- **Vercel 413 Error**: Vercel serverless functions have a strict 4.5MB request body limit. Large video uploads were failing.
- **R2 CORS Error**: Direct browser-to-R2 uploads were blocked because the bucket CORS settings didn't allow the origin.

## The Solution: Chunked Proxy Upload
I implemented a **Chunked Multipart Upload** system that solves both issues simultaneously:

1. **Client-Side Chunking**: The browser splits the video into **4MB chunks**.
2. **Sequential Upload**: Each chunk is uploaded individually to the Next.js API.
   - Since 4MB < 4.5MB, this **bypasses the Vercel limit**.
3. **Server-Side Proxy**: The Next.js API receives the chunk and forwards it to R2 using AWS SDK.
   - Since the browser talks to Next.js (same origin), there are **no CORS issues**.
   - Since Next.js talks to R2 (backend-to-backend), there are **no CORS issues**.

## API Endpoints Created
1. `POST /api/upload-multipart/init`: Starts the upload session.
2. `POST /api/upload-multipart/part`: Uploads a single 4MB chunk.
3. `POST /api/upload-multipart/complete`: Assembles the file in R2 and runs AI analysis.

## User Experience
- Users see a progress indicator: "Uploading part X/Y..."
- Uploads are robust and reliable.
- AI analysis runs after the full file is assembled.

## Deployment
Changes pushed to `main` branch. Deployed to **ombrixa.com**.
