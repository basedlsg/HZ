import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { generateId, generateToken } from '@/lib/utils';
import { CheckInSession } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng, alias } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json(
        { error: 'Invalid location data' },
        { status: 400 }
      );
    }

    const session: CheckInSession = {
      id: generateId('session'),
      location: { lat, lng },
      timestamp: Date.now(),
      token: generateToken(),
      alias: alias || 'anonymous',
    };

    dataStore.addSession(session);

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      token: session.token,
      message: 'Checked in successfully',
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to check in' },
      { status: 500 }
    );
  }
}
