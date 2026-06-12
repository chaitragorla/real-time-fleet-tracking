import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import request from 'supertest';
import type { Connection } from 'mongoose';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

jest.setTimeout(60000);

describe('Live Mongo-backed API', () => {
  let app: INestApplication;
  let connection: Connection;
  const suffix = Date.now().toString().slice(-8);
  const deviceCode = `LIVE${suffix}`;
  const m2m = `98${suffix.padStart(11, '0')}`.slice(0, 13);
  const customerPhone = '9876543210';
  const secondCustomerPhone = '9876543213';
  const superAdminPhone = '9876543212';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidUnknownValues: false }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    connection = app.get<Connection>(getConnectionToken());

    await connection.collection('users').updateOne(
      { phoneNumber: secondCustomerPhone, role: 'customer' },
      {
        $setOnInsert: {
          legacyId: 13,
          fullName: 'Live Share Customer',
          phoneNumber: secondCustomerPhone,
          role: 'customer',
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  });

  afterAll(async () => {
    if (connection) {
      await connection.collection('devices').deleteMany({ deviceCode });
      await connection.collection('gps_data').deleteMany({ deviceCode });
      await connection.collection('device_shares').deleteMany({ deviceCode });
    }
    if (app) await app.close();
  });

  it('creates expected MongoDB collections and indexes in addwise_gps', async () => {
    expect(connection.db?.databaseName).toBe(process.env.MONGODB_DB_NAME || 'addwise_gps');
    const collections = await connection.db?.listCollections().toArray();
    expect(collections?.map((collection) => collection.name)).toEqual(
      expect.arrayContaining(['users', 'devices', 'gps_data', 'otp_verifications', 'employee_login_logs', 'device_shares']),
    );
    const gpsIndexes = await connection.collection('gps_data').indexes();
    const otpIndexes = await connection.collection('otp_verifications').indexes();
    const deviceIndexes = await connection.collection('devices').indexes();
    expect(gpsIndexes.some((index) => index.key.location === '2dsphere')).toBe(true);
    expect(otpIndexes.some((index) => index.key.expiresAt === 1 && index.expireAfterSeconds === 0)).toBe(true);
    expect(deviceIndexes.some((index) => index.key.deviceCode === 1 && index.unique)).toBe(true);
    expect(deviceIndexes.some((index) => index.key.deviceM2mNumber === 1 && index.unique && index.sparse)).toBe(true);
  });

  it('covers health, auth OTP, profile, cleanup, and SMS routes against live Mongo', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);

    const otpRes = await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ phoneNumber: customerPhone, role: 'customer' })
      .expect(200);
    expect(otpRes.body.success).toBe(true);

    await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ phoneNumber: customerPhone, otp: '000000', role: 'customer' })
      .expect(401);

    const validOtp = otpRes.body.debug?.generatedOtp;
    expect(validOtp).toMatch(/^\d{6}$/);
    const verifyRes = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ phoneNumber: customerPhone, otp: validOtp, role: 'customer' })
      .expect(200);
    expect(verifyRes.body).toMatchObject({ success: true, otpVerified: true });

    const superOtpRes = await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ phoneNumber: superAdminPhone, role: 'superadmin' })
      .expect(200);
    const superVerify = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ phoneNumber: superAdminPhone, otp: superOtpRes.body.debug.generatedOtp, role: 'superadmin' })
      .expect(200);

    await request(app.getHttpServer()).get(`/v1/auth/profile/${superVerify.body.sessionToken}`).expect(200);
    await request(app.getHttpServer())
      .put(`/v1/auth/profile/${superVerify.body.sessionToken}`)
      .send({ name: 'Test Super Admin' })
      .expect(200);
    await request(app.getHttpServer()).post('/v1/auth/cleanup-otps').expect(201);

    const smsRes = await request(app.getHttpServer())
      .post('/v1/sms/send')
      .send({ phoneNumber: customerPhone, message: 'OTP 123456' });
    expect([200, 500]).toContain(smsRes.status);
    expect(typeof smsRes.body.success).toBe('boolean');
  });

  it('covers users and employee login log routes', async () => {
    const customers = await request(app.getHttpServer()).get('/v1/users?role=customer').expect(200);
    expect(customers.body.data.length).toBeGreaterThan(0);

    await request(app.getHttpServer()).get(`/v1/users/by-phone/${customerPhone}?role=customer`).expect(200);
    const created = await request(app.getHttpServer())
      .post('/v1/users')
      .send({ phone_number: `98${suffix}`, full_name: 'Live API User', role: 'customer' })
      .expect(201);
    await request(app.getHttpServer()).delete(`/v1/users/${created.body.data.id}?role=customer`).expect(200);

    await request(app.getHttpServer()).post('/v1/users/login-logs').send({ employee_id: 'EMP001' }).expect(201);
    const logs = await request(app.getHttpServer()).get('/v1/users/login-logs').expect(200);
    expect(logs.body.data.length).toBeGreaterThan(0);
  });

  it('covers device CRUD, allocation, sharing, active-listing, and GPS routes', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/devices')
      .send({ devices: [{ device_code: deviceCode, qr_code: deviceCode, is_active: true }] })
      .expect(201);
    const deviceId = created.body.data[0].id;

    await request(app.getHttpServer()).get('/v1/devices').expect(200);
    await request(app.getHttpServer()).get(`/v1/devices/code/${deviceCode}`).expect(200);
    await request(app.getHttpServer())
      .patch(`/v1/devices/id/${deviceId}`)
      .send({ device_m2m_number: m2m, device_icon: 'truck' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/devices/${deviceCode}/allocate`)
      .send({ allocated_to_customer_id: 1, allocated_to_customer_name: 'Test Customer', device_name: 'Live Device' })
      .expect(201);
    await request(app.getHttpServer()).get('/v1/devices/active').expect(200);
    await request(app.getHttpServer()).get('/v1/devices/owner/1').expect(200);
    await request(app.getHttpServer()).post(`/v1/devices/${deviceCode}/share`).send({ phone_number: secondCustomerPhone }).expect(201);
    const sent = await request(app.getHttpServer()).get('/v1/devices/sent/1').expect(200);
    await request(app.getHttpServer()).get('/v1/devices/received/13').expect(200);
    if (sent.body.data[0]?.id) {
      await request(app.getHttpServer()).delete(`/v1/devices/shares/${sent.body.data[0].id}`).expect(200);
    }

    await request(app.getHttpServer())
      .post('/v1/gps-signal/update-location')
      .send({ device_code: deviceCode, device_m2m_number: '111', latitude: 12.1, longitude: 77.1 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/v1/gps-signal/update-location')
      .send({ device_code: deviceCode, device_m2m_number: m2m, latitude: 12.1, longitude: 77.1, accuracy: 5 })
      .expect(201);
    await request(app.getHttpServer()).get('/v1/gps-signal/current-location').expect(200);
    await request(app.getHttpServer()).get(`/v1/gps-signal/${deviceCode}`).expect(200);
    await request(app.getHttpServer()).get(`/v1/gps-signal/${deviceCode}/history`).expect(200);
    await request(app.getHttpServer()).get(`/v1/gps-signal/device/${deviceCode}/data`).expect(200);
    await request(app.getHttpServer()).post(`/v1/gps-signal/device/${deviceCode}/active`).send({ is_active: false }).expect(201);
    await request(app.getHttpServer()).get(`/v1/gps-signal/${deviceCode}`).expect(403);
    await request(app.getHttpServer()).post(`/v1/gps-signal/device/${deviceCode}/active`).send({ is_active: true }).expect(201);
    await request(app.getHttpServer()).delete(`/v1/gps-signal/device/${deviceCode}/clear`).expect(200);
    await request(app.getHttpServer()).post(`/v1/devices/id/${deviceId}/unassign`).expect(201);
    await request(app.getHttpServer()).delete(`/v1/devices/id/${deviceId}`).expect(200);
  });
});
