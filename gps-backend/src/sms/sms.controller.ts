import { Body, Controller, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SendSmsDto } from './dto/send-sms.dto';
import { SmsService } from './sms.service';

@Controller('v1/sms')
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  @Post('send')
  async send(@Body() body: SendSmsDto, @Res() res: Response) {
    if (!body.phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    const otpMatch = body.message?.match(/\b\d{6}\b/);
    if (!otpMatch) {
      return res.status(400).json({
        success: false,
        error: 'Message must contain a 6-digit OTP',
      });
    }
    const result = await this.smsService.sendOtpSms(body.phoneNumber, otpMatch[0]);
    return res.status(result.success ? 200 : 500).json(result);
  }
}
