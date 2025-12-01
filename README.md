# HOTZONES MVP

A lightweight web app for presence tracking and activity monitoring with secure camera recording, proximal streams, and QR code generation.

## Features

- **Check-In**: Use browser location or manual coordinates to check in
- **Activity Map**: View purple "heat bubbles" showing presence zones
- **Secure Camera**: Record short video segments with panic close button
- **Proximal Streams**: See nearby presence sessions with distance and stability metrics
- **Burner Profile**: Create anonymous alias with auto-generated hex handle
- **QR Codes**: Generate admin and self QR codes with geocell parameters

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **In-memory data store** (no database required)
- **qrcode.react** for QR code generation

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## How to Use

### 1. Check In
- Click "Use My Location" to check in with your browser location
- Or enter coordinates manually (e.g., 37.7749, -122.4194 for San Francisco)
- You'll receive a session token and be redirected to the map

### 2. View Activity Map
The Activity Map is an **ego-centric visualization** of nearby presence zones:

- **What you see**: Purple bubbles representing coarse geographic cells with aggregated activity
- **Size**: Larger bubbles = higher intensity (more sessions in that zone)
- **Brightness**: Brighter bubbles = more recent activity (time-decay makes old zones fade)
- **Number**: Session count actively contributing to each zone
- **Pulse animation**: Fresh zones (< 30 seconds old) have a subtle breathing effect
- **"You" marker**: Blue dot at center - everything is relative to your location

**Interacting with the map:**
- **Hover** over any bubble to see detailed zone info (label, sessions, intensity, last activity, stability)
- **About button** (top-right) explains the conceptual model and future evolution
- **Auto-refresh**: Map updates every 5 seconds to show zones fading as they age

**Understanding zone status:**
- 🟢 **Active**: Fresh (≤ 30s), high intensity, pulsing
- 🟡 **Stable**: Recent (≤ 2min), moderate fade
- 🟠 **Fading**: Older (> 2min), significantly dimmed

This creates a live view of nearby activity that conveys both spatial distribution and temporal dynamics.

### 3. Record Video
- Navigate to Camera view
- Click "Start Recording" to begin capturing (16:9 aspect ratio, 720p preferred)
- Click "Stop Recording" when done
- Use "PANIC CLOSE" to immediately discard recording
- Click "Save & Upload" to save the video file to disk and metadata
- Videos are automatically uploaded to the server and stored in `uploads/` directory
- View your uploaded videos on the Videos page (/videos)

### 4. View Proximal Streams
- See a list of nearby presence sessions
- Each stream shows distance, stability score, and last seen time
- Data refreshes automatically every 5 seconds

### 5. Manage Profile
- Edit your burner alias
- Generate random aliases
- View your auto-generated hex handle
- Clear all local data if needed

### 6. Generate QR Codes
- Choose between Self QR or Admin QR
- Configure geocell ID, TTL, and radius
- Download QR code as PNG
- Use quick presets for common locations

## Data Storage

- **User Profile**: Stored in browser localStorage
- **Session Data**: Stored in browser localStorage
- **Presence/Heatmap Data**: In-memory (resets on server restart)
- **Video Files**: Stored in **Cloudflare R2** (S3-compatible cloud storage)
- **Video Metadata**: In-memory with references to cloud URLs

### Video Storage Details

Videos are uploaded to **Cloudflare R2** cloud storage:

- **Storage**: Cloudflare R2 (S3-compatible object storage)
- **Location**: `hotzones` bucket at `videos/{videoId}.webm`
- **Public URLs**: e.g., `https://...r2.cloudflarestorage.com/hotzones/videos/video-abc123.webm`
- **Retention**: Videos older than **2 hours** are filtered out in the app logic
- **Cleanup**: TTL enforcement in app code; optionally configure R2 lifecycle rules for automatic deletion
- **Serving**: Videos served directly from R2 URLs (no server streaming required)
- **Global Access**: R2 CDN delivers videos worldwide with low latency

### R2 Configuration

Set these environment variables (see `.env.example`):

```bash
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_ENDPOINT=https://...r2.cloudflarestorage.com
R2_BUCKET=hotzones
R2_PUBLIC_BASE_URL=https://...r2.cloudflarestorage.com/hotzones
```

