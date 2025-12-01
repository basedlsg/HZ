import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { VIDEO_PULSE_IMMEDIATE_MS } from '@/lib/config';

/**
 * GET /api/heatmap-pulse
 * Get pulse data for map bubbles based on recent video activity
 *
 * Returns which zones have recent videos and how intense the pulse should be.
 */
export async function GET() {
  try {
    const bubbles = dataStore.getAllHeatBubbles();
    const now = Date.now();

    const pulseData = bubbles.map((bubble) => {
      const lastVideoTimestamp = dataStore.getLastVideoTimestampInZone(bubble.id);
      const recentVideoCount = dataStore.getRecentVideoCountInZone(bubble.id);

      // Determine if zone should pulse
      const shouldPulse = lastVideoTimestamp
        ? now - lastVideoTimestamp < VIDEO_PULSE_IMMEDIATE_MS
        : false;

      return {
        zoneId: bubble.id,
        shouldPulse,
        recentVideoCount,
        lastVideoTimestamp,
        pulseIntensity: Math.min(recentVideoCount, 5), // Cap at 5 for visual effect
      };
    });

    return NextResponse.json({
      success: true,
      pulseData,
    });
  } catch (error) {
    console.error('Heatmap pulse error:', error);
    return NextResponse.json(
      { error: 'Failed to get pulse data' },
      { status: 500 }
    );
  }
}
