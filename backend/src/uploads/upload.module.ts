import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

// Đang lưu ảnh trên Cloudflare R2. Rollback về Cloudinary: import CloudinaryProvider và
// CloudinaryUploadService, rồi đổi providers thành
//   [{ provide: UploadService, useClass: CloudinaryUploadService }, CloudinaryProvider]
@Module({
  controllers: [UploadController],
  providers: [UploadService],
})
export class UploadModule {}
