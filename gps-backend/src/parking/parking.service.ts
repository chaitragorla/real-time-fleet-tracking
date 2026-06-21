import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ParkingPlace, ParkingPlaceDocument } from './schemas/parking-place.schema';

@Injectable()
export class ParkingService {
  constructor(
    @InjectModel(ParkingPlace.name) private readonly parkingModel: Model<ParkingPlaceDocument>,
  ) {}

  async create(data: {
    name: string;
    description?: string;
    latitude: number;
    longitude: number;
    radius: number;
    address?: string;
    createdBy?: number;
    allowedDeviceCodes?: string[];
    maxCapacity?: number;
    passName?: string;
    passCode?: string;
  }) {
    const parking = await this.parkingModel.create({
      name: data.name,
      description: data.description,
      latitude: data.latitude,
      longitude: data.longitude,
      radius: data.radius,
      address: data.address,
      location: {
        type: 'Point',
        coordinates: [data.longitude, data.latitude],
      },
      createdBy: data.createdBy,
      allowedDeviceCodes: data.allowedDeviceCodes || [],
      maxCapacity: data.maxCapacity,
      currentOccupancy: 0,
      passName: data.passName,
      passCode: data.passCode,
    });
    return {
      success: true,
      message: 'Parking place created successfully',
      parking,
    };
  }

  async findAll(userRole?: string) {
    const parkingPlaces = await this.parkingModel.find({ isActive: true }).lean().exec();
    
    // Hide passName and passCode for non-superadmin users
    const filteredPlaces = parkingPlaces.map((place) => {
      if (userRole !== 'superadmin') {
        const { passName, passCode, ...rest } = place;
        return rest;
      }
      return place;
    });

    return {
      success: true,
      count: filteredPlaces.length,
      parkingPlaces: filteredPlaces,
    };
  }

  async findById(id: string, userRole?: string) {
    const parking = await this.parkingModel.findById(id).lean().exec();
    if (!parking) {
      throw new NotFoundException('Parking place not found');
    }

    // Hide passName and passCode for non-superadmin users
    if (userRole !== 'superadmin') {
      const { passName, passCode, ...rest } = parking;
      return {
        success: true,
        parking: rest,
      };
    }

    return {
      success: true,
      parking,
    };
  }

  async update(id: string, data: Partial<{
    name: string;
    description: string;
    latitude: number;
    longitude: number;
    radius: number;
    address: string;
    isActive: boolean;
    allowedDeviceCodes: string[];
    maxCapacity: number;
  }>) {
    const parking = await this.parkingModel.findById(id);
    if (!parking) {
      throw new NotFoundException('Parking place not found');
    }

    if (data.latitude !== undefined || data.longitude !== undefined) {
      parking.location = {
        type: 'Point',
        coordinates: [data.longitude || parking.longitude, data.latitude || parking.latitude],
      };
    }

    Object.assign(parking, data);
    await parking.save();

    return {
      success: true,
      message: 'Parking place updated successfully',
      parking,
    };
  }

  async delete(id: string) {
    const parking = await this.parkingModel.findById(id);
    if (!parking) {
      throw new NotFoundException('Parking place not found');
    }

    // Soft delete by setting isActive to false
    parking.isActive = false;
    await parking.save();

    return {
      success: true,
      message: 'Parking place deleted successfully',
    };
  }

  async checkParkingStatus(deviceCode: string, latitude: number, longitude: number) {
    // Find all active parking places
    const parkingPlaces = await this.parkingModel.find({ isActive: true }).lean().exec();

    const parkingStatus = parkingPlaces.map((place) => {
      const distance = this.calculateDistance(
        latitude,
        longitude,
        place.latitude,
        place.longitude,
      );

      const isWithinRadius = distance <= place.radius;
      const isAllowed = place.allowedDeviceCodes.length === 0 || 
                      place.allowedDeviceCodes.includes(deviceCode);

      return {
        parkingPlaceId: place._id,
        name: place.name,
        isParked: isWithinRadius,
        isAllowed,
        distance,
        radius: place.radius,
        currentOccupancy: place.currentOccupancy,
        maxCapacity: place.maxCapacity,
      };
    });

    const currentlyParked = parkingStatus.find((status) => status.isParked && status.isAllowed);

    return {
      success: true,
      isParked: !!currentlyParked,
      currentParkingPlace: currentlyParked || null,
      allParkingPlaces: parkingStatus,
    };
  }

  async updateOccupancy(id: string, change: number) {
    const parking = await this.parkingModel.findById(id);
    if (!parking) {
      throw new NotFoundException('Parking place not found');
    }

    if (parking.maxCapacity && parking.currentOccupancy + change > parking.maxCapacity) {
      throw new BadRequestException('Parking place is at full capacity');
    }

    parking.currentOccupancy = Math.max(0, parking.currentOccupancy + change);
    await parking.save();

    return {
      success: true,
      currentOccupancy: parking.currentOccupancy,
    };
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
}
