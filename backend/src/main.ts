// Cố định múi giờ khách sạn trước mọi thao tác Date: khung giờ ca, "hôm nay" và các
// cột timestamp (không tz) đều đọc theo giờ local — server deploy thường chạy UTC.
process.env.TZ = process.env.TZ ?? 'Asia/Ho_Chi_Minh';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  // Đọc cookie (refresh token httpOnly) vào req.cookies.
  app.use(cookieParser());
  // CORS_ORIGIN nhận nhiều domain cách nhau bằng dấu phẩy (vd. domain Vercel chính
  // + localhost khi dev). credentials: true để trình duyệt gửi/nhận cookie khi frontend
  // gọi API khác cổng/domain — khi đó origin bắt buộc phải liệt kê cụ thể, không dùng "*".
  app.enableCors({
    origin: configService
      .get<string>('CORS_ORIGIN', 'http://localhost:5173')
      .split(',')
      .map((origin) => origin.trim()),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  await app.listen(configService.get<string>('PORT') ?? 3000);
}
bootstrap();
