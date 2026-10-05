import { MigrationInterface, QueryRunner } from 'typeorm';

// Thêm cấu hình chính sách hoàn tiền theo thời điểm huỷ (KAN-117) — áp dụng chung toàn
// khách sạn (single-property, không phân biệt theo loại phòng). Default giữ gần với hành
// vi cũ: hoàn 100% nếu huỷ sớm >= 48h trước giờ nhận phòng, còn lại hoàn 50%.
export class AddCancellationPolicyToHotelConfig1791200000000
  implements MigrationInterface
{
  name = 'AddCancellationPolicyToHotelConfig1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "HotelConfig"
      ADD COLUMN IF NOT EXISTS "freeCancellationHours" integer NOT NULL DEFAULT 48,
      ADD COLUMN IF NOT EXISTS "partialRefundPercent" integer NOT NULL DEFAULT 50
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "HotelConfig"
      DROP COLUMN IF EXISTS "freeCancellationHours",
      DROP COLUMN IF EXISTS "partialRefundPercent"
    `);
  }
}
