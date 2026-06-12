import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { toast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MapPin, Play, Square, AlertCircle, Clock, Satellite, RotateCcw } from 'lucide-react';
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
  // Load tracking state from localStorage
  const getStoredTrackingState = () => {
    try {
      const stored = localStorage.getItem(`gps_tracking_${deviceCode}`);
      return stored ? JSON.parse(stored) : { isTracking: false, sessionStart: null, totalPoints: 0 };
    } catch {
      return { isTracking: false, sessionStart: null, totalPoints: 0 };
    }
  };

  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [trackingStats, setTrackingStats] = useState(() => {
    const stored = getStoredTrackingState();
    return {
      sessionStart: stored.sessionStart ? new Date(stored.sessionStart) : null,
      totalPoints: stored.totalPoints || 0,
      lastError: null as string | null
    };
  });
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [locationError, setLocationError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const watchIdRef = useRef<number | null>(null);

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
        console.log('GPS permission status:', permission.state);

        // Listen for permission changes
        permission.onchange = () => {
          setPermissionStatus(permission.state);
          console.log('GPS permission changed to:', permission.state);
        };
      } else {
        // Fallback: Try to get position to check if permission is granted
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

      // First attempt with high accuracy disabled
      const attemptGeolocation = (highAccuracy: boolean, timeout: number) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ GPS position obtained:', {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              highAccuracy
            });
            resolve(position);
          },
          (error) => {
            console.error('❌ Geolocation error details:', {
              code: error.code,
              message: error.message,
              highAccuracy,
              timeout
            });

            // If first attempt fails and we used low accuracy, try with high accuracy
            if (!highAccuracy && error.code === 2) {
              console.log('🔄 Retrying with high accuracy...');
              attemptGeolocation(true, 30000);
              return;
            }

            let errorMessage = 'Unknown location error';
            switch (error.code) {
              case 1: // PERMISSION_DENIED
          errorMessage = 'GPS access denied. Please enable location permissions in your browser settings to use real GPS tracking.';
          break;
        case 2: // POSITION_UNAVAILABLE
          errorMessage = 'GPS signal unavailable. This may happen indoors or in areas with poor GPS reception. Please move to an area with better GPS signal.';
          break;
        case 3: // TIMEOUT
          errorMessage = 'GPS request timed out. Please try again or move to an area with better GPS signal.';
          break;
            }

            reject(new Error(errorMessage));
          },
          {
            enableHighAccuracy: highAccuracy,
            timeout: timeout,
            maximumAge: highAccuracy ? 0 : 60000 // Use fresh location for high accuracy
          }
        );
      };

      // Start with low accuracy for faster response
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

      // Send real GPS coordinates to backend
      await sendLocationToBackend(locationData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown location error';
      setLocationError(errorMessage);
      setTrackingStats(prev => ({
        ...prev,
        lastError: errorMessage
      }));
      console.error('Error getting location:', error);

      toast({
        title: "Location Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  // Modified startTracking
  const startTracking = async () => {
    if (!isGeolocationSupported) {
      toast({
        title: "Not Supported",
        description: "Geolocation is not supported by this browser.",
        variant: "destructive",
      });
      return false;
    }

    // Check permission status before starting
    await checkPermissionStatus();

    if (permissionStatus === 'denied') {
      toast({
        title: "Permission Denied",
        description: "GPS permission is denied. Please enable location access in your browser settings.",
        variant: "destructive",
      });
      return false;
    }

    try {
      toast({
        title: "Requesting GPS Permission",
        description: "Please allow location access when prompted.",
      });

      // Get initial position (this will trigger permission request if needed)
      await trackLocation();

      // Update permission status after successful location access
      await checkPermissionStatus();

      // Only proceed if permission was actually granted
      if (permissionStatus !== 'granted') {
        throw new Error('GPS permission was not granted');
      }

      toast({
        title: "GPS Tracking Started",
        description: "Your real GPS location is now being tracked.",
      });

      // Set up interval for every 20 seconds
      intervalRef.current = setInterval(trackLocation, 20000);

      const newStats = {
        sessionStart: new Date(),
        totalPoints: 0,
        lastError: null
      };

      setTrackingStats(prev => ({ ...prev, ...newStats }));

      return true; // Indicate successful start
    } catch (error) {
      console.error('Error starting tracking:', error);
      await checkPermissionStatus();

      let errorMessage = "Could not start GPS tracking.";
      if (error instanceof Error) {
        if (error.message.includes('denied')) {
          errorMessage = "Location permission was denied. Please enable location access and try again.";
        } else if (error.message.includes('timeout')) {
          errorMessage = "GPS signal timeout. Please ensure you're in an area with good GPS reception.";
        } else {
          errorMessage = `GPS Error: ${error.message}`;
        }
      }

      toast({
        title: "Failed to Start",
        description: errorMessage,
        variant: "destructive",
      });
      return false; // Indicate failed start
    }
  };

  // Modified stopTracking
  const stopTracking = async () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setTrackingStats(prev => ({
      ...prev,
      sessionStart: null,
      totalPoints: 0,
      lastError: null
    }));

    toast({
      title: "GPS Tracking Stopped",
      description: "Location tracking has been disabled.",
    });
  };

  // Reset tracking and map data
  const resetTracking = async () => {
    // Stop current tracking
    stopTracking();

    try {
      // Clear all GPS data from database
      console.log('🗑️ Clearing GPS data for device:', deviceCode);
      const response = await fetch(`http://localhost:3001/v1/gps-signal/device/${deviceCode}/clear`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ GPS data cleared successfully:', result);
        toast({
          title: "GPS Data Cleared",
          description: `Cleared ${result.deletedCount || 0} GPS tracking points from database.`,
        });
      } else {
        console.error('❌ Failed to clear GPS data:', response.statusText);
        toast({
          title: "Warning",
          description: "Could not clear GPS data from database. Map will still reset.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Error clearing GPS data:', error);
      toast({
        title: "Warning",
        description: "Could not clear GPS data from database. Map will still reset.",
        variant: "destructive",
      });
    }

    // Clear current location and errors
    setCurrentLocation(null);
    setLocationError(null);
    setLastUpdate(null);
    const resetStats = {
      sessionStart: null,
      totalPoints: 0,
      lastError: null
    };
    setTrackingStats(resetStats);

    // Clear localStorage state
    try {
      localStorage.removeItem(`gps_tracking_${deviceCode}`);
    } catch (error) {
      console.error('Failed to clear tracking state from localStorage:', error);
    }

    // Clear manual input
    setManualLat('');
    setManualLng('');
    setShowManualInput(false);

    // Recheck permission status
    await checkPermissionStatus();

    toast({
      title: "Tracking Reset",
      description: "GPS tracking has been completely reset. You can start tracking from point 1 again.",
    });
  };

  // Auto-start GPS tracking when isTrackingActive is true and GPS permission is available
  useEffect(() => {
    const initializeTracking = async () => {
      if (isTrackingActive && permissionStatus === 'granted') {
        // If tracking should be active and GPS permission is granted, start tracking
        console.log('Auto-starting GPS tracking - permission already granted');
        const success = await startTracking();
        if (!success) {
          // If auto-start failed, update database to reflect actual state
          onToggleTracking(false);
        }
      } else if (isTrackingActive && permissionStatus === 'prompt') {
        // If tracking should be active but permission needs to be requested
        console.log('GPS tracking requested but permission needed');
        toast({
          title: "GPS Permission Required",
          description: "Please click 'Start Tracking' to enable GPS permission for location tracking.",
          variant: "default",
        });
      }
    };

    initializeTracking();

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [isTrackingActive, permissionStatus, deviceCode]);

  // Remove useEffect that syncs local state with backend is_active
  // The buttons now control the tracking state directly.

  const formatTimestamp = (date: Date) => {
    // Database now stores timestamps in IST, no timezone conversion needed
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSessionDuration = () => {
    if (!trackingStats.sessionStart) return 'Not started';
    const now = new Date();
    const diff = now.getTime() - trackingStats.sessionStart.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="space-y-6">
      {/* GPS Tracker Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Satellite className="w-5 h-5 text-blue-600" />
            GPS Tracker - {deviceName || deviceCode}
          </CardTitle>
          <CardDescription>
            Track your real GPS location for device monitoring
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Control Buttons */}
          <div className="flex items-center gap-3">
            {!isTrackingActive ? (
              <Button
                onClick={async () => {
                  // First try to start actual GPS tracking
                  const success = await startTracking();
                  // Only update database state if GPS tracking started successfully
                  if (success) {
                    onToggleTracking(true);
                  }
                }}
                disabled={!isGeolocationSupported}
                className="flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                Start Tracking
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  // Stop actual GPS tracking first
                  await stopTracking();
                  // Then update database state
                  onToggleTracking(false);
                }}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <Square className="w-4 h-4" />
                Stop Tracking
              </Button>
            )}

            <Button
              onClick={resetTracking}
              variant="outline"
              className="flex items-center gap-2"
              title="Reset tracking data"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>

            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${isTrackingActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
              <div className={`w-2 h-2 rounded-full ${isTrackingActive ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {isTrackingActive ? 'Tracking Active' : 'Tracking Inactive'}
            </div>
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
                    permissionStatus === 'granted' ? 'Real GPS Active' :
                      permissionStatus === 'denied' ? 'GPS Denied' :
                        permissionStatus === 'prompt' ? 'GPS Permission Required' :
                          'Checking GPS...'
                  }
                </span>
                {permissionStatus === 'granted' && (
                  <p className="text-xs text-green-700 mt-1">
                    Using your real GPS location for accurate tracking.
                  </p>
                )}
                {permissionStatus === 'denied' && (
                  <p className="text-xs text-red-700 mt-1">
                    GPS access denied. Enable location access in browser settings for real GPS tracking.
                  </p>
                )}
                {permissionStatus === 'prompt' && (
                  <p className="text-xs text-blue-700 mt-1">
                    Click "Start Tracking" to enable GPS permission for real location tracking.
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
            <div className="space-y-3">
              <div className={`flex items-center gap-2 p-3 rounded-lg ${locationError.includes('denied')
                ? 'bg-red-50 border border-red-200'
                : 'bg-yellow-50 border border-yellow-200'
                }`}>
                <AlertCircle className={`w-5 h-5 ${locationError.includes('denied') ? 'text-red-600' : 'text-yellow-600'
                  }`} />
                <div className="flex-1">
                  <span className={`text-sm ${locationError.includes('denied') ? 'text-red-800' : 'text-yellow-800'
                    }`}>{locationError}</span>
                  {!locationError.includes('denied') && (
                    <p className="text-xs text-yellow-700 mt-1">
                      Note: You can use manual location input as a fallback option.
                    </p>
                  )}
                </div>
              </div>

              {/* Manual Location Input Fallback */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">Manual Location Input</span>
                  <Button
                    onClick={() => setShowManualInput(!showManualInput)}
                    variant="outline"
                    size="sm"
                  >
                    {showManualInput ? 'Hide' : 'Use Manual Input'}
                  </Button>
                </div>

                {showManualInput && (
                  <div className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-blue-700">Latitude</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="e.g., 16.2997"
                          value={manualLat}
                          onChange={(e) => setManualLat(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-blue-700">Longitude</label>
                        <input
                          type="number"
                          step="any"
                          placeholder="e.g., 80.4573"
                          value={manualLng}
                          onChange={(e) => setManualLng(e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={() => {
                        const lat = parseFloat(manualLat);
                        const lng = parseFloat(manualLng);
                        if (!isNaN(lat) && !isNaN(lng)) {
                          const manualLocation: LocationData = {
                            latitude: lat,
                            longitude: lng,
                            accuracy: 0,
                            timestamp: Date.now()
                          };
                          setCurrentLocation(manualLocation);
                          setLocationError(null);
                          sendLocationToBackend(manualLocation);
                          sendGPSData(manualLocation);
                          toast({
                            title: "Manual Location Set",
                            description: `Location set to ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
                          });
                        } else {
                          toast({
                            title: "Invalid Coordinates",
                            description: "Please enter valid latitude and longitude values.",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={!manualLat || !manualLng}
                      size="sm"
                      className="w-full"
                    >
                      Set Manual Location
                    </Button>
                  </div>
                )}
              </div>
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
