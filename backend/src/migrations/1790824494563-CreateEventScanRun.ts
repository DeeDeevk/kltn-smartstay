import { MigrationInterface, QueryRunner } from 'typeorm';

// Tạo bảng EventScanRun — nhật ký mỗi lần LocalEventAutoScanService chạy (thủ công hoặc
// cron hàng tuần), xem chú thích đầu entity để biết vì sao tách bảng riêng với LocalEvent.
// Bảng hoàn toàn mới, không có dữ liệu cũ cần backfill.
export class CreateEventScanRun1790824494563 implements MigrationInterface {
  name = 'CreateEventScanRun1790824494563';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "EventScanRun_triggeredBy_enum" AS ENUM('MANUAL', 'CRON');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "EventScanRun_status_enum" AS ENUM('SUCCESS', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "EventScanRun" (
        "scanRunId" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "fromDate" date NOT NULL,
        "toDate" date NOT NULL,
        "triggeredBy" "EventScanRun_triggeredBy_enum" NOT NULL,
        "triggeredByUserId" uuid,
        "status" "EventScanRun_status_enum" NOT NULL,
        "errorMessage" text,
        "citations" jsonb NOT NULL DEFAULT '[]',
        "createdEventsCount" integer NOT NULL DEFAULT 0,
        "skippedDuplicateCount" integer NOT NULL DEFAULT 0,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_EventScanRun" PRIMARY KEY ("scanRunId")
      )
    `);
    // Trang "Lịch sử quét" luôn sort theo createdAt giảm dần — index sẵn cho truy vấn đó.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_event_scan_run_created_at"
      ON "EventScanRun" ("createdAt" DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_event_scan_run_created_at"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "EventScanRun"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "EventScanRun_status_enum"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "EventScanRun_triggeredBy_enum"`,
    );
  }
}
