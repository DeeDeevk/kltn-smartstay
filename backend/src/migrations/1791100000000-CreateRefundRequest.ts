import { MigrationInterface, QueryRunner } from 'typeorm';

// Tạo bảng RefundRequest (KAN-114) — xem chú thích đầu entity để biết vì sao không có cột
// paymentId (không có bảng Payment riêng trong hệ thống) và vì sao đây là quy trình BÁN TỰ
// ĐỘNG (không gọi API PayOS để tự hoàn tiền). Bảng hoàn toàn mới, không cần backfill.
export class CreateRefundRequest1791100000000 implements MigrationInterface {
  name = 'CreateRefundRequest1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "RefundRequest_status_enum" AS ENUM('PENDING', 'COMPLETED', 'REJECTED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "RefundRequest" (
        "refundRequestId" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "bookingId" uuid NOT NULL,
        "amount" integer NOT NULL,
        "payerBankInfo" jsonb,
        "conversationId" uuid,
        "status" "RefundRequest_status_enum" NOT NULL DEFAULT 'PENDING',
        "reason" text,
        "processedByUserId" uuid,
        "processedAt" TIMESTAMPTZ,
        "adminNote" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_RefundRequest" PRIMARY KEY ("refundRequestId"),
        CONSTRAINT "FK_RefundRequest_booking" FOREIGN KEY ("bookingId")
          REFERENCES "Booking"("bookingId") ON DELETE CASCADE,
        CONSTRAINT "FK_RefundRequest_conversation" FOREIGN KEY ("conversationId")
          REFERENCES "Conversation"("conversationId") ON DELETE SET NULL
      )
    `);
    // Trang admin mặc định lọc/hiển thị PENDING trước — index sẵn cho truy vấn đó.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_refund_request_status_created_at"
      ON "RefundRequest" ("status", "createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_refund_request_status_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "RefundRequest"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "RefundRequest_status_enum"`);
  }
}
