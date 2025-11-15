import { NextRequest, NextResponse } from 'next/server';
import { dataStore } from '@/lib/store';
import { generateId, calculateDistance } from '@/lib/utils';
import { Comment } from '@/lib/types';
import {
  COMMENT_PROXIMITY_RADIUS_M,
  COMMENT_SESSION_FRESHNESS_MS,
  COMMENT_MAX_LENGTH,
  COMMENT_RATE_LIMIT_MS,
} from '@/lib/config';

/**
 * POST /api/comments
 * Add a comment to a video
 *
 * Proximity gating: Users can only comment if:
 * - They have a valid active session
 * - Their check-in is fresh (within COMMENT_SESSION_FRESHNESS_MS)
 * - Their location is within COMMENT_PROXIMITY_RADIUS_M of the video's location
 * - They haven't commented too recently (rate limiting)
 *
 * Body: { videoId: string, sessionId: string, text: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { videoId, sessionId, text } = body;

    if (!videoId || !sessionId || !text) {
      return NextResponse.json(
        { error: 'Missing videoId, sessionId, or text' },
        { status: 400 }
      );
    }

    // Validate comment length
    if (text.length > COMMENT_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Comment too long (max ${COMMENT_MAX_LENGTH} characters)` },
        { status: 400 }
      );
    }

    // Get the video
    const video = dataStore.getVideo(videoId);
    if (!video || !video.location) {
      return NextResponse.json(
        { error: 'Video not found or has no location' },
        { status: 404 }
      );
    }

    // Get the user's session
    const session = dataStore.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found - please check in first' },
        { status: 403 }
      );
    }

    // Check if session is fresh enough
    const sessionAge = Date.now() - session.timestamp;
    if (sessionAge > COMMENT_SESSION_FRESHNESS_MS) {
      return NextResponse.json(
        {
          error: `Session too old (${Math.floor(sessionAge / 60000)} minutes). Check in again to comment.`,
        },
        { status: 403 }
      );
    }

    // Check proximity: user must be near the video's location
    const distance = calculateDistance(session.location, video.location);
    if (distance > COMMENT_PROXIMITY_RADIUS_M) {
      return NextResponse.json(
        {
          error: `Too far from video location (${Math.round(distance)}m away, max ${COMMENT_PROXIMITY_RADIUS_M}m)`,
        },
        { status: 403 }
      );
    }

    // Check rate limiting: has this session commented too recently?
    const lastCommentTime = dataStore.getLastCommentTimestamp(sessionId);
    if (lastCommentTime) {
      const timeSinceLastComment = Date.now() - lastCommentTime;
      if (timeSinceLastComment < COMMENT_RATE_LIMIT_MS) {
        const waitSeconds = Math.ceil((COMMENT_RATE_LIMIT_MS - timeSinceLastComment) / 1000);
        return NextResponse.json(
          {
            error: `Please wait ${waitSeconds} seconds before commenting again`,
          },
          { status: 429 }
        );
      }
    }

    // All checks passed - create the comment
    const comment: Comment = {
      id: generateId('comment'),
      videoId,
      sessionId,
      text: text.trim(),
      timestamp: Date.now(),
    };

    dataStore.addComment(comment);

    return NextResponse.json({
      success: true,
      comment: {
        id: comment.id,
        text: comment.text,
        timestamp: comment.timestamp,
        // Don't send sessionId to client - comments are anonymous
      },
    });
  } catch (error) {
    console.error('Comment error:', error);
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/comments?videoId=xxx
 * Get comments for a video
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

    const comments = dataStore.getCommentsForVideo(videoId);

    // Strip sessionId from comments before sending to client
    const anonymizedComments = comments.map((c) => ({
      id: c.id,
      text: c.text,
      timestamp: c.timestamp,
    }));

    return NextResponse.json({
      success: true,
      comments: anonymizedComments,
    });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Failed to get comments' },
      { status: 500 }
    );
  }
}
