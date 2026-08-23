import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

class GuestInfoDto {
  @IsString()
  fullName!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class CreateBookingDto {
  @IsUUID()
  roomTypeId!: string;

  @IsDateString()
  checkIn!: string;

  @IsDateString()
  checkOut!: string;

  @ValidateNested()
  @Type(() => GuestInfoDto)
  guestInfo!: GuestInfoDto;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  extraServiceIds?: string[];

  @IsOptional()
  @IsString()
  promotionCode?: string;
}
