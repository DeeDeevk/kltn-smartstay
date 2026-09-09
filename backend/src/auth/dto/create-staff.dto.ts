import { IsEmail, IsOptional, IsString } from 'class-validator';

// Không nhận password từ client — AuthService.createStaff() tự sinh mật khẩu
// tạm và gửi qua email cho nhân viên, admin không tự đặt/nhìn thấy mật khẩu.
export class CreateStaffDto {
  @IsEmail()
  email!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
