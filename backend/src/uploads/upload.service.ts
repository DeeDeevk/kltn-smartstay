import { randomUUID } from 'node:crypto';
import { parse } from 'node:path';
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { UploadedImage } from './upload.types';

const KEY_PREFIX = 'vikahotel/room-types';
const MAX_NAME_LENGTH = 60;
// Ảnh gốc từ điện thoại/máy ảnh có thể tới 5 MB (giới hạn của controller) — khách chỉ
// xem trong khung tối đa vài trăm px nên thu về chiều rộng 1600px và nén WebP. R2 không
// tự resize như Cloudinary trước đây, nên phải làm ở bước upload.
const MAX_IMAGE_WIDTH = 1600;
const WEBP_QUALITY = 82;
const IMAGE_EXTENSION = '.webp';
const IMAGE_CONTENT_TYPE = 'image/webp';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    const endpoint = this.requireEnv('R2_ENDPOINT');
    this.bucket = this.requireEnv('R2_BUCKET_NAME');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint,
      credentials: {
        accessKeyId: this.requireEnv('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.requireEnv('R2_SECRET_ACCESS_KEY'),
      },
      // AWS SDK bản mới tự thêm header checksum mặc định mà R2 không phải lúc nào
      // cũng chấp nhận — chỉ tính checksum khi API bắt buộc.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });

    const publicUrl = this.config.get<string>('R2_PUBLIC_URL')?.trim();
    if (publicUrl) {
      this.publicBaseUrl = publicUrl.replace(/\/+$/, '');
    } else {
      // Endpoint S3 của R2 yêu cầu chữ ký nên trình duyệt không mở được URL này —
      // chỉ dùng tạm cho tới khi cấu hình domain public hoặc bucket public URL.
      this.publicBaseUrl = `${endpoint.replace(/\/+$/, '')}/${this.bucket}`;
      this.logger.warn(
        'Chưa cấu hình R2_PUBLIC_URL: URL ảnh trả về sẽ không truy cập công khai được.',
      );
    }
  }

  async uploadImage(file: Express.Multer.File): Promise<UploadedImage> {
    const body = await this.optimizeImage(file.buffer);
    const key = this.buildKey(file);
    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: IMAGE_CONTENT_TYPE,
        }),
      );
    } catch (error) {
      this.logger.error(
        `Upload ảnh lên R2 thất bại (key=${key}): ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException(
        'Không thể tải ảnh lên, vui lòng thử lại',
      );
    }
    return { url: `${this.publicBaseUrl}/${key}`, publicId: key };
  }

  // Không phóng to ảnh nhỏ; rotate() áp dụng hướng xoay EXIF của ảnh chụp bằng điện thoại
  // (nếu không ảnh sẽ bị nằm ngang) và việc ghi lại ảnh sẽ bỏ luôn metadata EXIF như vị
  // trí GPS. File không giải mã được là ảnh (đuôi/mimetype giả) bị từ chối.
  private async optimizeImage(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .rotate()
        .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();
    } catch {
      throw new UnprocessableEntityException(
        'File tải lên không phải ảnh hợp lệ',
      );
    }
  }

  // uuid đảm bảo không trùng key; phần tên gốc chỉ để dễ nhận biết file khi xem trong
  // bucket nên được ép về ASCII an toàn cho URL (multer còn giải mã sai tên tiếng Việt).
  private buildKey(file: Express.Multer.File): string {
    const { name } = parse(file.originalname);
    const slug = name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, MAX_NAME_LENGTH);
    return `${KEY_PREFIX}/${randomUUID()}${slug ? `-${slug}` : ''}${IMAGE_EXTENSION}`;
  }

  private requireEnv(name: string): string {
    const value = this.config.get<string>(name);
    if (!value) {
      throw new InternalServerErrorException(`Thiếu biến môi trường ${name}`);
    }
    return value;
  }
}
