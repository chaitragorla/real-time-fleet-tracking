import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Tooltip, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, MapPin, Clock, CheckCircle2, Navigation } from 'lucide-react';
import { createCustomMarkerIcon, createStartIcon } from '@/utils/iconUtils';
import { IconSelector } from './IconSelector';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// ── 3-D Geofence Cage Icon (neon-green parking cube) ──────────────────────────
function buildGeofenceCubeIcon(): L.DivIcon {
  const G = "#00FF88";
  const Gm = "#00CC66";
  const Gd = "#004422";
  const Ge = "#AAFFD0";
  const Gf = "rgba(0,255,136,0.12)";

  const ax = 25, ay = 80;
  const bx = 200, by = 80;
  const cx = 200, cy = 225;
  const dx = 25, dy = 225;
  const ex = 96, ey = 24;
  const fx = 271, fy = 24;
  const gx = 271, gy = 169;
  const hx = 96, hy = 169;

  const fvBars = [75, 115, 155]
    .map(x => `<line x1="${x}" y1="${ay}" x2="${x}" y2="${cy}" stroke="${G}" stroke-width="1.2" opacity="0.28"/>`)
    .join("");
  const fhBars = [130, 165, 200]
    .map(y => `<line x1="${ax}" y1="${y}" x2="${bx}" y2="${y}" stroke="${G}" stroke-width="1.2" opacity="0.28"/>`)
    .join("");
  const rvBars = [0.35, 0.67]
    .map(t => {
      const y1s = by + (cy - by) * t, y1e = fy + (gy - fy) * t;
      return `<line x1="${bx}" y1="${y1s}" x2="${fx}" y2="${y1e}" stroke="${G}" stroke-width="1" opacity="0.22"/>`;
    })
    .join("");

  const p = (pts: number[][]) => pts.map(([x, y]) => `${x},${y}`).join(" ");
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
<ellipse cx="${(dx + cx + gx + hx) / 4}" cy="${(dy + cy + gy + hy) / 4 + 8}"
  rx="95" ry="18" fill="rgba(0,255,136,0.12)" />
<g filter="url(#glow)">
  <polygon points="${p([[ex, ey], [fx, fy], [gx, gy], [hx, hy]])}"
    fill="${Gd}" fill-opacity="0.25" stroke="${Gd}" stroke-width="1.5" stroke-dasharray="8 5" opacity="0.5"/>
  <line x1="${hx}" y1="${hy}" x2="${dx}" y2="${dy}" stroke="${Gm}" stroke-width="1.5" stroke-dasharray="8 5" opacity="0.45"/>
  <line x1="${hx}" y1="${hy}" x2="${gx}" y2="${gy}" stroke="${Gd}" stroke-width="1.5" stroke-dasharray="8 5" opacity="0.4"/>
  <line x1="${ex}" y1="${ey}" x2="${hx}" y2="${hy}" stroke="${Gm}" stroke-width="2" stroke-dasharray="8 5" opacity="0.5"/>
  <polygon points="${p([[bx, by], [fx, fy], [gx, gy], [cx, cy]])}"
    fill="${Gm}" fill-opacity="0.22" stroke="${G}" stroke-width="2.5"/>
  ${rvBars}
  <polygon points="${p([[ax, ay], [bx, by], [cx, cy], [dx, dy]])}"
    fill="${Gf}" stroke="${G}" stroke-width="3"/>
  ${fvBars}${fhBars}
  <polygon points="${p([[ax, ay], [bx, by], [fx, fy], [ex, ey]])}"
    fill="${G}" fill-opacity="0.48" stroke="${Ge}" stroke-width="3.5"/>
  <line x1="${ax + 28}" y1="${ay}" x2="${ex + 28}" y2="${ey}" stroke="white" stroke-width="2" stroke-dasharray="14 7" opacity="0.45"/>
  <line x1="${bx - 28}" y1="${by}" x2="${fx - 28}" y2="${fy}" stroke="white" stroke-width="2" stroke-dasharray="14 7" opacity="0.45"/>
  <line x1="${ax}" y1="${ay}" x2="${dx}" y2="${dy}" stroke="${Ge}" stroke-width="4.5"/>
  <line x1="${bx}" y1="${by}" x2="${cx}" y2="${cy}" stroke="${Ge}" stroke-width="4.5"/>
  <line x1="${fx}" y1="${fy}" x2="${gx}" y2="${gy}" stroke="${G}" stroke-width="3"/>
  <line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="${Ge}" stroke-width="4.5"/>
  <line x1="${bx}" y1="${by}" x2="${fx}" y2="${fy}" stroke="${Ge}" stroke-width="4"/>
  <line x1="${fx}" y1="${fy}" x2="${ex}" y2="${ey}" stroke="${G}" stroke-width="3"/>
  <line x1="${ex}" y1="${ey}" x2="${ax}" y2="${ay}" stroke="${G}" stroke-width="3"/>
  <line x1="${dx}" y1="${dy}" x2="${cx}" y2="${cy}" stroke="${Ge}" stroke-width="4"/>
  <line x1="${cx}" y1="${cy}" x2="${gx}" y2="${gy}" stroke="${G}" stroke-width="3"/>
  <line x1="${dx}" y1="${dy}" x2="${hx}" y2="${hy}" stroke="${Gm}" stroke-width="2" stroke-dasharray="8 5" opacity="0.5"/>
  <circle cx="${ax}" cy="${ay}" r="7" fill="${Ge}" stroke="white" stroke-width="2"/>
  <circle cx="${bx}" cy="${by}" r="7" fill="${Ge}" stroke="white" stroke-width="2"/>
  <circle cx="${dx}" cy="${dy}" r="7" fill="${Ge}" stroke="white" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="7" fill="${Ge}" stroke="white" stroke-width="2"/>
  <circle cx="${fx}" cy="${fy}" r="5" fill="${G}" stroke="white" stroke-width="1.5"/>
  <circle cx="${gx}" cy="${gy}" r="5" fill="${G}" stroke="white" stroke-width="1.5"/>
  <circle cx="${ex}" cy="${ey}" r="4" fill="${Gm}" stroke="white" stroke-width="1" opacity="0.6"/>
</g>
<g filter="url(#glow2)">
  <text x="${rpx}" y="${rpy + 10}" text-anchor="middle" font-size="32" font-weight="900"
    fill="white" font-family="Arial Black,sans-serif" opacity="0.92">P</text>
</g>
<g class="pulse">
  <rect x="${rpx - 46}" y="2" width="92" height="20" rx="10" fill="${G}" opacity="0.9"/>
  <text x="${rpx}" y="16" text-anchor="middle" font-size="11" font-weight="900"
    fill="#001a0a" font-family="monospace" letter-spacing="1.5">PARKED</text>
</g>
</g>
</svg>`;

  return L.divIcon({
    html: svg,
    className: "",
    iconSize: [155, 125],
    iconAnchor: [56, 76],
  });
}

// ── Trip start marker icon ────────────────────────────────────────────────────
function buildTripStartIcon(tripNumber: number): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:28px;height:28px;border-radius:50%;
      background:linear-gradient(135deg,#6366F1,#8B5CF6);
      border:3px solid white;
      box-shadow:0 2px 8px rgba(99,102,241,.5);
      display:flex;align-items:center;justify-content:center;
      color:white;font-weight:900;font-size:11px;font-family:monospace;
    ">${tripNumber}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

// ── Saved Place marker icon ───────────────────────────────────────────────────
interface SavedPlace {
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
  borderColor: string;
  coordinates: [number, number];
}

function buildSavedPlaceIcon(place: SavedPlace): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      display:flex;flex-direction:column;align-items:center;gap:2px;
      filter:drop-shadow(0 3px 6px rgba(0,0,0,.35));
    ">
      <div style="
        background:${place.bgColor};
        border:3px solid ${place.borderColor};
        border-radius:14px;
        padding:4px 10px;
        display:flex;align-items:center;gap:5px;
        white-space:nowrap;
      ">
        <span style="font-size:18px;line-height:1;">${place.emoji}</span>
        <span style="font-size:11px;font-weight:800;color:${place.color};letter-spacing:.5px;text-transform:uppercase;">${place.name}</span>
      </div>
      <div style="
        width:0;height:0;
        border-left:8px solid transparent;border-right:8px solid transparent;
        border-top:10px solid ${place.borderColor};
      "></div>
    </div>`,
    className: "",
    iconSize: [100, 50],
    iconAnchor: [50, 50],
  });
}

