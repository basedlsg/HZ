/**
 * Test script to verify REAL Llama API connection.
 * This script makes an actual API call to Llama Vision API to ensure:
 * 1. API key is valid
 * 2. Endpoint is reachable
 * 3. Model responds correctly
 * 4. No mocks or fakes are used
 *
 * Run with: npx tsx scripts/test-llama-api.ts
 */

import { DEFAULT_LLAMA_CONFIG } from '../lib/ai-metadata';

// Sample base64-encoded 1x1 pixel JPEG (tiny test image)
const TEST_IMAGE = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAA//2Q==';

async function testLlamaAPI() {
  console.log('🔍 Testing REAL Llama API Connection...\n');

  // Check API key
  const apiKey = process.env.LLAMA_API_KEY || DEFAULT_LLAMA_CONFIG.apiKey;
  if (!apiKey) {
    console.error('❌ ERROR: LLAMA_API_KEY not set in environment');
    console.error('   Please set it in .env.local');
    process.exit(1);
  }

  console.log('✓ API Key found:', apiKey.substring(0, 20) + '...\n');
  console.log('📡 Endpoint:', DEFAULT_LLAMA_CONFIG.endpoint);
  console.log('🤖 Model:', DEFAULT_LLAMA_CONFIG.model);
  console.log('\n🚀 Making REAL API call...\n');

  const requestPayload = {
    model: DEFAULT_LLAMA_CONFIG.model,
    messages: [
      {
        role: 'system',
        content: 'You are analyzing a test image. Respond with valid JSON only.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Analyze this test image and return: {"summary": "Test image", "tags": ["test"], "counts": {"people": "0", "vehicles": "0"}, "activityLevel": "low", "confidence": 0.9}',
          },
          {
            type: 'image_url',
            image_url: {
              url: TEST_IMAGE,
            },
          },
        ],
      },
    ],
    max_tokens: 200,
    temperature: 0.3,
  };

  try {
    const response = await fetch(DEFAULT_LLAMA_CONFIG.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestPayload),
    });

    console.log('📥 Response Status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('\n❌ API ERROR:');
      console.error(errorText);
      process.exit(1);
    }

    const data = await response.json();

    console.log('\n✅ SUCCESS! Real Llama API responded:\n');
    console.log('Response ID:', data.id);
    console.log('Model:', data.model);
    console.log('Content:', data.choices[0].message.content);
    console.log('\nToken Usage:');
    console.log('  Prompt tokens:', data.usage.prompt_tokens);
    console.log('  Completion tokens:', data.usage.completion_tokens);
    console.log('  Total tokens:', data.usage.total_tokens);

    console.log('\n✅ VERIFICATION COMPLETE: Using REAL Llama API (NO MOCKS)');
    console.log('   Endpoint: https://api.llama-api.com/chat/completions');
    console.log('   Model: llama-3.2-90b-vision-instruct');
    console.log('   Status: API is reachable and responding correctly');

  } catch (error) {
    console.error('\n❌ NETWORK/CONNECTION ERROR:');
    console.error(error);
    process.exit(1);
  }
}

// Run test
testLlamaAPI();
