/**
 * SimulatorService
 *
 * Core GPS simulation engine. Manages multiple simulated vehicles, each
 * following a predefined route with realistic speed, heading and telemetry.
 *
 * Architecture:
 *  - Vehicle state is held in memory (Map<vehicleId, VehicleState>)
 *  - Each vehicle runs a setInterval loop that advances its position
 *  - Each tick persists the GPS point to MongoDB through GpsService
 *    so the existing REST endpoints (/v1/gps-signal/device/:code/data) still work
 *  - Vehicle telemetry is available via REST API endpoints in SimulatorController
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  OnModuleDestroy,
} from "@nestjs/common";
import { GpsService } from "../gps/gps.service";
import { PREDEFINED_ROUTES, getRouteById } from "./data/routes.data";
import {
  VehicleState,
  VehicleTelemetry,
  VehicleStatus,
  SimulatorConfig,
  SimulatorRoute,
} from "./interfaces/simulator.interfaces";

/** Default speed range in km/h (at 1× multiplier) */
const BASE_SPEED_MIN_KMH = 20;
const BASE_SPEED_MAX_KMH = 55;

/** Default update interval in ms */
const DEFAULT_INTERVAL_MS = 2000;

/** Earth radius for haversine */
const EARTH_RADIUS_KM = 6371;

@Injectable()
export class SimulatorService implements OnModuleDestroy {
  private readonly logger = new Logger(SimulatorService.name);
  private readonly vehicles = new Map<string, VehicleState>();

  constructor(
    private readonly gpsService: GpsService,
  ) {}

  // ───────────────────────────────────── Lifecycle ────────────────────────

  /** Clean up all intervals when the NestJS module shuts down */
  onModuleDestroy() {
    for (const vehicleId of this.vehicles.keys()) {
      this.clearVehicleInterval(vehicleId);
    }
    this.vehicles.clear();
    this.logger.log("All simulator intervals cleared on shutdown");
  }

  // ─────────────────────────────── Simulation controls ───────────────────

  /**
   * Start a new vehicle simulation.
   * If the vehicleId is already running, throws BadRequestException.
   */
  startSimulation(config: SimulatorConfig): VehicleTelemetry {
    const {
      vehicleId,
      routeId,
      speedMultiplier = 1,
      updateIntervalMs = DEFAULT_INTERVAL_MS,
    } = config;

    if (this.vehicles.has(vehicleId)) {
      throw new BadRequestException(
        `Vehicle "${vehicleId}" is already running. Stop it first or use a different vehicleId.`,
      );
    }

    const route = getRouteById(routeId);
    if (!route) {
      throw new NotFoundException(
        `Route "${routeId}" not found. Available routes: ${PREDEFINED_ROUTES.map((r) => r.id).join(", ")}`,
      );
    }

    if (route.waypoints.length < 2) {
      throw new BadRequestException(
        `Route "${routeId}" must have at least 2 waypoints`,
      );
    }

    const fullConfig: Required<SimulatorConfig> = {
      vehicleId,
      routeId,
      speedMultiplier,
      updateIntervalMs,
    };

    const initialTelemetry = this.buildTelemetry(
      vehicleId,
      route,
      0,
      0,
      speedMultiplier,
      "Moving",
    );

    const state: VehicleState = {
      ...initialTelemetry,
      config: fullConfig,
      isPaused: false,
      history: [initialTelemetry],
      _waypointProgress: 0,
      _route: route,
    };

    this.vehicles.set(vehicleId, state);

    // Start the simulation loop
    const handle = setInterval(() => this.tick(vehicleId), updateIntervalMs);
    state._intervalHandle = handle;

    this.logger.log(
      `Simulation started: vehicleId=${vehicleId} route=${routeId} multiplier=${speedMultiplier}×`,
    );

    return this.toTelemetry(state);
  }

  /**
   * Stop a vehicle simulation completely and remove it from memory.
   */
  stopSimulation(vehicleId: string): { message: string } {
    const state = this.getStateOrThrow(vehicleId);
    this.clearVehicleInterval(vehicleId);
    state.status = "Stopped";
    state.speed = 0;
    this.vehicles.delete(vehicleId);
    this.logger.log(`Simulation stopped: vehicleId=${vehicleId}`);
    return { message: `Vehicle "${vehicleId}" simulation stopped` };
  }

  /**
   * Pause a vehicle – it stays in memory but stops advancing.
   */
  pauseSimulation(vehicleId: string): VehicleTelemetry {
    const state = this.getStateOrThrow(vehicleId);
    if (state.isPaused) {
      throw new BadRequestException(`Vehicle "${vehicleId}" is already paused`);
    }
    this.clearVehicleInterval(vehicleId);
    state.isPaused = true;
    state.status = "Idle";
    state.speed = 0;
    this.logger.log(`Simulation paused: vehicleId=${vehicleId}`);
    return this.toTelemetry(state);
  }

