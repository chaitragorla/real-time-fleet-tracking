import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GeofenceDocument = HydratedDocument<Geofence>;

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ default: 'Point', enum: ['Point'] })
  type: 'Point';

  @Prop({ type: [Number], required: true })
  coordinates: [number, number];
}

const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

@Schema({ _id: false })
export class GeofenceBoundary {
  @Prop({ required: true })
  type: 'Polygon';

  @Prop({ type: [[Number]], required: true })
  coordinates: number[][]; // Array of [longitude, latitude] pairs forming a polygon
}

const GeofenceBoundarySchema = SchemaFactory.createForClass(GeofenceBoundary);

@Schema({ collection: 'geofences', timestamps: true })
export class Geofence {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ required: true, enum: ['circular', 'polygonal'] })
  type: 'circular' | 'polygonal';

  @Prop({ type: GeoPointSchema, required: false })
  center?: GeoPoint; // For circular geofences

  @Prop({ required: false })
  radius?: number; // Radius in meters for circular geofences

  @Prop({ type: GeofenceBoundarySchema, required: false })
  boundary?: GeofenceBoundary; // For polygonal geofences

  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({ required: true, enum: ['entry', 'exit', 'both'] })
  triggerType: 'entry' | 'exit' | 'both'; // When to trigger alerts

  @Prop({ default: true })
  isActive: boolean;

  createdBy?: number; // User ID who created this geofence

  @Prop({ type: [String], default: [] })
  monitoredDeviceCodes: string[]; // Devices to monitor within this geofence

  @Prop({ default: false })
  sendNotification: boolean; // Whether to send notifications on trigger

  @Prop({ trim: true })
  notificationMessage?: string; // Custom notification message

  @Prop({ trim: true })
  passName?: string; // Only visible to superadmin

  @Prop({ trim: true })
  passCode?: string; // Only visible to superadmin
}

export const GeofenceSchema = SchemaFactory.createForClass(Geofence);
GeofenceSchema.index({ center: '2dsphere' });
GeofenceSchema.index({ boundary: '2dsphere' });
GeofenceSchema.index({ createdBy: 1 });
