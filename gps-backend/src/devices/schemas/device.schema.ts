import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DeviceDocument = HydratedDocument<Device>;

@Schema({ _id: false })
export class SharedDeviceUser {
  @Prop({ required: true })
  userLegacyId: number;

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  phoneNumber: string;

  @Prop({ default: Date.now })
  sharedAt: Date;
}

export const SharedDeviceUserSchema = SchemaFactory.createForClass(SharedDeviceUser);

@Schema({ collection: 'devices', timestamps: true })
export class Device {
  @Prop({ index: true, unique: true, sparse: true })
  legacyId?: number;

  @Prop({ required: true, unique: true, trim: true })
  deviceCode: string;

  @Prop({ required: true })
  qrCode: string;

  @Prop({ trim: true })
  deviceName?: string;

  @Prop({ default: 'car', trim: true })
  deviceIcon?: string;

  @Prop({
    trim: true,
    validate: {
      validator: (value?: string) => !value || /^[0-9]{13}$/.test(value),
      message: 'deviceM2mNumber must be exactly 13 digits',
    },
  })
  deviceM2mNumber?: string;

  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ index: true })
  allocatedToCustomerId?: number;

  @Prop({ trim: true })
  allocatedToCustomerName?: string;

  @Prop()
  allocatedAt?: Date;

  @Prop({ type: [SharedDeviceUserSchema], default: [] })
  sharedWith: SharedDeviceUser[];
}

export const DeviceSchema = SchemaFactory.createForClass(Device);
DeviceSchema.index({ deviceM2mNumber: 1 }, { unique: true, sparse: true });
