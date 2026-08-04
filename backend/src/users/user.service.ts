import {  ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { UserRole } from 'src/common/enums/user-role.enum';
import * as bcrypt from 'bcrypt';
import { UserStatus } from 'src/common/enums/user-status.enum';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User> 
  ){}
  async create (data: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role?: UserRole;
  }): Promise<User>{
    const existed = await this.userRepo.findOne({where: {email: data.email}});
    if(existed){
      throw new ConflictException("Email đã được sử dụng");
    }
    const hashed = await bcrypt.hash(data.password, 10);
    const user = this.userRepo.create({
      ...data,
      password: hashed,
      role: data.role ?? UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
    });
    return this.userRepo.save(user);
  }
  findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    return user;
  }
}