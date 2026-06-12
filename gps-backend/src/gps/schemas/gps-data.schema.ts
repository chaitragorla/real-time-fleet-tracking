import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type GpsDataDocument = HydratedDocument<GpsData>;

@Schema({ _id: false })
export class GeoPoint {
  @Prop({ default: 'Point', enum: ['Point'] })
  type: 'Point';

  @Prop({ type: [Number], required: true })
  coordinates: [number, number];
}

const GeoPointSchema = SchemaFactory.createForClass(GeoPoint);

@Schema({ collection: 'gps_data', timestamps: true })
export class GpsData {
  @Prop({ index: true, required: true })
  deviceCode: string;

  @Prop({ index: true })
  userLegacyId?: number;

  @Prop({ required: true })
  latitude: number;

  @Prop({ required: true })
  longitude: number;

  @Prop({ type: GeoPointSchema, required: true })
  location: GeoPoint;

  @Prop()
  accuracy?: number;

  @Prop({ default: Date.now, index: true })
  timestamp: Date;

  @Prop()
  speed?: number;

  @Prop()
  altitude?: number;

  @Prop()
  voltage?: number;

  @Prop()
  rel1?: boolean;

  @Prop()
  rel2?: boolean;

  @Prop()
  rel3?: boolean;

  @Prop()
  alert1?: boolean;

  @Prop()
  alert2?: boolean;

  @Prop()
  alert3?: boolean;

  @Prop()
  alert4?: boolean;
}

export const GpsDataSchema = SchemaFactory.createForClass(GpsData);
GpsDataSchema.index({ location: '2dsphere' });
GpsDataSchema.index({ deviceCode: 1, timestamp: 1 });
