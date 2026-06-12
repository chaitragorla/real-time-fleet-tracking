import { Body, Controller, Delete, Get, Param, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ActiveDto, UpdateLocationDto } from './dto/gps.dto';
import { DevicesService } from '../devices/devices.service';
import { GpsService } from './gps.service';

@Controller('v1/gps-signal')
export class GpsController {
  constructor(
    private readonly gpsService: GpsService,
    private readonly devicesService: DevicesService,
  ) {}

  @Post('update-location')
  updateLocation(@Body() body: UpdateLocationDto) {
    return this.gpsService.updateLocation(body);
  }

  @Get('current-location')
  currentLocation() {
    return this.gpsService.getCurrentLocation();
  }

  @Get('device/:deviceCode/data')
  deviceData(@Param('deviceCode') deviceCode: string) {
    return this.gpsService.deviceData(deviceCode);
  }

  @Delete('device/:deviceCode/clear')
  clear(@Param('deviceCode') deviceCode: string) {
    return this.gpsService.clearDeviceData(deviceCode);
  }

  @Post('device/:device_code/active')
  async active(@Param('device_code') deviceCode: string, @Body() body: ActiveDto) {
    const data = await this.devicesService.updateActive(deviceCode, body.is_active);
    return {
      success: true,
      device_code: deviceCode,
      is_active: data.isActive,
      message: `Device tracking has been ${data.isActive ? 'enabled' : 'disabled'}`,
    };
  }

  @Get(':device_code/history')
  history(@Param('device_code') deviceCode: string) {
    return this.gpsService.history(deviceCode);
  }

  @Get(':device_code')
  async track(@Param('device_code') deviceCode: string, @Res() res: Response) {
    const result = await this.gpsService.trackDevice(deviceCode);
    return res.status(result.status).json(result.body);
  }
}
