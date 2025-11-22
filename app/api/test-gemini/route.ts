/**
 * Simple test endpoint to verify Google Gemini API works in production.
 * This doesn't require ffmpeg or video processing - just tests the API connection.
 */

import { NextRequest, NextResponse } from 'next/server';

// Small test image (1x1 red pixel PNG as base64)
const TEST_IMAGE_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        success: false,
        error: 'GOOGLE_API_KEY environment variable not set',
        hint: 'Add GOOGLE_API_KEY to your Vercel environment variables',
      },
      { status: 500 }
    );
  }

  console.log('[Test Gemini] Testing Gemini API connection...');
  console.log('[Test Gemini] API Key:', apiKey.substring(0, 20) + '...');

  try {
    // Test 1: Simple text generation
    console.log('[Test Gemini] Test 1: Text generation');
    const textResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Respond with JSON only: {"status": "success", "message": "Gemini API is working"}',
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 100,
          },
        }),
      }
    );

    console.log('[Test Gemini] Text response status:', textResponse.status);

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      console.error('[Test Gemini] Text generation failed:', errorText);
      return NextResponse.json(
        {
          success: false,
          error: 'Gemini API request failed',
          status: textResponse.status,
          details: errorText.substring(0, 500),
        },
        { status: textResponse.status }
      );
    }

    const textData = await textResponse.json();
    console.log('[Test Gemini] Text response:', JSON.stringify(textData).substring(0, 200));

    // Test 2: Vision analysis with test image
    console.log('[Test Gemini] Test 2: Vision analysis');
    const visionResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: 'Describe this image in JSON: {"color": "...", "description": "..."}',
                },
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: TEST_IMAGE_BASE64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 100,
          },
        }),
      }
    );

    console.log('[Test Gemini] Vision response status:', visionResponse.status);

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      console.error('[Test Gemini] Vision analysis failed:', errorText);
      return NextResponse.json(
        {
          success: false,
          error: 'Gemini Vision API request failed',
          status: visionResponse.status,
          details: errorText.substring(0, 500),
          textGenerationWorked: true,
          textResponse: textData,
        },
        { status: visionResponse.status }
      );
    }

    const visionData = await visionResponse.json();
    console.log('[Test Gemini] Vision response:', JSON.stringify(visionData).substring(0, 200));

    // Both tests passed!
    return NextResponse.json({
      success: true,
      message: '✅ Gemini API is working perfectly!',
      tests: {
        textGeneration: {
          status: 'PASSED',
          response: textData.candidates?.[0]?.content?.parts?.[0]?.text || 'N/A',
        },
        visionAnalysis: {
          status: 'PASSED',
          response: visionData.candidates?.[0]?.content?.parts?.[0]?.text || 'N/A',
        },
      },
      apiKey: `${apiKey.substring(0, 20)}...`,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Test Gemini] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Test failed with exception',
        message: error.message,
        stack: error.stack?.substring(0, 500),
      },
      { status: 500 }
    );
  }
}
