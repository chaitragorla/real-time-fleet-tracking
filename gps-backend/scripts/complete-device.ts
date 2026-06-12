import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { DeviceSchema } from '../src/devices/schemas/device.schema';
import { GpsDataSchema } from '../src/gps/schemas/gps-data.schema';

dotenv.config({ path: '.env' });
dotenv.config({ path: '../.env' });

const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017';
const dbName = process.env.MONGODB_DB_NAME || 'addwise_gps';

async function main() {
  await mongoose.connect(mongoUri, { dbName });

  const Device = mongoose.model('Device', DeviceSchema);
  const GpsDataModel = mongoose.model('GpsData', GpsDataSchema);

  const deviceCode = 'F6W7LSL6C1ZEBWTM';

  // 1. Update the device to be completed/inactive
  const updateResult = await Device.updateOne(
    { deviceCode },
    { $set: { isActive: false } }
  );

  console.log(`Device ${deviceCode} update result:`, updateResult);

  // 2. Clear existing GPS data for this device
  await GpsDataModel.deleteMany({ deviceCode });

  // 3. Seed Bangalore GPS route ending in Office Parking slot
  // Office slot is around [centerLat - 0.0010, centerLng - 0.0010] relative to start point
  const points = [
    { lat: 12.9748, lng: 77.5857, timeOffset: 0 },
    { lat: 12.9744, lng: 77.5852, timeOffset: 5 },
    { lat: 12.9740, lng: 77.5849, timeOffset: 10 },
    { lat: 12.9738, lng: 77.5847, timeOffset: 15 }, // Ends in Office Parking Slot!
  ];

  const now = new Date();
  for (const pt of points) {
    const timestamp = new Date(now.getTime() - (30 - pt.timeOffset) * 60000);
    await GpsDataModel.create({
      deviceCode,
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

  console.log(`Successfully seeded ${points.length} GPS points for ${deviceCode}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
