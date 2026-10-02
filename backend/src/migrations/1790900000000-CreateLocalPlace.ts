import { MigrationInterface, QueryRunner } from 'typeorm';

// Tạo bảng LocalPlace — địa điểm tham quan/vui chơi/ăn uống do admin quản lý thủ công hoặc
// do AI trích xuất từ link/text, xem chú thích đầu entity để biết vì sao tách biệt hoàn
// toàn với PlacesService (Google Places). Bảng hoàn toàn mới, không có dữ liệu cũ cần
// backfill.
export class CreateLocalPlace1790900000000 implements MigrationInterface {
  name = 'CreateLocalPlace1790900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "LocalPlace_source_enum" AS ENUM('MANUAL', 'AI_SUGGESTED');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "LocalPlace_status_enum" AS ENUM('APPROVED', 'PENDING');
      EXCEPTION WHEN duplicate_object THEN null; END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "LocalPlace" (
        "placeId" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "description" text,
        "address" character varying(255),
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "addressHint" character varying(255),
        "source" "LocalPlace_source_enum" NOT NULL DEFAULT 'MANUAL',
        "status" "LocalPlace_status_enum" NOT NULL DEFAULT 'APPROVED',
        "sourceRef" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_LocalPlace" PRIMARY KEY ("placeId")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "LocalPlace"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "LocalPlace_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "LocalPlace_source_enum"`);
  }
}
