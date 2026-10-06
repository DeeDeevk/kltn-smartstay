import { MigrationInterface, QueryRunner } from 'typeorm';

// Thêm cấu hình SLA xử lý hoàn tiền (KAN-122) — cùng nhóm với freeCancellationHours/
// partialRefundPercent (KAN-117). Quá số giờ này mà RefundRequest vẫn PENDING thì FE hiện
// nút "Liên hệ lễ tân" cho khách thay vì để khách chờ im lặng không biết khi nào mới xử lý.
export class AddRefundProcessingSlaHoursToHotelConfig1791500000000
  implements MigrationInterface
{
  name = 'AddRefundProcessingSlaHoursToHotelConfig1791500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "HotelConfig"
      ADD COLUMN IF NOT EXISTS "refundProcessingSlaHours" integer NOT NULL DEFAULT 24
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "HotelConfig" DROP COLUMN IF EXISTS "refundProcessingSlaHours"
    `);
  }
}
