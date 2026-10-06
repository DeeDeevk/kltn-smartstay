import { MigrationInterface, QueryRunner } from 'typeorm';

// Thêm cột nullable "proofImageUrl" vào RefundRequest — ảnh biên lai/QR chuyển khoản admin
// đính kèm khi đánh dấu đã hoàn tiền, làm bằng chứng cho việc chuyển khoản thủ công. KHÔNG
// BẮT BUỘC (một số admin chuyển bằng app ngân hàng không tiện chụp lại ngay).
export class AddProofImageUrlToRefundRequest1791400000000
  implements MigrationInterface
{
  name = 'AddProofImageUrlToRefundRequest1791400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "RefundRequest" ADD COLUMN IF NOT EXISTS "proofImageUrl" varchar
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "RefundRequest" DROP COLUMN IF EXISTS "proofImageUrl"
    `);
  }
}
