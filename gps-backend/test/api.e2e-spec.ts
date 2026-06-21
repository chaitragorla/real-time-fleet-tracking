import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { getConnectionToken } from '@nestjs/mongoose';
import { AuthController } from '../src/auth/auth.controller';
import { AuthService } from '../src/auth/auth.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { DevicesController } from '../src/devices/devices.controller';
import { DevicesService } from '../src/devices/devices.service';
import { GpsController } from '../src/gps/gps.controller';
import { GpsService } from '../src/gps/gps.service';
import { HealthController } from '../src/health/health.controller';
import { SmsController } from '../src/sms/sms.controller';
import { SmsService } from '../src/sms/sms.service';
import { UsersController } from '../src/users/users.controller';
import { UsersService } from '../src/users/users.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { DeviceSchema } from '../src/devices/schemas/device.schema';
import { GpsDataSchema } from '../src/gps/schemas/gps-data.schema';
import { OtpVerificationSchema } from '../src/auth/schemas/otp-verification.schema';

import { JwtService } from '@nestjs/jwt';

describe('NestJS compatibility API', () => {
  let app: INestApplication;
  const authService = {
    sendOtp: jest.fn(),
    verifyOtp: jest.fn(),
    profile: jest.fn(),
    updateProfile: jest.fn(),
    cleanupExpiredOtps: jest.fn(),
  };
  const gpsService = {
    updateLocation: jest.fn(),
    getCurrentLocation: jest.fn(),
    trackDevice: jest.fn(),
    history: jest.fn(),
    deviceData: jest.fn(),
    clearDeviceData: jest.fn(),
  };
  const devicesService = {
    listActiveAllocated: jest.fn(),
    updateActive: jest.fn(),
    listAll: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    allocate: jest.fn(),
    share: jest.fn(),
    deleteByCode: jest.fn(),
    toLegacyDevice: jest.fn((device) => device),
  };
  const smsService = {
    sendOtpSms: jest.fn(),
  };
  const usersService = {
    list: jest.fn(),
    deleteByLegacyId: jest.fn(),
    toLegacyUser: jest.fn((user) => user),
  };
  const jwtService = {
    verify: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [
        AuthController,
        GpsController,
        DevicesController,
        SmsController,
        HealthController,
        UsersController,
      ],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: GpsService, useValue: gpsService },
        { provide: DevicesService, useValue: devicesService },
        { provide: SmsService, useValue: smsService },
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: getConnectionToken(), useValue: { readyState: 1 } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /health returns Mongo-backed service health', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.mongodb.status).toBe('connected');
  });

  it('POST /v1/auth/send-otp preserves success shape', async () => {
    authService.sendOtp.mockResolvedValue({
      status: 200,
      body: { success: true, phoneNumber: '9876543210', userExists: false, smsStatus: true },
    });
    const res = await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ phoneNumber: '9876543210' })
      .expect(200);
    expect(res.body).toMatchObject({ success: true, phoneNumber: '9876543210' });
  });

  it('POST /v1/auth/send-otp returns legacy invalid-phone error', async () => {
    authService.sendOtp.mockResolvedValue({
      status: 400,
      body: { success: false, error: 'Invalid phone number format' },
    });
    const res = await request(app.getHttpServer())
      .post('/v1/auth/send-otp')
      .send({ phoneNumber: '123' })
      .expect(400);
    expect(res.body.error).toBe('Invalid phone number format');
  });

  it('POST /v1/auth/verify-otp returns session and JWT tokens', async () => {
    authService.verifyOtp.mockResolvedValue({
      status: 200,
      body: {
        success: true,
        sessionToken: 'session_1_1000',
        accessToken: 'jwt',
        otpVerified: true,
        user: { id: 1, role: 'superadmin' },
      },
    });
    const res = await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ phoneNumber: '9876543210', otp: '123456' })
      .expect(200);
    expect(res.body).toMatchObject({ success: true, sessionToken: 'session_1_1000', accessToken: 'jwt' });
  });

  it('POST /v1/auth/verify-otp rejects invalid OTPs', async () => {
    authService.verifyOtp.mockResolvedValue({
      status: 401,
      body: { success: false, error: 'Invalid or expired OTP' },
    });
    await request(app.getHttpServer())
      .post('/v1/auth/verify-otp')
      .send({ phoneNumber: '9876543210', otp: '000000' })
      .expect(401);
  });

  it('GET and PUT profile retain legacy session token routes', async () => {
    authService.profile.mockResolvedValue({ status: 200, body: { success: true, user: { id: 1 } } });
    authService.updateProfile.mockResolvedValue({ status: 200, body: { success: true, user: { name: 'New' } } });
    await request(app.getHttpServer()).get('/v1/auth/profile/session_1_1000').expect(200);
    await request(app.getHttpServer()).put('/v1/auth/profile/session_1_1000').send({ name: 'New' }).expect(200);
  });

  it('POST /v1/auth/cleanup-otps returns cleanup status', async () => {
    await request(app.getHttpServer()).post('/v1/auth/cleanup-otps').expect(201);
  });

  it('POST /v1/sms/send validates OTP-bearing messages', async () => {
    smsService.sendOtpSms.mockResolvedValue({ success: true });
    await request(app.getHttpServer())
      .post('/v1/sms/send')
      .send({ phoneNumber: '9876543210', message: 'OTP 123456' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/v1/sms/send')
      .send({ phoneNumber: '9876543210', message: 'no code' })
      .expect(400);
  });

  it('GET /v1/devices/active returns active devices', async () => {
    devicesService.listActiveAllocated.mockResolvedValue([
      { deviceCode: 'ABC', deviceName: 'Truck', allocatedToCustomerName: 'Ravi' },
    ]);
    const res = await request(app.getHttpServer()).get('/v1/devices/active').expect(200);
    expect(res.body).toMatchObject({ status: 'success', count: 1 });
  });

  it('GPS location endpoints preserve response shapes and errors', async () => {
    gpsService.updateLocation.mockResolvedValue({ success: true, data: { device_code: 'ABC' } });
    gpsService.getCurrentLocation.mockReturnValue({ status: 'success', location: { latitude: 1 } });
    gpsService.trackDevice.mockResolvedValue({ status: 400, body: { error: 'GPS coordinates not available' } });

    await request(app.getHttpServer())
      .post('/v1/gps-signal/update-location')
      .send({ device_code: 'ABC', device_m2m_number: '1234567890123', latitude: 1, longitude: 2 })
      .expect(201);
    await request(app.getHttpServer()).get('/v1/gps-signal/current-location').expect(200);
    const res = await request(app.getHttpServer()).get('/v1/gps-signal/ABC').expect(400);
    expect(res.body.error).toBe('GPS coordinates not available');
  });

  it('GPS history, device data, clear, and active toggle endpoints work', async () => {
    gpsService.history.mockResolvedValue({ status: 'success', count: 1, data: [{ timestamp: '2026-01-01' }] });
    gpsService.deviceData.mockResolvedValue({ success: true, count: 1, data: [{}] });
    gpsService.clearDeviceData.mockResolvedValue({ success: true, deletedCount: 1 });
    devicesService.updateActive.mockResolvedValue({ isActive: false });
    await request(app.getHttpServer()).get('/v1/gps-signal/ABC/history').expect(200);
    await request(app.getHttpServer()).get('/v1/gps-signal/device/ABC/data').expect(200);
    await request(app.getHttpServer()).delete('/v1/gps-signal/device/ABC/clear').expect(200);
    await request(app.getHttpServer()).post('/v1/gps-signal/device/ABC/active').send({ is_active: false }).expect(201);
  });

  it('JWT-protected replacement APIs are mounted', async () => {
    usersService.list.mockResolvedValue([{ legacyId: 1, phoneNumber: '9876543210' }]);
    devicesService.listAll.mockResolvedValue([{ deviceCode: 'ABC' }]);
    await request(app.getHttpServer()).get('/v1/users').set('Authorization', 'Bearer test').expect(200);
    await request(app.getHttpServer()).get('/v1/devices').set('Authorization', 'Bearer test').expect(200);
  });

  it('declares MongoDB indexes for constraints, TTL, and geospatial queries', () => {
    expect(DeviceSchema.indexes()).toEqual(
      expect.arrayContaining([
        [{ deviceM2mNumber: 1 }, expect.objectContaining({ unique: true, sparse: true })],
      ]),
    );
    expect(GpsDataSchema.indexes()).toEqual(
      expect.arrayContaining([[{ location: '2dsphere' }, expect.any(Object)]]),
    );
    expect(OtpVerificationSchema.indexes()).toEqual(
      expect.arrayContaining([[{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })]]),
    );
  });
});
