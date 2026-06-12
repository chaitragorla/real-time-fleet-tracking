import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, GpsPoint, LegacyDevice } from '@/lib/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Compass,
  MapPin,
  Clock,
  Search,
  Play,
  Pause,
  RotateCcw,
  X,
  Navigation,
  Loader2,
  Calendar,
  Smartphone,
  Route,
  Timer,
  Activity
} from 'lucide-react';
import { getIconComponent } from '@/utils/iconUtils';
import { renderToString } from 'react-dom/server';

// Standard Leaflet blue marker fix
const defaultBlueIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Bangalore and Mumbai landmarks for geocoding
const LANDMARKS = [
  { name: 'KR Circle', lat: 12.9748, lng: 77.5857 },
  { name: 'Kanteerava Stadium', lat: 12.9698, lng: 77.5925 },
  { name: 'Prof Ashirvadam Junction', lat: 12.9645, lng: 77.6080 },
  { name: 'Cubbon Park', lat: 12.9730, lng: 77.5920 },
  { name: 'Anil Kumble Circle', lat: 12.9760, lng: 77.6015 },
  { name: 'Frazer Town', lat: 13.0000, lng: 77.6100 },
  { name: 'Ashokanagar', lat: 12.9620, lng: 77.6080 },
  { name: 'Doddigunta', lat: 12.9900, lng: 77.6150 },
  { name: 'M C Layout', lat: 12.9650, lng: 77.5350 },
  { name: 'Hudson Circle', lat: 12.9695, lng: 77.5898 },
  { name: 'Vidhana Soudha', lat: 12.9796, lng: 77.5906 },
  { name: 'Richmond Road', lat: 12.9645, lng: 77.6020 },
  { name: 'Richmond Circle', lat: 12.9600, lng: 77.5970 },
  { name: 'Cash Pharmacy Junction', lat: 12.9658, lng: 77.6035 },
  { name: 'Shanthala Nagar', lat: 12.9702, lng: 77.6001 },
  // Mumbai fallback landmarks
  { name: 'Kamani', lat: 19.0716, lng: 72.8846 },
  { name: 'Kurla West', lat: 19.0735, lng: 72.8800 },
  { name: 'Kulkarni Wadi', lat: 19.0765, lng: 72.8900 }
];

// Haversine distance
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Geocoder helper
function getClosestLandmark(lat: number, lng: number): string {
  let minDistance = Infinity;
  let closestName = 'Bangalore Suburbs';

  for (const landmark of LANDMARKS) {
    const dist = calculateDistance(lat, lng, landmark.lat, landmark.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestName = landmark.name;
    }
  }

  return closestName;
}

// Bearing calculation for vehicle rotation
function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

interface Trip {
  id: string;
  deviceCode: string;
  deviceName: string;
  deviceIcon: string;
  user: string;
  tripNumber: number;
  stopCount: number;
  startTime: Date;
  endTime: Date | null;
  distanceKm: number;
  durationMin: number;
  routeText: string;
  routeLegs: Array<{ start: string; end: string }>;
  status: 'ACTIVE' | 'COMPLETED';
  points: GpsPoint[];
}

const MapBoundsFitter = ({ points }: { points: [number, number][] }) => {
  const map = useMap();
  useEffect(() => {
    if (points && points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
};

const MapPanner = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.panTo(center);
    }
  }, [center, map]);
  return null;
};

