import { NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';

export async function GET() {
  try {
    const heatBubbles = dataStore.getAllHeatBubbles();

    return NextResponse.json({
      success: true,
      bubbles: heatBubbles,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch heatmap data' },
      { status: 500 }
    );
  }
}
