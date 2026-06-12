import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EmployeeLoginLogDocument = HydratedDocument<EmployeeLoginLog>;

@Schema({ collection: 'employee_login_logs', timestamps: true })
export class EmployeeLoginLog {
  @Prop({ required: true, trim: true, index: true })
  employeeId: string;

  @Prop({ default: Date.now, index: true })
  loginTime: Date;
}

export const EmployeeLoginLogSchema = SchemaFactory.createForClass(EmployeeLoginLog);
EmployeeLoginLogSchema.index({ employeeId: 1, loginTime: -1 });
