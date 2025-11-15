// Utility functions for Hotzones MVP

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function generateToken(): string {
  return Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
}

export function generateHexHandle(alias: string): string {
  // Generate a simple hex handle from alias
  const hash = alias.split('').reduce((acc, char) => {
    return ((acc << 5) - acc + char.charCodeAt(0)) | 0;
  }, 0);
  return Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function formatTimestamp(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

/**
 * Calculate a time-decay multiplier for visual effects (opacity, brightness).
 *
 * Conceptual model:
 * - Fresh activity (< 30s) = full strength (1.0)
 * - Recent activity (30s - 2min) = strong (0.7 - 1.0)
 * - Fading activity (2min - 5min) = weak (0.3 - 0.7)
 * - Old activity (> 5min) = very faint (0.1 - 0.3)
 *
 * This creates a visual sense of "life" - newer zones appear brighter/stronger.
 */
export function calculateRecencyDecay(lastActivity: number): number {
  const ageInSeconds = (Date.now() - lastActivity) / 1000;

  if (ageInSeconds < 30) return 1.0; // Fresh
  if (ageInSeconds < 120) return 0.7 + (0.3 * (1 - (ageInSeconds - 30) / 90)); // Recent
  if (ageInSeconds < 300) return 0.3 + (0.4 * (1 - (ageInSeconds - 120) / 180)); // Fading
  return Math.max(0.1, 0.3 * (1 - (ageInSeconds - 300) / 300)); // Old
}

/**
 * Get a stability label for a zone based on its age and intensity.
 *
 * This helps users understand if a zone is:
 * - "active" (fresh, high intensity)
 * - "stable" (moderately fresh, consistent)
 * - "fading" (older, declining)
 */
export function getZoneStability(lastActivity: number, intensity: number): 'active' | 'stable' | 'fading' {
  const ageInSeconds = (Date.now() - lastActivity) / 1000;

  if (ageInSeconds < 60 && intensity > 0.6) return 'active';
  if (ageInSeconds < 120) return 'stable';
  return 'fading';
}

/**
 * Calculate approximate distance between two geographic points in meters.
 *
 * This uses the Haversine formula for spherical distance.
 * It's not perfectly accurate (Earth is not a perfect sphere), but good enough
 * for our proximity checks in an MVP.
 */
export function calculateDistance(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (point1.lat * Math.PI) / 180;
  const φ2 = (point2.lat * Math.PI) / 180;
  const Δφ = ((point2.lat - point1.lat) * Math.PI) / 180;
  const Δλ = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
