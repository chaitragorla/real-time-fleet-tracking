import { Body, Controller, Get, Param, Post, Put, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, UpdateProfileDto } from './dto/auth.dto';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto, @Res() res: Response) {
    const result = await this.authService.login(body.email, body.password, body.role);
    return res.status(result.status).json(result.body);
  }

  @Post('register')
  async register(@Body() body: RegisterDto, @Res() res: Response) {
    const result = await this.authService.register(
      body.email,
      body.password,
      body.fullName,
      body.role || 'customer',
      body.phone_number,
    );
    return res.status(result.status).json(result.body);
  }

  @Get('profile/:sessionToken')
  async profile(@Param('sessionToken') sessionToken: string, @Res() res: Response) {
    const result = await this.authService.profile(sessionToken);
    return res.status(result.status).json(result.body);
  }

  @Put('profile/:sessionToken')
  async updateProfile(
    @Param('sessionToken') sessionToken: string,
    @Body() body: UpdateProfileDto,
    @Res() res: Response,
  ) {
    const result = await this.authService.updateProfile(sessionToken, body.name);
    return res.status(result.status).json(result.body);
  }
}
