import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { generateId } from '@/lib/utils';
import { VideoUpload } from '@/lib/types';
import { uploadVideoToR2, getPresignedVideoUrl } from '@/lib/storage';
import { GoogleGenerativeAI } from '@google/generative-ai';

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

    // Verify session exists and has location
    const session = dataStore.getSession(sessionId);
    if (!session || !session.location) {
      return NextResponse.json(
        { error: 'Invalid session. Please check in first.' },
        { status: 403 }
      );
    }

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
        const analysisPromise = (async () => {
          const imageBuffer = await analysisImage.arrayBuffer();
          const base64Image = Buffer.from(imageBuffer).toString('base64');
          const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

          const prompt = `
            Analyze this video frame from a security/safety perspective (HotZones app).
            Identify:
            1. Text (OCR) - badge numbers, signs, plates.
            2. Uniforms/Personnel.
            3. Hazards or events.
            Return a concise summary (under 50 words).
          `;

          const result = await model.generateContent([
            prompt,
            { inlineData: { data: base64Image, mimeType: analysisImage.type || 'image/jpeg' } }
          ]);

          return await result.response.text();
        })();

        // Add 30-second timeout to AI analysis
        const timeoutPromise = new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('AI analysis timeout')), 30000)
        );

        analysisResult = await Promise.race([analysisPromise, timeoutPromise]);
      } catch (aiError: any) {
        console.error('AI Analysis failed during upload:', aiError);
        analysisResult = aiError.message === 'AI analysis timeout'
          ? 'Analysis timed out'
          : 'Analysis failed';
      }
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
