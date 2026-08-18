import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { UserService } from '../users/user.service';
import { User } from '../users/entities/user.entity';
import { RegisterDTO } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { AuthProvider } from '../common/enums/auth-provider.enum';
import { Account } from './entities/account.entity';
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
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {
    this.googleClient = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async register(dto: RegisterDTO) {
    // Tạo User + Account(LOCAL) trong cùng 1 transaction để tránh User "mồ côi"
    // (tồn tại nhưng không có cách nào đăng nhập) nếu bước tạo Account thất bại.
    const user = await this.dataSource.transaction(async (manager) => {
      const newUser = await this.userService.create(
        { email: dto.email, fullName: dto.fullName, phone: dto.phone },
        manager,
      );

      const hashedPassword = await bcrypt.hash(dto.password, 10);
      const accountRepo = manager.getRepository(Account);
      await accountRepo.save(
        accountRepo.create({
          user: newUser,
          provider: AuthProvider.LOCAL,
          providerAccountId: newUser.email,
          password: hashedPassword,
        }),
      );

      return newUser;
    });

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

    const account = await this.accountRepo.findOne({
      where: { user: { userId: user.userId }, provider: AuthProvider.LOCAL },
    });
    if (!account?.password) {
      throw new UnauthorizedException(
        'Tài khoản này chưa đăng ký đăng nhập bằng mật khẩu',
      );
    }

    const matched = await bcrypt.compare(dto.password, account.password);
    if (!matched) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    return this.buildTokenPair(user.userId, user.email, user.role);
  }

  async loginWithGoogle(idToken: string) {
    let payload: {
      email?: string;
      email_verified?: boolean;
      sub: string;
      name?: string;
    };
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });
      const ticketPayload = ticket.getPayload();
      if (!ticketPayload) {
        throw new Error('Empty payload');
      }
      payload = ticketPayload;
    } catch {
      throw new UnauthorizedException('Google ID token không hợp lệ');
    }

    if (!payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Email Google chưa được xác thực');
    }

    const email = payload.email;
    const googleSub = payload.sub;

    const user = await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const accountRepo = manager.getRepository(Account);

      let existingUser = await userRepo.findOne({ where: { email } });
      if (!existingUser) {
        existingUser = await userRepo.save(
          userRepo.create({
            email,
            fullName: payload.name ?? email,
            role: UserRole.CUSTOMER,
            status: UserStatus.ACTIVE,
          }),
        );
      }

      if (existingUser.status === UserStatus.LOCKED) {
        throw new UnauthorizedException('Tài khoản đã bị khóa');
      }

      const existingAccount = await accountRepo.findOne({
        where: {
          user: { userId: existingUser.userId },
          provider: AuthProvider.GOOGLE,
        },
      });
      if (!existingAccount) {
        // Auto-link: email đã được Google xác thực nên đủ tin cậy để gắn
        // thêm Account(GOOGLE) vào User hiện có (kể cả nếu trước đó đăng ký bằng mật khẩu).
        await accountRepo.save(
          accountRepo.create({
            user: existingUser,
            provider: AuthProvider.GOOGLE,
            providerAccountId: googleSub,
            password: null,
          }),
        );
      }

      return existingUser;
    });

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

    const storedUserId = await this.redisClient.get(`refresh:${payload.jti}`);
    if (!storedUserId || storedUserId !== payload.sub) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }

    // Thu hồi refresh token cũ (rotation) trước khi cấp cặp token mới
    await this.redisClient.del(`refresh:${payload.jti}`);

    return this.buildTokenPair(payload.sub, payload.email, payload.role);
  }

  async getMe(userId: string) {
    return this.userService.findById(userId);
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
