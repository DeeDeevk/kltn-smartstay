import { Inject, Injectable } from '@nestjs/common';
import { v2 as CloudinaryType } from 'cloudinary';
import { CLOUDINARY } from './cloudinary.provider';
import { UploadedImage } from './upload.types';

// Giữ lại logic upload Cloudinary cũ để rollback nhanh nếu R2 gặp sự cố — cách bật lại
// hướng dẫn trong upload.module.ts.
@Injectable()
export class CloudinaryUploadService {
  constructor(
    @Inject(CLOUDINARY) private readonly cloudinary: typeof CloudinaryType,
  ) {}

  // Không nhận keyPrefix như UploadService (R2) — luôn lưu vào "room-types" bất kể nơi
  // gọi. Chấp nhận được vì đây chỉ là lớp dự phòng rollback, hiếm khi bật lại; nếu có
  // rollback khi đã dùng keyPrefix riêng cho ảnh chat (KAN-112), ảnh chat sẽ bị lưu lẫn
  // vào thư mục room-types cho tới khi cập nhật lại class này.
  uploadImage(file: Express.Multer.File): Promise<UploadedImage> {
    return new Promise((resolve, reject) => {
      const stream = this.cloudinary.uploader.upload_stream(
        { folder: 'vikahotel/room-types', resource_type: 'image' },
        (error, result) => {
          if (error || !result) {
            return reject(new Error(error?.message ?? 'Cloudinary upload lỗi'));
          }
          resolve({ url: result.secure_url, publicId: result.public_id });
        },
      );
      stream.end(file.buffer);
    });
  }
}
