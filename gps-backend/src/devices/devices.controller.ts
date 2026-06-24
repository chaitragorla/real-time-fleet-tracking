import { AllocateDeviceDto, CreateDevicesDto, ShareDeviceDto, UpdateDeviceDto } from './dto/device.dto';
import { DevicesService } from './devices.service';
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';

@Controller('v1/devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Get('active')
  async active() {
    const devices = await this.devicesService.listActiveAllocated();
    return {
      status: 'success',
      count: devices.length,
      devices: devices.map((device) => ({
        device_code: device.deviceCode,
        device_name: device.deviceName,
        allocated_to_customer_name: device.allocatedToCustomerName,
      })),
    };
  }

  @Get()
  async list() {
    const devices = await this.devicesService.listAll();
    return { success: true, count: devices.length, data: devices.map((d) => this.devicesService.toLegacyDevice(d)) };
  }

  @Get('code/:deviceCode')
  async byCode(@Param('deviceCode') deviceCode: string) {
    const device = await this.devicesService.findByCode(deviceCode);
    return { success: Boolean(device), data: device ? this.devicesService.toLegacyDevice(device) : null };
  }

  @Get('owner/:ownerId')
  async byOwner(@Param('ownerId') ownerId: string) {
    const devices = await this.devicesService.listByOwner(Number(ownerId));
    return { success: true, count: devices.length, data: devices.map((d) => this.devicesService.toLegacyDevice(d)) };
  }

  @Get('received/:userId')
  async received(@Param('userId') userId: string) {
    const data = await this.devicesService.listReceived(Number(userId));
    return { success: true, count: data.length, data };
  }

  @Get('sent/:ownerId')
  async sent(@Param('ownerId') ownerId: string) {
    const data = await this.devicesService.listSent(Number(ownerId));
    return { success: true, count: data.length, data };
  }

  @Post()
  async create(@Body() body: CreateDevicesDto) {
    const devices = body.devices?.length
      ? await this.devicesService.createProvided(body.devices)
      : await this.devicesService.createMany(body.count || 1);
    return { success: true, count: devices.length, data: devices.map((d) => this.devicesService.toLegacyDevice(d)) };
  }

  @Patch(':deviceCode')
  async update(@Param('deviceCode') deviceCode: string, @Body() body: UpdateDeviceDto) {
    const device = await this.devicesService.update(deviceCode, {
      deviceName: body.device_name,
      deviceIcon: body.device_icon,
      deviceM2mNumber: body.device_m2m_number,
      isActive: body.is_active,
    });
    return { success: true, data: this.devicesService.toLegacyDevice(device) };
  }

  @Patch('id/:legacyId')
  async updateById(@Param('legacyId') legacyId: string, @Body() body: UpdateDeviceDto) {
    const device = await this.devicesService.updateByLegacyId(Number(legacyId), {
      deviceName: body.device_name,
      deviceIcon: body.device_icon,
      deviceM2mNumber: body.device_m2m_number,
      isActive: body.is_active,
    });
    return { success: true, data: this.devicesService.toLegacyDevice(device) };
  }

  @Post(':deviceCode/allocate')
  async allocate(@Param('deviceCode') deviceCode: string, @Body() body: AllocateDeviceDto) {
    const device = await this.devicesService.allocate(deviceCode, body);
    return { success: true, data: this.devicesService.toLegacyDevice(device) };
  }

  @Post(':deviceCode/claim')
  async claim(@Param('deviceCode') deviceCode: string, @Body() body: { customer_id: number | string; device_name?: string; device_icon?: string }) {
    const device = await this.devicesService.claimDevice(deviceCode, body.customer_id, body.device_name, body.device_icon);
    return { success: true, data: this.devicesService.toLegacyDevice(device) };
  }

  @Post(':deviceCode/share')
  share(@Param('deviceCode') deviceCode: string, @Body() body: ShareDeviceDto) {
    return this.devicesService.share(deviceCode, body.phone_number);
  }

  @Delete('shares/:shareId')
  async revokeShare(@Param('shareId') shareId: string) {
    await this.devicesService.revokeShare(shareId);
    return { success: true, message: 'Share revoked successfully.' };
  }

  @Post('id/:legacyId/unassign')
  async unassign(@Param('legacyId') legacyId: string) {
    const device = await this.devicesService.unassignByLegacyId(Number(legacyId));
    return { success: true, data: this.devicesService.toLegacyDevice(device) };
  }

  @Post('owner/:ownerId/unassign-all')
  async unassignAll(@Param('ownerId') ownerId: string) {
    const count = await this.devicesService.unassignAllForOwner(Number(ownerId));
    return { success: true, count };
  }

  @Delete('id/:legacyId')
  async removeById(@Param('legacyId') legacyId: string) {
    const device = await this.devicesService.findByLegacyId(Number(legacyId));
    if (device?.deviceCode) {
      await this.devicesService.deleteByCode(device.deviceCode);
    }
    return { success: true, message: 'Device deleted successfully.' };
  }

  @Delete(':deviceCode')
  async remove(@Param('deviceCode') deviceCode: string) {
    await this.devicesService.deleteByCode(deviceCode);
    return { success: true, message: 'Device deleted successfully.' };
  }
}
