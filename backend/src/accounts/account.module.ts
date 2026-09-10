import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Account } from './entities/account.entity';
import { AccountService } from './account.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([Account]), RedisModule],
  providers: [AccountService],
  exports: [AccountService],
})
export class AccountModule {}
