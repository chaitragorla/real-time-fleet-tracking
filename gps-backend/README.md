# AddWise GPS Backend

NestJS + MongoDB backend for OTP authentication, device management, and GPS tracking.

## Runtime

- NestJS with TypeScript
- MongoDB through Mongoose
- JWT authentication through Passport
- SMS OTP delivery through the configured HTTP SMS provider

## Setup

```bash
npm install
npm run build
npm start
```

Development server:

```bash
npm run dev
```

Required environment:

```bash
MONGODB_URI=mongodb+srv://...
MONGODB_DB_NAME=addwise_gps
PORT=3001
JWT_SECRET=change-me
JWT_EXPIRES_IN=7d
OTP_TTL_MINUTES=10
SMS_SECRET=...
SMS_SENDER=NIGHAI
SMS_TEMPLATE_ID=...
SMS_ROUTE=TA
SMS_MSGTYPE=1
SMS_BASE_URL=http://43.252.88.250/index.php/smsapi/httpapi/
```

## Commands

```bash
npm run build
npm run db:init
npm run test:e2e
npm run test:e2e:live
```

`db:init` creates the `addwise_gps` database collections, synchronizes indexes, and seeds minimum validation data.

## Compatibility Endpoints

- `GET /health`
- `POST /v1/auth/send-otp`
- `POST /v1/auth/verify-otp`
- `GET /v1/auth/profile/:sessionToken`
- `PUT /v1/auth/profile/:sessionToken`
- `POST /v1/auth/cleanup-otps`
- `POST /v1/sms/send`
- `GET /v1/devices/active`
- `POST /v1/gps-signal/update-location`
- `GET /v1/gps-signal/current-location`
- `GET /v1/gps-signal/:device_code`
- `GET /v1/gps-signal/:device_code/history`
- `GET /v1/gps-signal/device/:deviceCode/data`
- `DELETE /v1/gps-signal/device/:deviceCode/clear`
- `POST /v1/gps-signal/device/:device_code/active`

Static API docs are available at `../swagger/index.html`.
