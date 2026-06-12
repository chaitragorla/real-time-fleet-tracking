import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from './schemas/user.schema';

@Controller('v1/users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  async list(@Query('role') role?: UserRole) {
    const users = await this.usersService.list(role);
    return {
      success: true,
      count: users.length,
      data: users.map((user) => this.usersService.toLegacyUser(user)),
    };
  }

  @Get('by-phone/:phoneNumber')
  async byPhone(@Param('phoneNumber') phoneNumber: string, @Query('role') role?: UserRole) {
    const user = await this.usersService.findByPhone(phoneNumber, role);
    return {
      success: Boolean(user),
      data: user ? this.usersService.toLegacyUser(user) : null,
    };
  }

  @Post()
  async create(@Body() body: {
    email: string;
    passwordHash: string;
    phone_number?: string;
    full_name?: string;
    name?: string;
    role?: UserRole;
    employee_id?: string;
  }) {
    const user = await this.usersService.create({
      email: body.email,
      passwordHash: body.passwordHash,
      phoneNumber: body.phone_number,
      fullName: body.full_name || body.name || `User_${body.email.split('@')[0]}`,
      role: body.role || 'customer',
      employeeId: body.employee_id,
    });
    return { success: true, data: this.usersService.toLegacyUser(user) };
  }

  @Get('login-logs')
  async loginLogs(@Query('limit') limit?: string) {
    const logs = await this.usersService.listEmployeeLoginLogs(Number(limit) || 100);
    return {
      success: true,
      count: logs.length,
      data: logs.map((log) => this.usersService.toLegacyLoginLog(log)),
    };
  }

  @Post('login-logs')
  async createLoginLog(@Body() body: { employee_id: string }) {
    const log = await this.usersService.logEmployeeLogin(body.employee_id);
    return { success: true, data: log ? this.usersService.toLegacyLoginLog(log) : null };
  }

  @Delete(':legacyId')
  async remove(@Param('legacyId') legacyId: string, @Query('role') role?: UserRole) {
    await this.usersService.deleteByLegacyId(Number(legacyId), role);
    return { success: true, message: 'User deleted successfully' };
  }
}
