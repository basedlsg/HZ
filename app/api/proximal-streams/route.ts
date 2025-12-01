import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import type { GeoLocation } from '@/lib/types';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '37.7749');
    const lng = parseFloat(searchParams.get('lng') || '-122.4194');
    const maxDistance = parseInt(searchParams.get('maxDistance') || '1000');

    const location: GeoLocation = { lat, lng };
    const streams = dataStore.getProximalStreams(location, maxDistance);

    return NextResponse.json({
      success: true,
      streams,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch proximal streams' },
      { status: 500 }
    );
  }
}
