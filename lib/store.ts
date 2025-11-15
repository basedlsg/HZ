// In-memory data store for Hotzones MVP

import { CheckInSession, HeatBubble, ProximalStream, VideoUpload, GeoLocation } from './types';

// Simple in-memory storage
class DataStore {
  private sessions: Map<string, CheckInSession> = new Map();
  private heatBubbles: Map<string, HeatBubble> = new Map();
  private proximalStreams: Map<string, ProximalStream> = new Map();
  private videos: Map<string, VideoUpload> = new Map();

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

  // Session methods
  addSession(session: CheckInSession): void {
    this.sessions.set(session.id, session);
  }

  getSession(id: string): CheckInSession | undefined {
    return this.sessions.get(id);
  }

  // Heat bubble methods
  getAllHeatBubbles(): HeatBubble[] {
    return Array.from(this.heatBubbles.values());
  }

  // Proximal streams methods
  getProximalStreams(location: GeoLocation, maxDistance: number = 1000): ProximalStream[] {
    const streams = Array.from(this.proximalStreams.values());
    // Simple distance filter (not accurate geospatial math)
    return streams
      .filter(stream => stream.distance < maxDistance)
      .sort((a, b) => a.distance - b.distance);
  }

  // Video methods
  addVideo(video: VideoUpload): void {
    this.videos.set(video.id, video);
  }

  getVideo(id: string): VideoUpload | undefined {
    return this.videos.get(id);
  }

  getAllVideos(): VideoUpload[] {
    return Array.from(this.videos.values());
  }
}

// Singleton instance
export const dataStore = new DataStore();
