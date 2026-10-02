import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { RegisterDTO } from './dto/register.dto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { MobileLoginDto } from './dto/mobile-login.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { VerifyResetOtpDto } from './dto/verify-reset-otp.dto';
import { TurnstileService } from './turnstile.service';
import { ConfigService } from '@nestjs/config';

// Giới hạn riêng cho các endpoint nhạy cảm (brute-force mật khẩu/OTP), chặt hơn mức mặc định toàn cục
const AUTH_THROTTLE = { default: { limit: 5, ttl: 60000 } };
// Refresh token nằm trong cookie httpOnly (JS phía trình duyệt không đọc được, chống
// XSS đánh cắp token) thay vì trả trong body để frontend tự lưu localStorage.
const REFRESH_COOKIE = 'refresh_token';
// Cookie chỉ được gửi kèm request tới /api/v1/auth/*, không đi theo mọi API khác.
const REFRESH_COOKIE_PATH = '/api/v1/auth';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // khớp JWT_REFRESH_EXPIRES=7d

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly turnstileService: TurnstileService,
    private readonly configService: ConfigService,
  ) {}

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.configService.get<string>('COOKIE_SECURE') === 'true',
      sameSite: (this.configService.get<string>('COOKIE_SAMESITE') ?? 'lax') as
        'lax' | 'strict' | 'none',
      path: REFRESH_COOKIE_PATH,
    };
  }

  private withRefreshCookie(
    res: Response,
    tokens: { accessToken: string; refreshToken: string; user: unknown },
  ) {
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.cookieOptions(),
      maxAge: REFRESH_COOKIE_MAX_AGE,
    });
    return { accessToken: tokens.accessToken, user: tokens.user };
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions());
  }

  @Throttle(AUTH_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDTO) {
    return this.authService.register(dto);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('login')
  // passthrough: vẫn return dữ liệu như bình thường, chỉ mượn res để set cookie.
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.turnstileService.verify(dto.turnstileToken, 'login');
    return this.withRefreshCookie(res, await this.authService.login(dto));
  }

  // Turnstile chỉ áp dụng cho web; app mobile native đăng nhập qua endpoint này,
  // vẫn giới hạn tần suất như /login để chống brute-force.
  @Throttle(AUTH_THROTTLE)
  @Post('mobile/login')
  async mobileLogin(
    @Body() dto: MobileLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withRefreshCookie(res, await this.authService.login(dto));
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = (req.cookies as Record<string, string | undefined>)[
      REFRESH_COOKIE
    ];
    if (!token) throw new UnauthorizedException('Chưa đăng nhập');
    try {
      return this.withRefreshCookie(res, await this.authService.refresh(token));
    } catch (err) {
      // Token hỏng/hết hạn/bị thu hồi -> xoá luôn cookie để trình duyệt khỏi gửi lại.
      this.clearRefreshCookie(res);
      throw err;
    }
  }

  @Post('google')
  async google(
    @Body() dto: GoogleLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.withRefreshCookie(
      res,
      await this.authService.loginWithGoogle(dto.idToken),
    );
  }

  @Throttle(AUTH_THROTTLE)
  @Post('verify-otp')
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.email, dto.otp);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('resend-otp')
  resendOtp(@Body() dto: ResendOtpDto) {
    return this.authService.resendOtp(dto.email);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('verify-reset-otp')
  verifyResetOtp(@Body() dto: VerifyResetOtpDto) {
    return this.authService.verifyResetOtp(dto.email, dto.otp);
  }

  @Throttle(AUTH_THROTTLE)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.otp, dto.newPassword);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.split(' ')[1] ?? '';
    this.clearRefreshCookie(res);
    return this.authService.logout(token);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: AuthenticatedRequest) {
    return this.authService.getMe(req.user.userId);
  }

  @Post('create-staff')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  createStaff(@Body() dto: CreateStaffDto) {
    return this.authService.createStaff(dto);
  }
}