**For Vercel deployment:**
```bash
vercel env add R2_ACCESS_KEY_ID
vercel env add R2_SECRET_ACCESS_KEY
vercel env add R2_ENDPOINT
vercel env add R2_BUCKET
vercel env add R2_PUBLIC_BASE_URL
```

Or use the Vercel dashboard: Project Settings → Environment Variables

**Optional: R2 Lifecycle Rule**
For automatic deletion of old videos, configure an R2 lifecycle policy to delete objects after N hours/days. This complements the app's TTL enforcement.

## API Endpoints

- `POST /api/checkin` - Create a new presence session
- `GET /api/heatmap` - Get all heat bubble data
- `GET /api/heatmap-pulse` - Get video pulse data for map bubbles
- `GET /api/proximal-streams` - Get nearby presence streams
- `POST /api/upload-video` - Upload video file to R2 (multipart/form-data)
- `GET /api/videos` - Get all active video metadata (includes cloudUrl)
- `POST /api/reactions` - Add an anonymous reaction to a video
- `GET /api/reactions?videoId={id}` - Get reaction counts for a video
- `POST /api/comments` - Add a proximity-gated comment to a video
- `GET /api/comments?videoId={id}` - Get comments for a video
- `POST /api/vote` - Cast or toggle a vote on a video
- `GET /api/vote?videoId={id}` - Get vote counts for a video

**Note**: Videos are served directly from R2 public URLs, not via server API.

## Project Structure

```
/app
  /api              # API routes
    /video/[videoId] # Video streaming endpoint
    /upload-video    # Video upload handler
    /reactions       # Reaction management
    /comments        # Comment management
  /camera           # Camera recording view (16:9 aspect ratio)
  /map              # Activity map view with video pulses
  /profile          # User profile management
  /qr               # QR code generator
  /streams          # Proximal streams list
  /videos           # Video feed with reactions and comments
  page.tsx          # Home/check-in page
/components
  AspectVideo.tsx   # Reusable 16:9 video container
/lib
  config.ts         # Configuration constants (TTLs, thresholds)
  store.ts          # In-memory data store
  types.ts          # TypeScript type definitions
  utils.ts          # Utility functions
/uploads            # Local video file storage (auto-created)
```

## Conceptual Model: Presence Zones

### What are Presence Zones?

Presence zones are **coarse geographic cells** that aggregate nearby activity into a single visual representation. Instead of showing individual users as precise points (which would compromise privacy and create visual clutter), we cluster activity into zones.

### Why Ego-Centric?

The Activity Map is centered on **"You"** because presence is fundamentally relative:
- You care about what's happening **near you**, not globally
- Distances and relevance are measured **from your position**
- This mirrors how we naturally perceive space and proximity

### How Zones Convey "Life"

Zones use multiple visual channels to communicate activity:
- **Size** (radius) = intensity/session count (spatial density)
- **Brightness** (opacity) = recency (temporal freshness)
- **Animation** (pulse) = freshness indicator (< 30s)
- **Label** (on hover) = geographic identifier (e.g., "Mission-01")

As zones age, they naturally fade through time-decay:
- 0-30s: Full brightness, pulsing (active)
- 30s-2min: Strong, no pulse (stable)
- 2-5min: Dimming (fading)
- 5min+: Very faint (stale)

This creates an intuitive sense of where activity **is happening now** vs. where it **was recent** vs. where it's **dying out**.

### Future Evolution

In a production system, zones would be derived from:
- **Real geospatial cells** (H3, S2, or similar hierarchical systems)
- **Movement tracking** (zones that migrate as groups move)
- **Density overlays** (crowd concentration indicators)
- **Safety/risk signals** (community-reported hazards)
- **Persistence models** (long-term vs. transient zones)

This MVP uses fake zones with simulated timestamps to demonstrate the core concept without geospatial dependencies.

## Technical Notes

- This is an MVP focused on functionality over architecture
- No real geospatial calculations (simple distance approximations)
- No authentication or encryption (simulated)
- Camera requires HTTPS in production (works on localhost)
- All data is ephemeral and resets on server restart
