const mongoose = require('mongoose');
require('dotenv').config({ path: './gps-backend/.env' });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");
  const db = mongoose.connection.db;
  const users = await db.collection('users').find({}).toArray();
  console.log("Users:", users.map(u => ({ id: u._id, legacy: u.legacyId, email: u.email })));
  
  const devices = await db.collection('devices').find({}).toArray();
  console.log("Devices:", devices.map(d => ({ code: d.deviceCode, owner: d.allocatedToCustomerId })));
  process.exit(0);
}
run();
