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

export interface VideoUpload {
  id: string;
  sessionId: string;
  timestamp: number;
  duration: number;
  size: number;
  filename: string;
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
