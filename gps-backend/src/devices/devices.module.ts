import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Device, DeviceSchema } from './schemas/device.schema';
import { DeviceShare, DeviceShareSchema } from './schemas/device-share.schema';
import { GpsData, GpsDataSchema } from '../gps/schemas/gps-data.schema';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Device.name, schema: DeviceSchema },
      { name: DeviceShare.name, schema: DeviceShareSchema },
      { name: GpsData.name, schema: GpsDataSchema },
    ]),
    UsersModule,
  ],
  controllers: [DevicesController],
  providers: [DevicesService],
  exports: [DevicesService, MongooseModule],
})
export class DevicesModule {}
