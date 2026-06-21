import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ParkingService } from './parking.service';
import { ParkingController } from './parking.controller';
import { ParkingPlace, ParkingPlaceSchema } from './schemas/parking-place.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ParkingPlace.name, schema: ParkingPlaceSchema }]),
  ],
  controllers: [ParkingController],
  providers: [ParkingService],
  exports: [ParkingService],
})
export class ParkingModule {}
