import {
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { PutObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { UploadService } from './upload.service';

const ENV: Record<string, string> = {
  R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  R2_BUCKET_NAME: 'smartstay',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_PUBLIC_URL: 'https://pub-test.r2.dev/',
};

function makeService() {
  const service = new UploadService({
    get: (name: string) => ENV[name],
  } as unknown as ConfigService);
  // Thay S3Client thật bằng mock để test không gọi mạng.
  const send = jest.fn().mockResolvedValue({});
  (service as unknown as { s3: { send: jest.Mock } }).s3 = { send };
  return { service, send };
}

function makeFile(buffer: Buffer, originalname = 'Phòng đẹp.PNG') {
  return { buffer, originalname, mimetype: 'image/png' } as Express.Multer.File;
}

function solidPng(width: number, height: number) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 30, b: 30 },
    },
  })
    .png()
    .toBuffer();
}

describe('UploadService', () => {
  it('thu ảnh lớn về rộng 1600px, đổi sang WebP và trả url/publicId theo R2_PUBLIC_URL', async () => {
    const { service, send } = makeService();
    const original = await solidPng(3200, 2400);

    const result = await service.uploadImage(makeFile(original));

    const command = (send.mock.calls[0] as [PutObjectCommand])[0];
    const body = command.input.Body as Buffer;
    const meta = await sharp(body).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1600);
    expect(meta.height).toBe(1200);
    expect(command.input.ContentType).toBe('image/webp');
    expect(command.input.Bucket).toBe('smartstay');

    expect(result.publicId).toMatch(
      /^vikahotel\/room-types\/[0-9a-f-]{36}-phong-dep\.webp$/,
    );
    expect(result.url).toBe(`https://pub-test.r2.dev/${result.publicId}`);
  });

  it('không phóng to ảnh nhỏ hơn 1600px', async () => {
    const { service, send } = makeService();

    await service.uploadImage(makeFile(await solidPng(400, 300)));

    const command = (send.mock.calls[0] as [PutObjectCommand])[0];
    const meta = await sharp(command.input.Body as Buffer).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });

  it('từ chối file không phải ảnh thật (422) và không gọi R2', async () => {
    const { service, send } = makeService();

    await expect(
      service.uploadImage(makeFile(Buffer.from('đây không phải ảnh'))),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
    expect(send).not.toHaveBeenCalled();
  });

  it('R2 lỗi thì trả 500 với thông báo chung, không lộ chi tiết nội bộ', async () => {
    const { service, send } = makeService();
    send.mockRejectedValueOnce(new Error('AccessDenied: secret details'));

    const error = await service
      .uploadImage(makeFile(await solidPng(100, 100)))
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InternalServerErrorException);
    expect((error as Error).message).toBe(
      'Không thể tải ảnh lên, vui lòng thử lại',
    );
  });
});
