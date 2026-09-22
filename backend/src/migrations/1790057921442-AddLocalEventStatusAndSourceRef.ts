import { MigrationInterface, QueryRunner } from 'typeorm';

// Thêm 2 cột mà luồng xem-duyệt sự kiện do AI đề xuất cần (xem enum LocalEventStatus và
// LocalEventExtractionService): cổng chặn pending/approved để get_local_events không bao
// giờ lộ ra cho khách 1 đề xuất AI chưa được xem lại, và sourceRef để admin đối chiếu đề
// xuất với text/link gốc lúc duyệt. Dòng dữ liệu cũ (toàn bộ 'manual', có từ trước tính
// năng này) tự nhận status='approved' qua giá trị DEFAULT của cột — không cần chạy UPDATE
// backfill, vì chúng vốn đã coi như "đã duyệt" do được tạo trực tiếp qua form CRUD admin.
// Dùng IF NOT EXISTS / IF EXISTS xuyên suốt để chạy an toàn kể cả khi DB_SYNCHRONIZE đã
// tự tạo sẵn 2 cột này từ entity ở môi trường dev.
export class AddLocalEventStatusAndSourceRef1790057921442 implements MigrationInterface {
  name = 'AddLocalEventStatusAndSourceRef1790057921442';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "LocalEvent_status_enum" AS ENUM('approved', 'pending');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      ALTER TABLE "LocalEvent"
      ADD COLUMN IF NOT EXISTS "status" "LocalEvent_status_enum" NOT NULL DEFAULT 'approved'
    `);
    await queryRunner.query(`
      ALTER TABLE "LocalEvent"
      ADD COLUMN IF NOT EXISTS "sourceRef" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "LocalEvent" DROP COLUMN IF EXISTS "sourceRef"`,
    );
    await queryRunner.query(
      `ALTER TABLE "LocalEvent" DROP COLUMN IF EXISTS "status"`,
    );
    await queryRunner.query(`DROP TYPE IF EXISTS "LocalEvent_status_enum"`);
  }
}
