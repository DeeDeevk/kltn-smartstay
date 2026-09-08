import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RegisterDTO {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;
}
