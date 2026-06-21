import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserRole = 'customer' | 'superadmin';
export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ index: true, unique: true, sparse: true })
  legacyId?: number;

  @Prop({ required: true, trim: true })
  fullName: string;

  @Prop({ trim: true })
  phoneNumber?: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true, enum: ['customer', 'superadmin'], index: true })
  role: UserRole;

  @Prop({ trim: true, index: true, sparse: true })
  employeeId?: string;

  @Prop({ trim: true })
  passName?: string;

  @Prop({ trim: true })
  passCode?: string;

  @Prop()
  createdAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ email: 1, role: 1 }, { unique: true });
