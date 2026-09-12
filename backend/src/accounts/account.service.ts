import {
  BadRequestException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { Account } from './entities/account.entity';
import { User } from '../users/entities/user.entity';
import { AuthProvider } from '../common/enums/auth-provider.enum';
import { REDIS_CLIENT } from '../redis/redis.module';

// Sở hữu entity Account (liên kết tài khoản đăng nhập LOCAL/GOOGLE của 1 User).
// Auth và User cùng cần đọc/ghi Account nên tách ra module riêng thay vì để 2
// module kia inject thẳng repository — giữ đúng ranh giới modular monolith.
@Injectable()
export class AccountService {
  constructor(
    @InjectRepository(Account)
    private readonly accountRepo: Repository<Account>,
    @Inject(REDIS_CLIENT) private readonly redisClient: Redis,
  ) {}

  private repo(manager?: EntityManager): Repository<Account> {
    return manager ? manager.getRepository(Account) : this.accountRepo;
  }

  findLocalByUserId(userId: string): Promise<Account | null> {
    return this.accountRepo.findOne({
      where: { user: { userId }, provider: AuthProvider.LOCAL },
    });
  }

  findByUserIdAndProvider(
    userId: string,
    provider: AuthProvider,
    manager?: EntityManager,
  ): Promise<Account | null> {
    return this.repo(manager).findOne({
      where: { user: { userId }, provider },
    });
  }

  async listProvidersByUserId(userId: string): Promise<AuthProvider[]> {
    const accounts = await this.accountRepo.find({
      where: { user: { userId } },
    });
    return accounts.map((account) => account.provider);
  }

  createLocal(
    data: { user: User; providerAccountId: string; passwordHash: string },
    manager?: EntityManager,
  ): Promise<Account> {
    const repo = this.repo(manager);
    return repo.save(
      repo.create({
        user: data.user,
        provider: AuthProvider.LOCAL,
        providerAccountId: data.providerAccountId,
        password: data.passwordHash,
      }),
    );
  }

  createGoogle(
    data: { user: User; providerAccountId: string },
    manager?: EntityManager,
  ): Promise<Account> {
    const repo = this.repo(manager);
    return repo.save(
      repo.create({
        user: data.user,
        provider: AuthProvider.GOOGLE,
        providerAccountId: data.providerAccountId,
        password: null,
      }),
    );
  }

  async updatePassword(account: Account, passwordHash: string): Promise<void> {
    account.password = passwordHash;
    await this.accountRepo.save(account);
  }

  // Luồng đổi mật khẩu chuyển nguyên vẹn từ UserService.changePassword — cùng
  // thông báo lỗi, cùng việc gỡ cờ Redis "bắt buộc đổi mật khẩu".
  async changeLocalPassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const account = await this.findLocalByUserId(userId);
    if (!account?.password) {
      throw new BadRequestException(
        'Tài khoản này chưa đăng ký đăng nhập bằng mật khẩu',
      );
    }

    const matched = await bcrypt.compare(oldPassword, account.password);
    if (!matched) {
      throw new UnauthorizedException('Mật khẩu cũ không đúng');
    }

    account.password = await bcrypt.hash(newPassword, 10);
    await this.accountRepo.save(account);
    await this.redisClient.del(`must-change-password:${userId}`);
  }
}
