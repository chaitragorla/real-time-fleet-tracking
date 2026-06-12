import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { UserRole } from '../users/schemas/user.schema';

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async login(email: string, password: string, role?: UserRole) {
    const trimmedEmail = email.toLowerCase().trim();
    if (!trimmedEmail || !password) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Missing credentials',
          message: 'Email and password are required',
        },
      };
    }

    const user = role
      ? await this.usersService.findByEmailAndRole(trimmedEmail, role)
      : await this.usersService.findAnyByEmail(trimmedEmail);

    if (!user) {
      return {
        status: 401,
        body: {
          success: false,
          error: 'Invalid credentials',
          message: 'Invalid email or password',
        },
      };
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        status: 401,
        body: {
          success: false,
          error: 'Invalid credentials',
          message: 'Invalid email or password',
        },
      };
    }

    const userType: UserRole = user.role ?? role ?? 'customer';

    const legacyId = user.legacyId ?? String(user._id);
    const accessToken = this.jwtService.sign({
      sub: String(legacyId),
      email: user.email,
      role: userType,
    });
    const sessionToken = `session_${legacyId}_${Date.now()}`;

    return {
      status: 200,
      body: {
        success: true,
        message: `${this.labelRole(userType)} login successful`,
        user: {
          id: legacyId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          name: user.fullName,
          createdAt: user.createdAt,
          role: userType,
          employee_id: user.employeeId,
        },
        sessionToken,
        accessToken,
      },
    };
  }

  async register(
    email: string,
    password: string,
    fullName: string,
    role: UserRole = 'customer',
    phoneNumber?: string,
  ) {
    const trimmedEmail = email.toLowerCase().trim();

    if (!trimmedEmail || !password || !fullName) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Missing fields',
          message: 'Email, password, and full name are required',
        },
      };
    }

    if (password.length < 6) {
      return {
        status: 400,
        body: {
          success: false,
          error: 'Weak password',
          message: 'Password must be at least 6 characters long',
        },
      };
    }

    const existing = await this.usersService.findByEmailAndRole(trimmedEmail, role);
    if (existing) {
      return {
        status: 409,
        body: {
          success: false,
          error: 'User already exists',
          message: 'An account with this email already exists',
        },
      };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.usersService.create({
      email: trimmedEmail,
      passwordHash,
      fullName: fullName.trim(),
      role,
      phoneNumber,
    });

    const legacyId = user.legacyId ?? String(user._id);
    const accessToken = this.jwtService.sign({
      sub: String(legacyId),
      email: user.email,
      role,
    });

    return {
      status: 201,
      body: {
        success: true,
        message: 'Registration successful',
        user: {
          id: legacyId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          name: user.fullName,
          createdAt: user.createdAt,
          role,
        },
        accessToken,
      },
    };
  }

  async profile(sessionToken: string) {
    const legacyId = this.extractLegacyId(sessionToken);
    if (!legacyId) {
      return {
        status: 401,
        body: { success: false, error: 'Invalid session token', message: 'Valid session token is required' },
      };
    }
    const user = await this.usersService.findByLegacyId(legacyId, 'superadmin');
    if (!user) {
      return {
        status: 404,
        body: { success: false, error: 'User not found', message: 'User profile not found' },
      };
    }
    return {
      status: 200,
      body: {
        success: true,
        message: 'Profile retrieved successfully',
        user: {
          id: user.legacyId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          name: user.fullName,
          createdAt: user.createdAt,
        },
      },
    };
  }

  async updateProfile(sessionToken: string, name: string) {
    const legacyId = this.extractLegacyId(sessionToken);
    if (!legacyId) {
      return {
        status: 401,
        body: { success: false, error: 'Invalid session token', message: 'Valid session token is required' },
      };
    }
    if (!name || name.trim().length < 2) {
      return {
        status: 400,
        body: { success: false, error: 'Invalid name', message: 'Name must be at least 2 characters long' },
      };
    }
    const user = await this.usersService.updateProfileByLegacyId(legacyId, name);
    if (!user) {
      return { status: 404, body: { success: false, error: 'User not found', message: 'User profile not found' } };
    }
    return {
      status: 200,
      body: {
        success: true,
        message: 'Profile updated successfully',
        user: {
          id: user.legacyId,
          email: user.email,
          phoneNumber: user.phoneNumber,
          name: user.fullName,
          createdAt: user.createdAt,
        },
      },
    };
  }

  private extractLegacyId(sessionToken: string) {
    if (!sessionToken?.startsWith('session_')) return null;
    const [, id] = sessionToken.split('_');
    const numeric = Number(id);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private labelRole(role: UserRole) {
    if (role === 'superadmin') return 'Super admin';
    return 'Customer';
  }
}
