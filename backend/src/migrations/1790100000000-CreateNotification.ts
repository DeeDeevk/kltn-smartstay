import { MigrationInterface, QueryRunner } from 'typeorm';

// Bảng thông báo in-app cho khách hàng (xem NotificationModule). Dùng IF NOT EXISTS
// để chạy an toàn cả khi DB_SYNCHRONIZE đã tự tạo bảng từ entity ở môi trường dev.
export class CreateNotification1790100000000 implements MigrationInterface {
  name = 'CreateNotification1790100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "Notification" (
        "notificationId" uuid NOT NULL DEFAULT gen_random_uuid(),
        "userId" uuid NOT NULL,
        "type" character varying(40) NOT NULL,
        "title" character varying(200) NOT NULL,
        "body" text NOT NULL,
        "bookingId" uuid,
        "isRead" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_Notification_notificationId" PRIMARY KEY ("notificationId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_Notification_userId_createdAt"
      ON "Notification" ("userId", "createdAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_Notification_userId_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "Notification"`);
  }
}
