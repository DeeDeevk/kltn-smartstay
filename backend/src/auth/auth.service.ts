import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { UserService } from '../users/user.service';
import { RegisterDTO } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserStatus } from '../common/enums/user-status.enum';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

interface RefreshPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  async register(dto: RegisterDTO) {
    const user = await this.userService.create(dto);
    return this.buildTokenPair(user.userId, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.userService.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (user.status === UserStatus.LOCKED) {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    const matched = await bcrypt.compare(dto.password, user.password);
    if (!matched) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return this.buildTokenPair(user.userId, user.email, user.role);
  }

  async refresh(refreshToken: string) {
    let payload: RefreshPayload;
    try {
      payload = this.jwtService.verify<RefreshPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const storedUserId = await this.redisClient.get(
      `refresh:${payload.jti}`,
    );
    if (!storedUserId || storedUserId !== payload.sub) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    // Thu hồi refresh token cũ (rotation) trước khi cấp cặp token mới
    await this.redisClient.del(`refresh:${payload.jti}`);

    return this.buildTokenPair(payload.sub, payload.email, payload.role);
  }

  async logout(token: string) {
    const decoded = this.jwtService.decode(token) as {
      jti?: string;
      exp?: number;
    } | null;

    if (!decoded?.jti || !decoded?.exp) {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    const now = Math.floor(Date.now() / 1000);
    const ttl = decoded.exp - now;

    // Chỉ cần lưu blacklist nếu token chưa hết hạn (ttl > 0)
    if (ttl > 0) {
      await this.redisClient.set(`blacklist:${decoded.jti}`, '1', 'EX', ttl);
    }
    // access token và refresh token dùng chung jti -> thu hồi luôn refresh token
    await this.redisClient.del(`refresh:${decoded.jti}`);

    return { message: 'Đăng xuất thành công' };
  }

  private async buildTokenPair(userId: string, email: string, role: string) {
    const jti = randomUUID();
    const payload = { sub: userId, email, role, jti };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES'),
    } as any);

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES'),
    } as any);

    const decodedRefresh = this.jwtService.decode(refreshToken) as {
      exp: number;
    };
    const refreshTtl = decodedRefresh.exp - Math.floor(Date.now() / 1000);
    await this.redisClient.set(`refresh:${jti}`, userId, 'EX', refreshTtl);

    return { accessToken, refreshToken, user: { userId, email, role } };
  }
}
