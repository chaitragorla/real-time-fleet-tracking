import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DevicesService } from '../devices/devices.service';
import { GpsData, GpsDataDocument } from './schemas/gps-data.schema';

export interface CurrentUserLocation {
  latitude: number | null;
  longitude: number | null;
  timestamp: string | null;
  hasPermission: boolean;
}

@Injectable()
export class GpsService {
  private currentUserLocation: CurrentUserLocation = {
    latitude: null,
    longitude: null,
    timestamp: null,
    hasPermission: false,
  };

  constructor(
    @InjectModel(GpsData.name) private readonly gpsModel: Model<GpsDataDocument>,
    private readonly devicesService: DevicesService,
  ) {}

  async updateLocation(input: {
    device_code: string;
    device_m2m_number?: string;
    latitude: number;
    longitude: number;
    accuracy?: number;
    timestamp?: string;
  }) {
    // If m2m number is provided, match it. Otherwise just match by device code
    const device = input.device_m2m_number
      ? await this.devicesService.findByCodeAndM2m(input.device_code, input.device_m2m_number)
      : await this.devicesService.findByCode(input.device_code);
    if (!device) {
      throw new NotFoundException({
        success: false,
        error: 'Device not found or device_code and device_m2m_number do not belong to the same device',
      });
    }
    const gps = await this.createGpsData({
      deviceCode: device.deviceCode,
      latitude: input.latitude,
      longitude: input.longitude,
      userLegacyId: device.allocatedToCustomerId,
      accuracy: input.accuracy,
      timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
    });
    this.currentUserLocation = {
      latitude: input.latitude,
      longitude: input.longitude,
      timestamp: gps.timestamp.toISOString(),
      hasPermission: true,
    };
    return {
      success: true,
      message: 'Location updated successfully',
      data: this.toLegacyGps(gps),
    };
  }

  getCurrentLocation() {
    return {
      status: 'success',
      location: this.currentUserLocation,
    };
  }

  async trackDevice(deviceCode: string) {
    const device = await this.devicesService.findByCode(deviceCode);
    if (!device) {
      throw new NotFoundException({ error: 'Device not found', device_code: deviceCode });
    }
    if (!device.isActive) {
      throw new ForbiddenException({
        error: 'Device tracking is disabled',
        device_code: deviceCode,
        is_active: false,
      });
    }
    if (
      !this.currentUserLocation.hasPermission ||
      this.currentUserLocation.latitude === null ||
      this.currentUserLocation.longitude === null
    ) {
      return {
        status: 400,
        body: {
          error: 'GPS coordinates not available',
          message: 'Please ensure GPS permission is granted and location is being tracked',
          device_code: deviceCode,
        },
      };
    }
    const gps = await this.createGpsData({
      deviceCode,
      latitude: this.currentUserLocation.latitude,
      longitude: this.currentUserLocation.longitude,
      userLegacyId: device.allocatedToCustomerId,
      timestamp: new Date(),
    });
    return {
      status: 200,
      body: {
        device_code: deviceCode,
        latitude: gps.latitude,
        longitude: gps.longitude,
        timestamp: gps.timestamp,
        user_id: device.allocatedToCustomerId,
        device_name: device.deviceName,
        status: 'active',
      },
    };
  }

  async history(deviceCode: string) {
    const gpsHistory = await this.gpsModel.find({ deviceCode }).sort({ timestamp: 1 }).lean().exec();
    return {
      status: 'success',
      device_code: deviceCode,
      count: gpsHistory.length,
      data: gpsHistory.map((gps) => this.toLegacyGps(gps)),
    };
  }

  async deviceData(deviceCode: string) {
    const data = await this.gpsModel.find({ deviceCode }).sort({ timestamp: 1 }).lean().exec();
    return {
      success: true,
      data: data.map((gps) => this.toLegacyGps(gps)),
      count: data.length,
    };
  }

  async clearDeviceData(deviceCode: string) {
    const result = await this.gpsModel.deleteMany({ deviceCode }).exec();
    return {
      success: true,
      message: `All GPS data cleared for device ${deviceCode}`,
      deletedCount: result.deletedCount ?? 0,
    };
  }

  async createGpsData(input: {
    deviceCode: string;
    latitude: number;
    longitude: number;
    userLegacyId?: number;
    accuracy?: number;
    timestamp?: Date;
  }) {
    return this.gpsModel.create({
      deviceCode: input.deviceCode,
      userLegacyId: input.userLegacyId,
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      timestamp: input.timestamp ?? new Date(),
      location: {
        type: 'Point',
        coordinates: [input.longitude, input.latitude],
      },
    });
  }

  toLegacyGps(gps: Partial<GpsData> & { _id?: unknown }) {
    return {
      id: String(gps._id ?? ''),
      device_code: gps.deviceCode,
      latitude: gps.latitude,
      longitude: gps.longitude,
      user_id: gps.userLegacyId ?? null,
      accuracy: gps.accuracy ?? null,
      timestamp: gps.timestamp,
      speed: gps.speed ?? null,
      altitude: gps.altitude ?? null,
      voltage: gps.voltage ?? null,
      rel1: gps.rel1 ?? null,
      rel2: gps.rel2 ?? null,
      rel3: gps.rel3 ?? null,
      alert1: gps.alert1 ?? null,
      alert2: gps.alert2 ?? null,
      alert3: gps.alert3 ?? null,
      alert4: gps.alert4 ?? null,
    };
  }
}
