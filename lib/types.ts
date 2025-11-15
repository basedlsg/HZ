// Core types for Hotzones MVP

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface CheckInSession {
  id: string;
  location: GeoLocation;
  timestamp: number;
  token: string;
  alias?: string;
}

/**
 * Represents a "presence zone" - a coarse geographic cell showing aggregated activity.
 *
 * Conceptual model:
 * - Each bubble represents recent activity in a geographic area
 * - Size (visual radius) corresponds to intensity/session count
 * - Opacity/brightness corresponds to recency - newer activity is brighter
 * - The number displayed is the count of active sessions in this zone
 *
 * In a production system, these would be derived from real geospatial cells (H3/S2),
 * but in this MVP they are simulated zones with fake timestamps.
 */
export interface HeatBubble {
  id: string;
  location: GeoLocation;

  /** Intensity score (0-1) representing activity level. Higher = more active. */
  intensity: number;

  /** Physical radius in meters - used for proximity calculations */
  radius: number;

  /** Number of active sessions contributing to this zone */
  sessionCount: number;

  /** Unix timestamp (ms) of the most recent activity in this zone */
  lastActivity: number;

  /**
   * Zone label for display purposes (e.g., "Zone A", "Mission-01")
   * In production, this would be derived from geocell ID
   */
  label?: string;
}

export interface ProximalStream {
  id: string;
  alias: string;
  distance: number; // in meters
  stability: number; // 0-1
  lastSeen: number;
  location: GeoLocation;
}

/**
 * Represents an uploaded video/event captured in a zone.
 *
 * Videos are tied to sessions (which have locations) and can be
 * assigned to zones for geographic aggregation.
 */
export interface VideoUpload {
  id: string;
  sessionId: string;
  timestamp: number;
  duration: number;
  size: number;
  filename: string;

  /**
   * Location where the video was recorded (derived from session).
   * Used for zone assignment and proximity calculations.
   */
  location?: GeoLocation;

  /**
   * ID of the zone this video belongs to (if assigned).
   * Used for showing video pulses on map bubbles.
   */
  zoneId?: string;
}

export interface UserProfile {
  alias: string;
  hexHandle: string;
}

export interface QRData {
  type: 'admin' | 'self';
  geocell: string;
  ttl: number; // in seconds
  radius: number; // in meters
  timestamp: number;
}

// ============================================================================
// Reactions and Comments
// ============================================================================

/**
 * Available reaction types for videos/events.
 *
 * These are anonymous, count-only reactions:
 * - 👀 "I see this" (eyesReaction)
 * - ⚠️ "Risky" (riskyReaction)
 * - ✅ "Resolved / cooled down" (resolvedReaction)
 * - ❓ "Unclear" (unclearReaction)
 */
export type ReactionType = 'eyes' | 'risky' | 'resolved' | 'unclear';

/**
 * Aggregated reaction counts for a video/event.
 * All reactions are anonymous - we only track counts.
 */
export interface ReactionCounts {
  videoId: string;
  eyes: number;      // 👀 "I see this"
  risky: number;     // ⚠️ "Risky"
  resolved: number;  // ✅ "Resolved / cooled down"
  unclear: number;   // ❓ "Unclear"
}

/**
 * A short text comment on a video/event.
 *
 * Comments are proximity-gated: users can only comment if:
 * - They have a fresh check-in session (within COMMENT_SESSION_FRESHNESS_MS)
 * - Their location is within COMMENT_PROXIMITY_RADIUS_M of the video's zone
 *
 * Comments are anonymous (no usernames) and auto-expire with the video.
 */
export interface Comment {
  id: string;
  videoId: string;
  text: string;
  timestamp: number;

  /**
   * Session ID of the commenter (for rate limiting, not displayed).
   * We don't show this to users - comments are anonymous.
   */
  sessionId: string;
}
