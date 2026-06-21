import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Geofence, GeofenceDocument } from './schemas/geofence.schema';

@Injectable()
export class GeofenceService {
  constructor(
    @InjectModel(Geofence.name) private readonly geofenceModel: Model<GeofenceDocument>,
  ) {}

  async create(data: {
    name: string;
    description?: string;
    type: 'circular' | 'polygonal';
    latitude: number;
    longitude: number;
    radius?: number;
    boundary?: number[][];
    triggerType: 'entry' | 'exit' | 'both';
    createdBy?: number;
    monitoredDeviceCodes?: string[];
    sendNotification?: boolean;
    notificationMessage?: string;
    passName?: string;
    passCode?: string;
  }) {
    if (data.type === 'circular' && !data.radius) {
      throw new BadRequestException('Radius is required for circular geofences');
    }

    if (data.type === 'polygonal' && !data.boundary) {
      throw new BadRequestException('Boundary is required for polygonal geofences');
    }

    const geofenceData: any = {
      name: data.name,
      description: data.description,
      type: data.type,
      latitude: data.latitude,
      longitude: data.longitude,
      triggerType: data.triggerType,
      createdBy: data.createdBy,
      monitoredDeviceCodes: data.monitoredDeviceCodes || [],
      sendNotification: data.sendNotification ?? false,
      notificationMessage: data.notificationMessage,
      passName: data.passName,
      passCode: data.passCode,
    };

    if (data.type === 'circular') {
      geofenceData.center = {
        type: 'Point',
        coordinates: [data.longitude, data.latitude],
      };
      geofenceData.radius = data.radius;
    } else if (data.type === 'polygonal') {
      geofenceData.boundary = {
        type: 'Polygon',
        coordinates: [data.boundary],
      };
    }

    const geofence = await this.geofenceModel.create(geofenceData);

    return {
      success: true,
      message: 'Geofence created successfully',
      geofence,
    };
  }

  async findAll(userRole?: string) {
    const geofences = await this.geofenceModel.find({ isActive: true }).lean().exec();
    
    // Hide passName and passCode for non-superadmin users
    const filteredGeofences = geofences.map((fence) => {
      if (userRole !== 'superadmin') {
        const { passName, passCode, ...rest } = fence;
        return rest;
      }
      return fence;
    });

    return {
      success: true,
      count: filteredGeofences.length,
      geofences: filteredGeofences,
    };
  }

  async findById(id: string, userRole?: string) {
    const geofence = await this.geofenceModel.findById(id).lean().exec();
    if (!geofence) {
      throw new NotFoundException('Geofence not found');
    }

    // Hide passName and passCode for non-superadmin users
    if (userRole !== 'superadmin') {
      const { passName, passCode, ...rest } = geofence;
      return {
        success: true,
        geofence: rest,
      };
    }

    return {
      success: true,
      geofence,
    };
  }

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    radius: number;
    boundary: number[][];
    triggerType: 'entry' | 'exit' | 'both';
    isActive: boolean;
    monitoredDeviceCodes: string[];
    sendNotification: boolean;
    notificationMessage: string;
  }>) {
    const geofence = await this.geofenceModel.findById(id);
    if (!geofence) {
      throw new NotFoundException('Geofence not found');
    }

    if (data.latitude !== undefined || data.longitude !== undefined) {
      if (geofence.type === 'circular' && geofence.center) {
        geofence.center.coordinates = [
          data.longitude || geofence.center.coordinates[0],
          data.latitude || geofence.center.coordinates[1],
        ];
      }
      geofence.latitude = data.latitude || geofence.latitude;
      geofence.longitude = data.longitude || geofence.longitude;
    }

    if (data.radius !== undefined && geofence.type === 'circular') {
      geofence.radius = data.radius;
    }

    if (data.boundary !== undefined && geofence.type === 'polygonal') {
      // Ensure boundary is properly formatted as GeoJSON Polygon: [[[lon, lat], [lon, lat], ...]]
      const formattedBoundary = Array.isArray(data.boundary[0]) ? data.boundary : data.boundary;
      geofence.boundary = {
        type: 'Polygon',
        coordinates: [formattedBoundary] as any,
      };
    }

    Object.assign(geofence, data);
    await geofence.save();

    return {
      success: true,
      message: 'Geofence updated successfully',
      geofence,
    };
  }

  async delete(id: string) {
    const geofence = await this.geofenceModel.findById(id);
    if (!geofence) {
      throw new NotFoundException('Geofence not found');
    }

    // Soft delete by setting isActive to false
    geofence.isActive = false;
    await geofence.save();

    return {
      success: true,
      message: 'Geofence deleted successfully',
    };
  }

  async checkGeofenceStatus(deviceCode: string, latitude: number, longitude: number) {
    // Find all active geofences that monitor this device or all devices
    const geofences = await this.geofenceModel
      .find({
        isActive: true,
        $or: [
          { monitoredDeviceCodes: { $size: 0 } }, // Monitors all devices
          { monitoredDeviceCodes: deviceCode }, // Monitors this specific device
        ],
      })
      .lean()
      .exec();

    const geofenceStatus = geofences.map((fence) => {
      const isInside = this.isPointInGeofence(latitude, longitude, fence);
      
      return {
        geofenceId: fence._id,
        name: fence.name,
        type: fence.type,
        isInside,
        triggerType: fence.triggerType,
        shouldTrigger: this.shouldTriggerAlert(isInside, fence.triggerType),
        sendNotification: fence.sendNotification,
        notificationMessage: fence.notificationMessage,
      };
    });

    const triggeredAlerts = geofenceStatus.filter((status) => status.shouldTrigger);

    return {
      success: true,
      deviceCode,
      latitude,
      longitude,
      triggeredAlerts,
      allGeofences: geofenceStatus,
    };
  }

  private isPointInGeofence(lat: number, lon: number, geofence: any): boolean {
    if (geofence.type === 'circular') {
      const distance = this.calculateDistance(
        lat,
        lon,
        geofence.latitude,
        geofence.longitude,
      );
      return distance <= (geofence.radius || 0);
    } else if (geofence.type === 'polygonal' && geofence.boundary) {
      return this.isPointInPolygon(lat, lon, geofence.boundary.coordinates[0]);
    }
    return false;
  }

  private shouldTriggerAlert(isInside: boolean, triggerType: string): boolean {
    if (triggerType === 'entry') return isInside;
    if (triggerType === 'exit') return !isInside;
    if (triggerType === 'both') return true; // Always trigger for both
    return false;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  private isPointInPolygon(lat: number, lon: number, polygon: number[][]): boolean {
    // Ray casting algorithm to check if point is inside polygon
    // Polygon coordinates are [longitude, latitude]
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i][0], yi = polygon[i][1];
      const xj = polygon[j][0], yj = polygon[j][1];

      const intersect =
        yi > lon !== yj > lon && lon < ((xj - xi) * (lon - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
}
