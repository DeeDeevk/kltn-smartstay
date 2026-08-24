import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(6)
  password!: string;
}
