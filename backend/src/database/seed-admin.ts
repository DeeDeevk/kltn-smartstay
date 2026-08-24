import 'dotenv/config';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/entities/user.entity';
import { Account } from '../auth/entities/account.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { UserStatus } from '../common/enums/user-status.enum';
import { AuthProvider } from '../auth/enums/auth-provider.enum';

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [User, Account],
  });

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);
  const accountRepo = dataSource.getRepository(Account);

  const email = 'admin@vikahotel.com'; // đổi email bạn muốn
  const plainPassword = 'Admin@123'; // đổi password bạn muốn
  const hashed = await bcrypt.hash(plainPassword, 10);

  let user = await userRepo.findOne({ where: { email } });
  if (!user) {
    user = await userRepo.save(
      userRepo.create({
        email,
        fullName: 'Administrator', // tự động, không cần nhập tay
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
      }),
    );
  }

  let account = await accountRepo.findOne({
    where: { user: { userId: user.userId }, provider: AuthProvider.LOCAL },
  });
  if (account) {
    account.password = hashed;
  } else {
    account = accountRepo.create({
      user,
      provider: AuthProvider.LOCAL,
      providerAccountId: user.email,
      password: hashed,
    });
  }
  await accountRepo.save(account);

  console.log(
    `Đã tạo/cập nhật tài khoản Admin: ${email} / mật khẩu: ${plainPassword}`,
  );
  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Tạo Admin thất bại:', err);
  process.exit(1);
});
