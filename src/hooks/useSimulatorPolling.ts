/**
 * useSimulatorPolling — React hook for REST API-based GPS simulator
 *
 * Polls the NestJS Simulator REST API for vehicle telemetry.
 * Handles auto-refresh with configurable intervals and exposes
 * live vehicle telemetry to consuming components.
 *
 * Usage:
 *   const { vehicleData, allVehicles, isLoading, error } =
 *     useSimulatorPolling({ vehicleId: 'my-device' });
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { apiRequest } from '@/lib/api';

const POLL_INTERVAL_MS = 2000; // 2 seconds default

export interface VehicleTelemetry {
  vehicleId: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
  status: 'Moving' | 'Idle' | 'Stopped';
  routeName: string;
  routeIndex: number;
  totalRoutePoints: number;
  speedMultiplier: number;
}

export interface SimulatorRoute {
  id: string;
  name: string;
  description: string;
  distanceKm: number;
}

interface UseSimulatorPollingOptions {
  /** Poll for a single vehicle. Mutually exclusive with pollAll. */
  vehicleId?: string;
  /** Poll for all vehicles. */
  pollAll?: boolean;
  /** Called on every telemetry update */
  onUpdate?: (telemetry: VehicleTelemetry) => void;
  /** Polling interval in milliseconds (default: 2000) */
  pollInterval?: number;
}

interface UseSimulatorPollingReturn {
  /** Latest telemetry for the subscribed vehicleId (null until first update) */
  vehicleData: VehicleTelemetry | null;
  /** Map of all vehicles (vehicleId → latest telemetry) when pollAll=true */
  allVehicles: Map<string, VehicleTelemetry>;
  /** Whether data is currently being fetched */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
  /** Manually trigger a refresh */
  refresh: () => void;
}

export function useSimulatorPolling({
  vehicleId,
  pollAll = false,
  onUpdate,
  pollInterval = POLL_INTERVAL_MS,
}: UseSimulatorPollingOptions = {}): UseSimulatorPollingReturn {
  const [vehicleData, setVehicleData] = useState<VehicleTelemetry | null>(null);
  const [allVehicles, setAllVehicles] = useState<Map<string, VehicleTelemetry>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onUpdateRef = useRef(onUpdate);
  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (pollAll) {
        const response = await apiRequest<{ success: boolean; count: number; vehicles: VehicleTelemetry[] }>('/v1/simulator/vehicles');
        if (response.success && response.vehicles) {
          const vehiclesMap = new Map<string, VehicleTelemetry>();
          response.vehicles.forEach((v: VehicleTelemetry) => {
            vehiclesMap.set(v.vehicleId, v);
            onUpdateRef.current?.(v);
          });
          setAllVehicles(vehiclesMap);
        }
      } else if (vehicleId) {
        const response = await apiRequest<{ success: boolean; vehicle: VehicleTelemetry }>(`/v1/simulator/vehicles/${vehicleId}`);
        if (response.success && response.vehicle) {
          setVehicleData(response.vehicle);
          
          setAllVehicles(prev => {
            const newMap = new Map(prev);
            newMap.set(response.vehicle.vehicleId, response.vehicle);
            return newMap;
          });

          onUpdateRef.current?.(response.vehicle);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch vehicle data');
    } finally {
      setIsLoading(false);
    }
  }, [vehicleId, pollAll]);

  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    // Initial fetch
    fetchData();

    // Set up polling
    const interval = setInterval(() => {
      fetchData();
    }, pollInterval);

    return () => {
      clearInterval(interval);
    };
  }, [fetchData, pollInterval]);

  return { vehicleData, allVehicles, isLoading, error, refresh };
}
