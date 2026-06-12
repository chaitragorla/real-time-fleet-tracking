import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, Rectangle, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { RefreshCw, MapPin, Clock, AlertCircle, RotateCcw } from 'lucide-react';
import { createCustomMarkerIcon, createStartIcon, getGeofenceOffsets } from '@/utils/iconUtils';
import { IconSelector } from './IconSelector';

// Fix for default markers in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom icons will be created dynamically based on device settings

interface GPSData {
  id: number;
  device_code: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  user_id?: number;
}

interface Device {
  id: number;
  device_code: string;
  device_name: string | null;
  device_icon: string | null;
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

const MapUpdater = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
};

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
  const [prevStatus, setPrevStatus] = useState<string>('');


  // Extract unique dates from gpsData
  const dateOptions = React.useMemo(() => {
    const dates = Array.from(
      new Set(
        gpsData.map(point => point.timestamp.split('T')[0])
      )
    );
    dates.sort((a, b) => b.localeCompare(a)); // Descending order
    return ['ALL', ...dates];
  }, [gpsData]);

  // Filter gpsData by selectedDate
  const filteredGpsData = React.useMemo(() => {
    if (selectedDate === 'ALL') return gpsData;
    return gpsData.filter(point => point.timestamp.startsWith(selectedDate));
  }, [gpsData, selectedDate]);



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
      console.log('📡 Fetching GPS data for device:', deviceCode);
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
    // Fetch device info on component mount
    fetchDeviceInfo();

    // Always fetch historical GPS data regardless of tracking status
    fetchGPSData();

    // Poll for GPS updates while tracking is active. This replaces Supabase realtime.
    if (isTrackingActive) {
      const interval = window.setInterval(fetchGPSData, 3000);
      return () => window.clearInterval(interval);
    }
  }, [deviceCode, isTrackingActive]);

  const formatTimestamp = (timestamp: string) => {
    // Database now stores timestamps in IST, no timezone conversion needed
    return new Date(timestamp).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // If no GPS data, we will still show the map but centered at a default location (e.g. India)
  const defaultCenter: [number, number] = [20.5937, 78.9629];
  const hasValidData = gpsData.length > 0;

  // Prepare path coordinates for polyline
  console.log('Processing GPS data for coordinates:', filteredGpsData);
  const pathCoordinates: [number, number][] = filteredGpsData
    .filter(point => {
      const isValid = point.latitude != null && point.longitude != null &&
        typeof point.latitude === 'number' && typeof point.longitude === 'number' &&
        !isNaN(point.latitude) && !isNaN(point.longitude);
      if (!isValid) {
        console.log('Invalid GPS point filtered out:', point);
      }
      return isValid;
    })
    .map(point => [point.latitude, point.longitude]);
  console.log('Valid path coordinates:', pathCoordinates);
  const centerCoordinate = pathCoordinates.length > 0 
    ? pathCoordinates[pathCoordinates.length - 1] 
    : defaultCenter;

  const referenceCoordinate = pathCoordinates.length > 0 ? pathCoordinates[0] : defaultCenter;
  const centerLat = referenceCoordinate[0];
  const centerLng = referenceCoordinate[1];

  const offsets = getGeofenceOffsets(deviceIcon);

  const homeBounds: [number, number][] = [
    [centerLat + offsets.home[0][0], centerLng + offsets.home[0][1]],
    [centerLat + offsets.home[1][0], centerLng + offsets.home[1][1]]
  ];

  const collegeBounds: [number, number][] = [
    [centerLat + offsets.college[0][0], centerLng + offsets.college[0][1]],
    [centerLat + offsets.college[1][0], centerLng + offsets.college[1][1]]
  ];

  const officeBounds: [number, number][] = [
    [centerLat + offsets.office[0][0], centerLng + offsets.office[0][1]],
    [centerLat + offsets.office[1][0], centerLng + offsets.office[1][1]]
  ];

  const isPointInBounds = (point: [number, number] | null, bounds: [number, number][]) => {
    if (!point) return false;
    const [lat, lng] = point;
    const [[minLat, minLng], [maxLat, maxLng]] = bounds;
    return lat >= Math.min(minLat, maxLat) &&
           lat <= Math.max(minLat, maxLat) &&
           lng >= Math.min(minLng, maxLng) &&
           lng <= Math.max(minLng, maxLng);
  };

  const getParkingStatus = () => {
    const latestPoint = pathCoordinates.length > 0 ? pathCoordinates[pathCoordinates.length - 1] : null;
    if (!latestPoint) return { status: 'UNKNOWN', name: 'No location data', message: 'No location data available.' };
    
    if (isPointInBounds(latestPoint, homeBounds)) {
      return { status: 'HOME', name: 'Home Parking Slot', message: '🎉 Correctly Parked! Your vehicle is safely parked in the Home Parking Slot.' };
    }
    if (isPointInBounds(latestPoint, collegeBounds)) {
      return { status: 'COLLEGE', name: 'College Parking Slot', message: '🎉 Correctly Parked! Your vehicle is safely parked in the College Parking Slot.' };
    }
    if (isPointInBounds(latestPoint, officeBounds)) {
      return { status: 'OFFICE', name: 'Office Parking Slot', message: '🎉 Correctly Parked! Your vehicle is safely parked in the Office Parking Slot.' };
    }
    return { status: 'WRONG', name: 'Wrong Location', message: '❌ Wrongly Parked! Your vehicle is parked outside the designated parking slots. Please park inside the square boxes.' };
  };

  const parkingInfo = getParkingStatus();

  useEffect(() => {
    if (pathCoordinates.length > 0) {
      const currentStatus = parkingInfo.status;
      if (currentStatus !== prevStatus && currentStatus !== 'UNKNOWN') {
        if (currentStatus === 'WRONG') {
          toast({
            title: "⚠️ Parking Violation",
            description: parkingInfo.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "✅ Parking Confirmed",
            description: parkingInfo.message,
          });
        }
        setPrevStatus(currentStatus);
      }
    }
  }, [pathCoordinates, parkingInfo.status, prevStatus]);

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
            {!isTrackingActive && (
              <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                Tracking Stopped
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
      {pathCoordinates.length > 0 && (
        <div className={`p-4 rounded-xl border font-semibold flex items-center justify-between transition-all ${
          parkingInfo.status === 'WRONG'
            ? 'bg-red-500/10 border-red-500/20 text-red-400'
            : 'bg-green-500/10 border-green-500/20 text-green-400'
        }`}>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wider block opacity-70">Current Parking Check</span>
            <span className="text-sm">{parkingInfo.message}</span>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wide ${
            parkingInfo.status === 'WRONG'
              ? 'bg-red-500/20 border-red-500/30 text-red-400'
              : 'bg-green-500/20 border-green-500/30 text-green-400'
          }`}>
            {parkingInfo.status === 'WRONG' ? 'Wrongly Parked' : 'Correctly Parked'}
          </span>
        </div>
      )}
      <div className="border border-gray-200 rounded-lg overflow-hidden relative">
        <MapContainer
          center={centerCoordinate}
          zoom={14}
          style={{ height, width: '100%' }}
          className="z-0"
        >
          <TileLayer
            url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            attribution='&copy; <a href="https://www.google.com/intl/en_US/help/terms_maps.html">Google Maps</a>'
          />
          <MapUpdater center={centerCoordinate} />
          {/* Route polyline */}
          <Polyline
            positions={pathCoordinates}
            color="#2563EB"
            weight={6}
            opacity={0.8}
          />
          {/* Parking Slot Zones */}
          <Rectangle
            bounds={homeBounds}
            pathOptions={{
              color: parkingInfo.status === 'HOME' ? '#22C55E' : '#3B82F6',
              weight: 2,
              dashArray: '5, 5',
              fillColor: '#3B82F6',
              fillOpacity: 0.1
            }}
          >
            <Tooltip permanent direction="center" className="bg-transparent border-none shadow-none font-bold text-blue-600 text-xs">
              Home Parking
            </Tooltip>
          </Rectangle>

          <Rectangle
            bounds={collegeBounds}
            pathOptions={{
              color: parkingInfo.status === 'COLLEGE' ? '#22C55E' : '#3B82F6',
              weight: 2,
              dashArray: '5, 5',
              fillColor: '#3B82F6',
              fillOpacity: 0.1
            }}
          >
            <Tooltip permanent direction="center" className="bg-transparent border-none shadow-none font-bold text-blue-600 text-xs">
              College Parking
            </Tooltip>
          </Rectangle>

          <Rectangle
            bounds={officeBounds}
            pathOptions={{
              color: parkingInfo.status === 'OFFICE' ? '#22C55E' : '#3B82F6',
              weight: 2,
              dashArray: '5, 5',
              fillColor: '#3B82F6',
              fillOpacity: 0.1
            }}
          >
            <Tooltip permanent direction="center" className="bg-transparent border-none shadow-none font-bold text-blue-600 text-xs">
              Office Parking
            </Tooltip>
          </Rectangle>
          {/* Start point marker - only show if we have more than 1 point */}
          {filteredGpsData.length > 1 && filteredGpsData[0].latitude != null && filteredGpsData[0].longitude != null && (
            <Marker
              position={[filteredGpsData[0].latitude, filteredGpsData[0].longitude]}
              icon={createStartIcon()}
            >
              <Popup>
                <div className="text-sm">
                  <strong>Start Point</strong><br />
                  <strong>Time:</strong> {formatTimestamp(filteredGpsData[0].timestamp)}<br />
                  <strong>Coordinates:</strong> {filteredGpsData[0].latitude?.toFixed(6) || 'N/A'}, {filteredGpsData[0].longitude?.toFixed(6) || 'N/A'}
                </div>
              </Popup>
            </Marker>
          )}
          {/* Current position marker - ALWAYS show the device logo for the latest point */}
          {filteredGpsData.length > 0 && filteredGpsData[filteredGpsData.length - 1].latitude != null && filteredGpsData[filteredGpsData.length - 1].longitude != null && (
            <Marker
              position={[filteredGpsData[filteredGpsData.length - 1].latitude, filteredGpsData[filteredGpsData.length - 1].longitude]}
              icon={createCustomMarkerIcon(deviceIcon, '#EF4444', 24)}
              eventHandlers={{
                dblclick: () => setShowIconSelector(true)
              }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>Current Position</strong><br />
                  <strong>Time:</strong> {formatTimestamp(filteredGpsData[filteredGpsData.length - 1].timestamp)}<br />
                  <strong>Coordinates:</strong> {filteredGpsData[filteredGpsData.length - 1].latitude?.toFixed(6) || 'N/A'}, {filteredGpsData[filteredGpsData.length - 1].longitude?.toFixed(6) || 'N/A'}<br />
                  <em className="text-xs text-gray-500">Double-click marker to change icon</em>
                </div>
              </Popup>
            </Marker>
          )}
          {/* Intermediate points removed - only showing start and end markers */}
        </MapContainer>
        
        {/* Icon Selector Modal - Positioned within the map container */}
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
      {showControls && filteredGpsData.length > 0 && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <strong>Route Summary:</strong> {filteredGpsData.length} GPS points from {formatTimestamp(filteredGpsData[0].timestamp)} to {formatTimestamp(filteredGpsData[filteredGpsData.length - 1].timestamp)}
        </div>
      )}



    </div>
  );
};

export default DeviceRouteMap;
