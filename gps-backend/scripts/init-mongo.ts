import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { DeviceSchema } from '../src/devices/schemas/device.schema';
import { DeviceShareSchema } from '../src/devices/schemas/device-share.schema';
import { GpsDataSchema } from '../src/gps/schemas/gps-data.schema';
import { UserSchema } from '../src/users/schemas/user.schema';
import { EmployeeLoginLogSchema } from '../src/users/schemas/employee-login-log.schema';

dotenv.config({ path: '.env' });
dotenv.config({ path: '../.env' });

const mongoUri = process.env.MONGODB_URI ?? '';
const dbName = process.env.MONGODB_DB_NAME || 'addwise_gps';

if (!mongoUri) {
  throw new Error('MONGODB_URI is required');
}

async function main() {
  await mongoose.connect(mongoUri, { dbName });

  const User = mongoose.model('User', UserSchema);
  const Device = mongoose.model('Device', DeviceSchema);
  mongoose.model('DeviceShare', DeviceShareSchema);
  mongoose.model('GpsData', GpsDataSchema);
  mongoose.model('EmployeeLoginLog', EmployeeLoginLogSchema);

  for (const name of ['users', 'devices', 'device_shares', 'gps_data', 'employee_login_logs']) {
    const exists = await mongoose.connection.db?.listCollections({ name }).hasNext();
    if (!exists) {
      await mongoose.connection.createCollection(name);
    }
  }

  await Promise.all(Object.values(mongoose.connection.models).map((model) => model.syncIndexes()));

  const passwordHash = await bcrypt.hash('password123', 10);

  await User.updateOne(
    { email: 'customer@example.com', role: 'customer' },
    {
      $setOnInsert: {
        legacyId: 1,
        fullName: 'Test Customer',
        email: 'customer@example.com',
        phoneNumber: '9876543210',
        passwordHash,
        role: 'customer',
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  await User.updateOne(
    { email: 'user@example.com', role: 'customer' },
    {
      $setOnInsert: {
        legacyId: 999,
        fullName: 'Test User',
        email: 'user@example.com',
        phoneNumber: '9876543211',
        passwordHash,
        role: 'customer',
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  await User.updateOne(
    { email: 'superadmin@example.com', role: 'superadmin' },
    {
      $setOnInsert: {
        legacyId: 3,
        fullName: 'Test Super Admin',
        email: 'superadmin@example.com',
        phoneNumber: '9876543212',
        passwordHash,
        role: 'superadmin',
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );

  await Device.updateOne(
    { deviceCode: 'TESTDEVICE000001' },
    {
      $setOnInsert: {
        legacyId: 1,
        deviceCode: 'TESTDEVICE000001',
        qrCode: 'TESTDEVICE000001',
        deviceName: 'Seeded Test Device',
        deviceIcon: 'car',
        deviceM2mNumber: '1234567890123',
        isActive: false, // Inactive/Completed
        allocatedToCustomerId: 1,
        allocatedToCustomerName: 'Test Customer',
        allocatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  await Device.updateOne(
    { deviceCode: 'TESTDEVICE000002' },
    {
      $setOnInsert: {
        legacyId: 1000,
        deviceCode: 'TESTDEVICE000002',
        qrCode: 'TESTDEVICE000002',
        deviceName: 'Completed Test Route',
        deviceIcon: 'car',
        deviceM2mNumber: '1234567890124',
        isActive: false, // Inactive/Completed
        allocatedToCustomerId: 1,
        allocatedToCustomerName: 'Test Customer',
        allocatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  await Device.updateOne(
    { deviceCode: 'TESTDEVICE000003' },
    {
      $setOnInsert: {
        legacyId: 1001,
        deviceCode: 'TESTDEVICE000003',
        qrCode: 'TESTDEVICE000003',
        deviceName: 'Completed Out-of-Slot Route',
        deviceIcon: 'car',
        deviceM2mNumber: '1234567890125',
        isActive: false, // Inactive/Completed
        allocatedToCustomerId: 1,
        allocatedToCustomerName: 'Test Customer',
        allocatedAt: new Date(),
      },
    },
    { upsert: true },
  );

  const GpsDataModel = mongoose.model('GpsData', GpsDataSchema);
  await GpsDataModel.deleteMany({ deviceCode: 'TESTDEVICE000001' });
  await GpsDataModel.deleteMany({ deviceCode: 'TESTDEVICE000002' });
  await GpsDataModel.deleteMany({ deviceCode: 'TESTDEVICE000003' });

  const pointsDevice1 = [
    { lat: 12.9748, lng: 77.5857, timeOffset: 0 },
    { lat: 12.9744, lng: 77.5860, timeOffset: 5 },
    { lat: 12.9740, lng: 77.5863, timeOffset: 10 },
    { lat: 12.9738, lng: 77.5867, timeOffset: 15 },
  ];

  const pointsDevice2 = [
    { lat: 12.9748, lng: 77.5857, timeOffset: 0 },
    { lat: 12.9750, lng: 77.5860, timeOffset: 5 },
    { lat: 12.9752, lng: 77.5863, timeOffset: 10 },
    { lat: 12.9758, lng: 77.5867, timeOffset: 15 },
  ];

  const pointsDevice3 = [
    { lat: 12.9748, lng: 77.5857, timeOffset: 0 },
    { lat: 12.9730, lng: 77.5920, timeOffset: 5 },
    { lat: 12.9698, lng: 77.5925, timeOffset: 10 },
    { lat: 12.9680, lng: 77.5940, timeOffset: 15 },
  ];

  const now = new Date();

  // Seed points for Device 1
  for (const pt of pointsDevice1) {
    const timestamp = new Date(now.getTime() - (30 - pt.timeOffset) * 60000);
    await GpsDataModel.create({
      deviceCode: 'TESTDEVICE000001',
      userLegacyId: 1,
      latitude: pt.lat,
      longitude: pt.lng,
      location: {
        type: 'Point',
        coordinates: [pt.lng, pt.lat],
      },
      accuracy: 5,
      timestamp,
    });
  }

  // Seed points for Device 2
  for (const pt of pointsDevice2) {
    const timestamp = new Date(now.getTime() - (30 - pt.timeOffset) * 60000);
    await GpsDataModel.create({
      deviceCode: 'TESTDEVICE000002',
      userLegacyId: 1,
      latitude: pt.lat,
      longitude: pt.lng,
      location: {
        type: 'Point',
        coordinates: [pt.lng, pt.lat],
      },
      accuracy: 5,
      timestamp,
    });
  }

  // Seed points for Device 3
  for (const pt of pointsDevice3) {
    const timestamp = new Date(now.getTime() - (30 - pt.timeOffset) * 60000);
    await GpsDataModel.create({
      deviceCode: 'TESTDEVICE000003',
      userLegacyId: 1,
      latitude: pt.lat,
      longitude: pt.lng,
      location: {
        type: 'Point',
        coordinates: [pt.lng, pt.lat],
      },
      accuracy: 5,
      timestamp,
    });
  }

  const collections = await mongoose.connection.db?.listCollections().toArray();
  console.log(
    JSON.stringify(
      {
        databaseName: mongoose.connection.db?.databaseName,
        collections: collections?.map((collection) => collection.name).sort(),
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
