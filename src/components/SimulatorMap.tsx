/**
 * SimulatorMap — Fully automatic live GPS tracking map
 *
 * When opened with a deviceCode (QR scan flow):
 *   - Auto-starts simulation immediately, no user interaction needed
 *   - Vehicle moves along a real road route, updating every second
 *   - When vehicle stops for 2 minutes → 3D GREEN geofence auto-appears
 *   - No controls shown — fully autonomous
 *
 * When opened without deviceCode (standalone simulator):
 *   - Full controls panel shown for manual operation
 */

import React, { useEffect, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Tooltip,
  Popup,
  Circle,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  useSimulatorPolling,
  VehicleTelemetry,
  SimulatorRoute,
} from "@/hooks/useSimulatorPolling";
import { apiRequest } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { createCustomMarkerIcon } from "@/utils/iconUtils";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";

// ─── Saved Places (shown clearly on the map) ─────────────────────────────────
interface SavedPlace {
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  coordinates: [number, number];
}

const SAVED_PLACES: SavedPlace[] = [
  {
    name: 'Home',
    emoji: '🏠',
    color: '#1E40AF',
    bgColor: '#DBEAFE',
    borderColor: '#3B82F6',
    coordinates: [12.9488, 77.6175],   // Koramangala (Simulator End)
  },
  {
    name: 'Office',
    emoji: '🏢',
    color: '#7C3AED',
    bgColor: '#EDE9FE',
    borderColor: '#8B5CF6',
    coordinates: [12.9758, 77.6064],   // MG Road (Simulator Start)
  },
  {
    name: 'College',
    emoji: '🎓',
    color: '#B45309',
    bgColor: '#FEF3C7',
    borderColor: '#F59E0B',
    coordinates: [12.9660, 77.6018],   // Richmond Road (Simulator Middle)
  },
];

const ARRIVAL_RADIUS_METERS = 150;

// ─── Danger Zones ────────────────────────────────────────────────────────────
interface DangerZone {
  name: string;
  coordinates: [number, number];
  radiusMeters: number;
  alternateRouteId: string;
}

const DANGER_ZONES: DangerZone[] = [
  {
    name: 'Richmond Circle High Traffic',
    coordinates: [12.9645, 77.5998], // Intersects the default route
    radiusMeters: 250,
    alternateRouteId: 'blr-richmond-jayanagar'
  }
];

function buildSavedPlaceIcon(place: SavedPlace): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      display:flex;flex-direction:column;align-items:center;gap:2px;
      filter:drop-shadow(0 4px 10px rgba(0,0,0,.5));
    ">
      <div style="
        background:${place.bgColor};
        border:3px solid ${place.borderColor};
        border-radius:16px;
        padding:6px 14px;
        display:flex;align-items:center;gap:6px;
        white-space:nowrap;
        box-shadow:0 2px 12px rgba(0,0,0,.25);
      ">
        <span style="font-size:22px;line-height:1;">${place.emoji}</span>
        <span style="font-size:13px;font-weight:900;color:${place.color};letter-spacing:.5px;text-transform:uppercase;">${place.name}</span>
      </div>
      <div style="
        width:0;height:0;
        border-left:9px solid transparent;border-right:9px solid transparent;
        border-top:12px solid ${place.borderColor};
      "></div>
    </div>`,
    className: "",
    iconSize: [120, 60],
    iconAnchor: [60, 60],
  });
}

// ─── Device marker: shows actual device symbol from API ──────────────────────
function buildDeviceMarkerIcon(
  iconName: string,
  status: "Moving" | "Idle" | "Stopped",
): L.DivIcon {
  const sc =
    status === "Moving" ? "#10B981" : status === "Idle" ? "#F59E0B" : "#EF4444";

  // Use standard 'car' to utilize the robust image icon rather than Node.js renderToString which crashes in Vite prod
  const sc2 = sc;
  const actualIconName = (!iconName || iconName === "car") ? "car" : iconName;
  const inner = createCustomMarkerIcon(actualIconName, sc2, 52);
  return L.divIcon({
    html: `<div style="width:72px;height:72px;display:flex;align-items:center;
      justify-content:center;
      filter:drop-shadow(0 4px 8px rgba(0,0,0,.6)) drop-shadow(0 0 6px ${sc}99);">
      ${(inner.options.html as string) ?? ""}
    </div>`,
    className: "",
    iconSize: [72, 72],
    iconAnchor: [36, 36],
  });
}

function buildStartIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div style="width:14px;height:14px;background:#6366F1;border:3px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
    className: "",
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

function buildStopHistoryIcon(label: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:linear-gradient(135deg,#EC4899,#BE185D);
      border:3px solid white;
      box-shadow:0 2px 8px rgba(236,72,153,.5);
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:900;font-size:14px;font-family:sans-serif;
    ">${label}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/**
 * 3-D parking cage — large, neon-green, fence-mesh walls, roof “P” marking,
 * corner fence-posts, drop animation. Car appears centred in the front face.
 */
function buildGeofenceCubeIcon(): L.DivIcon {
  const G = "#00FF88"; // neon bright green
  const Gm = "#00CC66"; // medium green
  const Gd = "#004422"; // dark green (back faces)
  const Ge = "#AAFFD0"; // highlight / edge
  const Gf = "rgba(0,255,136,0.12)"; // face fill

  // Cabinet-oblique projection
  // Front face 175×145 px, depth 90 at 38° → dx=71, dy=−56
  const ax = 25,
    ay = 80; // A front-top-left
  const bx = 200,
    by = 80; // B front-top-right
  const cx = 200,
    cy = 225; // C front-bot-right
  const dx = 25,
    dy = 225; // D front-bot-left
  const ex = 96,
    ey = 24; // E back-top-left  (A+71,-56)
  const fx = 271,
    fy = 24; // F back-top-right
  const gx = 271,
    gy = 169; // G back-bot-right
  const hx = 96,
    hy = 169; // H back-bot-left

  // Fence mesh on front face: 4 vertical + 3 horizontal bars
  const fvBars = [75, 115, 155]
    .map(
      (x) =>
        `<line x1="${x}" y1="${ay}" x2="${x}" y2="${cy}" stroke="${G}" stroke-width="1.2" opacity="0.28"/>`,
    )
    .join("");
  const fhBars = [130, 165, 200]
    .map(
      (y) =>
        `<line x1="${ax}" y1="${y}" x2="${bx}" y2="${y}" stroke="${G}" stroke-width="1.2" opacity="0.28"/>`,
    )
    .join("");

  // Fence mesh on right face B-F-G-C: 2 horizontal bars
  const rvBars = [0.35, 0.67]
    .map((t) => {
      const y1s = by + (cy - by) * t,
        y1e = fy + (gy - fy) * t;
      return `<line x1="${bx}" y1="${y1s}" x2="${fx}" y2="${y1e}" stroke="${G}" stroke-width="1" opacity="0.22"/>`;
    })
    .join("");

  const p = (pts: number[][]) => pts.map(([x, y]) => `${x},${y}`).join(" ");

  // Roof “P” centre: avg of A B F E
  const rpx = Math.round((ax + bx + fx + ex) / 4);
  const rpy = Math.round((ay + by + fy + ey) / 4);

  const svg = `
