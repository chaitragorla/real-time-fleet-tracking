/**
 * GPS Simulator Interfaces
 * Shared TypeScript types for the simulator module.
 * Designed so the frontend can be swapped to a real GPS device without
 * changing the contract – just replace the simulator service.
 */

/** Current status of a simulated vehicle */
export type VehicleStatus = 'Moving' | 'Idle' | 'Stopped';

/**
 * Telemetry snapshot broadcast to clients on every tick.
 * This is the canonical "GPS device payload" that the frontend consumes.
 */
export interface VehicleTelemetry {
  /** Unique vehicle / device identifier */
  vehicleId: string;
  /** Current latitude */
  latitude: number;
  /** Current longitude */
  longitude: number;
  /** Speed in km/h */
  speed: number;
  /** Compass bearing in degrees (0–360, 0 = North) */
  heading: number;
  /** ISO-8601 timestamp of this reading */
  timestamp: string;
  /** Current operational status */
  status: VehicleStatus;
  /** Human-readable route name */
  routeName: string;
  /** Index of the current waypoint within the route */
  routeIndex: number;
  /** Total waypoints in the active route */
  totalRoutePoints: number;
  /** Current speed multiplier applied */
  speedMultiplier: number;
}

/** A single geographic waypoint */
export interface Waypoint {
  lat: number;
  lng: number;
}

/**
 * Predefined simulation route.
 * Waypoints should follow realistic road paths.
 */
export interface SimulatorRoute {
  /** Unique route identifier */
  id: string;
  /** Display name */
  name: string;
  /** Description of the route (e.g. city, landmarks) */
  description: string;
  /** Ordered list of GPS waypoints along the route */
  waypoints: Waypoint[];
  /** Approximate total distance in km */
  distanceKm: number;
}

/**
 * Configuration for starting a new simulation.
 */
export interface SimulatorConfig {
  /** Device / vehicle identifier (maps to deviceCode in GPS schema) */
  vehicleId: string;
  /** Route to follow (must match a route ID from routes.data.ts) */
  routeId: string;
  /** Speed multiplier – 1× = normal, 2× = double speed, 0.5× = half speed */
  speedMultiplier?: number;
  /** Milliseconds between coordinate updates (default: 2000) */
  updateIntervalMs?: number;
}

/**
 * Full in-memory state for a running simulated vehicle.
 * Extends the broadcast telemetry with internal runtime fields.
 */
export interface VehicleState extends VehicleTelemetry {
  /** Original simulator configuration */
  config: Required<SimulatorConfig>;
  /** Whether the simulation is currently paused */
  isPaused: boolean;
  /** Ordered history of every telemetry snapshot (grows as vehicle moves) */
  history: VehicleTelemetry[];
  /** NodeJS interval handle (internal – not serialised) */
  _intervalHandle?: ReturnType<typeof setInterval>;
  /** Sub-waypoint progress (0–1) for smooth interpolation between waypoints */
  _waypointProgress: number;
  /** Reference to the active route */
  _route: SimulatorRoute;
  /** Ticks remaining for a random mid-route stop */
  _randomStopTicksRemaining?: number;
}

/** REST response for GET /vehicles */
export interface VehiclesListResponse {
  success: boolean;
  count: number;
  vehicles: VehicleTelemetry[];
}

/** REST response for GET /routes */
export interface RoutesListResponse {
  success: boolean;
  count: number;
  routes: Omit<SimulatorRoute, 'waypoints'>[];
}
