import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFavoriteRoomType1791600000000 implements MigrationInterface {
  name = 'CreateFavoriteRoomType1791600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "FavoriteRoomType" (
        "userId" uuid NOT NULL,
        "roomTypeId" uuid NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_FavoriteRoomType" PRIMARY KEY ("userId", "roomTypeId"),
        CONSTRAINT "FK_FavoriteRoomType_user" FOREIGN KEY ("userId")
          REFERENCES "User"("userId") ON DELETE CASCADE,
        CONSTRAINT "FK_FavoriteRoomType_roomType" FOREIGN KEY ("roomTypeId")
          REFERENCES "RoomType"("roomTypeId") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "FavoriteRoomType"`);
  }
}
