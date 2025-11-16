// In-memory data store for Hotzones MVP

import { CheckInSession, HeatBubble, ProximalStream, VideoUpload, GeoLocation, ReactionCounts, Comment, ReactionType, VoteCounts, VoteDirection } from './types';
import { calculateDistance } from './utils';
import { VIDEO_TTL_MS, VIDEO_STORAGE_TTL_MS, ZONE_ASSIGNMENT_MAX_DISTANCE_M, VIDEO_PULSE_WINDOW_MS } from './config';

// Simple in-memory storage
class DataStore {
  private sessions: Map<string, CheckInSession> = new Map();
  private heatBubbles: Map<string, HeatBubble> = new Map();
  private proximalStreams: Map<string, ProximalStream> = new Map();
  private videos: Map<string, VideoUpload> = new Map();
  private reactions: Map<string, ReactionCounts> = new Map(); // videoId -> counts
  private comments: Map<string, Comment> = new Map(); // commentId -> comment
  private votes: Map<string, VoteCounts> = new Map(); // videoId -> vote counts

  constructor() {
    this.initializeFakeData();
  }

  // Initialize with some fake data
  private initializeFakeData() {
    // Fake heat bubbles in San Francisco area
    // Each location represents a coarse presence zone
    const fakeLocations = [
      { lat: 37.7749, lng: -122.4194 },
      { lat: 37.7849, lng: -122.4094 },
      { lat: 37.7649, lng: -122.4294 },
      { lat: 37.7949, lng: -122.4394 },
      { lat: 37.7549, lng: -122.4094 },
    ];

    const zoneLabels = ['Mission-01', 'Castro-02', 'SOMA-03', 'Haight-04', 'Marina-05'];
    const now = Date.now();

    fakeLocations.forEach((location, index) => {
      // Simulate varying recency: some zones are fresh, others are older
      const ageInSeconds = Math.random() * 180; // 0-3 minutes old
      const lastActivity = now - (ageInSeconds * 1000);

      const bubble: HeatBubble = {
        id: `bubble-${index}`,
        location,
        intensity: Math.random() * 0.7 + 0.3, // 0.3 to 1.0
        radius: Math.random() * 100 + 50, // 50-150 meters
        sessionCount: Math.floor(Math.random() * 10) + 1,
        lastActivity,
        label: zoneLabels[index],
      };
      this.heatBubbles.set(bubble.id, bubble);
    });

    // Fake proximal streams
    const fakeAliases = ['ghost_rider', 'neon_cat', 'cyber_punk', 'void_walker', 'pixel_sage'];
    fakeAliases.forEach((alias, index) => {
      const stream: ProximalStream = {
        id: `stream-${index}`,
        alias,
        distance: Math.random() * 500 + 10, // 10-510 meters
        stability: Math.random() * 0.6 + 0.4, // 0.4 to 1.0
        lastSeen: Date.now() - Math.random() * 60000, // within last minute
        location: fakeLocations[index % fakeLocations.length],
      };
      this.proximalStreams.set(stream.id, stream);
    });
  }

  // ============================================================================
  // Session methods
  // ============================================================================

  addSession(session: CheckInSession): void {
    this.sessions.set(session.id, session);
  }

  getSession(id: string): CheckInSession | undefined {
    return this.sessions.get(id);
  }

  // ============================================================================
  // Heat bubble / Zone methods
  // ============================================================================

  getAllHeatBubbles(): HeatBubble[] {
    return Array.from(this.heatBubbles.values());
  }

  getHeatBubble(id: string): HeatBubble | undefined {
    return this.heatBubbles.get(id);
  }

  /**
   * Find the nearest zone to a given location.
   * Returns the zone ID and distance, or null if no zone is within max distance.
   */
  findNearestZone(location: GeoLocation): { zoneId: string; distance: number } | null {
    let nearest: { zoneId: string; distance: number } | null = null;

    for (const bubble of this.heatBubbles.values()) {
      const distance = calculateDistance(location, bubble.location);

      if (distance <= ZONE_ASSIGNMENT_MAX_DISTANCE_M) {
        if (!nearest || distance < nearest.distance) {
          nearest = { zoneId: bubble.id, distance };
        }
      }
    }

    return nearest;
  }

  // ============================================================================
  // Proximal streams methods
  // ============================================================================

  getProximalStreams(location: GeoLocation, maxDistance: number = 1000): ProximalStream[] {
    const streams = Array.from(this.proximalStreams.values());
    // Simple distance filter (not accurate geospatial math)
    return streams
      .filter(stream => stream.distance < maxDistance)
      .sort((a, b) => a.distance - b.distance);
  }

  // ============================================================================
  // Video methods
  // ============================================================================

  /**
   * Add a video to the store.
   * If the video has a sessionId, we'll try to:
   * 1. Look up the session to get its location
   * 2. Assign the video to the nearest zone
   */
  addVideo(video: VideoUpload): void {
    // If video has a sessionId, try to get location and assign zone
    if (video.sessionId && !video.location) {
      const session = this.getSession(video.sessionId);
      if (session?.location) {
        video.location = session.location;

        // Find nearest zone
        const nearest = this.findNearestZone(session.location);
        if (nearest) {
          video.zoneId = nearest.zoneId;
        }
      }
    }

    this.videos.set(video.id, video);

    // Initialize empty reaction counts for this video
    this.reactions.set(video.id, {
      videoId: video.id,
      eyes: 0,
      risky: 0,
      resolved: 0,
      unclear: 0,
    });
  }

  getVideo(id: string): VideoUpload | undefined {
    return this.videos.get(id);
  }

