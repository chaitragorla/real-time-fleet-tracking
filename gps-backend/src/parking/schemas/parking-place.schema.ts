import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ParkingPlaceDocument = HydratedDocument<ParkingPlace>;

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ default: 'Point', enum: ['Point'] })
  type: 'Point';

  @Prop({ type: [Number], required: true })
  coordinates: [number, number];
}

const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

@Schema({ collection: 'parking_places', timestamps: true })
export class ParkingPlace {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: GeoPointSchema, required: true })
  location: GeoPoint;

  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({ required: true })
  radius: number; // Radius in meters for parking area

  @Prop({ trim: true })
  address?: string;

  @Prop({ default: true })
  isActive: boolean;

  createdBy?: number; // User ID who created this parking place

  @Prop({ type: [String], default: [] })
  allowedDeviceCodes: string[]; // Devices allowed to park here

  @Prop()
  maxCapacity?: number; // Maximum number of vehicles

  @Prop({ default: 0 })
  currentOccupancy: number; // Current number of parked vehicles

  @Prop({ trim: true })
  passName?: string; // Only visible to superadmin

  @Prop({ trim: true })
  passCode?: string; // Only visible to superadmin
}

export const ParkingPlaceSchema = SchemaFactory.createForClass(ParkingPlace);
ParkingPlaceSchema.index({ location: '2dsphere' });
ParkingPlaceSchema.index({ createdBy: 1 });
