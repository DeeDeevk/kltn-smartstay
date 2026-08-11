import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [User],
  });

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);

  const email = 'admin@vikahotel.com'; // đổi email bạn muốn
  const plainPassword = 'Admin@123'; // đổi password bạn muốn

  const existed = await userRepo.findOne({ where: { email } });
  if (existed) {
    const hashed = await bcrypt.hash(plainPassword, 10);
    existed.password = hashed;
    await userRepo.save(existed);
    console.log(`Đã cập nhật lại mật khẩu cho: ${email}`);
    await dataSource.destroy();
    return;
  }

  const hashed = await bcrypt.hash(plainPassword, 10);
  const admin = userRepo.create({
    email,
    password: hashed,
    fullName: 'Administrator', // tự động, không cần nhập tay
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  });
  await userRepo.save(admin);

  console.log(`Đã tạo tài khoản Admin: ${email} / mật khẩu: ${plainPassword}`);
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Tạo Admin thất bại:', err);
  process.exit(1);
});
