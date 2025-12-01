import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '');

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const imageFile = formData.get('image') as File | null;

        if (!imageFile) {
            return NextResponse.json(
                { error: 'No image provided' },
                { status: 400 }
            );
        }

        const buffer = await imageFile.arrayBuffer();
        const base64Image = Buffer.from(buffer).toString('base64');

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `
      Analyze this image from a security/safety perspective.
      Identify any:
      1. Text (OCR) - especially badge numbers, street signs, license plates.
      2. Uniforms or official personnel.
      3. Safety hazards or notable events.
      
      Return a concise summary. If text is found, list it explicitly.
      Format as plain text, keep it short (under 50 words).
    `;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Image,
                    mimeType: imageFile.type || 'image/jpeg',
                },
            },
        ]);

        const response = await result.response;
        const text = response.text();

        return NextResponse.json({
            success: true,
            analysis: text,
        });
    } catch (error) {
        console.error('Analysis error:', error);
        return NextResponse.json(
            { error: 'Failed to analyze image' },
            { status: 500 }
        );
    }
}
