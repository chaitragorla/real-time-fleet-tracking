import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Device, DeviceDocument } from './schemas/device.schema';
import { DeviceShare, DeviceShareDocument } from './schemas/device-share.schema';
import { GpsData, GpsDataDocument } from '../gps/schemas/gps-data.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class DevicesService {
  constructor(
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(DeviceShare.name) private readonly shareModel: Model<DeviceShareDocument>,
    @InjectModel(GpsData.name) private readonly gpsDataModel: Model<GpsDataDocument>,
    private readonly usersService: UsersService,
  ) {}

  async findByCode(deviceCode: string) {
    return this.deviceModel.findOne({ deviceCode }).lean().exec();
  }

  async findByCodeAndM2m(deviceCode: string, deviceM2mNumber: string) {
    return this.deviceModel
      .findOne({ deviceCode, deviceM2mNumber })
      .lean()
      .exec();
  }

  async listAll() {
    return this.deviceModel.find().sort({ createdAt: -1 }).lean().exec();
  }

  async findByLegacyId(legacyId: number) {
    return this.deviceModel.findOne({ legacyId }).lean().exec();
  }

  async listByOwner(ownerLegacyId: number) {
    return this.deviceModel
      .find({ allocatedToCustomerId: ownerLegacyId })
      .sort({ allocatedAt: -1, createdAt: -1 })
      .lean()
      .exec();
  }

  async listActiveAllocated() {
    return this.deviceModel
      .find({ isActive: true, allocatedToCustomerId: { $ne: null } })
      .select('deviceCode deviceName allocatedToCustomerName')
      .lean()
      .exec();
  }

  async updateActive(deviceCode: string, isActive: boolean) {
    const device = await this.deviceModel
      .findOneAndUpdate({ deviceCode }, { isActive }, { returnDocument: 'after' })
      .lean()
      .exec();
    if (!device) throw new NotFoundException({ error: 'Device not found', device_code: deviceCode });
    return device;
  }

  async createMany(count: number) {
    const startLegacyId = await this.nextLegacyId();
    const devices = Array.from({ length: count }, (_, index) => {
      const deviceCode = this.generateDeviceCode();
      return { legacyId: startLegacyId + index, deviceCode, qrCode: deviceCode, isActive: true, deviceIcon: 'car' };
    });
    const createdDevices = await this.deviceModel.insertMany(devices);
    
    // Add initial random GPS data for each device (e.g., somewhere in central NY)
    const gpsPoints = createdDevices.map(d => {
      const lat = 20.5937 + (Math.random() - 0.5) * 5;
      const lng = 78.9629 + (Math.random() - 0.5) * 5;
      return {
        deviceCode: d.deviceCode,
        latitude: lat,
        longitude: lng,
        location: { type: 'Point', coordinates: [lng, lat] },
        timestamp: new Date(),
      };
    });
    if (gpsPoints.length > 0) {
      await this.gpsDataModel.insertMany(gpsPoints);
    }
    return createdDevices;
  }

  async createProvided(devices: Array<{ device_code: string; qr_code?: string; is_active?: boolean }>) {
    const docs = [];
    for (const device of devices) {
      const doc = await this.deviceModel.findOneAndUpdate(
        { deviceCode: device.device_code },
        {
          $setOnInsert: {
            legacyId: await this.nextLegacyId(),
            deviceCode: device.device_code,
            qrCode: device.device_code, // Ignore provided qr_code to ensure strict matching
            isActive: device.is_active ?? true,
            deviceIcon: 'car',
          },
        },
        { upsert: true, returnDocument: 'after' },
      );
      
      const existingGps = await this.gpsDataModel.findOne({ deviceCode: device.device_code }).lean();
      if (!existingGps && doc) {
        const lat = 20.5937 + (Math.random() - 0.5) * 5;
        const lng = 78.9629 + (Math.random() - 0.5) * 5;
        await this.gpsDataModel.create({
          deviceCode: doc.deviceCode,
          latitude: lat,
          longitude: lng,
          location: { type: 'Point', coordinates: [lng, lat] },
          timestamp: new Date(),
        });
      }
      docs.push(doc);
    }
    return docs;
  }

  async update(deviceCode: string, update: Partial<Device>) {
    const device = await this.deviceModel
      .findOneAndUpdate({ deviceCode }, update, { returnDocument: 'after' })
      .lean()
      .exec();
    if (!device) throw new NotFoundException({ error: 'Device not found', device_code: deviceCode });
    return device;
  }

  async updateByLegacyId(legacyId: number, update: Partial<Device>) {
    const device = await this.deviceModel
      .findOneAndUpdate({ legacyId }, update, { returnDocument: 'after' })
      .lean()
      .exec();
    if (!device) throw new NotFoundException({ error: 'Device not found', id: legacyId });
    return device;
  }

  async allocate(deviceCode: string, input: {
    allocated_to_customer_id: number;
    allocated_to_customer_name: string;
    device_name?: string;
    device_icon?: string;
  }) {
    await this.generateRandomGpsPath(deviceCode, input.allocated_to_customer_id);

    return this.update(deviceCode, {
      allocatedToCustomerId: input.allocated_to_customer_id,
      allocatedToCustomerName: input.allocated_to_customer_name,
      allocatedAt: new Date(),
      deviceName: input.device_name,
      deviceIcon: input.device_icon,
    });
  }

  async claimDevice(deviceCode: string, customerId: number, deviceName?: string, deviceIcon?: string) {
    const device = await this.findByCode(deviceCode);
    if (!device) {
      throw new NotFoundException({ success: false, error: 'Device not found.' });
    }
    if (device.allocatedToCustomerId) {
      throw new NotFoundException({ success: false, error: 'Device is already assigned.' });
    }
    
    const user = await this.usersService.findByLegacyId(customerId, 'customer');
    if (!user) {
      throw new NotFoundException({ success: false, error: 'Customer not found.' });
    }

    await this.generateRandomGpsPath(deviceCode, user.legacyId as number);

    return this.update(deviceCode, {
      allocatedToCustomerId: user.legacyId,
      allocatedToCustomerName: user.fullName,
      allocatedAt: new Date(),
      deviceName: deviceName || `My Device (${deviceCode.substring(0, 4)})`,
      deviceIcon: deviceIcon || 'car',
    });
  }

  async deleteByCode(deviceCode: string) {
    const device = await this.findByCode(deviceCode);
    if (device?.legacyId) {
      await this.shareModel.deleteMany({ deviceLegacyId: device.legacyId }).exec();
    }
    return this.deviceModel.deleteOne({ deviceCode }).exec();
  }

  async share(deviceCode: string, phoneNumber: string) {
    const device = await this.findByCode(deviceCode);
    if (!device) throw new NotFoundException({ error: 'Device not found', device_code: deviceCode });
    const user = await this.usersService.findByPhoneAndRole(phoneNumber, 'customer');
    if (!user || !user.legacyId) {
      throw new NotFoundException({ success: false, error: 'User with this phone number not found.' });
    }
    if (!device.legacyId || !device.allocatedToCustomerId) {
      throw new NotFoundException({ success: false, error: 'Device must be allocated before sharing.' });
    }
    await this.shareModel.updateOne(
      { deviceLegacyId: device.legacyId, sharedWithUserLegacyId: user.legacyId },
      {
        $setOnInsert: {
          deviceLegacyId: device.legacyId,
          deviceCode: device.deviceCode,
          ownerLegacyId: device.allocatedToCustomerId,
          sharedWithUserLegacyId: user.legacyId,
          sharedAt: new Date(),
        },
      },
      { upsert: true },
    );
    return { success: true, message: `Device shared successfully with ${user.fullName}!` };
  }

  async listReceived(userLegacyId: number) {
    const shares = await this.shareModel.find({ sharedWithUserLegacyId: userLegacyId }).sort({ sharedAt: -1 }).lean();
    return this.hydrateShares(shares);
  }

  async listSent(ownerLegacyId: number) {
    const shares = await this.shareModel.find({ ownerLegacyId }).sort({ sharedAt: -1 }).lean();
    return this.hydrateShares(shares);
  }

  async revokeShare(shareId: string) {
    return this.shareModel.deleteOne({ _id: shareId }).exec();
  }

  async removeSharesForDevice(legacyId: number) {
    return this.shareModel.deleteMany({ deviceLegacyId: legacyId }).exec();
  }

  async unassignByLegacyId(legacyId: number) {
    await this.removeSharesForDevice(legacyId);
    const device = await this.deviceModel
      .findOneAndUpdate(
        { legacyId },
        { $unset: { allocatedToCustomerId: '', allocatedToCustomerName: '', allocatedAt: '', deviceName: '' } },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
    if (!device) throw new NotFoundException({ error: 'Device not found', id: legacyId });
    return device;
  }

  async unassignAllForOwner(ownerLegacyId: number) {
    const devices = await this.listByOwner(ownerLegacyId);
    const legacyIds = devices
      .map((device) => device.legacyId)
      .filter((legacyId): legacyId is number => typeof legacyId === 'number');
    await this.shareModel.deleteMany({ deviceLegacyId: { $in: legacyIds } });
    await this.deviceModel.updateMany(
      { allocatedToCustomerId: ownerLegacyId },
      { $unset: { allocatedToCustomerId: '', allocatedToCustomerName: '', allocatedAt: '', deviceName: '' } },
    );
    return devices.length;
  }

  toLegacyDevice(device: Partial<Device> & { _id?: unknown; createdAt?: Date; updatedAt?: Date }) {
    return {
      id: device.legacyId ?? String(device._id ?? ''),
      device_code: device.deviceCode,
      qr_code: device.qrCode,
      created_at: device.createdAt,
      is_active: device.isActive,
      allocated_to_customer_id: device.allocatedToCustomerId ?? null,
      allocated_to_customer_name: device.allocatedToCustomerName ?? null,
      allocated_at: device.allocatedAt ?? null,
      device_name: device.deviceName ?? null,
      device_icon: device.deviceIcon ?? 'car',
      device_m2m_number: device.deviceM2mNumber ?? null,
    };
  }

  private async generateRandomGpsPath(deviceCode: string, userLegacyId: number) {
    // Delete any existing GPS data for this device code
    await this.gpsDataModel.deleteMany({ deviceCode }).exec();

    // Generate coordinates centered around Bangalore (KR Circle -> Kanteerava Stadium -> Richmond Road / Prof Ashirvadam Junction)
    const pointsCount = 120;
    const gpsPoints = [];
    const now = new Date();

    // Base coordinates for Bangalore route
    const offsetLat = (Math.random() - 0.5) * 0.001;
    const offsetLng = (Math.random() - 0.5) * 0.001;

    const startLat = 12.9748 + offsetLat;
    const startLng = 77.5857 + offsetLng;
    const midLat = 12.9698 + offsetLat;
    const midLng = 77.5925 + offsetLng;
    const endLat = 12.9645 + offsetLat;
    const endLng = 77.6080 + offsetLng;

    for (let i = 0; i < pointsCount; i++) {
      let lat: number;
      let lng: number;

      if (i < 60) {
        // Leg 1: KR Circle to Kanteerava Stadium
        const t = i / 60;
        lat = startLat + (midLat - startLat) * t;
        lng = startLng + (midLng - startLng) * t;
      } else {
        // Leg 2: Kanteerava Stadium to Prof Ashirvadam Junction
        const t = (i - 60) / 60;
        lat = midLat + (endLat - midLat) * t;
        lng = midLng + (endLng - midLng) * t;
      }

      // Add small random jitter for realistic GPS fluctuation
      lat += (Math.random() - 0.5) * 0.00015;
      lng += (Math.random() - 0.5) * 0.00015;

      const timestamp = new Date(now.getTime() - (pointsCount - i) * 30000); // 30s intervals

      gpsPoints.push({
        deviceCode,
        latitude: lat,
        longitude: lng,
        userLegacyId,
        location: {
          type: 'Point',
          coordinates: [lng, lat],
        },
        timestamp,
      });
    }

    if (gpsPoints.length > 0) {
      await this.gpsDataModel.insertMany(gpsPoints);
    }
  }

  private generateDeviceCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from({ length: 16 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private async nextLegacyId() {
    const latest = await this.deviceModel.findOne({ legacyId: { $exists: true } }).sort({ legacyId: -1 }).lean();
    return (latest?.legacyId ?? 0) + 1;
  }

  private async hydrateShares(shares: Array<Partial<DeviceShare> & { _id?: unknown }>) {
    const rows = [];
    for (const share of shares) {
      const device = share.deviceLegacyId ? await this.findByLegacyId(share.deviceLegacyId) : null;
      const sharedWithUser = share.sharedWithUserLegacyId
        ? await this.usersService.findByLegacyId(share.sharedWithUserLegacyId, 'customer')
        : null;
      const owner = device?.allocatedToCustomerId
        ? await this.usersService.findByLegacyId(device.allocatedToCustomerId, 'customer')
        : null;
      if (!device) continue;
      rows.push({
        id: String(share._id ?? ''),
        device_id: share.deviceLegacyId,
        shared_with_user_id: share.sharedWithUserLegacyId,
        shared_at: share.sharedAt,
        device: this.toLegacyDevice(device),
        devices: this.toLegacyDevice(device),
        shared_with_user: sharedWithUser ? this.usersService.toLegacyUser(sharedWithUser) : null,
        owner: owner ? this.usersService.toLegacyUser(owner) : null,
      });
    }
    return rows;
  }
}
