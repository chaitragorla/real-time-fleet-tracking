import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  health() {
    const connected = this.connection.readyState === 1;
    return {
      status: connected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      mongodb: {
        status: connected ? 'connected' : 'error',
      },
      services: {
        sms: 'available',
        otp: 'available',
      },
    };
  }
}
