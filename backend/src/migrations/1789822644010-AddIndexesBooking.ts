import { MigrationInterface, QueryRunner } from 'typeorm';

// Index cho các truy vấn nóng trên bảng "Booking" (xem chú thích @Index trong
// booking.entity.ts). IF NOT EXISTS / IF EXISTS để chạy an toàn trên database đã được
// DB_SYNCHRONIZE tạo sẵn cùng tên index từ entity.
export class AddIndexesBooking1789822644010 implements MigrationInterface {
  name = 'AddIndexesBooking1789822644010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_room_type_status_checkin" ON "Booking" ("roomTypeId", "status", "checkInDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_room_status_checkin" ON "Booking" ("roomId", "status", "checkInDate")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_user_created_at" ON "Booking" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_status_created_at" ON "Booking" ("status", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_booking_status_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_booking_user_created_at"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_booking_room_status_checkin"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_booking_room_type_status_checkin"`,
    );
  }
}
