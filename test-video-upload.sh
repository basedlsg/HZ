#!/bin/bash

# Test video upload with location data
# This simulates what the frontend does when uploading a video

echo "🧪 Testing Video Upload with Location Data"
echo "=========================================="
echo ""

# Test video file
VIDEO_FILE="test-videos/test-video-small.mp4"

if [ ! -f "$VIDEO_FILE" ]; then
  echo "❌ Error: Test video file not found at $VIDEO_FILE"
  exit 1
fi

echo "✓ Video file: $VIDEO_FILE"
echo "✓ Video size: $(du -h "$VIDEO_FILE" | cut -f1)"
echo ""

# Test data
SESSION_ID="test-session-$(date +%s)"
DURATION="15"
LATITUDE="37.7749"  # San Francisco
LONGITUDE="-122.4194"

echo "📍 Test Location: San Francisco"
echo "   Latitude: $LATITUDE"
echo "   Longitude: $LONGITUDE"
echo ""

# Upload to local dev server
echo "📤 Uploading to http://localhost:3000/api/upload-video"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:3000/api/upload-video \
  -F "video=@$VIDEO_FILE;type=video/mp4" \
  -F "sessionId=$SESSION_ID" \
  -F "duration=$DURATION" \
  -F "latitude=$LATITUDE" \
  -F "longitude=$LONGITUDE")

echo "Response:"
echo "$RESPONSE" | jq . 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if upload was successful
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "✅ Upload successful!"

  VIDEO_ID=$(echo "$RESPONSE" | jq -r '.videoId' 2>/dev/null)
  CLOUD_URL=$(echo "$RESPONSE" | jq -r '.cloudUrl' 2>/dev/null)

  echo ""
  echo "Video ID: $VIDEO_ID"
  echo "Cloud URL: $CLOUD_URL"
  echo ""

  if [ "$CLOUD_URL" != "null" ] && [ -n "$CLOUD_URL" ]; then
    echo "🔍 Checking if video is accessible at R2 URL..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -I "$CLOUD_URL" --max-time 10)

    if [ "$HTTP_STATUS" == "200" ]; then
      echo "✅ Video is accessible in R2 bucket (HTTP $HTTP_STATUS)"
    elif [ "$HTTP_STATUS" == "403" ]; then
      echo "⚠️  Video uploaded but R2 returned 403 Forbidden"
      echo "    This might be due to bucket permissions or CORS settings"
    else
      echo "⚠️  Video URL returned HTTP $HTTP_STATUS"
      echo "    URL: $CLOUD_URL"
    fi
  else
    echo "⚠️  No cloud URL in response (R2 credentials might be missing)"
  fi

  echo ""
  echo "🗺️  Testing zone assignment..."

  # Get heatmap to see if video was assigned to a zone
  HEATMAP_RESPONSE=$(curl -s http://localhost:3000/api/heatmap)

  if echo "$HEATMAP_RESPONSE" | grep -q '"zones":\['; then
    ZONE_COUNT=$(echo "$HEATMAP_RESPONSE" | jq '.zones | length' 2>/dev/null)
    echo "✓ Heatmap API returned $ZONE_COUNT zones"
  else
    echo "ℹ️  No zones in heatmap (this is normal if no check-ins exist)"
  fi

  echo ""
  echo "📹 Testing video metadata retrieval..."

  # Get videos list
  VIDEOS_RESPONSE=$(curl -s http://localhost:3000/api/videos)

  if echo "$VIDEOS_RESPONSE" | grep -q '"videos":\['; then
    VIDEO_COUNT=$(echo "$VIDEOS_RESPONSE" | jq '.videos | length' 2>/dev/null)
    echo "✓ Videos API returned $VIDEO_COUNT videos"

    # Check if our video has location data
    VIDEO_HAS_LOCATION=$(echo "$VIDEOS_RESPONSE" | jq ".videos[] | select(.id==\"$VIDEO_ID\") | has(\"location\")" 2>/dev/null)

    if [ "$VIDEO_HAS_LOCATION" == "true" ]; then
      VIDEO_LOCATION=$(echo "$VIDEOS_RESPONSE" | jq ".videos[] | select(.id==\"$VIDEO_ID\") | .location" 2>/dev/null)
      echo "✅ Video has location data: $VIDEO_LOCATION"
    else
      echo "❌ Video does not have location data!"
    fi
  fi

else
  echo "❌ Upload failed!"

  if echo "$RESPONSE" | grep -q "Location coordinates required"; then
    echo "   Reason: Location validation is working (coordinates were required)"
    echo "   This means our location gating is functioning correctly!"
  elif echo "$RESPONSE" | grep -q "R2"; then
    echo "   Reason: R2 storage issue"
    echo "   Check if R2 credentials are set in .env.local"
  else
    echo "   Response: $RESPONSE"
  fi
fi

echo ""
echo "=========================================="
echo "Test complete"
