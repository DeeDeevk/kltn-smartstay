import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';

// Đang lưu ảnh trên Cloudflare R2. Rollback về Cloudinary: import CloudinaryProvider và
// CloudinaryUploadService, rồi đổi providers thành
//   [{ provide: UploadService, useClass: CloudinaryUploadService }, CloudinaryProvider]
@Module({
  controllers: [UploadController],
  providers: [UploadService],
  // Để ChatModule tái dùng UploadService.uploadImage() trực tiếp (ảnh đính kèm chat,
  // KAN-112) thay vì gọi qua HTTP nội bộ tới POST /uploads/image — endpoint đó chỉ cho
  // ADMIN (ảnh phòng), trong khi khách hàng cũng cần gửi được ảnh trong chat.
  exports: [UploadService],
})
export class UploadModule {}
