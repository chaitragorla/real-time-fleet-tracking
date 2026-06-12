import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DeviceShareDocument = HydratedDocument<DeviceShare>;

@Schema({ collection: 'device_shares', timestamps: true })
export class DeviceShare {
  @Prop({ required: true, index: true })
  deviceLegacyId: number;

  @Prop({ required: true, index: true })
  deviceCode: string;

  @Prop({ required: true, index: true })
  ownerLegacyId: number;

  @Prop({ required: true, index: true })
  sharedWithUserLegacyId: number;

  @Prop({ default: Date.now, index: true })
  sharedAt: Date;
}

export const DeviceShareSchema = SchemaFactory.createForClass(DeviceShare);
DeviceShareSchema.index({ deviceLegacyId: 1, sharedWithUserLegacyId: 1 }, { unique: true });
