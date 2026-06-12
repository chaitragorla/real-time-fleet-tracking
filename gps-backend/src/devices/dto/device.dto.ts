import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Matches, Min, ValidateNested } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateDevicesDto {
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  count?: number;

  @IsOptional()
  @IsArray()
  devices?: Array<{
    device_code: string;
    qr_code?: string;
    is_active?: boolean;
  }>;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  device_name?: string;

  @IsOptional()
  @IsString()
  device_icon?: string;

  @IsOptional()
  @Matches(/^[0-9]{13}$/)
  device_m2m_number?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class AllocateDeviceDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  allocated_to_customer_id: number;

  @IsString()
  allocated_to_customer_name: string;

  @IsOptional()
  @IsString()
  device_name?: string;

  @IsOptional()
  @IsString()
  device_icon?: string;
}

export class UnassignDeviceDto {
  @IsOptional()
  @IsBoolean()
  clear_gps?: boolean;
}

export class ShareDeviceDto {
  @IsString()
  phone_number: string;
}