  getAllVideos(): VideoUpload[] {
    return Array.from(this.videos.values());
  }

  /**
   * Get only non-expired videos (within VIDEO_STORAGE_TTL_MS).
   * Auto-expire logic: we filter out old videos on read.
   * Uses 2-hour storage TTL for file retention.
   */
  getActiveVideos(): VideoUpload[] {
    const now = Date.now();
    return this.getAllVideos().filter(
      (video) => now - video.timestamp < VIDEO_STORAGE_TTL_MS
    );
  }

  /**
   * Get videos in a specific zone that are still active.
   */
  getVideosInZone(zoneId: string): VideoUpload[] {
    return this.getActiveVideos().filter((video) => video.zoneId === zoneId);
  }

  /**
   * Get the timestamp of the most recent video in a zone.
   * Used for map pulse effects.
   */
  getLastVideoTimestampInZone(zoneId: string): number | null {
    const videosInZone = this.getVideosInZone(zoneId);
    if (videosInZone.length === 0) return null;

    return Math.max(...videosInZone.map((v) => v.timestamp));
  }

  /**
   * Get the count of recent videos in a zone (within VIDEO_PULSE_WINDOW_MS).
   * Used for determining pulse intensity on map.
   */
  getRecentVideoCountInZone(zoneId: string): number {
    const now = Date.now();
    const videosInZone = this.getVideosInZone(zoneId);

    return videosInZone.filter(
      (video) => now - video.timestamp < VIDEO_PULSE_WINDOW_MS
    ).length;
  }

  // ============================================================================
  // Reaction methods
  // ============================================================================

  /**
   * Increment a reaction count for a video.
   * Returns the updated reaction counts.
   */
  addReaction(videoId: string, reactionType: ReactionType): ReactionCounts | null {
    const video = this.getVideo(videoId);
    if (!video) return null;

    // Check if video is expired
    if (Date.now() - video.timestamp > VIDEO_TTL_MS) {
      return null; // Can't react to expired videos
    }

    let counts = this.reactions.get(videoId);
    if (!counts) {
      // Initialize if missing
      counts = {
        videoId,
        eyes: 0,
        risky: 0,
        resolved: 0,
        unclear: 0,
      };
    }

    // Increment the specific reaction
    counts[reactionType]++;

    this.reactions.set(videoId, counts);
    return counts;
  }

  /**
   * Get reaction counts for a video.
   */
  getReactions(videoId: string): ReactionCounts | null {
    return this.reactions.get(videoId) || null;
  }

  // ============================================================================
  // Comment methods
  // ============================================================================

  /**
   * Add a comment to a video.
   */
  addComment(comment: Comment): void {
    this.comments.set(comment.id, comment);
  }

  /**
   * Get all active (non-expired) comments for a video.
   */
  getCommentsForVideo(videoId: string): Comment[] {
    const video = this.getVideo(videoId);
    if (!video) return [];

    // Only return comments if the video is still active
    if (Date.now() - video.timestamp > VIDEO_TTL_MS) {
      return [];
    }

    return Array.from(this.comments.values())
      .filter((comment) => comment.videoId === videoId)
      .sort((a, b) => b.timestamp - a.timestamp); // Newest first
  }

  /**
   * Get the timestamp of the last comment by a session (for rate limiting).
   */
  getLastCommentTimestamp(sessionId: string): number | null {
    const comments = Array.from(this.comments.values())
      .filter((comment) => comment.sessionId === sessionId)
      .sort((a, b) => b.timestamp - a.timestamp);

    return comments.length > 0 ? comments[0].timestamp : null;
  }

  // ============================================================================
  // Vote methods (Upvote/Downvote)
  // ============================================================================

  /**
   * Cast or toggle a vote on a video.
   *
   * @param videoId - The video to vote on
   * @param newDirection - 'up', 'down', or 'none'
   * @param previousDirection - The user's previous vote direction (from localStorage)
   * @returns Updated vote counts or null if video not found/expired
   *
   * Logic:
   * - If user had no vote and votes up: upvotes +1
   * - If user had upvote and votes up again: upvotes -1 (toggle off)
   * - If user had upvote and votes down: upvotes -1, downvotes +1
   * - If user had downvote and votes up: downvotes -1, upvotes +1
   * - If user had downvote and votes down again: downvotes -1 (toggle off)
   */
  castVote(
    videoId: string,
    newDirection: VoteDirection,
    previousDirection: VoteDirection
  ): VoteCounts | null {
    const video = this.getVideo(videoId);
    if (!video) return null;

    // Check if video is expired (use storage TTL for votes)
    if (Date.now() - video.timestamp > VIDEO_STORAGE_TTL_MS) {
      return null;
    }

    // Get or create vote counts
    let counts = this.votes.get(videoId);
    if (!counts) {
      counts = { videoId, upvotes: 0, downvotes: 0 };
    }

    // Remove previous vote
    if (previousDirection === 'up') {
      counts.upvotes = Math.max(0, counts.upvotes - 1);
    } else if (previousDirection === 'down') {
      counts.downvotes = Math.max(0, counts.downvotes - 1);
    }

    // Add new vote
    if (newDirection === 'up') {
      counts.upvotes++;
    } else if (newDirection === 'down') {
      counts.downvotes++;
    }

    this.votes.set(videoId, counts);
    return counts;
  }

  /**
   * Get vote counts for a video.
   */
  getVotes(videoId: string): VoteCounts {
    return this.votes.get(videoId) || { videoId, upvotes: 0, downvotes: 0 };
  }
}

// Singleton instance
export const dataStore = new DataStore();
