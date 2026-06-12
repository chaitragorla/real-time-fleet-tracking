import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type OtpVerificationDocument = HydratedDocument<OtpVerification>;

@Schema({ collection: 'otp_verifications', timestamps: true })
export class OtpVerification {
  @Prop({ required: true, trim: true, index: true })
  phoneNumber: string;

  @Prop({ required: true })
  otpHash: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: false, index: true })
  isVerified: boolean;
}

export const OtpVerificationSchema = SchemaFactory.createForClass(OtpVerification);
OtpVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
OtpVerificationSchema.index({ phoneNumber: 1, isVerified: 1, createdAt: -1 });
