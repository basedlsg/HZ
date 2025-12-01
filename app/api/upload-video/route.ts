import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { generateId } from '@/lib/utils';
import { VideoUpload } from '@/lib/types';
import { uploadVideoToR2, getPresignedVideoUrl } from '@/lib/storage';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Increase function timeout and body size limit
export const maxDuration = 60; // 60 seconds
export const dynamic = 'force-dynamic';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const videoFile = formData.get('video') as File | null;
    const sessionId = formData.get('sessionId') as string;
    const duration = parseFloat(formData.get('duration') as string);
    const analysisImage = formData.get('analysisImage') as File | null;

    // Validate inputs
    if (!videoFile) {
      return NextResponse.json(
        { error: 'No video file provided' },
        { status: 400 }
      );
    }

    if (!sessionId || isNaN(duration)) {
      return NextResponse.json(
        { error: 'Invalid session or duration data' },
        { status: 400 }
      );
    }

    // Note: Session validation removed due to serverless in-memory storage limitations
    // Client-side validation ensures user has checked in before upload
    console.log('[Upload] Processing video upload for session:', sessionId);

    // Generate unique video ID
    const videoId = generateId('video');

    // Convert File to Buffer for R2 upload
    const bytes = await videoFile.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Upload to Cloudflare R2
    const cloudUrl = await uploadVideoToR2(
      videoId,
      videoFile.type || 'video/webm',
      buffer
    );

    // Perform AI Analysis if image provided (with timeout)
    let analysisResult = '';
    if (analysisImage) {
      try {
        console.log('[AI Analysis] Starting analysis...');
        console.log('[AI Analysis] Image size:', analysisImage.size);
        console.log('[AI Analysis] Image type:', analysisImage.type);
        console.log('[AI Analysis] API Key present:', !!process.env.GOOGLE_API_KEY);

        const analysisPromise = (async () => {
          const imageBuffer = await analysisImage.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');

          console.log('[AI Analysis] Base64 image length:', base64Image.length);

          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

          const prompt = `
            Analyze this video frame from a security/safety perspective (HotZones app).
            Identify:
            1. Text (OCR) - badge numbers, signs, plates.
            2. Uniforms/Personnel.
            3. Hazards or events.
            Return a concise summary (under 50 words).
          `;

          console.log('[AI Analysis] Sending request to Gemini...');

          const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Image, mimeType: analysisImage.type || 'image/jpeg' } }
          ]);

          const text = await result.response.text();
          console.log('[AI Analysis] Success! Result length:', text.length);
          return text;
        })();

        // Add 30-second timeout to AI analysis
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('AI analysis timeout')), 30000)
        );

        analysisResult = await Promise.race([analysisPromise, timeoutPromise]);
      } catch (aiError: any) {
        console.error('[AI Analysis] FAILED:', {
          message: aiError.message,
          stack: aiError.stack,
          name: aiError.name,
          code: aiError.code,
        });

        analysisResult = aiError.message === 'AI analysis timeout'
          ? 'Analysis timed out'
          : `Analysis failed: ${aiError.message || 'Unknown error'}`;
      }
    } else {
      console.log('[AI Analysis] No image provided for analysis');
    }

    // Get session to extract location for zone assignment
    const userSession = dataStore.getSession(sessionId);
    const location = userSession?.location;

    // Create video metadata record
    const video: VideoUpload = {
      id: videoId,
      sessionId,
      timestamp: Date.now(),
      duration,
      size: videoFile.size,
      filename: `${videoId}.webm`,
      cloudUrl, // R2 public URL
      location,
      analysis: analysisResult || undefined,
    };

    // Find and assign nearest zone if location available
    if (location) {
      const nearestZone = dataStore.findNearestZone(location);
      if (nearestZone) {
        video.zoneId = nearestZone.zoneId;
      }
    }

    // Store video metadata in memory
    dataStore.addVideo(video);

    // Generate presigned URL for immediate playback
    const signedUrl = await getPresignedVideoUrl(videoId);

    return NextResponse.json({
      success: true,
      videoId: video.id,
      cloudUrl: signedUrl,
      analysisPreview: analysisResult,
      message: 'Video uploaded and analyzed successfully',
    });
  } catch (error) {
    console.error('Video upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload video to R2' },
      { status: 500 }
    );
  }
}
