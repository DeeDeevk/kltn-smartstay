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
import { AuthProvider } from 'src/common/enums/auth-provider.enum';
import { QueryUserDto } from './dto/query-user.dto';
import { AccountService } from '../accounts/account.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly accountService: AccountService,
  ) {}

  // manager: truyền vào khi cần gộp chung transaction với việc tạo Account (đăng ký)
  async create(
    data: {
      email: string;
      fullName: string;
      phone?: string;
      idNumber?: string;
      address?: string;
      role?: UserRole;
    },
    manager?: EntityManager,
  ): Promise<User> {
    const repo = manager ? manager.getRepository(User) : this.userRepo;
    const existed = await repo.findOne({ where: { email: data.email } });
    if (existed) {
      throw new ConflictException('Email đã được sử dụng');
    }
    if (data.phone) {
      const existedPhone = await repo.findOne({
        where: { phone: data.phone },
      });
      if (existedPhone) {
        throw new ConflictException('Số điện thoại đã được sử dụng');
      }
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

  findByPhone(phone: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phone } });
  }

  async findById(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }

  // Dùng riêng cho màn chi tiết của Admin (vd. Quản lý nhân viên) — kèm theo
  // danh sách phương thức đăng nhập (LOCAL/GOOGLE) mà GET /users/:id thường không cần,
  // nên tách khỏi findById() để không kéo thêm query cho các nơi khác đang gọi nó
  // (getMe, refresh, updateRole, updateStatus...).
  async findDetailForAdmin(
    userId: string,
  ): Promise<User & { authProviders: AuthProvider[] }> {
    const user = await this.findById(userId);
    const authProviders = await this.accountService.listProvidersByUserId(userId);
    return { ...user, authProviders };
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
    if (data.phone) {
      const existedPhone = await this.userRepo.findOne({
        where: { phone: data.phone },
      });
      if (existedPhone && existedPhone.userId !== userId) {
        throw new ConflictException('Số điện thoại đã được sử dụng');
      }
    }
    await this.userRepo.update({ userId }, data);
    return this.findById(userId);
  }

  async findAll(query: QueryUserDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const qb = this.userRepo.createQueryBuilder('user');

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }
    if (query.status) {
      qb.andWhere('user.status = :status', { status: query.status });
    }
    if (query.search) {
      qb.andWhere(
        '(user.fullName ILIKE :search OR user.email ILIKE :search OR user.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const [data, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  // Số lượng user gom theo vai trò — phục vụ DashboardService (thống kê tổng quan)
  // mà không để module Dashboard truy cập thẳng repository User.
  countGroupedByRole(): Promise<Array<{ group: string; count: string }>> {
    return this.userRepo
      .createQueryBuilder('user')
      .select('user.role', 'group')
      .addSelect('COUNT(*)', 'count')
      .groupBy('user.role')
      .getRawMany<{ group: string; count: string }>();
  }

  async updateRole(userId: string, role: UserRole): Promise<User> {
    await this.findById(userId);
    await this.userRepo.update({ userId }, { role });
    return this.findById(userId);
  }

  async updateStatus(userId: string, status: UserStatus): Promise<User> {
    await this.findById(userId);
    await this.userRepo.update({ userId }, { status });
    return this.findById(userId);
  }

  changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Mật khẩu thuộc về Account (module accounts) — uỷ quyền để không truy cập
    // repository của module khác từ đây.
    return this.accountService.changeLocalPassword(
      userId,
      oldPassword,
      newPassword,
    );
  }
}
