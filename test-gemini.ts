import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

async function testGemini() {
    console.log('Testing Gemini API...');

    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
        console.error('❌ GOOGLE_API_KEY not found');
        return;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        console.log('Trying gemini-2.0-flash...');
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        const result = await model.generateContent('Hello');
        console.log('gemini-2.0-flash works:', await result.response.text());

    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testGemini();