<svg width="155" height="125" viewBox="0 0 310 250" xmlns="http://www.w3.org/2000/svg">
<style>
  @keyframes cage-drop {
    0%   { transform: translateY(-36px) scaleY(0.6); opacity:0; }
    65%  { transform: translateY(6px)   scaleY(1.04); opacity:1; }
    100% { transform: translateY(0)     scaleY(1);    opacity:1; }
  }
  @keyframes cage-pulse {
    0%,100% { opacity:1; }
    50%      { opacity:0.82; }
  }
  .cage  { animation: cage-drop 0.75s cubic-bezier(.175,.885,.32,1.275) forwards; }
  .pulse { animation: cage-pulse 2.2s ease-in-out infinite 0.8s; }
</style>
<defs>
  <filter id="glow" x="-55%" y="-55%" width="210%" height="210%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <filter id="glow2" x="-30%" y="-30%" width="160%" height="160%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="b"/>
    <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
</defs>

<g class="cage">

<!-- Ground shadow -->
<ellipse cx="${(dx + cx + gx + hx) / 4}" cy="${(dy + cy + gy + hy) / 4 + 8}"
  rx="95" ry="18"
  fill="rgba(0,255,136,0.12)" />

<g filter="url(#glow)">
  <!-- Hidden back face E-F-G-H -->
  <polygon points="${p([
    [ex, ey],
    [fx, fy],
    [gx, gy],
    [hx, hy],
  ])}"
    fill="${Gd}" fill-opacity="0.25" stroke="${Gd}" stroke-width="1.5"
    stroke-dasharray="8 5" opacity="0.5"/>
  <!-- H→D edge -->
  <line x1="${hx}" y1="${hy}" x2="${dx}" y2="${dy}"
    stroke="${Gm}" stroke-width="1.5" stroke-dasharray="8 5" opacity="0.45"/>
  <!-- H→G bottom-back -->
  <line x1="${hx}" y1="${hy}" x2="${gx}" y2="${gy}"
    stroke="${Gd}" stroke-width="1.5" stroke-dasharray="8 5" opacity="0.4"/>
  <!-- Back-left pillar E→H -->
  <line x1="${ex}" y1="${ey}" x2="${hx}" y2="${hy}"
    stroke="${Gm}" stroke-width="2" stroke-dasharray="8 5" opacity="0.5"/>

  <!-- Right face B-F-G-C + mesh -->
  <polygon points="${p([
    [bx, by],
    [fx, fy],
    [gx, gy],
    [cx, cy],
  ])}"
    fill="${Gm}" fill-opacity="0.22" stroke="${G}" stroke-width="2.5"/>
  ${rvBars}

  <!-- Front face A-B-C-D + mesh -->
  <polygon points="${p([
    [ax, ay],
    [bx, by],
    [cx, cy],
    [dx, dy],
  ])}"
    fill="${Gf}" stroke="${G}" stroke-width="3"/>
  ${fvBars}${fhBars}

  <!-- Top face (roof) A-B-F-E -->
  <polygon points="${p([
    [ax, ay],
    [bx, by],
    [fx, fy],
    [ex, ey],
  ])}"
    fill="${G}" fill-opacity="0.48" stroke="${Ge}" stroke-width="3.5"/>
  <!-- Roof parking stripes -->
  <line x1="${ax + 28}" y1="${ay}" x2="${ex + 28}" y2="${ey}"
    stroke="white" stroke-width="2" stroke-dasharray="14 7" opacity="0.45"/>
  <line x1="${bx - 28}" y1="${by}" x2="${fx - 28}" y2="${fy}"
    stroke="white" stroke-width="2" stroke-dasharray="14 7" opacity="0.45"/>

  <!-- PILLAR EDGES -->
  <line x1="${ax}" y1="${ay}" x2="${dx}" y2="${dy}" stroke="${Ge}" stroke-width="4.5"/>
  <line x1="${bx}" y1="${by}" x2="${cx}" y2="${cy}" stroke="${Ge}" stroke-width="4.5"/>
  <line x1="${fx}" y1="${fy}" x2="${gx}" y2="${gy}" stroke="${G}"  stroke-width="3"/>

  <!-- TOP PERIMETER -->
  <line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${Ge}" stroke-width="4.5"/>
  <line x1="${bx}" y1="${by}" x2="${fx}" y2="${fy}" stroke="${Ge}" stroke-width="4"/>
  <line x1="${fx}" y1="${fy}" x2="${ex}" y2="${ey}" stroke="${G}"  stroke-width="3"/>
  <line x1="${ex}" y1="${ey}" x2="${ax}" y2="${ay}" stroke="${G}"  stroke-width="3"/>

  <!-- BOTTOM PERIMETER -->
  <line x1="${dx}" y1="${dy}" x2="${cx}" y2="${cy}" stroke="${Ge}" stroke-width="4"/>
  <line x1="${cx}" y1="${cy}" x2="${gx}" y2="${gy}" stroke="${G}"  stroke-width="3"/>
  <line x1="${dx}" y1="${dy}" x2="${hx}" y2="${hy}"
    stroke="${Gm}" stroke-width="2" stroke-dasharray="8 5" opacity="0.5"/>

  <!-- FENCE POST CAPS (circles at corners) -->
  <circle cx="${ax}" cy="${ay}" r="7" fill="${Ge}" stroke="white" stroke-width="2"/>
  <circle cx="${bx}" cy="${by}" r="7" fill="${Ge}" stroke="white" stroke-width="2"/>
  <circle cx="${dx}" cy="${dy}" r="7" fill="${Ge}" stroke="white" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="7" fill="${Ge}" stroke="white" stroke-width="2"/>
  <circle cx="${fx}" cy="${fy}" r="5" fill="${G}"  stroke="white" stroke-width="1.5"/>
  <circle cx="${gx}" cy="${gy}" r="5" fill="${G}"  stroke="white" stroke-width="1.5"/>
  <circle cx="${ex}" cy="${ey}" r="4" fill="${Gm}" stroke="white" stroke-width="1" opacity="0.6"/>
