import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { DevicesModule } from './devices/devices.module';
import { GpsModule } from './gps/gps.module';
import { HealthModule } from './health/health.module';
import { SmsModule } from './sms/sms.module';
import { UsersModule } from './users/users.module';
import { SimulatorModule } from './simulator/simulator.module';
import { ParkingModule } from './parking/parking.module';
import { GeofenceModule } from './geofence/geofence.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../.env'],
    }),
    // EventEmitterModule must be global so SimulatorService and SimulatorGateway
    // can communicate via EventEmitter2 without circular imports.
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: ':',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uri = config.get<string>('MONGODB_URI');
        if (!uri) {
          throw new Error('MONGODB_URI is required for the NestJS MongoDB backend');
        }
        return {
          uri,
          dbName: config.get<string>('MONGODB_DB_NAME') ?? 'addwise_gps',
          autoIndex: true,
          serverSelectionTimeoutMS: 5000,
        };
      },
    }),
    DatabaseModule,
    UsersModule,
    DevicesModule,
    SmsModule,
    AuthModule,
    GpsModule,
    SimulatorModule,
    ParkingModule,
    GeofenceModule,
    HealthModule,
  ],
})
export class AppModule {}