  /**
   * Resume a paused vehicle.
   */
  resumeSimulation(vehicleId: string): VehicleTelemetry {
    const state = this.getStateOrThrow(vehicleId);
    if (!state.isPaused) {
      throw new BadRequestException(`Vehicle "${vehicleId}" is not paused`);
    }
    state.isPaused = false;
    state.status = "Moving";
    const handle = setInterval(
      () => this.tick(vehicleId),
      state.config.updateIntervalMs,
    );
    state._intervalHandle = handle;
    this.logger.log(`Simulation resumed: vehicleId=${vehicleId}`);
    return this.toTelemetry(state);
  }

  /**
   * Change the speed multiplier of a running vehicle without stopping it.
   */
  changeSpeed(vehicleId: string, multiplier: number): VehicleTelemetry {
    if (multiplier <= 0 || multiplier > 10) {
      throw new BadRequestException(
        "Speed multiplier must be between 0.1 and 10",
      );
    }
    const state = this.getStateOrThrow(vehicleId);
    state.config.speedMultiplier = multiplier;
    state.speedMultiplier = multiplier;
    this.logger.log(
      `Speed changed: vehicleId=${vehicleId} multiplier=${multiplier}×`,
    );
    return this.toTelemetry(state);
  }

  /**
   * Reset a vehicle back to the beginning of its route.
   */
  resetRoute(vehicleId: string): VehicleTelemetry {
    const state = this.getStateOrThrow(vehicleId);
    state.routeIndex = 0;
    state._waypointProgress = 0;
    const firstWP = state._route.waypoints[0];
    state.latitude = firstWP.lat;
    state.longitude = firstWP.lng;
    state.history = [];
    this.logger.log(`Route reset: vehicleId=${vehicleId}`);
    return this.toTelemetry(state);
  }

  // ─────────────────────────────── Query methods ──────────────────────────

  getAllVehicles(): VehicleTelemetry[] {
    return Array.from(this.vehicles.values()).map((s) => this.toTelemetry(s));
  }

  getVehicleById(vehicleId: string): VehicleTelemetry {
    return this.toTelemetry(this.getStateOrThrow(vehicleId));
  }

  getCurrentLocation(
    vehicleId: string,
  ): Pick<
    VehicleTelemetry,
    "vehicleId" | "latitude" | "longitude" | "timestamp" | "status"
  > {
    const state = this.getStateOrThrow(vehicleId);
    return {
      vehicleId: state.vehicleId,
      latitude: state.latitude,
      longitude: state.longitude,
      timestamp: state.timestamp,
      status: state.status,
    };
  }

  getRouteHistory(vehicleId: string): VehicleTelemetry[] {
    return this.getStateOrThrow(vehicleId).history;
  }

  getAvailableRoutes(): Omit<SimulatorRoute, "waypoints">[] {
    return PREDEFINED_ROUTES.map(({ id, name, description, distanceKm }) => ({
      id,
      name,
      description,
      distanceKm,
    }));
  }

  // ─────────────────────────────── Core tick loop ─────────────────────────