</g>

<!-- Roof “P” label (no glow for crispness) -->
<g filter="url(#glow2)">
  <text x="${rpx}" y="${rpy + 10}"
    text-anchor="middle" font-size="32" font-weight="900"
    fill="white" font-family="Arial Black,sans-serif" opacity="0.92">P</text>
</g>

<!-- “PARKED” badge above cage -->
<g class="pulse">
  <rect x="${rpx - 46}" y="2" width="92" height="20" rx="10"
    fill="${G}" opacity="0.9"/>
  <text x="${rpx}" y="16"
    text-anchor="middle" font-size="11" font-weight="900"
    fill="#001a0a" font-family="monospace" letter-spacing="1.5">PARKED</text>
</g>

</g><!-- end .cage -->
</svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [155, 125],
    // Anchor at front-face centre so car marker sits inside the cage
    iconAnchor: [56, 76],
  });
}

// ─── Distance Helper ──────────────────────────────────────────────────────────
function distanceMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const dLat = (b[0] - a[0]) * Math.PI / 180;
  const dLon = (b[1] - a[1]) * Math.PI / 180;
  const lat1 = a[0] * Math.PI / 180;
  const lat2 = b[0] * Math.PI / 180;
  const x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

// ─── Auto-follow map panner ───────────────────────────────────────────────────
const MapFollower: React.FC<{ center: [number, number] | null }> = ({
  center,
}) => {
  const map = useMap();
  const prev = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (!center) return;
    if (
      prev.current &&
      Math.abs(prev.current[0] - center[0]) < 0.00001 &&
      Math.abs(prev.current[1] - center[1]) < 0.00001
    )
      return;
    prev.current = center;
    map.panTo(center, { animate: true, duration: 0.8 });
  }, [center, map]);
  return null;
};

