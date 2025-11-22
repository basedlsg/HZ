#!/bin/bash
# Direct test of Gemini API with different models

API_KEY="AIzaSyD7JLZ7gt4bE5i87zcycGJS2_Nvfv1VNwI"

echo "═══════════════════════════════════════════"
echo "Testing Different Gemini Models"
echo "═══════════════════════════════════════════"
echo ""

# Test 1: gemini-pro (older, more widely available)
echo "1. Testing gemini-pro..."
response=$(curl -s -o /tmp/gemini-test1.txt -w "%{http_code}" \
  -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello"}]}]}')

echo "   HTTP Status: $response"
if [ "$response" = "200" ]; then
    echo "   ✅ SUCCESS!"
    cat /tmp/gemini-test1.txt | head -20
else
    echo "   ❌ Failed"
    cat /tmp/gemini-test1.txt | head -10
fi
echo ""

# Test 2: gemini-1.5-flash
echo "2. Testing gemini-1.5-flash..."
response=$(curl -s -o /tmp/gemini-test2.txt -w "%{http_code}" \
  -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"contents":[{"parts":[{"text":"Say hello"}]}]}')

echo "   HTTP Status: $response"
if [ "$response" = "200" ]; then
    echo "   ✅ SUCCESS!"
    cat /tmp/gemini-test2.txt | head -20
else
    echo "   ❌ Failed"
    cat /tmp/gemini-test2.txt | head -10
fi
echo ""

# Test 3: List all available models
echo "3. Listing available models..."
response=$(curl -s -o /tmp/gemini-models.txt -w "%{http_code}" \
  "https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}")

echo "   HTTP Status: $response"
if [ "$response" = "200" ]; then
    echo "   ✅ SUCCESS! Available models:"
    cat /tmp/gemini-models.txt
else
    echo "   ❌ Failed"
    cat /tmp/gemini-models.txt | head -10
fi
echo ""

echo "═══════════════════════════════════════════"
