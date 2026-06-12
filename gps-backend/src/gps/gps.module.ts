import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DevicesModule } from '../devices/devices.module';
import { GpsController } from './gps.controller';
import { GpsService } from './gps.service';
import { GpsData, GpsDataSchema } from './schemas/gps-data.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: GpsData.name, schema: GpsDataSchema }]),
    DevicesModule,
  ],
  controllers: [GpsController],
  providers: [GpsService],
  exports: [GpsService, MongooseModule],
})
export class GpsModule {}