// ─── Smooth animated marker ───────────────────────────────────────────────
const AnimatedMarker: React.FC<{
  telemetry: VehicleTelemetry;
  isSelected: boolean;
  onClick: () => void;
  deviceIcon: string;
}> = ({ telemetry, isSelected, onClick, deviceIcon }) => {
  const animRef = useRef<number | null>(null);
  const prevPos = useRef<[number, number] | null>(null);
  const [pos, setPos] = useState<[number, number]>([
    telemetry.latitude,
    telemetry.longitude,
  ]);

  useEffect(() => {
    const target: [number, number] = [telemetry.latitude, telemetry.longitude];
    if (!prevPos.current) {
      prevPos.current = target;
      setPos(target);
      return;
    }
    const from = prevPos.current;
    prevPos.current = target;
    const start = performance.now();
    if (animRef.current) cancelAnimationFrame(animRef.current);
    const step = (now: number) => {
      const t = Math.min((now - start) / 1000, 1);
      const e = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      setPos([
        from[0] + (target[0] - from[0]) * e,
        from[1] + (target[1] - from[1]) * e,
      ]);
      if (t < 1) animRef.current = requestAnimationFrame(step);
    };
    animRef.current = requestAnimationFrame(step);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [telemetry.latitude, telemetry.longitude]);

  return (
    <Marker
      position={pos}
      icon={buildDeviceMarkerIcon(deviceIcon, telemetry.status)}
      eventHandlers={{ click: onClick }}
      zIndexOffset={isSelected ? 2000 : 1000}
    >
      <Tooltip
        permanent={isSelected}
        direction="top"
        offset={[0, -26]}
        className="sim-tip"
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 12,
            color: telemetry.status === "Moving" ? "#059669" : "#92400E",
          }}
        >
          {telemetry.status === "Moving" ? "🚗" : "⏸"} {telemetry.vehicleId} —{" "}
          {telemetry.speed.toFixed(1)} km/h
        </span>
      </Tooltip>
    </Marker>
  );
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface SimulatorMapProps {
  deviceCode?: string;
  /** Device icon name from the API (car / truck / bus / bike / etc.) */
  deviceIcon?: string;
  height?: string;
  onClose?: () => void;
}

