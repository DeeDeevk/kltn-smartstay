import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { EntityManager, Repository } from 'typeorm';
import { UserRole } from 'src/common/enums/user-role.enum';
import { UserStatus } from 'src/common/enums/user-status.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // manager: truyền vào khi cần gộp chung transaction với việc tạo Account (đăng ký)
  async create(
    data: {
      email: string;
      fullName: string;
      phone?: string;
      role?: UserRole;
    },
    manager?: EntityManager,
  ): Promise<User> {
    const repo = manager ? manager.getRepository(User) : this.userRepo;
    const existed = await repo.findOne({ where: { email: data.email } });
    if (existed) {
      throw new ConflictException('Email đã được sử dụng');
    }
    const user = repo.create({
      ...data,
      role: data.role ?? UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });
    return repo.save(user);
  }
  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  async updateProfile(
    userId: string,
    data: {
      fullName?: string;
      phone?: string;
      address?: string;
      idNumber?: string;
    },
  ): Promise<User> {
    await this.userRepo.update({ userId }, data);
    return this.findById(userId);
  }
}
