import { MigrationInterface, QueryRunner } from 'typeorm';

// Lưu % đã áp dụng khi tạo RefundRequest (KAN-117) — dữ liệu cũ (tạo trước khi có chính
// sách theo thời điểm huỷ) luôn hoàn 100% paidAmount nên backfill mặc định 100 là đúng
// thực tế, không cần script backfill riêng.
export class AddRefundPercentToRefundRequest1791200000001
  implements MigrationInterface
{
  name = 'AddRefundPercentToRefundRequest1791200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "RefundRequest"
      ADD COLUMN IF NOT EXISTS "refundPercent" integer NOT NULL DEFAULT 100
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "RefundRequest" DROP COLUMN IF EXISTS "refundPercent"
    `);
  }
}
