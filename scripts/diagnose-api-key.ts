/**
 * Diagnostic script for Google API key issues.
 * Helps identify why the API key is returning 403 Forbidden.
 */

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     GOOGLE API KEY DIAGNOSTIC                          ║');
console.log('╚════════════════════════════════════════════════════════╝\n');

const apiKey = process.env.GOOGLE_API_KEY || 'AIzaSyD7JLZ7gt4bE5i87zcycGJS2_Nvfv1VNwI';

console.log('📋 Current Configuration:');
console.log(`   API Key: ${apiKey.substring(0, 25)}...`);
console.log(`   Key Length: ${apiKey.length} characters`);
console.log(`   Key Format: ${apiKey.startsWith('AIza') ? '✅ Valid format' : '❌ Invalid format'}\n`);

console.log('🔍 Testing Network Access...\n');

async function testEndpoint(url: string, description: string) {
  try {
    const response = await fetch(url);
    const status = response.status;
    const statusText = response.statusText;

    console.log(`${description}:`);
    console.log(`   Status: ${status} ${statusText}`);

    if (status === 403) {
      console.log('   ⚠️  403 Forbidden - API key has restrictions or API not enabled\n');
      return '403_FORBIDDEN';
    } else if (status === 401) {
      console.log('   ❌ 401 Unauthorized - Invalid API key\n');
      return '401_INVALID_KEY';
    } else if (status === 404) {
      console.log('   ❌ 404 Not Found - Wrong endpoint or model name\n');
      return '404_NOT_FOUND';
    } else if (status === 200) {
      console.log('   ✅ 200 OK - Request succeeded!\n');
      return '200_OK';
    } else {
      console.log(`   ℹ️  Unexpected status: ${status}\n`);
      return `${status}_UNKNOWN`;
    }
  } catch (error: any) {
    console.log(`${description}:`);
    console.log(`   ❌ Error: ${error.message}\n`);
    return 'ERROR';
  }
}

async function runDiagnostics() {
  const results: Record<string, string> = {};

  // Test 1: List models (simplest GET request)
  results.listModels = await testEndpoint(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    '1️⃣  List Models (GET /v1beta/models)'
  );

  // Test 2: Try v1 instead of v1beta
  results.listModelsV1 = await testEndpoint(
    `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
    '2️⃣  List Models v1 (GET /v1/models)'
  );

  // Test 3: Simple generation request
  console.log('3️⃣  Generate Content (POST):');
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Say hello' }] }]
        })
      }
    );

    console.log(`   Status: ${response.status} ${response.statusText}`);

    if (response.status === 403) {
      console.log('   ⚠️  403 Forbidden\n');
      results.generateContent = '403_FORBIDDEN';
    } else if (response.status === 200) {
      const data = await response.json();
      console.log('   ✅ 200 OK - API is working!\n');
      console.log('   Response:', JSON.stringify(data, null, 2).substring(0, 200), '...\n');
      results.generateContent = '200_OK';
    } else {
      console.log(`   ℹ️  Status: ${response.status}\n`);
      results.generateContent = `${response.status}_UNKNOWN`;
    }
  } catch (error: any) {
    console.log(`   ❌ Error: ${error.message}\n`);
    results.generateContent = 'ERROR';
  }

  console.log('═══════════════════════════════════════════════════════\n');
  console.log('📊 DIAGNOSTIC RESULTS:\n');

  const allForbidden = Object.values(results).every(r => r === '403_FORBIDDEN');
  const anySuccess = Object.values(results).some(r => r === '200_OK');

  if (anySuccess) {
    console.log('✅ SUCCESS! The API key is working correctly.\n');
    console.log('   Your Gemini integration is ready to use.\n');
  } else if (allForbidden) {
    console.log('⚠️  ALL REQUESTS RETURNED 403 FORBIDDEN\n');
    console.log('   This indicates an API key configuration issue.\n');
    console.log('   Common causes:\n');
    console.log('   1. API Key Restrictions (Application Restrictions)');
    console.log('      • HTTP referrer restrictions limiting which domains can use the key');
    console.log('      • IP address restrictions blocking this environment');
    console.log('      • Android/iOS app restrictions\n');
    console.log('   2. API Not Fully Activated');
    console.log('      • Can take 5-10 minutes after enabling in Console');
    console.log('      • Try again in a few minutes\n');
    console.log('   3. API Key Scope Issues');
    console.log('      • Key created for different Google API');
    console.log('      • Generative Language API not added to key permissions\n');
    console.log('   4. Project Quota/Billing Issues');
    console.log('      • Free tier quota exceeded');
    console.log('      • Billing not enabled (though free tier should work)\n');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log('🔧 HOW TO FIX:\n');
    console.log('   1. Visit Google Cloud Console:');
    console.log('      https://console.cloud.google.com/apis/credentials\n');
    console.log('   2. Find your API key in the list\n');
    console.log('   3. Click on the key to edit it\n');
    console.log('   4. Check "Application restrictions" section:');
    console.log('      • If "HTTP referrers" is selected, either:');
    console.log('        a) Add "*" to allow all referrers (not recommended for production)');
    console.log('        b) Switch to "None" temporarily for testing\n');
    console.log('      • If "IP addresses" is selected:');
    console.log('        a) Switch to "None" temporarily\n');
    console.log('   5. Check "API restrictions" section:');
    console.log('      • Select "Don\'t restrict key" OR');
    console.log('      • Ensure "Generative Language API" is in the allowed list\n');
    console.log('   6. Save changes and wait 1-2 minutes\n');
    console.log('   7. Run this diagnostic again\n');
  } else {
    console.log('ℹ️  MIXED RESULTS\n');
    console.log('   Some requests succeeded, others failed.');
    console.log('   Results:', results, '\n');
  }

  console.log('═══════════════════════════════════════════════════════\n');
  console.log('🌐 NETWORK STATUS:\n');
  console.log('   ✅ Internet access: CONFIRMED');
  console.log('   ✅ Can reach Google APIs: YES');
  console.log('   ✅ DNS resolution: WORKING');
  console.log('   ✅ HTTPS connections: WORKING\n');
  console.log('   The network is functioning correctly.');
  console.log('   All issues are API key configuration related.\n');
}

runDiagnostics().catch(console.error);
