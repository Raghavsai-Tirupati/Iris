"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Hazard {
  id: string;
  latitude: number;
  longitude: number;
  description: string;
  timestamp: number;
}

function createHazardIcon() {
  return L.divIcon({
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -20],
    html: `
      <div style="position:relative;width:32px;height:32px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;
          width:32px;height:32px;
          border-radius:50%;
          background:rgba(239,83,80,0.2);
          animation:hazardPulse 2s ease-out infinite;
        "></div>
        <div style="
          position:absolute;
          width:20px;height:20px;
          border-radius:50%;
          background:rgba(239,83,80,0.35);
          animation:hazardPulse 2s ease-out infinite 0.3s;
        "></div>
        <div style="
          position:relative;
          width:12px;height:12px;
          border-radius:50%;
          background:radial-gradient(circle at 40% 35%, #ff7043, #ef5350, #c62828);
          box-shadow:0 0 10px rgba(239,83,80,0.8), 0 0 20px rgba(239,83,80,0.4);
          border:2px solid rgba(255,255,255,0.9);
        "></div>
      </div>
    `,
  });
}

const hazardIcon = createHazardIcon();

function createUserIcon() {
  return L.divIcon({
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <div style="position:relative;width:28px;height:28px;display:flex;align-items:center;justify-content:center;">
        <div style="
          position:absolute;
          width:28px;height:28px;
          border-radius:50%;
          background:rgba(79,195,247,0.15);
          animation:hazardPulse 3s ease-out infinite;
        "></div>
        <div style="
          position:relative;
          width:12px;height:12px;
          border-radius:50%;
          background:radial-gradient(circle at 40% 35%, #81d4fa, #4fc3f7, #0288d1);
          box-shadow:0 0 10px rgba(79,195,247,0.8), 0 0 20px rgba(79,195,247,0.3);
          border:2px solid rgba(255,255,255,0.95);
        "></div>
      </div>
    `,
  });
}

const userIcon = createUserIcon();

function RecenterOnNewHazard({ hazards }: { hazards: Hazard[] }) {
  const map = useMap();
  useEffect(() => {
    if (hazards.length > 0) {
      const latest = hazards[hazards.length - 1];
      map.flyTo([latest.latitude, latest.longitude], map.getZoom(), {
        duration: 1.2,
      });
    }
  }, [hazards, map]);
  return null;
}

export default function HazardMap({ hazards, userLocation, compact }: {
  hazards: Hazard[];
  userLocation?: [number, number] | null;
  compact?: boolean;
}) {
  const center: [number, number] =
    userLocation
      ? userLocation
      : hazards.length > 0
        ? [hazards[hazards.length - 1].latitude, hazards[hazards.length - 1].longitude]
        : [30.2849, -97.7341];

  return (
    <>
      <style>{`
        @keyframes hazardPulse {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(2.2); opacity: 0; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .leaflet-popup-content-wrapper {
          background: #1a1a1a !important;
          border: 1px solid #333 !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(239,83,80,0.1) !important;
        }
        .leaflet-popup-content {
          color: #e0e0e0 !important;
          margin: 14px 16px !important;
          font-family: var(--font-sans), system-ui, sans-serif !important;
        }
        .leaflet-popup-tip {
          background: #1a1a1a !important;
          border: 1px solid #333 !important;
          box-shadow: none !important;
        }
        .leaflet-popup-close-button {
          color: #666 !important;
        }
        .leaflet-popup-close-button:hover {
          color: #fff !important;
        }
        .leaflet-control-attribution {
          background: rgba(10,10,10,0.8) !important;
          color: #555 !important;
        }
        .leaflet-control-attribution a {
          color: #666 !important;
        }
        .leaflet-control-zoom a {
          background: #1a1a1a !important;
          color: #999 !important;
          border-color: #333 !important;
        }
        .leaflet-control-zoom a:hover {
          background: #252525 !important;
          color: #fff !important;
        }
      `}</style>
      <MapContainer
        center={center}
        zoom={compact ? 16 : 15}
        style={{ height: "100%", width: "100%", background: "#0a0a0a" }}
        scrollWheelZoom={!compact}
        zoomControl={!compact}
        dragging={!compact}
        attributionControl={!compact}
      >
        <TileLayer
          attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {!compact && <RecenterOnNewHazard hazards={hazards} />}
        {userLocation && (
          <Marker position={userLocation} icon={userIcon}>
            <Popup>
              <div style={{ maxWidth: 200 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#4fc3f7",
                    boxShadow: "0 0 6px rgba(79,195,247,0.6)",
                  }} />
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#4fc3f7",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}>
                    Your Location
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        )}
        {hazards.map((h) => (
          <Marker key={h.id} position={[h.latitude, h.longitude]} icon={hazardIcon}>
            <Popup>
              <div style={{ maxWidth: 260 }}>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}>
                  <span style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "#ef5350",
                    boxShadow: "0 0 6px rgba(239,83,80,0.6)",
                  }} />
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#ef5350",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                  }}>
                    Hazard Detected
                  </span>
                </div>
                <p style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  margin: 0,
                  color: "#e0e0e0",
                }}>
                  {h.description}
                </p>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 10,
                  paddingTop: 8,
                  borderTop: "1px solid #2a2a2a",
                }}>
                  <span style={{ fontSize: 11, color: "#666" }}>
                    {new Date(h.timestamp).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  <span style={{ fontSize: 11, color: "#555" }}>
                    {h.latitude.toFixed(4)}, {h.longitude.toFixed(4)}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </>
  );
}
