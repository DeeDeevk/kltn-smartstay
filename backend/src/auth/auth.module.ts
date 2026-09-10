import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { UserModule } from '../users/user.module';
import { AccountModule } from '../accounts/account.module';
import { RedisModule } from '../redis/redis.module';
import { MailModule } from '../mail/mail.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UserModule,
    AccountModule,
    PassportModule,
    JwtModule.register({}),
    RedisModule,
    MailModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
