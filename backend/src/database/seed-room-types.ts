import 'dotenv/config';
import { DataSource } from 'typeorm';
import { RoomType } from '../room-types/entities/room-type.entity';
import { RoomTypeStatus } from '../common/enums/room-type-status.enum';

const ROOM_TYPES: Array<
  Pick<
    RoomType,
    'name' | 'description' | 'basePrice' | 'capacity' | 'amenities' | 'images'
  >
> = [
  {
    name: 'Standard Room',
    description:
      'Lựa chọn tiết kiệm và thoải mái nhất, phù hợp cho khách đi công tác hoặc nghỉ ngắn ngày. Giường Queen êm ái, không gian gọn gàng, đầy đủ tiện nghi cơ bản.',
    basePrice: 1200000,
    capacity: 2,
    amenities: [
      'Giường Queen',
      'Diện tích 22m²',
      'Wifi miễn phí',
      'Điều hòa',
      'TV màn hình phẳng',
    ],
    images: [
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    name: 'Deluxe Room',
    description:
      'Không gian rộng rãi hơn với tầm nhìn đẹp, lựa chọn giường King hoặc 2 giường đơn linh hoạt theo nhu cầu. Phù hợp cho cặp đôi hoặc khách muốn tận hưởng kỳ nghỉ thoải mái hơn.',
    basePrice: 1800000,
    capacity: 3,
    amenities: [
      'Giường King hoặc 2 giường đơn',
      'Diện tích 30m²',
      'Tầm nhìn đẹp',
      'Wifi miễn phí',
      'Điều hòa',
      'TV màn hình phẳng',
      'Minibar',
    ],
    images: [
      'https://images.unsplash.com/photo-1560185893-a55cbc8c57e8?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    name: 'Family Suite',
    description:
      'Căn hộ suite với 1-2 phòng ngủ riêng biệt, không gian sinh hoạt chung thoải mái — lựa chọn lý tưởng cho gia đình hoặc nhóm bạn đi du lịch cùng nhau.',
    basePrice: 2800000,
    capacity: 4,
    amenities: [
      '1-2 phòng ngủ riêng',
      'Diện tích 45m²',
      'Phòng khách riêng',
      'Wifi miễn phí',
      'Điều hòa',
      'TV màn hình phẳng',
      'Minibar',
    ],
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    name: 'Executive Suite',
    description:
      'Hạng phòng cao cấp nhất tại Vika Hotel, dành riêng cho những vị khách đề cao sự đẳng cấp. Phòng khách riêng biệt, ban công view đẹp, cùng các tiện ích 5 sao chu đáo.',
    basePrice: 4500000,
    capacity: 2,
    amenities: [
      'Phòng khách riêng',
      'Ban công riêng',
      'Diện tích 55m²',
      'Minibar',
      'Bồn tắm',
      'Dịch vụ dọn phòng hàng ngày',
      'Wifi miễn phí',
      'Điều hòa',
      'TV màn hình phẳng',
    ],
    images: [
      'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    name: 'Superior Room',
    description:
      'Hạng phòng tiết kiệm hơn Deluxe nhưng vẫn đầy đủ tiện nghi cần thiết, không gian sáng sủa và yên tĩnh — lựa chọn hợp lý cho khách đi công tác ngắn ngày.',
    basePrice: 1500000,
    capacity: 2,
    amenities: [
      'Giường Queen',
      'Diện tích 24m²',
      'Wifi miễn phí',
      'Điều hòa',
      'TV màn hình phẳng',
      'Bàn làm việc nhỏ',
    ],
    images: [
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    name: 'Twin Room',
    description:
      'Phòng 2 giường đơn tách biệt, phù hợp cho bạn bè hoặc đồng nghiệp đi công tác cùng nhau mà vẫn muốn có không gian riêng.',
    basePrice: 1600000,
    capacity: 2,
    amenities: [
      '2 giường đơn',
      'Diện tích 26m²',
      'Wifi miễn phí',
      'Điều hòa',
      'TV màn hình phẳng',
      'Minibar',
    ],
    images: [
      'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?q=80&w=1600&auto=format&fit=crop',
    ],
  },
  {
    name: 'Honeymoon Suite',
    description:
      'Không gian lãng mạn dành riêng cho các cặp đôi, trang trí tinh tế cùng bồn tắm đôi và tầm nhìn đẹp — lựa chọn lý tưởng cho tuần trăng mật hoặc kỷ niệm đặc biệt.',
    basePrice: 3900000,
    capacity: 2,
    amenities: [
      'Giường King',
      'Bồn tắm đôi',
      'Diện tích 40m²',
      'Trang trí lãng mạn',
      'Minibar',
      'Wifi miễn phí',
      'Điều hòa',
      'TV màn hình phẳng',
    ],
    images: [
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?q=80&w=1600&auto=format&fit=crop',
    ],
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
    entities: [RoomType],
  });

  await dataSource.initialize();
  const roomTypeRepo = dataSource.getRepository(RoomType);

  for (const data of ROOM_TYPES) {
    const existing = await roomTypeRepo.findOne({ where: { name: data.name } });
    if (existing) {
      Object.assign(existing, data, { status: RoomTypeStatus.ACTIVE });
      await roomTypeRepo.save(existing);
      console.log(`Đã cập nhật loại phòng: ${data.name}`);
    } else {
      await roomTypeRepo.save(
        roomTypeRepo.create({ ...data, status: RoomTypeStatus.ACTIVE }),
      );
      console.log(`Đã tạo loại phòng: ${data.name}`);
    }
  }

  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Seed loại phòng thất bại:', err);
  process.exit(1);
});
