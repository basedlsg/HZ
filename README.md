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
- See purple heat bubbles representing activity zones
- Bubble size indicates intensity, numbers show session count
- Your location is marked with a blue dot

### 3. Record Video
- Navigate to Camera view
- Click "Start Recording" to begin
- Click "Stop Recording" when done
- Use "PANIC CLOSE" to immediately discard recording
- Click "Save & Upload" to save the video metadata

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
- **Video Metadata**: In-memory (actual video files not saved)

## API Endpoints

- `POST /api/checkin` - Create a new presence session
- `GET /api/heatmap` - Get all heat bubble data
- `GET /api/proximal-streams` - Get nearby presence streams
- `POST /api/upload-video` - Upload video metadata

## Project Structure

```
/app
  /api              # API routes
  /camera           # Camera recording view
  /map              # Activity map view
  /profile          # User profile management
  /qr               # QR code generator
  /streams          # Proximal streams list
  page.tsx          # Home/check-in page
/lib
  store.ts          # In-memory data store
  types.ts          # TypeScript type definitions
  utils.ts          # Utility functions
```

## Notes

- This is an MVP focused on functionality over architecture
- No real geospatial calculations (simple distance approximations)
- No authentication or encryption (simulated)
- Camera requires HTTPS in production (works on localhost)
- All data is ephemeral and resets on server restart
