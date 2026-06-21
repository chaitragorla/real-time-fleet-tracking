import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ParkingService } from './parking.service';
import { IsString, IsNumber, IsOptional, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

class CreateParkingDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsNumber()
  radius: number; // Radius in meters

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  createdBy?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDeviceCodes?: string[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxCapacity?: number;
}

class UpdateParkingDto {
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
  @IsString()
  address?: string;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedDeviceCodes?: string[];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  maxCapacity?: number;

  @IsOptional()
  @IsString()
  passName?: string;

  @IsOptional()
  @IsString()
  passCode?: string;
}

@Controller('v1/parking')
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Post()
  create(@Body() dto: CreateParkingDto) {
    return this.parkingService.create(dto);
  }

  @Get()
  findAll(@Body() body?: { userRole?: string }) {
    return this.parkingService.findAll(body?.userRole);
  }

  @Get(':id')
  findById(@Param('id') id: string, @Body() body?: { userRole?: string }) {
    return this.parkingService.findById(id, body?.userRole);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateParkingDto) {
    return this.parkingService.update(id, dto);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.parkingService.delete(id);
  }

  @Get('check/:deviceCode')
  checkParkingStatus(
    @Param('deviceCode') deviceCode: string,
    @Body() body: { latitude: number; longitude: number },
  ) {
    return this.parkingService.checkParkingStatus(deviceCode, body.latitude, body.longitude);
  }

  @Patch(':id/occupancy')
  updateOccupancy(@Param('id') id: string, @Body() body: { change: number }) {
    return this.parkingService.updateOccupancy(id, body.change);
  }
}
