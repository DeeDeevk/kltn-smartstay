import { IsString, Matches, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  oldPassword!: string;

  @IsString()
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @Matches(/(?=.*[a-zA-Z])(?=.*[0-9])/, {
    message: 'Mật khẩu mới phải chứa cả chữ và số',
  })
  newPassword!: string;
}
