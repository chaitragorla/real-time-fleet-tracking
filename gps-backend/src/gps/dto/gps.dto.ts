import { IsBoolean, IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateLocationDto {
  @IsString()
  device_code: string;

  @IsOptional()
  @Matches(/^[0-9]{13}$/)
  device_m2m_number?: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @IsOptional()
  @IsString()
  timestamp?: string;
}

export class ActiveDto {
  @IsBoolean()
  is_active: boolean;
}
