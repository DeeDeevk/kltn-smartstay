import { MigrationInterface, QueryRunner } from 'typeorm';

// Thêm cột đính kèm ảnh cho Message (KAN-112) — khách gửi ảnh chụp QR chuyển khoản để
// nhân viên xác minh bằng mắt qua chat, xem chú thích ở Message entity. content đổi sang
// có default '' để các dòng cũ (đã NOT NULL, chỉ có text) không bị ảnh hưởng; dòng mới chỉ
// có ảnh thì content rỗng, KHÔNG dùng content NULL để tránh đổi kiểu cột đang dùng ổn định.
export class AddMessageAttachment1791000000000 implements MigrationInterface {
  name = 'AddMessageAttachment1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "Message_attachmentType_enum" AS ENUM('IMAGE');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "Message" ALTER COLUMN "content" SET DEFAULT ''
    `);
    await queryRunner.query(`
      ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentUrl" varchar
    `);
    await queryRunner.query(`
      ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachmentType" "Message_attachmentType_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "Message" DROP COLUMN IF EXISTS "attachmentType"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Message" DROP COLUMN IF EXISTS "attachmentUrl"`,
    );
    await queryRunner.query(
      `ALTER TABLE "Message" ALTER COLUMN "content" DROP DEFAULT`,
    );
    await queryRunner.query(
      `DROP TYPE IF EXISTS "Message_attachmentType_enum"`,
    );
  }
}
