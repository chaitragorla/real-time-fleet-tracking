import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { GeofenceService } from './geofence.service';
import { IsString, IsNumber, IsOptional, IsBoolean, IsArray, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

class CreateGeofenceDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsEnum(['circular', 'polygonal'])
  type: 'circular' | 'polygonal';

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  radius?: number; // Required for circular geofences

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  boundary?: number[][]; // Required for polygonal geofences [ [lon, lat], [lon, lat], ... ]

  @IsEnum(['entry', 'exit', 'both'])
  triggerType: 'entry' | 'exit' | 'both';

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  createdBy?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  monitoredDeviceCodes?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  sendNotification?: boolean;

  @IsOptional()
  @IsString()
  notificationMessage?: string;

  @IsOptional()
  @IsString()
  passName?: string;

  @IsOptional()
  @IsString()
  passCode?: string;
}

class UpdateGeofenceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  radius?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  boundary?: number[][];

  @IsOptional()
  @IsEnum(['entry', 'exit', 'both'])
  triggerType?: 'entry' | 'exit' | 'both';

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  monitoredDeviceCodes?: string[];

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  sendNotification?: boolean;

  @IsOptional()
  @IsString()
  notificationMessage?: string;

  @IsOptional()
  @IsString()
  passName?: string;

  @IsOptional()
  @IsString()
  passCode?: string;
}

@Controller('v1/geofence')
export class GeofenceController {
  constructor(private readonly geofenceService: GeofenceService) {}

  @Post()
  create(@Body() dto: CreateGeofenceDto) {
    return this.geofenceService.create(dto);
  }

  @Get()
  findAll(@Body() body?: { userRole?: string }) {
    return this.geofenceService.findAll(body?.userRole);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Body() body?: { userRole?: string }) {
    return this.geofenceService.findById(id, body?.userRole);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGeofenceDto) {
    return this.geofenceService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.geofenceService.delete(id);
  }

  @Get('check/:deviceCode')
  checkGeofenceStatus(
    @Param('deviceCode') deviceCode: string,
    @Body() body: { latitude: number; longitude: number },
  ) {
    return this.geofenceService.checkGeofenceStatus(deviceCode, body.latitude, body.longitude);
  }
}
