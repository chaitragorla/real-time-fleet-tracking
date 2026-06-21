/**
 * SimulatorModule
 *
 * Wires together the GPS simulator components:
 *   - SimulatorService  (movement engine)
 *   - SimulatorController (REST API at /v1/simulator)
 *
 * Imports GpsModule to access GpsService for persisting each location tick
 * into MongoDB (so existing /v1/gps-signal REST endpoints still work).
 *
 * EventEmitterModule is imported globally in AppModule, so it is available here.
 */

import { Module } from '@nestjs/common';
import { SimulatorService } from './simulator.service';
import { SimulatorController } from './simulator.controller';
import { GpsModule } from '../gps/gps.module';

@Module({
  imports: [
    // GpsModule exports GpsService which the simulator uses to persist GPS data
    GpsModule,
  ],
  controllers: [SimulatorController],
  providers: [SimulatorService],
  exports: [SimulatorService],
})
export class SimulatorModule {}
