import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole } from './schemas/user.schema';
import { EmployeeLoginLog, EmployeeLoginLogDocument } from './schemas/employee-login-log.schema';
import { formatPhoneNumber } from '../common/utils/phone.util';

export interface LegacyUserDto {
  id: number | string;
  phone_number: string;
  full_name: string;
  email?: string;
  employee_id?: string;
  role: UserRole;
  created_at?: string | Date;
  pass_name?: string;
  pass_code?: string;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(EmployeeLoginLog.name)
    private readonly loginLogModel: Model<EmployeeLoginLogDocument>,
  ) {}

  async findByEmailAndRole(email: string, role: UserRole) {
    const user = await this.userModel.findOne({ email: email.toLowerCase().trim(), role }).exec();
    if (user && !user.legacyId) {
      user.legacyId = await this.nextLegacyId();
      await user.save();
    }
    return user ? user.toObject() : null;
  }

  async findAnyByEmail(email: string) {
    const formatted = email.toLowerCase().trim();
    const roles: UserRole[] = ['superadmin', 'customer'];
    for (const role of roles) {
      const user = await this.findByEmailAndRole(formatted, role);
      if (user) return user;
    }
    return null;
  }

  async findByPhoneAndRole(phoneNumber: string, role: UserRole) {
    return this.userModel
      .findOne({ phoneNumber: formatPhoneNumber(phoneNumber), role })
      .lean()
      .exec();
  }

  async findAnyByPhone(phoneNumber: string) {
    const formatted = formatPhoneNumber(phoneNumber);
    const roles: UserRole[] = ['superadmin', 'customer'];
    for (const role of roles) {
      const user = await this.findByPhoneAndRole(formatted, role);
      if (user) {
        return user;
      }
    }
    return null;
  }

  async findByLegacyId(legacyId: number, role?: UserRole) {
    const query: Record<string, unknown> = { legacyId };
    if (role) query.role = role;
    return this.userModel.findOne(query).lean().exec();
  }

  async list(role?: UserRole) {
    const query: Record<string, unknown> = role ? { role } : {};
    return this.userModel.find(query).sort({ createdAt: -1 }).lean().exec();
  }

  async findByPhone(phoneNumber: string, role?: UserRole) {
    if (role) return this.findByPhoneAndRole(phoneNumber, role);
    return this.findAnyByPhone(phoneNumber);
  }

  async create(input: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: UserRole;
    phoneNumber?: string;
    employeeId?: string;
    legacyId?: number;
    passName?: string;
    passCode?: string;
  }) {
    const existing = await this.findByEmailAndRole(input.email, input.role);
    if (existing) return existing;
    const legacyId = input.legacyId ?? (await this.nextLegacyId());
    return this.userModel.create({
      legacyId,
      email: input.email.toLowerCase().trim(),
      passwordHash: input.passwordHash,
      fullName: input.fullName,
      phoneNumber: input.phoneNumber ? formatPhoneNumber(input.phoneNumber) : undefined,
      role: input.role,
      employeeId: input.employeeId,
      passName: input.passName,
      passCode: input.passCode,
      createdAt: new Date(),
    });
  }

  async updateByLegacyId(legacyId: number, update: Partial<User>) {
    return this.userModel
      .findOneAndUpdate({ legacyId }, update, { returnDocument: 'after' })
      .lean()
      .exec();
  }

  async updateProfileByLegacyId(legacyId: number, name: string) {
    return this.userModel
      .findOneAndUpdate(
        { legacyId, role: 'superadmin' },
        { fullName: name.trim() },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
  }

  async deleteByLegacyId(legacyId: number, role?: UserRole) {
    const query: Record<string, unknown> = { legacyId };
    if (role) query.role = role;
    return this.userModel.deleteOne(query).exec();
  }

  async logEmployeeLogin(employeeId: string) {
    if (!employeeId) return null;
    return this.loginLogModel.create({ employeeId, loginTime: new Date() });
  }

  async listEmployeeLoginLogs(limit = 100) {
    return this.loginLogModel
      .find()
      .sort({ loginTime: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  toLegacyLoginLog(log: Partial<EmployeeLoginLog> & { _id?: unknown }) {
    return {
      id: String(log._id ?? ''),
      employee_id: log.employeeId,
      login_time: log.loginTime,
    };
  }

  toLegacyUser(user: Partial<User> & { _id?: unknown }, isSuperAdmin = false): LegacyUserDto {
    const dto: LegacyUserDto = {
      id: user.legacyId ?? String(user._id ?? ''),
      phone_number: user.phoneNumber ?? '',
      full_name: user.fullName ?? '',
      email: user.email,
      employee_id: user.employeeId,
      role: user.role ?? 'customer',
      created_at: user.createdAt,
    };
    if (isSuperAdmin) {
      dto.pass_name = user.passName;
      dto.pass_code = user.passCode;
    }
    return dto;
  }

  private async nextLegacyId() {
    const latest = await this.userModel.findOne({ legacyId: { $exists: true } }).sort({ legacyId: -1 }).lean();
    return (latest?.legacyId ?? 0) + 1;
  }
}
