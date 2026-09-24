import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';

// DataSource riêng cho TypeORM CLI (npm run migration:*) — app Nest tự cấu hình kết nối
// trong app.module.ts nên file này KHÔNG được app import. Dùng cùng các biến DB_* để CLI
// trỏ đúng database mà app đang chạy. synchronize luôn tắt: schema chỉ đổi qua migration.
// Glob theo __dirname để chạy được cả từ src (ts-node) lẫn dist (node, dùng trên server).
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [join(__dirname, '**/*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  synchronize: false,
});
