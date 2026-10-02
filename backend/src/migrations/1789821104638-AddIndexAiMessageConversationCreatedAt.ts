import { MigrationInterface, QueryRunner } from 'typeorm';

// Index cho truy vấn tải lịch sử hội thoại của ai-agent:
//   WHERE "conversationId" = ? ORDER BY "createdAt" [DESC] LIMIT n
// IF NOT EXISTS / IF EXISTS để chạy an toàn trên database đã có sẵn index (VD môi trường
// bật DB_SYNCHRONIZE đã tự tạo từ @Index trong entity — tên index giống hệt nhau).
export class AddIndexAiMessageConversationCreatedAt1789821104638 implements MigrationInterface {
  name = 'AddIndexAiMessageConversationCreatedAt1789821104638';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_ai_message_conversation_created_at" ON "AiMessage" ("conversationId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_ai_message_conversation_created_at"`,
    );
  }
}
