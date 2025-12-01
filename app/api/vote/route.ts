import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { VoteDirection } from '@/lib/types';

/**
 * POST /api/vote
 *
 * Cast or toggle a vote on a video.
 *
 * Body:
 * - videoId: string
 * - direction: 'up' | 'down' | 'none' (new vote direction)
 * - previousDirection: 'up' | 'down' | 'none' (previous vote from localStorage)
 *
 * Returns updated vote counts.
 */
export async function POST(request: NextRequest) {
  try {
    const { videoId, direction, previousDirection } = await request.json();

    // Validate inputs
    const validDirections: VoteDirection[] = ['up', 'down', 'none'];
    if (!videoId || !validDirections.includes(direction) || !validDirections.includes(previousDirection)) {
      return NextResponse.json(
        { error: 'Invalid vote data' },
        { status: 400 }
      );
    }

    // Cast the vote
    const updatedCounts = dataStore.castVote(videoId, direction, previousDirection);

    if (!updatedCounts) {
      return NextResponse.json(
        { error: 'Video not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      votes: updatedCounts,
    });
  } catch (error) {
    console.error('Vote error:', error);
    return NextResponse.json(
      { error: 'Failed to cast vote' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/vote?videoId={id}
 *
 * Get vote counts for a video.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'videoId required' },
        { status: 400 }
      );
    }

    const votes = dataStore.getVotes(videoId);

    return NextResponse.json({
      success: true,
      votes,
    });
  } catch (error) {
    console.error('Get votes error:', error);
    return NextResponse.json(
      { error: 'Failed to get votes' },
      { status: 500 }
    );
  }
}
