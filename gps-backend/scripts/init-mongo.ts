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
        isActive: true,
        allocatedToCustomerId: 1,
        allocatedToCustomerName: 'Test Customer',
        allocatedAt: new Date(),
      },
    },
    { upsert: true },
  );

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
