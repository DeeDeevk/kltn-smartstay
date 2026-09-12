import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { UserModule } from './users/user.module';
import { AuthModule } from './auth/auth.module';
import { RedisModule } from './redis/redis.module';
import { ReservationsModule } from './reservations/reservations.module';
import { ServiceModule } from './services/service.module';
import { PromotionModule } from './promotions/promotion.module';
import { UploadModule } from './uploads/upload.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { PaymentModule } from './payments/payment.module';
import { ShiftModule } from './shifts/shift.module';
import { RevenueModule } from './revenue/revenue.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }]),
    RedisModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: true,
        synchronize: config.get<string>('DB_SYNCHRONIZE') === 'true',
      }),
    }),
    UserModule,
    AuthModule,
    ReservationsModule,
    ServiceModule,
    PromotionModule,
    DashboardModule,
    UploadModule,
    PaymentModule,
    ShiftModule,
    RevenueModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
