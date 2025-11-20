// In-memory data store for Hotzones MVP

import { CheckInSession, HeatBubble, ProximalStream, VideoUpload, GeoLocation, ReactionCounts, Comment, ReactionType, VoteCounts, VoteDirection } from './types';
import { calculateDistance } from './utils';
import { VIDEO_TTL_MS, VIDEO_STORAGE_TTL_MS, ZONE_ASSIGNMENT_MAX_DISTANCE_M, VIDEO_PULSE_WINDOW_MS } from './config';

// Simple in-memory storage
class DataStore {
  private sessions: Map<string, CheckInSession> = new Map();
  private videos: Map<string, VideoUpload> = new Map();
  private reactions: Map<string, ReactionCounts> = new Map(); // videoId -> counts
  private comments: Map<string, Comment> = new Map(); // commentId -> comment
  private votes: Map<string, VoteCounts> = new Map(); // videoId -> vote counts
  // Note: heatBubbles and proximalStreams are generated dynamically, not stored

  constructor() {
    // No fake data initialization - zones are generated dynamically from sessions
  }

  /**
   * Generate heat bubbles dynamically from active sessions.
   * Sessions within 500m of each other are clustered into the same zone.
   *
   * Algorithm:
   * 1. Get all active sessions (within last 30 minutes)
   * 2. Cluster sessions by proximity (500m radius)
   * 3. Calculate zone properties (center, intensity, session count, last activity)
   */
  private generateDynamicZones(): HeatBubble[] {
    const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
    const CLUSTER_RADIUS_M = 500; // Cluster sessions within 500m
    const now = Date.now();

    // Get active sessions
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => now - session.timestamp < SESSION_TTL_MS);

    if (activeSessions.length === 0) {
      return [];
    }

    // Simple clustering: for each session, find all nearby sessions
    const clusters: CheckInSession[][] = [];
    const processed = new Set<string>();

    for (const session of activeSessions) {
      if (processed.has(session.id)) continue;

      // Create new cluster
      const cluster = [session];
      processed.add(session.id);

      // Find all sessions within CLUSTER_RADIUS_M
      for (const otherSession of activeSessions) {
        if (processed.has(otherSession.id)) continue;

        const distance = calculateDistance(session.location, otherSession.location);
        if (distance <= CLUSTER_RADIUS_M) {
          cluster.push(otherSession);
          processed.add(otherSession.id);
        }
      }

      clusters.push(cluster);
    }

    // Convert clusters to heat bubbles
    return clusters.map((cluster, index) => {
      // Calculate centroid (average location)
      const centroid = {
        lat: cluster.reduce((sum, s) => sum + s.location.lat, 0) / cluster.length,
        lng: cluster.reduce((sum, s) => sum + s.location.lng, 0) / cluster.length,
      };

      // Find most recent activity
      const lastActivity = Math.max(...cluster.map(s => s.timestamp));

      // Calculate intensity based on session count and recency
      const ageInMinutes = (now - lastActivity) / (60 * 1000);
      const recencyFactor = Math.max(0.3, 1 - (ageInMinutes / 30)); // Fade over 30 min
      const densityFactor = Math.min(1, cluster.length / 5); // Max at 5+ sessions
      const intensity = (recencyFactor + densityFactor) / 2;

      return {
        id: `zone-${index}`,
        location: centroid,
        intensity,
        radius: Math.min(CLUSTER_RADIUS_M, 100 + cluster.length * 20), // Grows with sessions
        sessionCount: cluster.length,
        lastActivity,
        label: `Zone ${index + 1}`,
      };
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

  /**
   * Get all heat bubbles (zones).
   * Zones are generated dynamically from active sessions, not stored.
   */
  getAllHeatBubbles(): HeatBubble[] {
    return this.generateDynamicZones();
  }

  /**
   * Get a specific heat bubble by ID.
   * Since zones are dynamic, this regenerates all zones and finds the matching one.
   */
  getHeatBubble(id: string): HeatBubble | undefined {
    const zones = this.generateDynamicZones();
    return zones.find(zone => zone.id === id);
  }

  /**
   * Find the nearest zone to a given location.
   * Returns the zone ID and distance, or null if no zone is within max distance.
   */
  findNearestZone(location: GeoLocation): { zoneId: string; distance: number } | null {
    let nearest: { zoneId: string; distance: number } | null = null;

    // Get dynamic zones
    const zones = this.generateDynamicZones();

    for (const bubble of zones) {
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

  /**
   * Get proximal streams (nearby sessions) dynamically.
   * Returns all active sessions within maxDistance from the given location.
   */
  getProximalStreams(location: GeoLocation, maxDistance: number = 1000): ProximalStream[] {
    const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    // Get active sessions
    const activeSessions = Array.from(this.sessions.values())
      .filter(session => now - session.timestamp < SESSION_TTL_MS);

    // Convert to proximal streams with distance calculation
    return activeSessions
      .map((session): ProximalStream => {
        const distance = calculateDistance(location, session.location);
        const ageInSeconds = (now - session.timestamp) / 1000;
        const stability = Math.max(0.4, 1 - (ageInSeconds / 1800)); // Fade over 30 min

        return {
          id: session.id,
          alias: session.alias || 'Anonymous',
          distance,
          stability,
          lastSeen: session.timestamp,
          location: session.location,
        };
      })
      .filter(stream => stream.distance <= maxDistance)
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

    // Initialize empty vote counts for this video
    this.votes.set(video.id, {
      videoId: video.id,
      upvotes: 0,
      downvotes: 0,
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
