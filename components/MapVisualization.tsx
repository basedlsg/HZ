import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { FeedItem } from '../types';
import L from 'leaflet';
import { Loader2 } from 'lucide-react';

// Strict CSS Marker (Purple Circle)
// We use L.DivIcon to render raw HTML/CSS instead of relying on image assets that might fail
// Helper to determine zone status from votes
// Helper to determine zone status from votes
const getZoneStatus = (votes?: any) => {
    if (!votes) return 'NEUTRAL';
    const up = votes.up || 0;
    const down = votes.down || 0;

    if (up === 0 && down === 0) return 'NEUTRAL';

    // Priority Logic for Thumbs Up/Down
    // Downvote = Danger/Negative
    // Upvote = Safe/Positive

    if (down > up) return 'DANGER';
    if (up > down) return 'SAFE';

    return 'NEUTRAL'; // Tie
};

// Dynamic Marker Icon based on Status
const createIncidentIcon = (status: string) => {
    // Branding: Always Purple Background
    const color = '#8b5cf6';

    // Status Logic
    let shadowColor = 'rgba(139, 92, 246, 0.4)';
    let animation = '';
    let emoji = '';

    if (status === 'DANGER') {
        shadowColor = 'rgba(239, 68, 68, 0.8)'; // Red Pulse for Danger
        animation = 'animation: pulse-ring 1.5s infinite;';
        emoji = '🚨';
    } else if (status === 'SAFE') {
        emoji = '🛡️';
    } else if (status === 'CAUTION') {
        emoji = '👁️';
    }

    return new L.DivIcon({
        className: 'custom-marker',
        html: `<div style="
            background-color: ${color}; 
            width: 32px; 
            height: 32px; 
            border-radius: 50%; 
            border: 2px solid white; 
            box-shadow: 0 0 10px ${shadowColor};
            ${animation}
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
        ">${emoji}</div>
        <style>
            @keyframes pulse-ring {
                0% { box-shadow: 0 0 0 0 ${shadowColor}; }
                70% { box-shadow: 0 0 0 12px rgba(0,0,0,0); }
                100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
            }
        </style>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
};

const createUserIcon = () => new L.DivIcon({
    className: 'user-marker',
    html: `<div style="
        background-color: #3b82f6; 
        width: 24px; 
        height: 24px; 
        border-radius: 50%; 
        border: 2px solid white; 
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12]
});

interface MapVisualizationProps {
    items: FeedItem[];
    isDarkMode: boolean;
}

// Recenter ONCE on load, then let user roam freely
const RecenterMap = ({ lat, lng }: { lat: number, lng: number }) => {
    const map = useMap();
    const [hasCentered, setHasCentered] = useState(false);

    useEffect(() => {
        if (!hasCentered && lat !== 0 && lng !== 0) {
            map.setView([lat, lng], 15);
            setHasCentered(true);
        }
    }, [lat, lng, map, hasCentered]);
    return null;
};

export const MapVisualization: React.FC<MapVisualizationProps> = ({ items, isDarkMode }) => {
    const [center, setCenter] = useState<[number, number] | null>(null);

    useEffect(() => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => setCenter([pos.coords.latitude, pos.coords.longitude]),
                () => {
                    console.log("Loc unavailable, using safe default");
                    setCenter([40.7128, -74.0060]); // NYC
                }
            );
        } else {
            setCenter([40.7128, -74.0060]);
        }
    }, []);

    if (!center) {
        return (
            <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? 'bg-zinc-900' : 'bg-gray-100'} `}>
                <Loader2 className="animate-spin text-brand-purple" />
            </div>
        );
    }

    // CartoDB Tiles (Clean, Fast)
    const tileLayerUrl = isDarkMode
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    const attribution = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

    return (
        <div className="w-full h-full z-0 relative">
            <MapContainer
                center={center}
                zoom={14}
                style={{ height: '100%', width: '100%', background: isDarkMode ? '#242f3e' : '#f0f0f0' }}
                zoomControl={false} // We can add buttons later if needed, but standard touch gestures work
            >
                <TileLayer
                    attribution={attribution}
                    url={tileLayerUrl}
                />

                <RecenterMap lat={center[0]} lng={center[1]} />

                {/* Users Location */}
                <Marker position={center} icon={createUserIcon()}>
                    <Popup>You are Here</Popup>
                </Marker>

                {/* Incidents (Purple Circles) */}
                {items.map(item => {
                    const status = getZoneStatus(item.userVotes);
                    return (
                        <Marker
                            key={item.id}
                            position={[item.location.lat, item.location.lng]}
                            icon={createIncidentIcon(status)}
                        >
                            <Popup>
                                <div className="text-xs">
                                    <strong>{item.analysis?.summary || 'Recorded Event'}</strong><br />
                                    Safety: {item.analysis?.safetyScore || 'N/A'}%
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

            </MapContainer>
        </div>
    );
};