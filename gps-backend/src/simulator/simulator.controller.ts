/**
 * SimulatorController
 *
 * Exposes the full GPS simulator REST API at /v1/simulator.
 * All endpoints are documented inline for easy Swagger / Postman integration.
 *
 * The controller itself is intentionally thin – all business logic
 * lives in SimulatorService; this layer only handles HTTP concerns.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { IsString, IsOptional, IsNumber, Min, Max } from "class-validator";
import { Type } from "class-transformer";
import { SimulatorService } from "./simulator.service";
import { SimulatorConfig } from "./interfaces/simulator.interfaces";

// ─────────────────────────────── DTOs ──────────────────────────────────────
// NOTE: class-validator decorators are REQUIRED — ValidationPipe({ whitelist:true })
// strips any property that has no decorator, causing silent undefined values.

/** Body for POST /v1/simulator/start */
class StartSimulationDto implements SimulatorConfig {
  @IsString()
  vehicleId: string;

  @IsString()
  routeId: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  speedMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  updateIntervalMs?: number;
}

/** Body for PATCH /v1/simulator/:vehicleId/speed */
class ChangeSpeedDto {
  @IsNumber()
  @Min(0.1)
  @Max(10)
  @Type(() => Number)
  multiplier: number;
}

// ─────────────────────────────── Controller ────────────────────────────────

@Controller("v1/simulator")
export class SimulatorController {
  constructor(private readonly simulatorService: SimulatorService) {}

  // ─── Routes (must come before :vehicleId routes to avoid param shadowing) ─

  /**
   * GET /v1/simulator/routes
   * Returns all predefined routes (without raw waypoint arrays).
   */
  @Get("routes")
  getRoutes() {
    return {
      success: true,
      routes: this.simulatorService.getAvailableRoutes(),
    };
  }

  /**
   * GET /v1/simulator/vehicles
   * Returns current telemetry for all active simulated vehicles.
   */
  @Get("vehicles")
  getAllVehicles() {
    const vehicles = this.simulatorService.getAllVehicles();
    return {
      success: true,
      count: vehicles.length,
      vehicles,
    };
  }

  /**
   * GET /v1/simulator/vehicles/:id
   * Returns current telemetry for a single vehicle.
   */
  @Get("vehicles/:id")
  getVehicleById(@Param("id") id: string) {
    return {
      success: true,
      vehicle: this.simulatorService.getVehicleById(id),
    };
  }

  /**
   * GET /v1/simulator/vehicles/:id/location
   * Returns only the current coordinates + status (lightweight endpoint).
   */
  @Get("vehicles/:id/location")
  getCurrentLocation(@Param("id") id: string) {
    return {
      success: true,
      location: this.simulatorService.getCurrentLocation(id),
    };
  }

  /**
   * GET /v1/simulator/vehicles/:id/history
   * Returns the full telemetry history for a vehicle (all ticks since start).
   */
  @Get("vehicles/:id/history")
  getHistory(@Param("id") id: string) {
    const history = this.simulatorService.getRouteHistory(id);
    return {
      success: true,
      vehicleId: id,
      count: history.length,
      history,
    };
  }

  // ─── Simulation Controls ─────────────────────────────────────────────────

  /**
   * POST /v1/simulator/start
   * Starts a new vehicle simulation on a predefined route.
   *
   * Body: { vehicleId, routeId, speedMultiplier?, updateIntervalMs? }
   */
  @Post("start")
  @HttpCode(HttpStatus.CREATED)
  startSimulation(@Body() body: StartSimulationDto) {
    const telemetry = this.simulatorService.startSimulation(body);
    return {
      success: true,
      message: `Simulation started for vehicle "${body.vehicleId}"`,
      vehicle: telemetry,
    };
  }

  /**
   * POST /v1/simulator/stop/:vehicleId
   * Stops and removes a vehicle from the simulator.
   */
  @Post("stop/:vehicleId")
  @HttpCode(HttpStatus.OK)
  stopSimulation(@Param("vehicleId") vehicleId: string) {
    return {
      success: true,
      ...this.simulatorService.stopSimulation(vehicleId),
    };
  }

  /**
   * POST /v1/simulator/pause/:vehicleId
   * Pauses a vehicle – it stays in memory but stops moving.
   */
  @Post("pause/:vehicleId")
  @HttpCode(HttpStatus.OK)
  pauseSimulation(@Param("vehicleId") vehicleId: string) {
    return {
      success: true,
      message: `Vehicle "${vehicleId}" paused`,
      vehicle: this.simulatorService.pauseSimulation(vehicleId),
    };
  }

  /**
   * POST /v1/simulator/resume/:vehicleId
   * Resumes a paused vehicle from its current position.
   */
  @Post("resume/:vehicleId")
  @HttpCode(HttpStatus.OK)
  resumeSimulation(@Param("vehicleId") vehicleId: string) {
    return {
      success: true,
      message: `Vehicle "${vehicleId}" resumed`,
      vehicle: this.simulatorService.resumeSimulation(vehicleId),
    };
  }

  /**
   * PATCH /v1/simulator/:vehicleId/speed
   * Changes the speed multiplier of a running vehicle without restarting it.
   *
   * Body: { multiplier: number }
   */
  @Patch(":vehicleId/speed")
  changeSpeed(
    @Param("vehicleId") vehicleId: string,
    @Body() body: ChangeSpeedDto,
  ) {
    return {
      success: true,
      message: `Speed multiplier changed to ${body.multiplier}× for vehicle "${vehicleId}"`,
      vehicle: this.simulatorService.changeSpeed(vehicleId, body.multiplier),
    };
  }

  /**
   * POST /v1/simulator/:vehicleId/reset
   * Resets a vehicle back to the beginning of its route.
   */
  @Post(":vehicleId/reset")
  @HttpCode(HttpStatus.OK)
  resetRoute(@Param("vehicleId") vehicleId: string) {
    return {
      success: true,
      message: `Route reset for vehicle "${vehicleId}"`,
      vehicle: this.simulatorService.resetRoute(vehicleId),
    };
  }
}