  private tick(vehicleId: string): void {
    const state = this.vehicles.get(vehicleId);
    if (!state || state.isPaused || state.status === "Stopped") return;

    const route = state._route;
    const waypoints = route.waypoints;
    const totalPoints = waypoints.length;

    // If we've reached the last waypoint → STOP at destination (don't loop)
    if (state.routeIndex >= totalPoints - 1) {
      state.status = "Idle";
      state.speed = 0;
      state.isPaused = true;
      this.clearVehicleInterval(vehicleId);
      this.logger.log(
        `Route completed — vehicle parked at destination: ${vehicleId}`,
      );
      return;
    }

    // ── Random Stops Logic ──
    if (state._randomStopTicksRemaining !== undefined && state._randomStopTicksRemaining > 0) {
      state._randomStopTicksRemaining--;
      state.status = "Idle";
      state.speed = 0;
      return;
    } else if (state.routeIndex > 0) {
      // 0.8% chance every tick to randomly stop (if moving).
      if (Math.random() < 0.008) {
        // Stop for 65 seconds (if tick is 1000ms) to ensure it triggers the 60s geofence
        const ticksFor65Sec = Math.ceil(65000 / state.config.updateIntervalMs);
        state._randomStopTicksRemaining = ticksFor65Sec;
        state.status = "Idle";
        state.speed = 0;
        this.logger.log(`Vehicle ${vehicleId} randomly stopped for ${ticksFor65Sec} ticks (~65s).`);
        return;
      }
    }

    const currentWP = waypoints[state.routeIndex];
    const nextWP = waypoints[state.routeIndex + 1];

    // Calculate distance between current and next waypoint (km)
    const segmentDistKm = this.haversineDistance(
      currentWP.lat,
      currentWP.lng,
      nextWP.lat,
      nextWP.lng,
    );

    // Calculate realistic speed for this tick (km/h)
    const baseSpeed =
      BASE_SPEED_MIN_KMH +
      Math.random() * (BASE_SPEED_MAX_KMH - BASE_SPEED_MIN_KMH);
    const effectiveSpeed = baseSpeed * state.config.speedMultiplier;

    // Distance traveled in this tick (km) = speed × time
    const intervalHours = state.config.updateIntervalMs / 3_600_000;
    const distanceTraveledKm = effectiveSpeed * intervalHours;

    // Advance waypoint progress
    const progressPerKm =
      segmentDistKm > 0 ? distanceTraveledKm / segmentDistKm : 1;
    state._waypointProgress += progressPerKm;

    // Move to next waypoint(s) if we've passed them
    while (state._waypointProgress >= 1 && state.routeIndex < totalPoints - 1) {
      state._waypointProgress -= 1;
      state.routeIndex += 1;
      // Stop at last waypoint — no looping
      if (state.routeIndex >= totalPoints - 1) {
        state._waypointProgress = 0;
        break;
      }
    }

    const fromWP = waypoints[state.routeIndex];
    const toWPIndex = Math.min(state.routeIndex + 1, totalPoints - 1);
    const toWP = waypoints[toWPIndex];

    // Interpolate position
    const t = Math.min(state._waypointProgress, 1);
    const lat = fromWP.lat + (toWP.lat - fromWP.lat) * t;
    const lng = fromWP.lng + (toWP.lng - fromWP.lng) * t;

    // Calculate compass bearing (heading)
    const heading = this.calculateBearing(
      fromWP.lat,
      fromWP.lng,
      toWP.lat,
      toWP.lng,
    );

    // Update state
    state.latitude = lat;
    state.longitude = lng;
    state.speed = Math.round(effectiveSpeed * 10) / 10;
    state.heading = Math.round(heading);
    state.status = "Moving";
    state.timestamp = new Date().toISOString();
    // state.routeIndex already updated in the while-loop above
    state.totalRoutePoints = totalPoints;
    state.speedMultiplier = state.config.speedMultiplier;

    // Save snapshot to history
    const telemetry = this.toTelemetry(state);
    state.history.push(telemetry);

    // Persist to MongoDB (non-blocking – fire and forget)
    this.persistToDatabase(state).catch((err) =>
      this.logger.warn(`DB persist failed for ${vehicleId}: ${err.message}`),
    );
  }

  // ─────────────────────────────── Helpers ────────────────────────────────

  private async persistToDatabase(state: VehicleState): Promise<void> {
    await this.gpsService.createGpsData({
      deviceCode: state.vehicleId,
      latitude: state.latitude,
      longitude: state.longitude,
      accuracy: 5, // Simulated high accuracy
      timestamp: new Date(state.timestamp),
    });
  }

  private getStateOrThrow(vehicleId: string): VehicleState {
    const state = this.vehicles.get(vehicleId);
    if (!state) {
      throw new NotFoundException(
        `Vehicle "${vehicleId}" not found. Start a simulation first.`,
      );
    }
    return state;
  }

  private clearVehicleInterval(vehicleId: string): void {
    const state = this.vehicles.get(vehicleId);
    if (state?._intervalHandle) {
      clearInterval(state._intervalHandle);
      state._intervalHandle = undefined;
    }
  }

  private toTelemetry(state: VehicleState): VehicleTelemetry {
    return {
      vehicleId: state.vehicleId,
      latitude: state.latitude,
      longitude: state.longitude,
      speed: state.speed,
      heading: state.heading,
      timestamp: state.timestamp,
      status: state.status,
      routeName: state.routeName,
      routeIndex: state.routeIndex,
      totalRoutePoints: state.totalRoutePoints,
      speedMultiplier: state.speedMultiplier,
    };
  }

  private buildTelemetry(
    vehicleId: string,
    route: SimulatorRoute,
    waypointIndex: number,
    heading: number,
    speedMultiplier: number,
    status: VehicleStatus,
  ): VehicleTelemetry {
    const wp = route.waypoints[waypointIndex];
    return {
      vehicleId,
      latitude: wp.lat,
      longitude: wp.lng,
      speed: 0,
      heading,
      timestamp: new Date().toISOString(),
      status,
      routeName: route.name,
      routeIndex: waypointIndex,
      totalRoutePoints: route.waypoints.length,
      speedMultiplier,
    };
  }

  /**
   * Haversine formula – great-circle distance between two points in km.
   */
  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
  }

  /**
   * Calculate compass bearing in degrees (0–360) from point A to point B.
   */
  private calculateBearing(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const toRad = (deg: number) => (deg * Math.PI) / 180;
    const toDeg = (rad: number) => (rad * 180) / Math.PI;
    const dLng = toRad(lng2 - lng1);
    const rLat1 = toRad(lat1);
    const rLat2 = toRad(lat2);
    const y = Math.sin(dLng) * Math.cos(rLat2);
    const x =
      Math.cos(rLat1) * Math.sin(rLat2) -
      Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }
}