// Custom icons will be created dynamically based on device settings

const SAVED_PLACES: SavedPlace[] = [
  {
    name: 'Home',
    emoji: '🏠',
    color: '#1E40AF',
    bgColor: '#DBEAFE',
    borderColor: '#3B82F6',
    coordinates: [12.9488, 77.6175],   // Koramangala Bus Stop (Simulator End)
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

const ARRIVAL_RADIUS_METERS = 150; // arrive when within 150m

interface GPSData {
  id: number;
  device_code: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  user_id?: number;
}

interface GeofenceZone {
  center: [number, number];
  timestamp: string;
  tripNumber: number;
  placeName?: string;  // name of saved place if stopped near one
}

interface TripSegment {
  tripNumber: number;
  startIndex: number;
  endIndex: number;
  startTimestamp: string;
  endTimestamp: string;
}

interface DeviceRouteMapProps {
  deviceCode: string;
  deviceName?: string;
  height?: string;
  showControls?: boolean;
  onReset?: () => void;
  isTrackingActive?: boolean;
  onToggleTracking?: (active: boolean) => void;
}

const MapUpdater = ({ center, pathCoordinates, isTrackingActive }: { center: [number, number]; pathCoordinates: [number, number][]; isTrackingActive: boolean }) => {
  const map = useMap();
  useEffect(() => {
    if (pathCoordinates.length > 1) {
      const bounds = L.latLngBounds(pathCoordinates);
      map.fitBounds(bounds, { padding: [50, 50], animate: true });
    } else {
      map.setView(center, map.getZoom(), { animate: true });
    }
  }, [center, pathCoordinates, isTrackingActive, map]);
  return null;
};

// ── Distance helper (meters between two lat/lng) ──────────────────────────────
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

const STOP_THRESHOLD_METERS = 15; // vehicle considered stopped if moved < 15m
const GEOFENCE_TIMER_SECONDS = 60; // 1 minute countdown

const DeviceRouteMap: React.FC<DeviceRouteMapProps> = ({
  deviceCode,
  deviceName,
  height = '400px',
  showControls = true,
  onReset,
  isTrackingActive = true,
  onToggleTracking,
}) => {
  const [gpsData, setGpsData] = useState<GPSData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [deviceIcon, setDeviceIcon] = useState<string>('car');
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [isUpdatingIcon, setIsUpdatingIcon] = useState(false);

  // ── Geofence & Trip State ──
  const [geofenceZones, setGeofenceZones] = useState<GeofenceZone[]>([]);
  const [idleCountdown, setIdleCountdown] = useState<number | null>(null);
  const [isVehicleStopped, setIsVehicleStopped] = useState(false);
  const [currentTripNumber, setCurrentTripNumber] = useState(1);
  const [showGeofenceBanner, setShowGeofenceBanner] = useState(false);
  const [arrivedAtPlace, setArrivedAtPlace] = useState<SavedPlace | null>(null);
  const lastArrivedPlaceRef = useRef<string | null>(null);

  // Refs for timer logic
  const idleStartTimeRef = useRef<number | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastMovingPosRef = useRef<[number, number] | null>(null);
  const geofenceActiveForCurrentStopRef = useRef(false);
  const prevGpsCountRef = useRef(0);
  const tripSegmentsRef = useRef<TripSegment[]>([]);

  // Extract unique dates from gpsData
  const dateOptions = React.useMemo(() => {
    const dates = Array.from(
      new Set(
        gpsData.map(point => point.timestamp.split('T')[0])
      )
    );
    dates.sort((a, b) => b.localeCompare(a));
    return ['ALL', ...dates];
  }, [gpsData]);

  // Filter gpsData by selectedDate
  const filteredGpsData = React.useMemo(() => {
    if (selectedDate === 'ALL') return gpsData;
    return gpsData.filter(point => point.timestamp.startsWith(selectedDate));
  }, [gpsData, selectedDate]);

  // ── Detect trips & stops from GPS data ──
  const { trips, detectedStops } = React.useMemo(() => {
    if (filteredGpsData.length < 2) return { trips: [] as TripSegment[], detectedStops: [] as GeofenceZone[] };

    const validPoints = filteredGpsData.filter(p =>
      p.latitude != null && p.longitude != null &&
      !isNaN(p.latitude) && !isNaN(p.longitude)
    );

    const tripsResult: TripSegment[] = [];
    const stopsResult: GeofenceZone[] = [];
    let tripStart = 0;
    let tripNum = 1;
    let inStop = false;
    let stopStartIdx = -1;

    for (let i = 1; i < validPoints.length; i++) {
      const prev: [number, number] = [validPoints[i - 1].latitude, validPoints[i - 1].longitude];
      const curr: [number, number] = [validPoints[i].latitude, validPoints[i].longitude];
      const dist = distanceMeters(prev, curr);

      if (dist < STOP_THRESHOLD_METERS) {
        if (!inStop) {
          inStop = true;
          stopStartIdx = i - 1;
        }
        // Check if stopped long enough (compare timestamps)
        const stopDuration = new Date(validPoints[i].timestamp).getTime() -
          new Date(validPoints[stopStartIdx].timestamp).getTime();

        if (stopDuration >= GEOFENCE_TIMER_SECONDS * 1000 && !stopsResult.find(s =>
          s.center[0] === validPoints[stopStartIdx].latitude &&
          s.center[1] === validPoints[stopStartIdx].longitude &&
          s.tripNumber === tripNum
        )) {
          stopsResult.push({
            center: [validPoints[stopStartIdx].latitude, validPoints[stopStartIdx].longitude],
            timestamp: validPoints[stopStartIdx].timestamp,
            tripNumber: tripNum,
          });
        }
      } else {
        if (inStop) {
          const stopDuration = new Date(validPoints[i - 1].timestamp).getTime() -
            new Date(validPoints[stopStartIdx].timestamp).getTime();
          if (stopDuration >= GEOFENCE_TIMER_SECONDS * 1000) {
            // End current trip at stop point
            tripsResult.push({
              tripNumber: tripNum,
              startIndex: tripStart,
              endIndex: i - 1,
              startTimestamp: validPoints[tripStart].timestamp,
              endTimestamp: validPoints[i - 1].timestamp,
            });
            tripNum++;
            tripStart = i - 1; // start new trip from the exact stop location
          }
          inStop = false;
        }
      }
    }

    // Final trip
    tripsResult.push({
      tripNumber: tripNum,
      startIndex: tripStart,
      endIndex: validPoints.length - 1,
      startTimestamp: validPoints[tripStart].timestamp,
      endTimestamp: validPoints[validPoints.length - 1].timestamp,
    });

    return { trips: tripsResult, detectedStops: stopsResult };
  }, [filteredGpsData]);

  // ── Live stop detection (real-time, based on latest GPS data changes) ──
  // ── Check if vehicle is near a saved place ──
  const getNearbyPlace = useCallback((pos: [number, number]): SavedPlace | null => {
    for (const place of SAVED_PLACES) {
      if (distanceMeters(pos, place.coordinates) <= ARRIVAL_RADIUS_METERS) {
        return place;
      }
    }
    return null;
  }, []);

  const detectLiveStop = useCallback(() => {
    if (!isTrackingActive || filteredGpsData.length < 3) return;

    const recent = filteredGpsData.slice(-5).filter(p =>
      p.latitude != null && p.longitude != null &&
      !isNaN(p.latitude) && !isNaN(p.longitude)
    );

    if (recent.length < 3) return;

    const last = recent[recent.length - 1];
    const lastPos: [number, number] = [last.latitude, last.longitude];

    // ── Check arrival at saved places ──
    const nearbyPlace = getNearbyPlace(lastPos);
    if (nearbyPlace && lastArrivedPlaceRef.current !== nearbyPlace.name) {
      lastArrivedPlaceRef.current = nearbyPlace.name;
      setArrivedAtPlace(nearbyPlace);
      toast({
        title: `${nearbyPlace.emoji} Arrived at ${nearbyPlace.name}!`,
        description: `Vehicle is within ${ARRIVAL_RADIUS_METERS}m of ${nearbyPlace.name}. Auto-parking will activate if stopped for 1 minute.`,
      });
    } else if (!nearbyPlace && lastArrivedPlaceRef.current) {
      lastArrivedPlaceRef.current = null;
      setArrivedAtPlace(null);
    }

    // Check if all recent points are within threshold
    const allStopped = recent.every(p => {
      const d = distanceMeters([p.latitude, p.longitude], lastPos);
      return d < STOP_THRESHOLD_METERS;
    });

    if (allStopped && !isVehicleStopped) {
      // Vehicle just stopped
      setIsVehicleStopped(true);
      idleStartTimeRef.current = Date.now();
      geofenceActiveForCurrentStopRef.current = false;
      startIdleTimer(lastPos, last.timestamp, nearbyPlace?.name);
    } else if (!allStopped && isVehicleStopped) {
      // Vehicle started moving again
      setIsVehicleStopped(false);
      stopIdleTimer();

      if (geofenceActiveForCurrentStopRef.current) {
        // Vehicle moved after geofence → new trip
        setCurrentTripNumber(prev => prev + 1);
        toast({
          title: `🚗 Trip ${currentTripNumber + 1} Started`,
          description: "Vehicle is moving again. New trip segment started.",
        });
        
        // Remove the active geofence cage now that it's moving
        setGeofenceZones([]);
        setShowGeofenceBanner(false);
      }

      geofenceActiveForCurrentStopRef.current = false;
      lastMovingPosRef.current = lastPos;
    }
  }, [filteredGpsData, isVehicleStopped, isTrackingActive, currentTripNumber, getNearbyPlace]);

  // Run live stop detection whenever GPS data changes
  useEffect(() => {
    if (filteredGpsData.length !== prevGpsCountRef.current) {
      prevGpsCountRef.current = filteredGpsData.length;
      detectLiveStop();
    }
  }, [filteredGpsData.length, detectLiveStop]);

  // ── Idle timer (1-minute countdown to geofence) ──
  const startIdleTimer = (position: [number, number], timestamp: string, placeName?: string) => {
    if (idleTimerRef.current) return;

    idleTimerRef.current = setInterval(() => {
      if (!idleStartTimeRef.current || geofenceActiveForCurrentStopRef.current) {
        if (idleTimerRef.current) {
          clearInterval(idleTimerRef.current);
          idleTimerRef.current = null;
        }
        return;
      }

      const elapsed = Date.now() - idleStartTimeRef.current;
      const remaining = Math.max(0, GEOFENCE_TIMER_SECONDS * 1000 - elapsed);
      setIdleCountdown(Math.ceil(remaining / 1000));

      if (elapsed >= GEOFENCE_TIMER_SECONDS * 1000) {
        // Timer expired → create geofence!
        if (idleTimerRef.current) {
          clearInterval(idleTimerRef.current);
          idleTimerRef.current = null;
        }
        geofenceActiveForCurrentStopRef.current = true;
        setIdleCountdown(null);

        // Check if near a saved place
        const nearby = getNearbyPlace(position);
        const locationLabel = nearby?.name || placeName;

        // Add geofence zone
        setGeofenceZones(prev => [
          ...prev,
          { center: position, timestamp, tripNumber: currentTripNumber, placeName: locationLabel },
        ]);

        setShowGeofenceBanner(true);
        toast({
          title: `🟢 ${locationLabel ? `Parked at ${locationLabel}` : 'Geofence Activated'}`,
          description: `Vehicle stopped for 1 minute — 3D geofence created${locationLabel ? ` at ${locationLabel}` : ''} (Trip ${currentTripNumber}).`,
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

  // Cleanup on unmount
  useEffect(() => () => stopIdleTimer(), []);

  const fetchDeviceInfo = async () => {
    try {
      const { data } = await api.devices.getByCode(deviceCode);
      if (data) {
        setDeviceIcon(data.device_icon || 'car');
      }
    } catch (error) {
      console.error('Error fetching device info:', error);
    }
  };

  const updateDeviceIcon = async (newIcon: string) => {
    setIsUpdatingIcon(true);
    try {
      await api.devices.updateByCode(deviceCode, { device_icon: newIcon });
      setDeviceIcon(newIcon);
      setShowIconSelector(false);
      toast({
        title: "Success",
        description: "Device icon updated successfully!",
      });
    } catch (error) {
      console.error('Error updating device icon:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingIcon(false);
    }
  };

  const fetchGPSData = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.gps.deviceData(deviceCode);
      setGpsData((data || []) as GPSData[]);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching GPS data:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching GPS data.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeviceInfo();
    fetchGPSData();

    if (isTrackingActive) {
      const interval = window.setInterval(fetchGPSData, 3000);
      return () => window.clearInterval(interval);
    }
  }, [deviceCode, isTrackingActive]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const defaultCenter: [number, number] = [20.5937, 78.9629];

  const pathCoordinates: [number, number][] = filteredGpsData
    .filter(point => {
      return point.latitude != null && point.longitude != null &&
        typeof point.latitude === 'number' && typeof point.longitude === 'number' &&
        !isNaN(point.latitude) && !isNaN(point.longitude);
    })
    .map(point => [point.latitude, point.longitude]);

  const centerCoordinate = pathCoordinates.length > 0
    ? pathCoordinates[pathCoordinates.length - 1]
    : defaultCenter;

  // Combine detected historical stops + live geofence zones (dedup)
  const allGeofences = React.useMemo(() => {
    const combined = [...detectedStops];
    for (const zone of geofenceZones) {
      if (!combined.find(s =>
        Math.abs(s.center[0] - zone.center[0]) < 0.0001 &&
        Math.abs(s.center[1] - zone.center[1]) < 0.0001
      )) {
        combined.push(zone);
      }
    }
    return combined;
  }, [detectedStops, geofenceZones]);

  // Trip colors for polylines


  // Determine current status label
  const isCurrentlyStopped = isVehicleStopped || !isTrackingActive;
  const hasActiveGeofence = geofenceActiveForCurrentStopRef.current || !isTrackingActive;

  return (
    <div className="space-y-4">
      {showControls && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-sm">
              {deviceName || deviceCode} - GPS {isTrackingActive ? 'Tracking' : 'History'}
            </span>
            <span className="text-xs text-gray-500">({filteredGpsData.length} points)</span>
            {trips.length > 1 && (
              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full font-semibold">
                {trips.length} Trips
              </span>
            )}
            {allGeofences.length > 0 && (
              <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-1 rounded-full font-semibold">
                {allGeofences.length} Geofence{allGeofences.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <div className="flex items-center gap-1 text-xs text-gray-500">
                  <Clock className="w-3 h-3" />
                  <span>Updated: {formatTimestamp(lastUpdated.toISOString())}</span>
                </div>
              )}
      
              <Button
                onClick={fetchGPSData}
                disabled={isLoading}
                variant="outline"
                size="sm"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          {/* Date Filter Dropdown */}
          <div className="flex items-center gap-2 self-end">
            <label htmlFor="date-filter" className="text-xs text-gray-600">Filter by Date:</label>
            <select
              id="date-filter"
              className="border rounded px-2 py-1 text-xs"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
            >
              {dateOptions.map(date => (
                <option key={date} value={date}>{date === 'ALL' ? 'ALL' : new Date(date).toLocaleDateString()}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Vehicle Status Banner */}
      {pathCoordinates.length > 0 && (
        <div className={`p-4 rounded-xl border font-semibold flex items-center justify-between transition-all ${
          isCurrentlyStopped && hasActiveGeofence
            ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
            : isCurrentlyStopped
            ? 'bg-amber-50 border-amber-400 text-amber-800'
            : 'bg-green-500/10 border-green-500/20 text-green-400'
        }`}>
          <div className="flex items-center gap-3">
            {isCurrentlyStopped && hasActiveGeofence && <CheckCircle2 className="w-7 h-7 text-emerald-500 flex-shrink-0" />}
            {isCurrentlyStopped && !hasActiveGeofence && <Clock className="w-6 h-6 text-amber-500 flex-shrink-0" />}
            {!isCurrentlyStopped && <Navigation className="w-6 h-6 text-green-400 flex-shrink-0" />}
            <div className="flex flex-col">
              <span className={`text-xs uppercase tracking-wider block font-bold ${
                isCurrentlyStopped && hasActiveGeofence ? 'text-emerald-600' :
                isCurrentlyStopped ? 'text-amber-600' : 'text-green-400/70'
              }`}>
                Vehicle Status — Trip {trips.length > 0 ? trips[trips.length - 1].tripNumber : currentTripNumber}
              </span>
              <span className={`text-sm font-semibold ${
                isCurrentlyStopped && hasActiveGeofence ? 'text-emerald-800' :
                isCurrentlyStopped ? 'text-amber-800' : 'text-green-300'
              }`}>
                {isCurrentlyStopped && hasActiveGeofence
                  ? '🟢 Vehicle parked — Geofence active'
                  : isCurrentlyStopped
                  ? '⏸ Vehicle stopped — Waiting for geofence...'
                  : `🚗 Vehicle is moving (Trip ${trips.length > 0 ? trips[trips.length - 1].tripNumber : currentTripNumber})`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {idleCountdown !== null && !hasActiveGeofence && (
              <span className={`px-3 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wide ${
                idleCountdown <= 15 ? 'bg-red-500/20 border-red-500/30 text-red-500 animate-pulse' :
                'bg-amber-500/20 border-amber-500/30 text-amber-600'
              }`}>
                🅿️ Geofence in {idleCountdown}s
              </span>
            )}
            <span className={`px-4 py-1.5 rounded-full text-xs font-bold border uppercase tracking-wide ${
              isCurrentlyStopped && hasActiveGeofence
                ? 'bg-emerald-500 border-emerald-600 text-white shadow-sm'
                : isCurrentlyStopped
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-700'
                : 'bg-green-500/20 border-green-500/30 text-green-400'
            }`}>
              {isCurrentlyStopped && hasActiveGeofence ? '🟢 Geofenced' :
               isCurrentlyStopped ? '⏸ Stopped' : '🚗 Moving'}
            </span>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="border-2 border-gray-200 rounded-xl overflow-hidden relative shadow-md">
        <MapContainer
          center={centerCoordinate}
          zoom={14}
          scrollWheelZoom={false}
          style={{ height, width: '100%' }}
          className="z-0"
        >
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            attribution='&copy; <a href="https://www.google.com/intl/en_US/help/terms_maps.html">Google Maps</a>'
          />
          <MapUpdater center={centerCoordinate} pathCoordinates={pathCoordinates} isTrackingActive={isTrackingActive} />

          {/* ── Saved Places (Home, Office, College) ── */}
          {SAVED_PLACES.map(place => (
            <React.Fragment key={`place-${place.name}`}>
              <Marker
                position={place.coordinates}
                icon={buildSavedPlaceIcon(place)}
                zIndexOffset={500}
              >
                <Popup>
                  <div className="text-sm min-w-[180px]">
                    <div className="font-bold text-base mb-1" style={{ color: place.color }}>
                      {place.emoji} {place.name}
                    </div>
                    <div className="text-xs text-gray-600 mb-2">
                      Vehicle will auto-park here when it arrives and stops for 1 minute.
                    </div>
                    <strong>Lat:</strong> {place.coordinates[0].toFixed(6)}<br />
                    <strong>Lng:</strong> {place.coordinates[1].toFixed(6)}
                  </div>
                </Popup>
              </Marker>
              {/* Arrival detection radius circle */}
              <Circle
                center={place.coordinates}
                radius={ARRIVAL_RADIUS_METERS}
                pathOptions={{
                  color: place.borderColor,
                  weight: 2,
                  opacity: 0.35,
                  fillColor: place.borderColor,
                  fillOpacity: 0.05,
                  dashArray: '8 6',
                }}
              />
            </React.Fragment>
          ))}

          {/* ── Trip start markers (no polylines) ── */}
          {trips.length > 1 && (
            trips.map(trip => {
              const validPoints = filteredGpsData.filter(p =>
                p.latitude != null && p.longitude != null && !isNaN(p.latitude) && !isNaN(p.longitude)
              );
              const tripCoords: [number, number][] = validPoints
                .slice(trip.startIndex, trip.endIndex + 1)
                .map(p => [p.latitude, p.longitude]);
              return (
                <React.Fragment key={`trip-${trip.tripNumber}`}>
                  {/* Trip start marker */}
                  {tripCoords.length > 0 && trip.tripNumber > 1 && (
                    <Marker
                      position={tripCoords[0]}
                      icon={buildTripStartIcon(trip.tripNumber)}
                    >
                      <Popup>
                        <div className="text-sm">
                          <strong className="text-purple-700">Trip {trip.tripNumber} Start</strong><br />
                          <strong>Time:</strong> {formatTimestamp(trip.startTimestamp)}<br />
                          <strong>Coordinates:</strong> {tripCoords[0][0].toFixed(6)}, {tripCoords[0][1].toFixed(6)}
                        </div>
                      </Popup>
                    </Marker>
                  )}
                </React.Fragment>
              );
            })
          )}

          {/* ── 3D Geofence Cubes at each detected stop ── */}
          {allGeofences.map((zone, idx) => (
            <React.Fragment key={`geofence-${idx}`}>
              {/* 3D Cube */}
              <Marker
                position={zone.center}
                icon={buildGeofenceCubeIcon()}
                interactive={false}
                zIndexOffset={-1000}
              />
              {/* Outer glow circle */}
              <Circle
                center={zone.center}
                radius={200}
                pathOptions={{
                  color: '#10B981',
                  weight: 3,
                  opacity: 0.3,
                  fillColor: '#10B981',
                  fillOpacity: 0.06,
                  dashArray: '12 6',
                }}
              />
              {/* Main geofence circle */}
              <Circle
                center={zone.center}
                radius={100}
                pathOptions={{
                  color: '#059669',
                  weight: 4,
                  opacity: 0.7,
                  fillColor: '#10B981',
                  fillOpacity: 0.12,
                }}
              >
                <Tooltip permanent direction="bottom" className="geofence-label">
                  <span style={{ fontWeight: 800, fontSize: 12, color: '#059669' }}>
                    🟢 GEOFENCE — Trip {zone.tripNumber} Stop
                  </span>
                </Tooltip>
              </Circle>
            </React.Fragment>
          ))}

          {/* ── Start point marker ── */}
          {filteredGpsData.length > 1 && filteredGpsData[0].latitude != null && filteredGpsData[0].longitude != null && (
            <Marker
              position={[filteredGpsData[0].latitude, filteredGpsData[0].longitude]}
              icon={createStartIcon()}
            >
              <Popup>
                <div className="text-sm">
                  <strong>Trip 1 — Start Point</strong><br />
                  <strong>Time:</strong> {formatTimestamp(filteredGpsData[0].timestamp)}<br />
                  <strong>Coordinates:</strong> {filteredGpsData[0].latitude?.toFixed(6)}, {filteredGpsData[0].longitude?.toFixed(6)}
                </div>
              </Popup>
            </Marker>
          )}

          {/* ── Current position marker ── */}
          {filteredGpsData.length > 0 && filteredGpsData[filteredGpsData.length - 1].latitude != null && filteredGpsData[filteredGpsData.length - 1].longitude != null && (
            <Marker
              position={[filteredGpsData[filteredGpsData.length - 1].latitude, filteredGpsData[filteredGpsData.length - 1].longitude]}
              icon={createCustomMarkerIcon(deviceIcon, isCurrentlyStopped ? '#059669' : '#10B981', isCurrentlyStopped ? 36 : 24, !isCurrentlyStopped)}
              eventHandlers={{
                dblclick: () => setShowIconSelector(true)
              }}
              zIndexOffset={2000}
            >
              <Popup>
                <div className="text-sm min-w-[200px]">
                  <div className={`font-bold text-base mb-1 ${
                    isCurrentlyStopped ? 'text-emerald-700' : 'text-green-700'
                  }`}>
                    {isCurrentlyStopped && hasActiveGeofence ? '🟢 Parked — Geofence Active' :
                     isCurrentlyStopped ? '⏸ Stopped' : '🚗 Current Position'}
                  </div>
                  {isCurrentlyStopped && hasActiveGeofence && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded p-2 mb-2 text-emerald-800 text-xs font-medium">
                      🟢 Vehicle is inside the geofence zone. Parked safely.
                    </div>
                  )}
                  <strong>Trip:</strong> {trips.length > 0 ? trips[trips.length - 1].tripNumber : currentTripNumber}<br />
                  <strong>Time:</strong> {formatTimestamp(filteredGpsData[filteredGpsData.length - 1].timestamp)}<br />
                  <strong>Lat:</strong> {filteredGpsData[filteredGpsData.length - 1].latitude?.toFixed(6)}<br />
                  <strong>Lng:</strong> {filteredGpsData[filteredGpsData.length - 1].longitude?.toFixed(6)}<br />
                  <em className="text-xs text-gray-400">Double-click marker to change icon</em>
                </div>
              </Popup>
              <Tooltip
                permanent
                direction="top"
                className={`font-bold px-3 py-1.5 rounded-lg shadow-lg border-2 text-sm ${
                  isCurrentlyStopped && hasActiveGeofence
                    ? 'bg-emerald-600 border-emerald-400 text-white'
                    : isCurrentlyStopped
                    ? 'bg-amber-600 border-amber-400 text-white'
                    : 'bg-green-600 border-green-400 text-white'
                }`}
              >
                {isCurrentlyStopped && hasActiveGeofence
                  ? `🟢 Parked${arrivedAtPlace ? ` at ${arrivedAtPlace.emoji} ${arrivedAtPlace.name}` : ''}`
                  : isCurrentlyStopped
                  ? `⏸ Stopped (${idleCountdown ?? 0}s to geofence)`
                  : arrivedAtPlace
                  ? `${arrivedAtPlace.emoji} Near ${arrivedAtPlace.name} — Moving`
                  : `🚗 Trip ${trips.length > 0 ? trips[trips.length - 1].tripNumber : currentTripNumber} — Moving`}
              </Tooltip>
            </Marker>
          )}
        </MapContainer>
        
        {/* ── Countdown overlay on map ── */}
        {idleCountdown !== null && !hasActiveGeofence && (
          <div style={{
            position: 'absolute',
            top: 12,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            background: 'rgba(15,23,42,.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: 14,
            border: `2px solid ${idleCountdown <= 15 ? '#EF4444' : '#F59E0B'}`,
            padding: '10px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            boxShadow: '0 4px 24px rgba(0,0,0,.5)',
          }}>
            <span style={{ fontSize: 24 }}>{arrivedAtPlace ? arrivedAtPlace.emoji : '🅿️'}</span>
            <div>
              <p style={{ color: '#F8FAFC', fontWeight: 700, fontSize: 14, margin: 0 }}>
                Vehicle Stopped{arrivedAtPlace ? ` at ${arrivedAtPlace.name}` : ''}
              </p>
              <p style={{
                color: idleCountdown <= 15 ? '#EF4444' : '#F59E0B',
                fontSize: 12,
                margin: 0,
                fontWeight: 700,
                animation: idleCountdown <= 10 ? 'blink .7s ease infinite' : 'none',
              }}>
                Auto-geofence in {idleCountdown}s
              </p>
            </div>
            <div style={{
              width: 48, height: 48,
              borderRadius: '50%',
              background: `conic-gradient(${idleCountdown <= 15 ? '#EF4444' : '#F59E0B'} ${((GEOFENCE_TIMER_SECONDS - idleCountdown) / GEOFENCE_TIMER_SECONDS) * 360}deg, rgba(255,255,255,.1) 0deg)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 900, fontSize: 16, color: '#F8FAFC',
              fontFamily: 'monospace',
            }}>
              {idleCountdown}
            </div>
          </div>
        )}

        {/* Icon Selector Modal */}
        {showIconSelector && (
          <div className="absolute inset-0 z-[1000] flex items-center justify-center">
            <div 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
              onClick={() => setShowIconSelector(false)}
            />
            <div className="relative bg-white p-6 rounded-xl shadow-2xl max-w-sm w-full mx-4 border border-gray-200 z-[1001]">
              <h3 className="text-lg font-semibold mb-4 text-center">Change Device Icon</h3>
              <IconSelector
                selectedIcon={deviceIcon}
                onIconSelect={updateDeviceIcon}
              />
              <div className="flex gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setShowIconSelector(false)}
                  disabled={isUpdatingIcon}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
              {isUpdatingIcon && (
                <div className="absolute inset-0 bg-white/90 flex items-center justify-center rounded-xl">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Route Summary */}
      {showControls && filteredGpsData.length > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <strong>Route Summary:</strong> {filteredGpsData.length} GPS points
          {trips.length > 1 && ` across ${trips.length} trips`}
          {allGeofences.length > 0 && ` • ${allGeofences.length} geofence stop${allGeofences.length > 1 ? 's' : ''}`}
          {' '}from {formatTimestamp(filteredGpsData[0].timestamp)} to {formatTimestamp(filteredGpsData[filteredGpsData.length - 1].timestamp)}
        </div>
      )}

      {/* Geofence Info Cards */}
      {allGeofences.length > 0 && (
        <div className="space-y-2">
          {allGeofences.map((zone, idx) => (
            <div key={`gf-card-${idx}`} className="rounded-xl border-2 border-emerald-400 bg-gradient-to-r from-emerald-50 to-green-50 shadow-lg overflow-hidden">
              <div className="flex items-center justify-between bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" />
                  <span className="text-white font-bold text-sm uppercase tracking-wide">
                    🟢 {zone.placeName ? `Parked at ${zone.placeName}` : `Geofence — Trip ${zone.tripNumber} Stop`}
                  </span>
                </div>
                <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm">
                  Trip {zone.tripNumber} • 100m radius
                </span>
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider mb-0.5">{zone.placeName ? 'Location' : 'Status'}</span>
                  <span className="text-sm font-semibold text-emerald-700">{zone.placeName ? `📍 ${zone.placeName}` : '🟢 Parked & Safe'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider mb-0.5">Stopped At</span>
                  <span className="text-sm font-semibold text-gray-800">{formatTimestamp(zone.timestamp)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider mb-0.5">Latitude</span>
                  <span className="text-sm font-mono text-gray-800">{zone.center[0].toFixed(6)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold text-emerald-600 tracking-wider mb-0.5">Longitude</span>
                  <span className="text-sm font-mono text-gray-800">{zone.center[1].toFixed(6)}</span>
                </div>
              </div>
              <div className="px-4 pb-2.5">
                <div className="bg-emerald-100/80 border border-emerald-300 rounded-lg p-2 text-xs text-emerald-800 font-medium flex items-center gap-2">
                  <span className="text-lg">🛡️</span>
                  3D geofence created after 1 min of no movement{zone.placeName ? ` at ${zone.placeName}` : ''}. Vehicle moved again → Trip {zone.tripNumber + 1} started.
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Geofence Created Overlay */}
      {showGeofenceBanner && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowGeofenceBanner(false)}
        >
          <div
            className="bg-[#0F2B1F] rounded-3xl p-10 max-w-sm w-[90%] text-center border-2 border-emerald-500 shadow-[0_0_80px_rgba(16,185,129,.3)]"
            style={{ animation: 'zoomin .35s ease' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-7xl mb-4">{arrivedAtPlace ? arrivedAtPlace.emoji : '🟢'}</div>
            <h2 className="text-emerald-400 text-2xl font-black mb-2">
              {arrivedAtPlace ? `Parked at ${arrivedAtPlace.name}!` : 'Geofence Created!'}
            </h2>
            <p className="text-emerald-300 text-sm mb-2">
              Vehicle stopped for 1 minute
            </p>
            <p className="text-emerald-200/70 text-xs mb-6">
              3D green geofence placed automatically{arrivedAtPlace ? ` at ${arrivedAtPlace.name}` : ''}. Trip {currentTripNumber} stop.
            </p>
            <button
              onClick={() => setShowGeofenceBanner(false)}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-base px-10 py-3 rounded-xl transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}

      <style>{`
        .geofence-label { background:transparent!important; border:none!important; box-shadow:none!important; }
        .geofence-label::before { display:none!important; }
        @keyframes zoomin { from{transform:scale(.85);opacity:0} to{transform:scale(1);opacity:1} }
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  );
};

export default DeviceRouteMap;
