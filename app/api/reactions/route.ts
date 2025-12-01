import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { ReactionType } from '@/lib/types';

/**
 * POST /api/reactions
 * Add a reaction to a video
 *
 * Body: { videoId: string, reactionType: 'eyes' | 'risky' | 'resolved' | 'unclear' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, reactionType } = body;

    if (!videoId || !reactionType) {
      return NextResponse.json(
        { error: 'Missing videoId or reactionType' },
        { status: 400 }
      );
    }

    // Validate reaction type
    const validReactions: ReactionType[] = ['eyes', 'risky', 'resolved', 'unclear'];
    if (!validReactions.includes(reactionType)) {
      return NextResponse.json(
        { error: 'Invalid reaction type' },
        { status: 400 }
      );
    }

    const updatedCounts = dataStore.addReaction(videoId, reactionType);

    if (!updatedCounts) {
      return NextResponse.json(
        { error: 'Video not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      reactions: updatedCounts,
    });
  } catch (error) {
    console.error('Reaction error:', error);
    return NextResponse.json(
      { error: 'Failed to add reaction' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/reactions?videoId=xxx
 * Get reaction counts for a video
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const videoId = searchParams.get('videoId');

    if (!videoId) {
      return NextResponse.json(
        { error: 'Missing videoId parameter' },
        { status: 400 }
      );
    }

    const reactions = dataStore.getReactions(videoId);

    if (!reactions) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      reactions,
    });
  } catch (error) {
    console.error('Get reactions error:', error);
    return NextResponse.json(
      { error: 'Failed to get reactions' },
      { status: 500 }
    );
  }
}
