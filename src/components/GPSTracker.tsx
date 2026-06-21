import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, AlertCircle, Satellite } from 'lucide-react';
import DeviceRouteMap from './DeviceRouteMap';

interface GPSTrackerProps {
  deviceCode: string;
  deviceName?: string;
  deviceM2mNumber?: string | null;
  isTrackingActive: boolean;
  onToggleTracking: (active: boolean) => void;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

const GPSTracker: React.FC<GPSTrackerProps> = ({ deviceCode, deviceName, deviceM2mNumber, isTrackingActive, onToggleTracking }) => {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [trackingStats, setTrackingStats] = useState({
    sessionStart: null as Date | null,
    totalPoints: 0,
    lastError: null as string | null
  });
  const [locationError, setLocationError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const autoStartedRef = useRef(false);

  // Check if geolocation is supported
  const isGeolocationSupported = 'geolocation' in navigator;
  const [permissionStatus, setPermissionStatus] = useState<string>('unknown');

  // Check GPS permission status
  const checkPermissionStatus = async () => {
    if (!isGeolocationSupported) {
      setPermissionStatus('not_supported');
      return;
    }

    try {
      if ('permissions' in navigator) {
        const permission = await navigator.permissions.query({ name: 'geolocation' });
        setPermissionStatus(permission.state);

        // Listen for permission changes
        permission.onchange = () => {
          setPermissionStatus(permission.state);
        };
      } else {
        (navigator as Navigator).geolocation.getCurrentPosition(
          () => setPermissionStatus('granted'),
          (error) => {
            if (error.code === 1) {
              setPermissionStatus('denied');
            } else {
              setPermissionStatus('prompt');
            }
          },
          { timeout: 5000, maximumAge: 300000 }
        );
      }
    } catch (error) {
      console.error('Error checking permission:', error);
      setPermissionStatus('unknown');
    }
  };

  // Check permission status on component mount
  useEffect(() => {
    checkPermissionStatus();
  }, []);

  // Get current position with fallback strategies
  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!isGeolocationSupported) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      const attemptGeolocation = (highAccuracy: boolean, timeout: number) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            resolve(position);
          },
          (error) => {
            if (!highAccuracy && error.code === 2) {
              attemptGeolocation(true, 30000);
              return;
            }

            let errorMessage = 'Unknown location error';
            switch (error.code) {
              case 1:
                errorMessage = 'GPS access denied. Please enable location permissions in your browser settings.';
                break;
              case 2:
                errorMessage = 'GPS signal unavailable. Please move to an area with better GPS reception.';
                break;
              case 3:
                errorMessage = 'GPS request timed out. Please try again.';
                break;
            }
            reject(new Error(errorMessage));
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: timeout,
            maximumAge: highAccuracy ? 0 : 60000
          }
        );
      };

      attemptGeolocation(false, 10000);
    });
  };

  // Send location to GPS backend
  const sendLocationToBackend = async (location: LocationData) => {
    try {
      if (!deviceM2mNumber) {
        throw new Error('This device is missing its 13-digit M2M number. Ask an admin to configure it before GPS tracking.');
      }
      const result = await api.gps.updateLocation({
        device_code: deviceCode,
        device_m2m_number: deviceM2mNumber,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
        timestamp: location.timestamp
      });
      console.log('📡 Real GPS location sent to backend:', result.message);

      setLastUpdate(new Date());
      setTrackingStats(prev => ({
        ...prev,
        totalPoints: prev.totalPoints + 1,
        lastError: null
      }));
    } catch (error) {
      console.error('Error sending location to backend:', error);
      setTrackingStats(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Failed to save GPS data'
      }));
      throw error;
    }
  };

  // Track location every 20 seconds
  const trackLocation = async () => {
    try {
      const position = await getCurrentPosition();
      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp
      };

      setCurrentLocation(locationData);
      setLocationError(null);
      await sendLocationToBackend(locationData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown location error';
      setLocationError(errorMessage);
      setTrackingStats(prev => ({
        ...prev,
        lastError: errorMessage
      }));
      console.error('Error getting location:', error);
    }
  };

  // Auto-start tracking
  const startTracking = async () => {
    if (!isGeolocationSupported) return false;

    try {
      await trackLocation();

      intervalRef.current = setInterval(trackLocation, 20000);

      setTrackingStats({
        sessionStart: new Date(),
        totalPoints: 0,
        lastError: null
      });

      return true;
    } catch (error) {
      console.error('Error starting tracking:', error);
      return false;
    }
  };

  // Stop tracking
  const stopTracking = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // AUTO-START: Device automatically starts tracking on mount
  useEffect(() => {
    const autoStart = async () => {
      if (autoStartedRef.current) return;
      autoStartedRef.current = true;

      await checkPermissionStatus();

      // Auto-start tracking and update database
      const success = await startTracking();
      if (success && !isTrackingActive) {
        onToggleTracking(true);
      }
    };

    autoStart();

    // Cleanup on unmount
    return () => {
      stopTracking();
    };
  }, [deviceCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-attempt when permission changes to granted
  useEffect(() => {
    if (permissionStatus === 'granted' && !intervalRef.current) {
      startTracking().then(success => {
        if (success && !isTrackingActive) {
          onToggleTracking(true);
        }
      });
    }
  }, [permissionStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatTimestamp = (date: Date) => {
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* GPS Status Card — No user controls, fully automatic */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Satellite className="w-5 h-5 text-blue-600" />
            GPS Tracker - {deviceName || deviceCode}
          </CardTitle>
          <CardDescription>
            Automatic GPS tracking — device manages itself
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Auto Status Indicator */}
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${isTrackingActive ? 'bg-green-100 text-green-800 border border-green-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}`}>
              <div className={`w-3 h-3 rounded-full ${isTrackingActive ? 'bg-green-500 animate-pulse' : 'bg-blue-500'}`} />
              {isTrackingActive ? '🚗 Moving — Auto Tracking' : '✅ Reached Destination'}
            </div>
            {trackingStats.totalPoints > 0 && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                {trackingStats.totalPoints} points tracked
              </span>
            )}
          </div>

          {/* Geolocation Support Warning */}
          {!isGeolocationSupported && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <span className="text-red-800 text-sm">
                Geolocation is not supported by this browser
              </span>
            </div>
          )}

          {/* GPS Permission Status */}
          {isGeolocationSupported && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${permissionStatus === 'granted' ? 'bg-green-50 border border-green-200' :
              permissionStatus === 'denied' ? 'bg-red-50 border border-red-200' :
                permissionStatus === 'prompt' ? 'bg-blue-50 border border-blue-200' :
                  'bg-gray-50 border border-gray-200'
              }`}>
              <div className={`w-2 h-2 rounded-full ${permissionStatus === 'granted' ? 'bg-green-500' :
                permissionStatus === 'denied' ? 'bg-red-500' :
                  permissionStatus === 'prompt' ? 'bg-blue-500' :
                    'bg-gray-500'
                }`} />
              <div className="flex-1">
                <span className={`text-sm font-medium ${permissionStatus === 'granted' ? 'text-green-800' :
                  permissionStatus === 'denied' ? 'text-red-800' :
                    permissionStatus === 'prompt' ? 'text-blue-800' :
                      'text-gray-800'
                  }`}>
                  GPS Status: {
                    permissionStatus === 'granted' ? '🟢 Real GPS Active — Auto Tracking' :
                      permissionStatus === 'denied' ? '🔴 GPS Denied' :
                        permissionStatus === 'prompt' ? '🔵 Awaiting GPS Permission' :
                          'Checking GPS...'
                  }
                </span>
                {permissionStatus === 'denied' && (
                  <p className="text-xs text-red-700 mt-1">
                    GPS access denied. Enable location access in browser settings for automatic tracking.
                  </p>
                )}
              </div>
              {permissionStatus === 'denied' && (
                <Button
                  onClick={checkPermissionStatus}
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                >
                  Recheck
                </Button>
              )}
            </div>
          )}

          {/* Location Error Display */}
          {locationError && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${locationError.includes('denied')
              ? 'bg-red-50 border border-red-200'
              : 'bg-yellow-50 border border-yellow-200'
              }`}>
              <AlertCircle className={`w-5 h-5 ${locationError.includes('denied') ? 'text-red-600' : 'text-yellow-600'}`} />
              <span className={`text-sm ${locationError.includes('denied') ? 'text-red-800' : 'text-yellow-800'}`}>
                {locationError}
              </span>
            </div>
          )}

          {/* Current Location Info */}
          {currentLocation && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-blue-50 rounded-lg">
              <div>
                <label className="text-sm font-medium text-blue-800">Current Position</label>
                <p className="text-sm text-blue-700">
                  {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-blue-800">Accuracy</label>
                <p className="text-sm text-blue-700">{currentLocation.accuracy.toFixed(0)}m</p>
              </div>
              <div>
                <label className="text-sm font-medium text-blue-800">Last Update</label>
                <p className="text-sm text-blue-700">
                  {lastUpdate ? formatTimestamp(lastUpdate) : 'Never'}
                </p>
              </div>
            </div>
          )}

          {/* Last Error */}
          {trackingStats.lastError && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-yellow-800 text-sm">
                <strong>Last Error:</strong> {trackingStats.lastError}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* GPS Route Map */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" />
            Live GPS Route
          </CardTitle>
          <CardDescription>
            Real-time visualization of your GPS tracking data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DeviceRouteMap
            deviceCode={deviceCode}
            deviceName={deviceName}
            height="500px"
            showControls={true}
            isTrackingActive={isTrackingActive}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default GPSTracker;
