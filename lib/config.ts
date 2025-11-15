/**
 * Configuration constants for Hotzones features
 *
 * These values control TTLs, proximity requirements, and rate limits.
 * Keeping them centralized makes tuning easier.
 */

// ============================================================================
// Event/Video TTL and Expiry
// ============================================================================

/** How long (in ms) before a video/event expires and stops showing reactions/comments */
export const VIDEO_TTL_MS = 30 * 60 * 1000; // 30 minutes

/** How long (in ms) a "recent video" counts for map pulse effects */
export const VIDEO_PULSE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** How long (in ms) to show the immediate pulse after a single video upload */
export const VIDEO_PULSE_IMMEDIATE_MS = 20 * 1000; // 20 seconds

// ============================================================================
// Proximity Requirements for Comments
// ============================================================================

/** Maximum distance (in meters) a user can be from a video's zone to comment */
export const COMMENT_PROXIMITY_RADIUS_M = 200; // 200 meters

/** Maximum age (in ms) of a user's check-in session to be considered "fresh" for commenting */
export const COMMENT_SESSION_FRESHNESS_MS = 10 * 60 * 1000; // 10 minutes

/** Maximum comment length in characters */
export const COMMENT_MAX_LENGTH = 120;

// ============================================================================
// Rate Limiting
// ============================================================================

/** Minimum time (in ms) between comments from the same session */
export const COMMENT_RATE_LIMIT_MS = 5 * 1000; // 5 seconds

// ============================================================================
// Zone Assignment
// ============================================================================

/**
 * When determining which zone a video belongs to, this is the maximum
 * distance (in meters) to consider. If no zone is within this distance,
 * the video is "unzoned".
 */
export const ZONE_ASSIGNMENT_MAX_DISTANCE_M = 300; // 300 meters
