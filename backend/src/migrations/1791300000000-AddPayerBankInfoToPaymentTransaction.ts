import { MigrationInterface, QueryRunner } from 'typeorm';

// Thêm ĐÚNG 1 cột nullable "payerBankInfo" vào PaymentTransaction (KAN-117) — PaymentTransaction
// là sổ ghi thêm dùng để chốt ca/đối soát, TUYỆT ĐỐI không đổi cột/logic hiện có của bảng
// này. Cột mới lưu thông tin tài khoản người chuyển trích được từ PayOS webhook/sync (nếu
// SDK có trả), giúp RefundRequestService biết tên người chuyển để đối chiếu khi hoàn tiền.
export class AddPayerBankInfoToPaymentTransaction1791300000000
  implements MigrationInterface
{
  name = 'AddPayerBankInfoToPaymentTransaction1791300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "payerBankInfo" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "PaymentTransaction" DROP COLUMN IF EXISTS "payerBankInfo"
    `);
  }
}
