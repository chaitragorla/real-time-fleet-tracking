import mongoose from 'mongoose';
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI + '/' + process.env.MONGODB_DB_NAME);
  console.log('Connected to DB:', process.env.MONGODB_DB_NAME);
  
  const Device = mongoose.connection.collection('devices');
  const d = await Device.findOne({ device_code: 'Q5E5MJOUU5IZ4BCG' });
  console.log('Device:', d);
  
  const User = mongoose.connection.collection('users');
  const u = await User.find({}).toArray();
  console.log('Users:', u.map(x => ({id: x._id, phone: x.phone_number, role: x.role})));
  
  mongoose.disconnect();
}
check();
