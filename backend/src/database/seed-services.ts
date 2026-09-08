import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Service } from '../services/entities/service.entity';
import { ServiceCategory } from '../common/enums/service-category.enum';

type SeedService = Pick<
  Service,
  'name' | 'description' | 'price' | 'unit' | 'category'
>;

const SERVICES: SeedService[] = [
  // Minibar — đồ trong phòng
  {
    name: 'Nước suối',
    description: 'Nước tinh khiết đóng chai 500ml',
    price: 0,
    unit: 'chai',
    category: ServiceCategory.MINIBAR,
  },
  {
    name: 'Trà túi lọc',
    description: 'Trà túi lọc pha nóng',
    price: 10000,
    unit: 'gói',
    category: ServiceCategory.MINIBAR,
  },
  {
    name: 'Nước ngọt',
    description: 'Coca / Pepsi / 7Up lon 330ml',
    price: 15000,
    unit: 'lon',
    category: ServiceCategory.MINIBAR,
  },
  {
    name: 'Snack các loại',
    description: 'Bánh snack / hạt điều / khô bò',
    price: 25000,
    unit: 'gói',
    category: ServiceCategory.MINIBAR,
  },
  {
    name: 'Bia lon',
    description: 'Heineken / Tiger lon 330ml',
    price: 30000,
    unit: 'lon',
    category: ServiceCategory.MINIBAR,
  },
  // Dịch vụ khác
  {
    name: 'Đưa đón sân bay (4 chỗ)',
    description: 'Xe 4 chỗ đưa hoặc đón sân bay',
    price: 350000,
    unit: 'lượt',
    category: ServiceCategory.SERVICE,
  },
  {
    name: 'Đưa đón sân bay (7 chỗ)',
    description: 'Xe 7 chỗ đưa hoặc đón sân bay',
    price: 500000,
    unit: 'lượt',
    category: ServiceCategory.SERVICE,
  },
  {
    name: 'Buffet sáng cao cấp',
    description: 'Buffet sáng tại nhà hàng khách sạn',
    price: 250000,
    unit: 'người',
    category: ServiceCategory.SERVICE,
  },
  {
    name: 'Giặt ủi',
    description: 'Dịch vụ giặt ủi lấy trong ngày',
    price: 50000,
    unit: 'kg',
    category: ServiceCategory.SERVICE,
  },
  {
    name: 'Thuê xe máy',
    description: 'Xe máy số / tay ga kèm mũ bảo hiểm',
    price: 150000,
    unit: 'ngày',
    category: ServiceCategory.SERVICE,
  },
  {
    name: 'Spa & Massage',
    description: 'Liệu trình massage thư giãn 60 phút',
    price: 400000,
    unit: 'lượt',
    category: ServiceCategory.SERVICE,
  },
];

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [Service],
    // Tự thêm cột "category" mới vào bảng Service nếu backend chưa chạy sync.
    synchronize: true,
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(Service);

  for (const data of SERVICES) {
    const existing = await repo.findOne({ where: { name: data.name } });
    if (existing) {
      Object.assign(existing, data, { isActive: true });
      await repo.save(existing);
      console.log(`Đã cập nhật dịch vụ: ${data.name}`);
    } else {
      await repo.save(repo.create({ ...data, isActive: true }));
      console.log(`Đã tạo dịch vụ: ${data.name}`);
    }
  }

  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Seed dịch vụ thất bại:', err);
  process.exit(1);
});
