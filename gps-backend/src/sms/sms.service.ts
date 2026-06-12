import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  constructor(private readonly config: ConfigService) {}

  async sendOtpSms(phoneNumber: string, otp: string) {
    try {
      const message = `Welcome to NighaTech Global Your OTP for authentication is ${otp} don't share with anybody Thank you`;
      const params = new URLSearchParams({
        secret: this.config.get<string>('SMS_SECRET') ?? '',
        sender: this.config.get<string>('SMS_SENDER') ?? 'NIGHAI',
        tempid: this.config.get<string>('SMS_TEMPLATE_ID') ?? '',
        receiver: phoneNumber,
        route: this.config.get<string>('SMS_ROUTE') ?? 'TA',
        msgtype: this.config.get<string>('SMS_MSGTYPE') ?? '1',
        sms: message,
      });

      const baseUrl = this.config.get<string>('SMS_BASE_URL');
      if (!baseUrl || !this.config.get<string>('SMS_SECRET')) {
        return {
          success: false,
          error: 'SMS service is not configured',
        };
      }

      const response = await fetch(`${baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: { 'User-Agent': 'NestJS SMS Service/1.0' },
      });
      const responseText = await response.text();
      if (response.status === 200) {
        return {
          success: true,
          message: `SMS sent successfully to ${phoneNumber}`,
          apiResponse: responseText,
          status: response.status,
        };
      }
      return {
        success: false,
        error: `SMS API returned status ${response.status}: ${responseText}`,
        apiResponse: responseText,
        status: response.status,
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to send SMS: ${error instanceof Error ? error.message : 'Unknown error'}`,
        exception: error instanceof Error ? error.name : 'UnknownError',
      };
    }
  }
}
