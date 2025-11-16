'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { VideoUpload, ReactionCounts, ReactionType, VoteCounts, VoteDirection } from '@/lib/types';
import { formatTimestamp, calculateDistance } from '@/lib/utils';
import { COMMENT_PROXIMITY_RADIUS_M, COMMENT_SESSION_FRESHNESS_MS, VIDEO_TTL_MS } from '@/lib/config';
import AspectVideo from '@/components/AspectVideo';

interface VideoWithMeta extends VideoUpload {
  reactionCounts: ReactionCounts | null;
  commentCount: number;
  voteCounts: VoteCounts;
}

interface CommentData {
  id: string;
  text: string;
  timestamp: number;
}

export default function VideosView() {
  const [videos, setVideos] = useState<VideoWithMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, CommentData[]>>({});
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Track user votes in localStorage: { videoId: 'up' | 'down' | 'none' }
  const [userVotes, setUserVotes] = useState<Record<string, VoteDirection>>({});

  // Load user votes from localStorage on mount
  useEffect(() => {
    const savedVotes = localStorage.getItem('hotzones-votes');
    if (savedVotes) {
      setUserVotes(JSON.parse(savedVotes));
    }
  }, []);

  useEffect(() => {
    fetchVideos();
    const interval = setInterval(fetchVideos, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/videos');
      const data = await response.json();
      if (data.success) {
        setVideos(data.videos);
      }
    } catch (error) {
      console.error('Failed to fetch videos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReaction = async (videoId: string, reactionType: ReactionType) => {
    try {
      const response = await fetch('/api/reactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, reactionType }),
      });

      const data = await response.json();
      if (data.success) {
        // Update local state
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId ? { ...v, reactionCounts: data.reactions } : v
          )
        );
      }
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  /**
   * Handle vote (upvote/downvote).
   * Clicking the same button toggles it off.
   * Clicking the opposite button switches the vote.
   */
  const handleVote = async (videoId: string, direction: VoteDirection) => {
    try {
      const previousDirection = userVotes[videoId] || 'none';

      // Determine new direction (toggle if clicking same button)
      let newDirection: VoteDirection = direction;
      if (previousDirection === direction) {
        newDirection = 'none'; // Toggle off
      }

      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          direction: newDirection,
          previousDirection,
        }),
      });

      const data = await response.json();
      if (data.success) {
        // Update vote counts in videos
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId ? { ...v, voteCounts: data.votes } : v
          )
        );

        // Update user's vote state
        const newVotes = { ...userVotes, [videoId]: newDirection };
        setUserVotes(newVotes);
        localStorage.setItem('hotzones-votes', JSON.stringify(newVotes));
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    }
  };

  const loadComments = async (videoId: string) => {
    if (comments[videoId]) {
      // Already loaded, toggle selection
      setSelectedVideo(selectedVideo === videoId ? null : videoId);
      return;
    }

    try {
      const response = await fetch(`/api/comments?videoId=${videoId}`);
      const data = await response.json();
      if (data.success) {
        setComments((prev) => ({ ...prev, [videoId]: data.comments }));
        setSelectedVideo(videoId);
      }
    } catch (error) {
      console.error('Failed to load comments:', error);
    }
  };

  const submitComment = async (videoId: string) => {
    const sessionData = localStorage.getItem('hotzones-session');
    if (!sessionData) {
      setMessage('Please check in first to comment');
      return;
    }

    const session = JSON.parse(sessionData);
    setSubmitting(true);
    setMessage('');

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          sessionId: session.sessionId,
          text: commentText,
        }),
      });

      const data = await response.json();

      if (data.success) {
        // Reload comments
        const commentsResponse = await fetch(`/api/comments?videoId=${videoId}`);
        const commentsData = await commentsResponse.json();
        if (commentsData.success) {
          setComments((prev) => ({ ...prev, [videoId]: commentsData.comments }));
        }
        setCommentText('');
        setMessage('✓ Comment posted!');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(data.error || 'Failed to post comment');
      }
    } catch (error) {
      setMessage('Failed to post comment');
    } finally {
      setSubmitting(false);
    }
  };

  const canComment = (video: VideoWithMeta): { can: boolean; reason?: string } => {
    const sessionData = localStorage.getItem('hotzones-session');
    if (!sessionData) {
      return { can: false, reason: 'Check in first' };
    }

    const session = JSON.parse(sessionData);
    const sessionAge = Date.now() - session.timestamp;

    if (sessionAge > COMMENT_SESSION_FRESHNESS_MS) {
      return { can: false, reason: 'Session expired - check in again' };
    }

    // We can't check actual distance client-side without fetching session location,
    // so we'll let the server enforce it. Just show the UI.
    return { can: true };
  };

  const getReactionEmoji = (type: ReactionType): string => {
    const map: Record<ReactionType, string> = {
      eyes: '👀',
      risky: '⚠️',
      resolved: '✅',
      unclear: '❓',
    };
    return map[type];
  };

  const getReactionLabel = (type: ReactionType): string => {
    const map: Record<ReactionType, string> = {
      eyes: 'I see this',
      risky: 'Risky',
      resolved: 'Resolved',
      unclear: 'Unclear',
    };
    return map[type];
  };

  const isExpired = (video: VideoWithMeta): boolean => {
    return Date.now() - video.timestamp > VIDEO_TTL_MS;
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-purple-900/30 bg-black/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-purple-400">
            HOTZONES
          </Link>
          <div className="flex gap-4">
            <Link href="/map" className="text-gray-400 hover:text-white">
              Map
            </Link>
            <Link href="/streams" className="text-gray-400 hover:text-white">
              Streams
            </Link>
            <Link href="/camera" className="text-gray-400 hover:text-white">
              Camera
            </Link>
            <Link href="/profile" className="text-gray-400 hover:text-white">
              Profile
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-1">Video Events</h2>
          <p className="text-gray-400 text-sm">
            Recent video captures with reactions and field notes
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400">Loading videos...</div>
          </div>
        ) : videos.length === 0 ? (
          <div className="bg-gray-900 rounded-lg p-8 text-center">
            <p className="text-gray-400 mb-4">No recent videos</p>
            <Link
              href="/camera"
              className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Record a Video
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {videos.map((video) => {
              const expired = isExpired(video);
              const commentPermission = canComment(video);

              return (
                <div
                  key={video.id}
                  className={`bg-gray-900 border rounded-lg p-6 ${
                    expired ? 'border-gray-800 opacity-60' : 'border-gray-800'
                  }`}
                >
                  {/* Video Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold text-lg">
                          {video.zoneId
                            ? `Zone: ${video.zoneId}`
                            : 'Unzoned Video'}
                        </h3>
                        {expired && (
                          <span className="text-xs bg-orange-900/30 text-orange-400 px-2 py-1 rounded">
                            Expired
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-400">
                        {formatTimestamp(video.timestamp)} •{' '}
                        {Math.round(video.duration)}s •{' '}
                        {Math.round(video.size / 1024)}KB
                      </div>
                    </div>
                  </div>

                  {/* Video Player */}
                  {video.filePath && (
                    <div className="mb-4">
                      <AspectVideo className="max-w-2xl mx-auto">
                        <video
                          src={`/api/video/${video.id}`}
                          controls
                          playsInline
                          className="w-full h-full object-cover"
                          preload="metadata"
                        />
                      </AspectVideo>
                    </div>
                  )}

                  {/* Upvote/Downvote */}
                  <div className="mb-4 flex items-center gap-3">
                    <button
                      onClick={() => !expired && handleVote(video.id, 'up')}
                      disabled={expired}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        expired
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                          : userVotes[video.id] === 'up'
                          ? 'bg-green-600 text-white shadow-lg'
                          : 'bg-gray-800 hover:bg-gray-700 text-white'
                      }`}
                      title="Upvote"
                    >
                      <span className="text-xl">👍</span>
                      <span className="font-semibold">{video.voteCounts?.upvotes || 0}</span>
                    </button>

                    <button
                      onClick={() => !expired && handleVote(video.id, 'down')}
                      disabled={expired}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                        expired
                          ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                          : userVotes[video.id] === 'down'
                          ? 'bg-red-600 text-white shadow-lg'
                          : 'bg-gray-800 hover:bg-gray-700 text-white'
                      }`}
                      title="Downvote"
                    >
                      <span className="text-xl">👎</span>
                      <span className="font-semibold">{video.voteCounts?.downvotes || 0}</span>
                    </button>

                    <div className="text-sm text-gray-400 ml-2">
                      Score: {(video.voteCounts?.upvotes || 0) - (video.voteCounts?.downvotes || 0) > 0 ? '+' : ''}{(video.voteCounts?.upvotes || 0) - (video.voteCounts?.downvotes || 0)}
                    </div>
                  </div>

                  {/* Reactions */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-400 mb-2">
                      Reactions
                    </h4>
                    <div className="flex gap-2">
                      {(['eyes', 'risky', 'resolved', 'unclear'] as ReactionType[]).map(
                        (type) => {
                          const count = video.reactionCounts?.[type] || 0;
                          return (
                            <button
                              key={type}
                              onClick={() => !expired && handleReaction(video.id, type)}
                              disabled={expired}
                              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                expired
                                  ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
                                  : 'bg-gray-800 hover:bg-gray-700 text-white'
                              }`}
                              title={getReactionLabel(type)}
                            >
                              <span className="text-lg">{getReactionEmoji(type)}</span>
                              <span className="text-sm font-semibold">{count}</span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>

                  {/* Comments Section */}
                  <div className="border-t border-gray-800 pt-4">
                    <button
                      onClick={() => loadComments(video.id)}
                      className="text-sm text-purple-400 hover:text-purple-300 mb-3"
                    >
                      {selectedVideo === video.id
                        ? '▼ Hide'
                        : `▶ Show ${video.commentCount} field note${
                            video.commentCount !== 1 ? 's' : ''
                          }`}
                    </button>

                    {selectedVideo === video.id && (
                      <div className="space-y-3">
                        {/* Comment List */}
                        {comments[video.id]?.length > 0 ? (
                          <div className="space-y-2 max-h-60 overflow-y-auto">
                            {comments[video.id].map((comment) => (
                              <div
                                key={comment.id}
                                className="bg-gray-800 rounded-lg p-3"
                              >
                                <p className="text-sm">{comment.text}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {formatTimestamp(comment.timestamp)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            No field notes yet
                          </p>
                        )}

                        {/* Comment Input */}
                        {!expired && commentPermission.can ? (
                          <div className="space-y-2">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder="Add a field note (you must be within 200m)..."
                              maxLength={120}
                              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-600 resize-none"
                              rows={2}
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">
                                {commentText.length}/120
                              </span>
                              <button
                                onClick={() => submitComment(video.id)}
                                disabled={
                                  !commentText.trim() || submitting || expired
                                }
                                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
                              >
                                {submitting ? 'Posting...' : 'Post'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 italic">
                            {expired
                              ? 'Event expired - comments closed'
                              : commentPermission.reason}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Message Display */}
        {message && (
          <div
            className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
              message.includes('✓')
                ? 'bg-green-900/90 border border-green-700 text-green-200'
                : 'bg-red-900/90 border border-red-700 text-red-200'
            }`}
          >
            {message}
          </div>
        )}

        {/* Info */}
        <div className="mt-8 bg-gray-900/50 border border-gray-800 rounded-lg p-4">
          <h3 className="font-semibold text-sm mb-2">About Field Notes</h3>
          <ul className="text-sm text-gray-400 space-y-1">
            <li>
              • Reactions are anonymous and count-only (👀 ⚠️ ✅ ❓)
            </li>
            <li>
              • Field notes require: active session + within 200m of event
            </li>
            <li>
              • All reactions and comments auto-expire after 30 minutes
            </li>
            <li>• Comments are anonymous - only timestamps are shown</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
