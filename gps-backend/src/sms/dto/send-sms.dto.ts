import { IsOptional, IsString } from 'class-validator';

export class SendSmsDto {
  @IsString()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  message?: string;
}
