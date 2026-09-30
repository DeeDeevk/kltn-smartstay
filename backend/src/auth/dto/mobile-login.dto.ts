import { IsEmail, IsString } from 'class-validator';

// Đăng nhập từ app mobile native: không có turnstileToken vì Turnstile chỉ dùng cho web
// (không có SDK cho iOS/Android).
export class MobileLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
