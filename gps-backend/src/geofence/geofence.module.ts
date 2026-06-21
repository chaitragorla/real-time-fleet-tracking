import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GeofenceService } from './geofence.service';
import { GeofenceController } from './geofence.controller';
import { Geofence, GeofenceSchema } from './schemas/geofence.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Geofence.name, schema: GeofenceSchema }]),
  ],
  controllers: [GeofenceController],
  providers: [GeofenceService],
  exports: [GeofenceService],
})
export class GeofenceModule {}