const TripHistory = () => {
  const { user } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredDevices, setRegisteredDevices] = useState<LegacyDevice[]>([]);
  
  // Replay Details Modal State
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch coordinates and construct trips
  const fetchAllTrips = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data: devices } = await api.devices.byOwner(user.id);
      const allDevices = devices || [];
      setRegisteredDevices(allDevices);
      const combinedTrips: Trip[] = [];

      for (const device of allDevices) {
        const { data: gpsData } = await api.gps.deviceData(device.device_code);
        const points = gpsData || [];

        // Skip devices with no GPS data — only show real trip data
        if (points.length === 0) {
          continue;
        }

        // Segment real coordinates
        const sortedPoints = [...points].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        // Segment every 40 points or >5 min gap
        const segments: GpsPoint[][] = [];
        let currentSegment: GpsPoint[] = [sortedPoints[0]];

        for (let i = 1; i < sortedPoints.length; i++) {
          const prevTime = new Date(sortedPoints[i - 1].timestamp).getTime();
          const currTime = new Date(sortedPoints[i].timestamp).getTime();
          const diffMinutes = (currTime - prevTime) / 60000;

          if (diffMinutes > 5 || currentSegment.length >= 40) {
            segments.push(currentSegment);
            currentSegment = [sortedPoints[i]];
          } else {
            currentSegment.push(sortedPoints[i]);
          }
        }
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
        }

        // Map segments to Trip objects — trip number increments per segment (stop)
        segments.forEach((segPoints, idx) => {
          const startPt = segPoints[0];
          const endPt = segPoints[segPoints.length - 1];

          let distanceKm = 0;
          for (let k = 1; k < segPoints.length; k++) {
            distanceKm += calculateDistance(
              segPoints[k - 1].latitude,
              segPoints[k - 1].longitude,
              segPoints[k].latitude,
              segPoints[k].longitude,
            );
          }

          const startAddress = getClosestLandmark(startPt.latitude, startPt.longitude);
          const midAddress = getClosestLandmark(
            segPoints[Math.floor(segPoints.length / 2)].latitude,
            segPoints[Math.floor(segPoints.length / 2)].longitude,
          );
          const endAddress = getClosestLandmark(endPt.latitude, endPt.longitude);

          const startTime = new Date(startPt.timestamp);
          const endTime = new Date(endPt.timestamp);
          const durationMin = Math.round((endTime.getTime() - startTime.getTime()) / 60000) || 1;

          const isLatest = idx === segments.length - 1;
          const status = (isLatest && device.is_active) ? 'ACTIVE' : 'COMPLETED';

          const routeLegs = [];
          let routeText = '';

          // Count unique stops in this trip (start + waypoints + end)
          const stopCount = status === 'ACTIVE' ? 1 : (startAddress === endAddress ? 1 : (startAddress === midAddress || midAddress === endAddress ? 2 : 3));

          if (status === 'ACTIVE') {
            routeText = `${startAddress} → In Progress`;
            routeLegs.push({ start: startAddress, end: 'In Progress' });
          } else {
            routeText = `${startAddress} → ${endAddress}`;
            routeLegs.push({ start: startAddress, end: midAddress });
            routeLegs.push({ start: midAddress, end: endAddress });
          }

          combinedTrips.push({
            id: `${device.device_code}-trip-${idx}`,
            deviceCode: device.device_code,
            deviceName: device.device_name || 'Unnamed Device',
            deviceIcon: device.device_icon || 'car',
            user: user.name || 'Deepa Menon',
            tripNumber: idx + 1,
            stopCount,
            startTime,
            endTime: status === 'ACTIVE' ? null : endTime,
            distanceKm: Number(distanceKm.toFixed(2)),
            durationMin,
            routeText,
            routeLegs,
            status,
            points: segPoints,
          });
        });
      }

      // Sort combined trips descending by start time
      combinedTrips.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

      // Deduplicate trips — no two trips should have the same route text for the same device
      const seen = new Set<string>();
      const uniqueTrips = combinedTrips.filter((trip) => {
        const key = `${trip.deviceCode}::${trip.routeText}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setTrips(uniqueTrips);
    } catch (error) {
      console.error('Error fetching trips:', error);
      toast({
        title: 'Error',
        description: 'Failed to load trip history.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllTrips();
  }, [user]);

  // Replay animation controller hook
  useEffect(() => {
    if (isPlaying && selectedTrip) {
      const baseInterval = 600;
      const interval = baseInterval / playbackSpeed;

      timerRef.current = setInterval(() => {
        setCurrentPointIndex((prev) => {
          if (prev >= selectedTrip.points.length - 1) {
            setIsPlaying(false);
            if (timerRef.current) clearInterval(timerRef.current);
            return prev;
          }
          return prev + 1;
        });
      }, interval);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, selectedTrip, playbackSpeed]);

  // Combined trips search filtration — search by device code or device name
  const filteredTrips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter((trip) =>
      trip.deviceCode.toLowerCase().includes(q) ||
      trip.deviceName.toLowerCase().includes(q)
    );
  }, [trips, searchQuery]);

  // Current marker coords during replay
  const currentCoords = useMemo(() => {
    if (!selectedTrip || selectedTrip.points.length === 0) return null;
    const pt = selectedTrip.points[currentPointIndex];
    return pt ? ([pt.latitude, pt.longitude] as [number, number]) : null;
  }, [selectedTrip, currentPointIndex]);

  // Current bearing/heading angle
  const currentBearing = useMemo(() => {
    if (!selectedTrip || selectedTrip.points.length < 2) return 0;
    const ptIndex = Math.min(currentPointIndex, selectedTrip.points.length - 1);
    if (ptIndex === selectedTrip.points.length - 1) {
      const p1 = selectedTrip.points[ptIndex - 1];
      const p2 = selectedTrip.points[ptIndex];
      return getBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
    }
    const p1 = selectedTrip.points[ptIndex];
    const p2 = selectedTrip.points[ptIndex + 1];
    return getBearing(p1.latitude, p1.longitude, p2.latitude, p2.longitude);
  }, [selectedTrip, currentPointIndex]);

  // Rotate vehicle marker dynamically
  const movingIcon = useMemo(() => {
    if (!selectedTrip) return null;
    const IconComponent = getIconComponent(selectedTrip.deviceIcon);
    const color = '#06b6d4'; // Cyan
    const size = 20;

    const iconHtml = renderToString(
      <div style={{
        backgroundColor: '#09090b',
        borderRadius: '50%',
        padding: '6px',
        border: `2px solid ${color}`,
        boxShadow: '0 0 10px rgba(6,182,212,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `rotate(${currentBearing}deg)`,
        transition: 'transform 0.1s linear',
        width: '32px',
        height: '32px'
      }}>
        <IconComponent size={size} color={color} />
      </div>
    );

    return L.divIcon({
      html: iconHtml,
      className: 'moving-marker-icon-container',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
  }, [selectedTrip, currentBearing]);

  // Modal map coordinates path
  const polylineCoords = useMemo(() => {
    if (!selectedTrip) return [];
    return selectedTrip.points.map((p) => [p.latitude, p.longitude] as [number, number]);
  }, [selectedTrip]);

  const coveredPolylineCoords = useMemo(() => {
    if (!selectedTrip) return [];
    return selectedTrip.points
      .slice(0, currentPointIndex + 1)
      .map((p) => [p.latitude, p.longitude] as [number, number]);
  }, [selectedTrip, currentPointIndex]);

  const startPt = useMemo(() => {
    if (!selectedTrip || selectedTrip.points.length === 0) return null;
    return selectedTrip.points[0];
  }, [selectedTrip]);

  const midPt = useMemo(() => {
    if (!selectedTrip || selectedTrip.points.length === 0) return null;
    return selectedTrip.points[Math.floor(selectedTrip.points.length / 2)];
  }, [selectedTrip]);

  const endPt = useMemo(() => {
    if (!selectedTrip || selectedTrip.points.length < 2) return null;
    return selectedTrip.points[selectedTrip.points.length - 1];
  }, [selectedTrip]);

  const formatDateTime = (date: Date) => {
    return date.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true
    });
  };

  const handleOpenMap = (trip: Trip) => {
    setSelectedTrip(trip);
    setCurrentPointIndex(0);
    setIsPlaying(false);
  };

  const handleCloseMap = () => {
    setSelectedTrip(null);
    setIsPlaying(false);
  };

  // Count trips per device
  const tripsPerDevice = useMemo(() => {
    const counts: Record<string, number> = {};
    trips.forEach((t) => {
      counts[t.deviceCode] = (counts[t.deviceCode] || 0) + 1;
    });
    return counts;
  }, [trips]);

  // Total stats
  const totalDistance = useMemo(() => trips.reduce((sum, t) => sum + t.distanceKm, 0), [trips]);
  const totalDuration = useMemo(() => trips.reduce((sum, t) => sum + t.durationMin, 0), [trips]);
  const activeTrips = useMemo(() => trips.filter((t) => t.status === 'ACTIVE').length, [trips]);

  return (
    <div className="space-y-6 text-white min-h-screen bg-[#09090b]">
      {/* Dashboard Title & Subtitle */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Trip Management</h1>
        <p className="text-gray-400 text-sm">View all trips, route history, and trip reports for your registered devices</p>
      </div>

      {/* Registered Devices Summary */}
      <Card className="bg-gradient-to-br from-[#0b0f19] to-[#0d1425] border-gray-800/60 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Smartphone className="w-4.5 h-4.5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white tracking-wide uppercase">Registered Devices</h2>
            <span className="ml-auto text-xs text-gray-500 font-mono">{registeredDevices.length} device{registeredDevices.length !== 1 ? 's' : ''}</span>
          </div>
          {registeredDevices.length === 0 ? (
            <div className="text-center py-6 text-gray-500">
              <Smartphone className="w-8 h-8 mx-auto text-gray-700 mb-2" />
              <p className="text-xs font-semibold">No devices registered. Add a device first.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-3">
              {registeredDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center gap-3 bg-gray-900/60 border border-gray-800/50 rounded-xl px-4 py-3 min-w-[200px] hover:border-cyan-500/30 transition-all duration-200"
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    device.is_active
                      ? 'bg-cyan-500/10 border border-cyan-500/25'
                      : 'bg-gray-800/50 border border-gray-700/30'
                  }`}>
                    <Smartphone className={`w-4 h-4 ${device.is_active ? 'text-cyan-400' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white leading-tight">
                      {device.device_name || 'Unnamed Device'}
                    </span>
                    <span className="text-[10px] font-mono text-gray-500">{device.device_code}</span>
                  </div>
                  <div className="ml-auto flex flex-col items-end gap-0.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider border ${
                      device.is_active
                        ? 'bg-green-500/10 text-green-400 border-green-500/25'
                        : 'bg-gray-700/20 text-gray-500 border-gray-700/30'
                    }`}>
                      {device.is_active ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                    <span className="text-[9px] text-gray-600 font-mono">
                      {tripsPerDevice[device.device_code] || 0} trip{(tripsPerDevice[device.device_code] || 0) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Trip Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#0b0f19] border border-gray-800/50 rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Trips</span>
          </div>
          <span className="text-2xl font-extrabold text-white font-mono">{trips.length}</span>
        </div>
        <div className="bg-[#0b0f19] border border-gray-800/50 rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Distance</span>
          </div>
          <span className="text-2xl font-extrabold text-white font-mono">{totalDistance.toFixed(1)} <span className="text-xs text-cyan-500">km</span></span>
        </div>
        <div className="bg-[#0b0f19] border border-gray-800/50 rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-violet-400" />
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Total Duration</span>
          </div>
          <span className="text-2xl font-extrabold text-white font-mono">{totalDuration} <span className="text-xs text-cyan-500">min</span></span>
        </div>
        <div className="bg-[#0b0f19] border border-gray-800/50 rounded-2xl p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-400" />
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Active Trips</span>
          </div>
          <span className="text-2xl font-extrabold text-white font-mono">{activeTrips}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="relative max-w-full">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 w-5 h-5" />
        <Input
          type="text"
          placeholder="Search by device ID or device name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-900/30 border-gray-800 text-white rounded-xl pl-12 h-12 text-sm focus-visible:ring-cyan-500"
        />
      </div>

      {/* Trips list Table */}
      <Card className="bg-[#0b0f19] border-gray-850 shadow-2xl backdrop-blur-md rounded-2xl overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
              <span>Fetching trips data...</span>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Compass className="w-12 h-12 mx-auto text-gray-700 mb-3" />
              <p className="font-semibold text-sm">
                {trips.length === 0
                  ? 'No trips found. Your registered devices have no GPS data yet.'
                  : 'No trips match your search filters.'}
              </p>
            </div>
          ) : (
            <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 font-bold tracking-wider text-xs uppercase bg-[#080c14]/50">
                  <th className="py-4 px-4 w-20">Trip #</th>
                  <th className="py-4 px-4">Device</th>
                  <th className="py-4 px-4">Start Time</th>
                  <th className="py-4 px-4">End Time</th>
                  <th className="py-4 px-4">Distance</th>
                  <th className="py-4 px-4">Duration</th>
                  <th className="py-4 px-4">Stops</th>
                  <th className="py-4 px-4">Route</th>
                  <th className="py-4 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-850 bg-[#0c111e]/20">
                {filteredTrips.map((trip) => {
                  return (
                    <tr
                      key={trip.id}
                      className="hover:bg-gray-900/40 transition-colors duration-150 group"
                    >
                      {/* Trip Number Badge */}
                      <td className="py-4 px-4">
                        <div className="flex flex-col items-center gap-1">
                          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/15 to-violet-500/15 border border-cyan-500/25 text-cyan-400 font-extrabold text-sm font-mono shadow-sm">
                            {trip.tripNumber}
                          </span>
                        </div>
                      </td>

                      {/* Device Clickable Code */}
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleOpenMap(trip)}
                          className="text-left group/device"
                        >
                          <span className="text-blue-500 hover:text-cyan-400 font-mono text-xs font-bold hover:underline transition-all block">
                            {trip.deviceCode}
                          </span>
                          <span className="text-[10px] text-gray-600 block mt-0.5">
                            {trip.deviceName}
                          </span>
                        </button>
                      </td>
                      
                      {/* Start Time */}
                      <td className="py-4 px-4 text-gray-400 text-xs font-semibold leading-relaxed">
                        {formatDateTime(trip.startTime)}
                      </td>
                      
                      {/* End Time */}
                      <td className="py-4 px-4 text-gray-400 text-xs font-semibold leading-relaxed">
                        {trip.endTime ? formatDateTime(trip.endTime) : '—'}
                      </td>
                      
                      {/* Distance */}
                      <td className="py-4 px-4 text-blue-400 font-bold font-mono">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {trip.distanceKm} km
                        </span>
                      </td>
                      
                      {/* Duration */}
                      <td className="py-4 px-4 text-gray-300 font-semibold">
                        <span className="flex items-center gap-1.5 text-gray-300 font-mono">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          {trip.durationMin}m
                        </span>
                      </td>

                      {/* Stop Count */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: trip.stopCount }, (_, i) => (
                              <div key={i} className="flex items-center">
                                <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                                  i === 0 ? 'bg-green-400 border-green-400/40' :
                                  i === trip.stopCount - 1 ? 'bg-red-400 border-red-400/40' :
                                  'bg-yellow-400 border-yellow-400/40'
                                }`} />
                                {i < trip.stopCount - 1 && (
                                  <div className="w-3 h-0.5 bg-gray-700" />
                                )}
                              </div>
                            ))}
                          </div>
                          <span className="text-xs font-bold text-gray-300 font-mono ml-1">
                            {trip.stopCount}
                          </span>
                        </div>
                      </td>
                      
                      {/* Route Path (Multi-stops) */}
                      <td className="py-4 px-4 text-gray-200 font-medium">
                        <div className="flex items-start gap-2 max-w-sm">
                          <Compass className="w-4 h-4 text-cyan-500 shrink-0 mt-0.5" />
                          <div className="flex flex-col text-xs font-semibold leading-normal">
                            {trip.routeLegs.map((leg, lIdx) => (
                              <div key={lIdx} className="flex items-center gap-1">
                                <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-800 text-[8px] text-gray-400 font-bold shrink-0">
                                  {lIdx + 1}
                                </span>
                                <span>{leg.start}</span>
                                <span className="text-cyan-600 font-extrabold">→</span>
                                <span className={leg.end === 'In Progress' ? 'text-blue-400 italic' : ''}>
                                  {leg.end}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                      
                      {/* Status Badges */}
                      <td className="py-4 px-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-extrabold tracking-wider border ${
                          trip.status === 'ACTIVE'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/25'
                            : 'bg-green-500/10 text-green-400 border-green-500/25'
                        }`}>
                          {trip.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* TRIP ROUTE DETAILS MAP MODAL (Full Screen Overlay Modal) */}
      {selectedTrip && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <Card className="bg-[#0b0f19] border border-gray-800 rounded-3xl w-full max-w-5xl overflow-hidden shadow-2xl flex flex-col h-[650px] relative">
            
            {/* Modal Header */}
            <div className="bg-gray-950/80 p-5 border-b border-gray-800/80 flex items-center justify-between z-10">
              <div>
                <h2 className="text-xl font-bold text-white tracking-wide">Trip Route Details</h2>
                <div className="flex items-center gap-4 text-xs font-semibold text-gray-400 mt-1">
                  <span>Device: <b className="text-blue-500 font-mono">{selectedTrip.deviceCode}</b></span>
                  <span>•</span>
                  <span>{selectedTrip.distanceKm} km</span>
                  <span>•</span>
                  <span>{selectedTrip.durationMin}m Duration</span>
                </div>
              </div>
              
              <button
                onClick={handleCloseMap}
                className="w-10 h-10 bg-gray-900 border border-gray-800 hover:bg-gray-800 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-all shadow-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Routing Header Banner */}
            <div className="bg-gray-950/50 px-6 py-3 border-b border-gray-900/60 z-10 flex items-center gap-2">
              <Compass className="w-4.5 h-4.5 text-cyan-400" />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-bold text-gray-200">
                {selectedTrip.routeLegs.map((leg, lIdx) => (
                  <React.Fragment key={lIdx}>
                    {lIdx > 0 && <span className="text-cyan-500">→</span>}
                    <span>{leg.start}</span>
                    <span className="text-cyan-500">→</span>
                    <span className={leg.end === 'In Progress' ? 'text-blue-400 italic' : ''}>{leg.end}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Map Container */}
            <div className="flex-1 relative bg-gray-950 z-0">
              <MapContainer
                center={[selectedTrip.points[0].latitude, selectedTrip.points[0].longitude]}
                zoom={14}
                style={{ width: '100%', height: '100%', background: '#09090b' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />

                {/* Full polyline dashed route line */}
                <Polyline
                  positions={polylineCoords}
                  color="#3b82f6"
                  weight={4.5}
                  opacity={0.35}
                  dashArray="8, 8"
                />

                {/* Animated driven route line */}
                <Polyline
                  positions={coveredPolylineCoords}
                  color="#06b6d4"
                  weight={5}
                  opacity={0.9}
                />

                {/* Pin 1: Start Location (standard blue pin marker) */}
                {startPt && (
                  <Marker position={[startPt.latitude, startPt.longitude]} icon={defaultBlueIcon}>
                    <Tooltip permanent direction="bottom" className="custom-leaflet-tooltip font-extrabold text-[10px] text-gray-200 bg-gray-900 border border-gray-800 rounded px-2 py-0.5 shadow-lg">
                      {selectedTrip.routeLegs[0]?.start}
                    </Tooltip>
                  </Marker>
                )}

                {/* Pin 2: Midpoint Location (standard blue pin marker) */}
                {midPt && selectedTrip.status !== 'ACTIVE' && (
                  <Marker position={[midPt.latitude, midPt.longitude]} icon={defaultBlueIcon}>
                    <Tooltip permanent direction="bottom" className="custom-leaflet-tooltip font-extrabold text-[10px] text-gray-200 bg-gray-900 border border-gray-800 rounded px-2 py-0.5 shadow-lg">
                      {selectedTrip.routeLegs[0]?.end}
                    </Tooltip>
                  </Marker>
                )}

                {/* Pin 3: End Location (standard blue pin marker) */}
                {endPt && selectedTrip.status !== 'ACTIVE' && (
                  <Marker position={[endPt.latitude, endPt.longitude]} icon={defaultBlueIcon}>
                    <Tooltip permanent direction="bottom" className="custom-leaflet-tooltip font-extrabold text-[10px] text-gray-200 bg-gray-900 border border-gray-800 rounded px-2 py-0.5 shadow-lg">
                      {selectedTrip.routeLegs[selectedTrip.routeLegs.length - 1]?.end}
                    </Tooltip>
                  </Marker>
                )}

                {/* Replay Simulated Car Marker */}
                {currentCoords && movingIcon && isPlaying && (
                  <Marker position={currentCoords} icon={movingIcon}>
                    <Tooltip direction="top" className="bg-gray-950 text-cyan-400 font-bold text-[9px] px-1.5 py-0.5 rounded border border-cyan-500/20">
                      Replay Active
                    </Tooltip>
                  </Marker>
                )}

                {/* Auto center and zoom map bounds */}
                <MapBoundsFitter points={polylineCoords} />
                
                {/* Auto pan map following vehicle location */}
                {isPlaying && currentCoords && <MapPanner center={currentCoords} />}
              </MapContainer>

              {/* Floating Replay Telemetry Stats Panel */}
              <div className="absolute top-4 left-4 z-10 bg-gray-900/90 border border-gray-800/80 rounded-2xl p-4 shadow-2xl backdrop-blur-md w-56 space-y-2">
                <span className="text-[9px] text-cyan-400 uppercase tracking-widest font-extrabold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  Replay telemetry
                </span>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-gray-950/60 p-2 rounded-xl border border-gray-800/40">
                    <span className="text-[9px] font-semibold text-gray-500">SPEED</span>
                    <span className="text-base font-bold font-mono text-white block mt-0.5">
                      {isPlaying ? `${(20 + Math.random() * 10).toFixed(1)}` : '0.0'} <b className="text-[9px] text-cyan-500">km/h</b>
                    </span>
                  </div>
                  <div className="bg-gray-950/60 p-2 rounded-xl border border-gray-800/40">
                    <span className="text-[9px] font-semibold text-gray-500">ODOMETER</span>
                    <span className="text-base font-bold font-mono text-white block mt-0.5">
                      {(selectedTrip.distanceKm * (currentPointIndex / (selectedTrip.points.length - 1))).toFixed(2)} <b className="text-[9px] text-cyan-500">km</b>
                    </span>
                  </div>
                </div>

                <div className="bg-gray-950/60 p-2 rounded-xl border border-gray-800/40 text-left text-[11px] font-mono text-gray-300">
                  <div className="flex justify-between">
                    <span>Point:</span>
                    <span className="text-white font-bold">{currentPointIndex + 1} / {selectedTrip.points.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Bottom Replay Controls Toolbar */}
            <div className="bg-gray-950/90 border-t border-gray-850 p-4 space-y-3 z-10">
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-gray-500 font-mono">00:00</span>
                <input
                  type="range"
                  min={0}
                  max={selectedTrip.points.length - 1}
                  value={currentPointIndex}
                  onChange={(e) => {
                    setCurrentPointIndex(Number(e.target.value));
                    setIsPlaying(false);
                  }}
                  className="flex-1 accent-cyan-500 h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer"
                />
                <span className="text-[10px] text-gray-500 font-mono">
                  {String(Math.floor((selectedTrip.durationMin * 60) / 60)).padStart(2, '0')}:
                  {String((selectedTrip.durationMin * 60) % 60).padStart(2, '0')}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-10 h-10 rounded-2xl bg-cyan-600 hover:bg-cyan-700 text-white flex items-center justify-center shrink-0 shadow-lg shadow-cyan-600/10"
                  >
                    {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentPointIndex(0);
                    }}
                    variant="outline"
                    className="w-10 h-10 rounded-2xl border-gray-800 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-850 shrink-0"
                  >
                    <RotateCcw className="w-4.5 h-4.5" />
                  </Button>
                </div>

                <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-2xl border border-gray-800">
                  {[1, 2, 5, 10].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={`text-[11px] px-2.5 py-1 rounded-xl font-bold transition-all ${
                        playbackSpeed === speed
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                          : 'text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default TripHistory;
