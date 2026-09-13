import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

export interface WsUser {
  userId: string;
  email: string;
  role: string;
}

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  jti: string;
}

// Xác thực token cho kết nối socket — tách riêng khỏi JwtStrategy (Passport) vì
// handshake của socket.io không đi qua HTTP request pipeline nên không dùng lại
// guard HTTP được, nhưng logic verify phải giống hệt để 1 access token hết hạn/bị
// thu hồi trên HTTP thì cũng vô hiệu trên socket.
@Injectable()
export class WsAuthService {
  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async verifyToken(token: string): Promise<WsUser> {
    if (!token) {
      throw new UnauthorizedException('Thiếu token xác thực');
    }

    let payload: JwtPayload;
    try {
      payload = jwt.verify(
        token,
        this.config.get<string>('JWT_ACCESS_SECRET')!,
      ) as JwtPayload;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }

    if (payload.jti) {
      const isBlacklisted = await this.redis.get(`blacklist:${payload.jti}`);
      if (isBlacklisted) {
        throw new UnauthorizedException('Token đã bị thu hồi, vui lòng đăng nhập lại');
      }
    }

    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
