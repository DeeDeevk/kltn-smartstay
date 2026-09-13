import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (configService: ConfigService) => {
        // REDIS_URL (vd. redis://... hoặc rediss://... có mật khẩu/TLS của Render Key
        // Value, Upstash) ưu tiên hơn REDIS_HOST/REDIS_PORT dùng khi chạy local.
        const url = configService.get<string>('REDIS_URL');
        if (url) {
          return new Redis(url);
        }
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
        });
      },
      inject: [ConfigService],
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
