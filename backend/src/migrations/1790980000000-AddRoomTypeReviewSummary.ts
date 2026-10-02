import { MigrationInterface, QueryRunner } from 'typeorm';

// Thêm cột cache "AI tổng hợp đánh giá" cho RoomType — xem chú thích ở entity và
// RoomTypeReviewSummaryService. Cột nullable, không cần backfill dữ liệu cũ (tính lazy lúc
// khách tải trang chi tiết phòng lần đầu sau khi có tính năng).
export class AddRoomTypeReviewSummary1790980000000 implements MigrationInterface {
  name = 'AddRoomTypeReviewSummary1790980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "RoomType" ADD COLUMN IF NOT EXISTS "reviewSummary" jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "RoomType" DROP COLUMN IF EXISTS "reviewSummary"
    `);
  }
}
