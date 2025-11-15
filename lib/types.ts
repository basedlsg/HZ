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

export interface HeatBubble {
  id: string;
  location: GeoLocation;
  intensity: number; // 0-1
  radius: number; // in meters
  sessionCount: number;
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