// ─── Main component ───────────────────────────────────────────────────────────
const SimulatorMap: React.FC<SimulatorMapProps> = ({
  deviceCode,
  deviceIcon = "car",
  height = "100vh",
  onClose,
}) => {
  // ── State ──
  const [routes, setRoutes] = useState<SimulatorRoute[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState("blr-mg-koramangala");
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [activeVehicleId, setActiveVehicleId] = useState(deviceCode || "");
  const [customVehicleId, setCustomVehicleId] = useState(deviceCode || "");
  const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<
    Map<string, [number, number][]>
  >(new Map());
  const [isSimRunning, setIsSimRunning] = useState(false);
  const [isSimPaused, setIsSimPaused] = useState(false);
  const [controlsCollapsed, setControlsCollapsed] = useState(!!deviceCode); // auto-collapse when from QR
  const [isAutoStarting, setIsAutoStarting] = useState(false);

  // ── Geofence state ──
  const GEOFENCE_DELTA = 0.0004; // ~44 m — parking-slot sized
  const IDLE_GEOFENCE_MS = 60 * 1000; // 1 minute
  const [geofenceCenter, setGeofenceCenter] = useState<[number, number] | null>(
    null,
  );
  const [geofenceActive, setGeofenceActive] = useState(false);
  const [idleCountdown, setIdleCountdown] = useState<number | null>(null);
  const [showParkedBanner, setShowParkedBanner] = useState(false);
  const [pastStops, setPastStops] = useState<{lat: number; lng: number; label: string}[]>([]);
  const [dangerAlert, setDangerAlert] = useState<{zone: DangerZone, oldRoute: string} | null>(null);

  // Refs (survive closure stale-state)
  const autoStartedRef = useRef(false);
  const geofenceActiveRef = useRef(false);
  const idleStartTimeRef = useRef<number | null>(null);
  const lastKnownPosRef = useRef<[number, number] | null>(null); // last GPS position
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const avoidedDangerZonesRef = useRef<Set<string>>(new Set());

  /** Start a 1-second frontend ticker once the vehicle goes idle.
   *  This runs independently of WebSocket — pausing kills WS updates but
   *  the ticker keeps counting so the 2-minute geofence still fires. */
  const startIdleTimer = () => {
    if (idleTimerRef.current) return; // already running
    idleTimerRef.current = setInterval(() => {
      if (!idleStartTimeRef.current || geofenceActiveRef.current) {
        clearInterval(idleTimerRef.current!);
        idleTimerRef.current = null;
        return;
      }
      const elapsed = Date.now() - idleStartTimeRef.current;
      const remaining = Math.max(0, IDLE_GEOFENCE_MS - elapsed);
      setIdleCountdown(Math.ceil(remaining / 1000));

      if (elapsed >= IDLE_GEOFENCE_MS) {
        clearInterval(idleTimerRef.current!);
        idleTimerRef.current = null;
        const pos = lastKnownPosRef.current;
        if (!pos) return;
        geofenceActiveRef.current = true;
        setGeofenceCenter(pos);
        setGeofenceActive(true);
        setIdleCountdown(null);
        setShowParkedBanner(true);
        toast({
          title: "🟢 Vehicle Auto-Parked",
          description: "Stopped for 2 minutes — green geofence created.",
        });
      }
    }, 1000);
  };

  const stopIdleTimer = () => {
    if (idleTimerRef.current) {
      clearInterval(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    idleStartTimeRef.current = null;
    setIdleCountdown(null);
  };

  // Clean up timer on unmount
  useEffect(() => () => stopIdleTimer(), []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch History for Past Stops ──
  useEffect(() => {
    if (!deviceCode) return;
    
    // Fetch last 24 hours of history to find previous stops
    apiRequest<{ success: boolean; data: any[] }>(`/v1/gps/history/${deviceCode}?hours=24`)
      .then(res => {
        if (!res.success || !res.data || res.data.length < 2) return;
        
        const validPoints = res.data.filter(p => p.latitude != null && p.longitude != null);
        const stopsResult: { lat: number; lng: number; label: string }[] = [];
        let inStop = false;
        let stopStartIdx = -1;
        let stopCount = 1;

        // Simple distance function
        const distM = (p1: [number, number], p2: [number, number]) => {
          const R = 6371e3;
          const lat1 = (p1[0] * Math.PI) / 180, lat2 = (p2[0] * Math.PI) / 180;
          const dLat = ((p2[0] - p1[0]) * Math.PI) / 180, dLon = ((p2[1] - p1[1]) * Math.PI) / 180;
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(lat1) * Math.cos(lat2) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        };

        for (let i = 1; i < validPoints.length; i++) {
          const prev: [number, number] = [validPoints[i - 1].latitude, validPoints[i - 1].longitude];
          const curr: [number, number] = [validPoints[i].latitude, validPoints[i].longitude];
          const dist = distM(prev, curr);

          if (dist < 50) { // 50 meters stop threshold
            if (!inStop) {
              inStop = true;
              stopStartIdx = i - 1;
            }
            const stopDuration = new Date(validPoints[i].timestamp).getTime() -
              new Date(validPoints[stopStartIdx].timestamp).getTime();

            // If stopped for more than 2 minutes (120s)
            if (stopDuration >= 120000 && !stopsResult.find(s => s.lat === validPoints[stopStartIdx].latitude && s.lng === validPoints[stopStartIdx].longitude)) {
              stopsResult.push({
                lat: validPoints[stopStartIdx].latitude,
                lng: validPoints[stopStartIdx].longitude,
                label: String(stopCount++)
              });
            }
          } else {
            inStop = false;
          }
        }
        
        setPastStops(stopsResult);
      })
      .catch(() => {});
  }, [deviceCode]);

  // ── REST Polling ──
  const { vehicleData, allVehicles, isLoading, error, refresh } =
    useSimulatorPolling({
      pollAll: true,
      onUpdate: (t) => {
        // Always track last known position
        lastKnownPosRef.current = [t.latitude, t.longitude];

        // Grow path trail
        setPathHistory((prev) => {
          const next = new Map(prev);
          const existing = next.get(t.vehicleId) || [];
          next.set(t.vehicleId, [
            ...existing.slice(-300),
            [t.latitude, t.longitude],
          ]);
          return next;
        });

        // ── Idle detected → start independent 1-min frontend timer ──
        if (t.status === "Idle" || t.status === "Stopped") {
          if (!idleStartTimeRef.current) {
            idleStartTimeRef.current = Date.now();
            startIdleTimer(); // kick off ticker — runs even after polling stops
          }
        } else {
          // Vehicle moving again — cancel countdown and remove geofence
          stopIdleTimer();
          if (geofenceActiveRef.current) {
            geofenceActiveRef.current = false;
            setGeofenceActive(false);
            const pos = lastKnownPosRef.current;
            if (pos) {
              setPastStops((prev) => {
                const label = String(prev.length + 1);
                return [...prev, { lat: pos[0], lng: pos[1], label }];
              });
            }
            setGeofenceCenter(null);
            setShowParkedBanner(false);
          }
        }

        // ── Danger Zone Detection ──
        if (t.status === 'Moving') {
          for (const zone of DANGER_ZONES) {
            if (avoidedDangerZonesRef.current.has(zone.name)) continue;
            const dist = distanceMeters([t.latitude, t.longitude], zone.coordinates);
            if (dist <= zone.radiusMeters) {
              avoidedDangerZonesRef.current.add(zone.name);
              // Trigger danger avoidance!
              setDangerAlert({ zone, oldRoute: t.routeName });
              
              // Stop vehicle, switch route, start again
              apiRequest(`/v1/simulator/stop/${t.vehicleId}`, { method: "POST" }).then(() => {
                setTimeout(() => {
                  apiRequest("/v1/simulator/start", {
                    method: "POST",
                    body: JSON.stringify({
                      vehicleId: t.vehicleId,
                      routeId: zone.alternateRouteId,
                      speedMultiplier: t.speedMultiplier,
                      updateIntervalMs: 1000,
                    }),
                  });
                  setSelectedRouteId(zone.alternateRouteId);
                }, 1500); // 1.5s pause to show alert
              });
            }
          }
        }
      },
    });

  // ── Fetch routes (for manual mode) ──
  useEffect(() => {
    apiRequest<{ success: boolean; routes: SimulatorRoute[] }>(
      "/v1/simulator/routes",
    )
      .then((r) => setRoutes(r.routes || []))
      .catch(() => {});
  }, []);

  // ── Auto-start: immediate, stop-and-restart if needed ──
  useEffect(() => {
    if (!deviceCode || autoStartedRef.current) return;
    autoStartedRef.current = true;

    const vid = deviceCode.trim();
    setActiveVehicleId(vid);
    setCustomVehicleId(vid);
    setSelectedVehicle(vid);
    setIsAutoStarting(true);

    const doStart = () =>
      apiRequest("/v1/simulator/start", {
        method: "POST",
        body: JSON.stringify({
          vehicleId: vid,
          routeId: "blr-mg-koramangala",
          speedMultiplier: 1,
          updateIntervalMs: 1000,
        }),
      });

    doStart()
      .then(() => {
        setIsSimRunning(true);
        setIsSimPaused(false);
        setIsAutoStarting(false);
      })
      .catch(() => {
        apiRequest(`/v1/simulator/stop/${vid}`, { method: "POST" })
          .catch(() => {})
          .then(() => doStart())
          .then(() => {
            setIsSimRunning(true);
            setIsSimPaused(false);
          })
          .catch((e: any) =>
            toast({
              title: "GPS Start Failed",
              description: e.message,
              variant: "destructive",
            }),
          )
          .finally(() => setIsAutoStarting(false));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceCode]);

  // ── Helpers ──
  const selectedTelemetry: VehicleTelemetry | null =
    (selectedVehicle ? allVehicles.get(selectedVehicle) : null) ||
    (activeVehicleId ? allVehicles.get(activeVehicleId) : null) ||
    vehicleData;

  const mapCenter: [number, number] = selectedTelemetry
    ? [selectedTelemetry.latitude, selectedTelemetry.longitude]
    : [12.9716, 77.5946];

  const statusColor = (s?: string) =>
    s === "Moving" ? "#10B981" : s === "Idle" ? "#F59E0B" : "#EF4444";

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

  // ── Manual simulator controls (only used when no deviceCode) ──
  const handleStart = async () => {
    const vid = customVehicleId.trim() || `sim-${Date.now()}`;
    setActiveVehicleId(vid);
    setSelectedVehicle(vid);
    try {
      await apiRequest("/v1/simulator/start", {
        method: "POST",
        body: JSON.stringify({
          vehicleId: vid,
          routeId: selectedRouteId,
          speedMultiplier,
          updateIntervalMs: 1000,
        }),
      });
      setIsSimRunning(true);
      setIsSimPaused(false);
      toast({ title: "🚗 Simulation Started", description: `Tracking ${vid}` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };
  const handleStop = async () => {
    if (!activeVehicleId) return;
    try {
      await apiRequest(`/v1/simulator/stop/${activeVehicleId}`, {
        method: "POST",
      });
      setIsSimRunning(false);
      setIsSimPaused(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };
  const handlePause = async () => {
    if (!activeVehicleId) return;
    try {
      await apiRequest(`/v1/simulator/pause/${activeVehicleId}`, {
        method: "POST",
      });
      setIsSimPaused(true);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };
  const handleResume = async () => {
    if (!activeVehicleId) return;
    try {
      await apiRequest(`/v1/simulator/resume/${activeVehicleId}`, {
        method: "POST",
      });
      setIsSimPaused(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };
  const handleSpeedChange = async (m: number) => {
    setSpeedMultiplier(m);
    if (!activeVehicleId || !isSimRunning) return;
    try {
      await apiRequest(`/v1/simulator/${activeVehicleId}/speed`, {
        method: "PATCH",
        body: JSON.stringify({ multiplier: m }),
      });
    } catch {
      /* silent */
    }
  };
  const handleReset = async () => {
    if (!activeVehicleId) return;
    try {
      await apiRequest(`/v1/simulator/${activeVehicleId}/reset`, {
        method: "POST",
      });
      setPathHistory((p) => {
        const n = new Map(p);
        n.delete(activeVehicleId);
        return n;
      });
      // Reset all geofence / idle state
      stopIdleTimer();
      geofenceActiveRef.current = false;
      lastKnownPosRef.current = null;
      setGeofenceActive(false);
      setGeofenceCenter(null);
      setShowParkedBanner(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const btnStyle = (bg: string, span = 1) =>
    ({
      background: bg,
      border: "none",
      borderRadius: 10,
      color: "white",
      fontWeight: 700,
      fontSize: 12,
      padding: "9px 12px",
      cursor: "pointer",
      transition: "opacity .15s",
      gridColumn: span === 2 ? "1/-1" : "auto",
    }) as React.CSSProperties;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height,
        fontFamily: "'Inter',sans-serif",
        overflow: "hidden",
        background: "#0F172A",
      }}
    >
      {/* Auto-start loading spinner */}
      {isAutoStarting && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 5000,
            background: "rgba(9,9,11,.93)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: "5px solid rgba(59,130,246,.2)",
              borderTop: "5px solid #3B82F6",
              animation: "spin .9s linear infinite",
            }}
          />
          <p
            style={{
              color: "#F8FAFC",
              fontSize: 18,
              fontWeight: 700,
              margin: 0,
            }}
          >
            Starting GPS Tracking…
          </p>
          <p
            style={{
              color: "#64748B",
              fontSize: 13,
              margin: 0,
              fontFamily: "monospace",
            }}
          >
            {deviceCode}
          </p>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 3000,
            background: "linear-gradient(90deg,#EF4444,#DC2626)",
            color: "white",
            padding: "10px 16px",
            fontSize: 13,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          ⚡ Error: {error}
        </div>
      )}

      {/* ── Leaflet Map ── */}
      <MapContainer
        center={mapCenter}
        zoom={14}
        style={{ width: "100%", height: "100%" }}
        zoomControl={false}
      >
        <TileLayer
          url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
          attribution="© Google Maps"
          maxZoom={20}
        />
        <MapFollower center={mapCenter} />

        {/* ── Removed Hardcoded Fake Stops & Danger Zones ── */}

        {/* Vehicles */}
        {Array.from(allVehicles.values())
          .filter(t => !deviceCode || t.vehicleId === deviceCode)
          .map((t) => {
          const hist = pathHistory.get(t.vehicleId) || [];
          return (
            <React.Fragment key={t.vehicleId}>

              {hist.length > 1 && (
                <Marker position={hist[0]} icon={buildStartIcon()} />
              )}
              <AnimatedMarker
                telemetry={t}
                deviceIcon={deviceIcon}
                isSelected={
                  selectedVehicle === t.vehicleId ||
                  (!selectedVehicle && t.vehicleId === activeVehicleId)
                }
                onClick={() => setSelectedVehicle(t.vehicleId)}
              />
            </React.Fragment>
          );
        })}

        {/* ── 3-D Isometric Cage (SVG DivIcon, screen-space) ── */}
        {geofenceActive && geofenceCenter && (
          <Marker
            position={geofenceCenter}
            icon={buildGeofenceCubeIcon()}
            interactive={false}
            zIndexOffset={-1000} /* cage behind the device marker */
          />
        )}

        {/* ── Past Stops (A, B, C...) ── */}
        {pastStops.map((stop) => (
          <Marker
            key={`stop-${stop.label}`}
            position={[stop.lat, stop.lng]}
            zIndexOffset={1500}
            icon={buildStopHistoryIcon(stop.label)}
          >
            <Tooltip permanent direction="top" offset={[0, -14]} className="sim-tip">
              <span style={{ fontWeight: 700, fontSize: 11, color: '#BE185D' }}>
                Stop {stop.label}
              </span>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {/* Controls panel completely removed — device is fully autonomous */}

      {/* ── Countdown banner (vehicle stopped, waiting for 2 min) ── */}
      {idleCountdown !== null && !geofenceActive && (
        <div
          style={{
            position: "absolute",
            top: error ? 60 : 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2500,
            background: "rgba(15,23,42,.97)",
            backdropFilter: "blur(12px)",
            borderRadius: 14,
            border: `1px solid ${idleCountdown <= 30 ? "#EF4444" : "#F59E0B"}`,
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 4px 24px rgba(0,0,0,.5)",
          }}
        >
          <span style={{ fontSize: 22 }}>🅿️</span>
          <div>
            <p
              style={{
                color: "#F8FAFC",
                fontWeight: 700,
                fontSize: 14,
                margin: 0,
              }}
            >
              Vehicle Stopped
            </p>
            <p
              style={{
                color: idleCountdown <= 30 ? "#EF4444" : "#F59E0B",
                fontSize: 12,
                margin: 0,
                fontWeight: 600,
                animation:
                  idleCountdown <= 10 ? "blink .7s ease infinite" : "none",
              }}
            >
              Auto-geofence in {idleCountdown}s
            </p>
          </div>
        </div>
      )}

      {/* ── Live telemetry panel (bottom) ── */}
      {selectedTelemetry && (
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2000,
            width: "min(640px,calc(100% - 32px))",
            background: "rgba(15,23,42,.97)",
            backdropFilter: "blur(12px)",
            borderRadius: 16,
            border: "1px solid rgba(255,255,255,.1)",
            boxShadow: "0 8px 32px rgba(0,0,0,.5)",
            padding: "14px 20px",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: statusColor(selectedTelemetry.status),
                  boxShadow: `0 0 8px ${statusColor(selectedTelemetry.status)}`,
                }}
              />
              <span style={{ color: "#F8FAFC", fontWeight: 700, fontSize: 14 }}>
                {selectedTelemetry.vehicleId}
              </span>
              <span
                style={{
                  padding: "2px 10px",
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: statusColor(selectedTelemetry.status) + "22",
                  color: statusColor(selectedTelemetry.status),
                  border: `1px solid ${statusColor(selectedTelemetry.status)}44`,
                }}
              >
                {selectedTelemetry.status}
              </span>
              {geofenceActive && (
                <span
                  style={{
                    padding: "2px 10px",
                    borderRadius: 20,
                    fontSize: 11,
                    fontWeight: 700,
                    background: "rgba(16,185,129,.15)",
                    color: "#10B981",
                    border: "1px solid rgba(16,185,129,.3)",
                  }}
                >
                  🟢 Geofenced
                </span>
              )}
            </div>
            <span style={{ color: "#475569", fontSize: 11 }}>
              {selectedTelemetry.routeName}
            </span>
          </div>

          {/* Stats grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 12,
            }}
          >
            {[
              {
                label: "Speed",
                value: `${selectedTelemetry.speed.toFixed(1)}`,
                unit: "km/h",
                accent: "#3B82F6",
              },
              {
                label: "Heading",
                value: `${selectedTelemetry.heading}°`,
                unit: compassDir(selectedTelemetry.heading),
                accent: "#8B5CF6",
              },
              {
                label: "Latitude",
                value: `${selectedTelemetry.latitude.toFixed(5)}`,
                unit: "°N",
                accent: "#10B981",
              },
              {
                label: "Updated",
                value: fmt(selectedTelemetry.timestamp),
                unit: `${selectedTelemetry.routeIndex + 1}/${selectedTelemetry.totalRoutePoints}`,
                accent: "#F59E0B",
              },
            ].map((c) => (
              <div
                key={c.label}
                style={{
                  background: "rgba(255,255,255,.05)",
                  borderRadius: 10,
                  padding: "10px 12px",
                  border: `1px solid ${c.accent}22`,
                }}
              >
                <p
                  style={{
                    color: "#64748B",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    margin: "0 0 4px",
                  }}
                >
                  {c.label}
                </p>
                <p
                  style={{
                    color: "#F8FAFC",
                    fontSize: 15,
                    fontWeight: 700,
                    lineHeight: 1,
                    margin: 0,
                  }}
                >
                  {c.value}
                </p>
                <p style={{ color: c.accent, fontSize: 10, marginTop: 2 }}>
                  {c.unit}
                </p>
              </div>
            ))}
          </div>

          {/* Speed bar */}
          <div
            style={{
              marginTop: 10,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min((selectedTelemetry.speed / 80) * 100, 100)}%`,
                background: `linear-gradient(90deg,#3B82F6,${statusColor(selectedTelemetry.status)})`,
                borderRadius: 2,
                transition: "width 1s ease",
              }}
            />
          </div>
        </div>
      )}

      {/* ── Auto-parked overlay ── */}
      {showParkedBanner && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 4500,
            background: "rgba(9,9,11,.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setShowParkedBanner(false)}
        >
          <div
            style={{
              background: "#0F2B1F",
              borderRadius: 28,
              padding: "40px 48px",
              maxWidth: 360,
              width: "90%",
              textAlign: "center",
              border: "2px solid #10B981",
              boxShadow: "0 0 80px rgba(16,185,129,.3)",
              animation: "zoomin .35s ease",
            }}
          >
            <div style={{ fontSize: 72, lineHeight: 1, marginBottom: 16 }}>
              🟢
            </div>
            <h2
              style={{
                color: "#10B981",
                fontSize: 26,
                fontWeight: 900,
                margin: "0 0 8px",
              }}
            >
              Vehicle Parked!
            </h2>
            <p style={{ color: "#6EE7B7", fontSize: 15, margin: "0 0 12px" }}>
              Stopped for 1 minute
            </p>
            <p style={{ color: "#34D399", fontSize: 13, margin: "0 0 28px" }}>
              Green geofence zone created automatically around the parked
              position.
            </p>
            <button
              onClick={() => setShowParkedBanner(false)}
              style={{
                background: "#10B981",
                border: "none",
                borderRadius: 14,
                color: "white",
                fontWeight: 700,
                fontSize: 16,
                padding: "14px 40px",
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}

      {/* ── Danger Zone Alert Banner ── */}
      {dangerAlert && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 4800,
            background: "rgba(30,10,10,.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(6px)",
          }}
          onClick={() => setDangerAlert(null)}
        >
          <div
            style={{
              background: "#2C0B0E",
              borderRadius: 28,
              padding: "40px 48px",
              maxWidth: 420,
              width: "90%",
              textAlign: "center",
              border: "3px solid #EF4444",
              boxShadow: "0 0 100px rgba(239,68,68,.4)",
              animation: "zoomin .3s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
            }}
          >
            <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 16 }}>
              ⚠️
            </div>
            <h2
              style={{
                color: "#EF4444",
                fontSize: 28,
                fontWeight: 900,
                margin: "0 0 8px",
                textTransform: "uppercase",
                letterSpacing: 1.5,
              }}
            >
              Danger Zone Entered!
            </h2>
            <p style={{ color: "#FCA5A5", fontSize: 15, margin: "0 0 16px" }}>
              Vehicle reached {dangerAlert.zone.name}.
            </p>
            <div style={{ background: 'rgba(239,68,68,0.1)', padding: 16, borderRadius: 12, marginBottom: 24, border: '1px solid rgba(239,68,68,0.2)' }}>
              <p style={{ color: "#F8FAFC", fontSize: 13, margin: "0 0 8px" }}>
                <span style={{ color: '#94A3B8' }}>Stopping previous route:</span><br/>
                <s>{dangerAlert.oldRoute}</s>
              </p>
              <p style={{ color: "#10B981", fontSize: 14, fontWeight: 700, margin: 0 }}>
                Rerouting to new path...<br/>
                Choosing safer route.
              </p>
            </div>
            <button
              onClick={() => setDangerAlert(null)}
              style={{
                background: "#EF4444",
                border: "none",
                borderRadius: 14,
                color: "white",
                fontWeight: 800,
                fontSize: 16,
                padding: "14px 40px",
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(239,68,68,.4)",
              }}
            >
              Continue on New Route
            </button>
          </div>
        </div>
      )}

      {/* Back button */}
      {onClose && (
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 2000,
            background: "rgba(15,23,42,.9)",
            border: "1px solid rgba(255,255,255,.1)",
            borderRadius: 10,
            padding: "8px 14px",
            color: "#F8FAFC",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← Back
        </button>
      )}

      <style>{`
        .sim-tip,.geo-lbl { background:transparent!important; border:none!important; box-shadow:none!important; }
        .sim-tip::before,.geo-lbl::before { display:none!important; }
        @keyframes zoomin { from{transform:scale(.85);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  );
};

// ── Compass direction helper ──────────────────────────────────────────────────
function compassDir(h: number): string {
  const d = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return d[Math.round(h / 45) % 8];
}

export default SimulatorMap;
