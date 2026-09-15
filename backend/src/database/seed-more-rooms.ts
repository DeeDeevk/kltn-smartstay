import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Room } from '../rooms/entities/room.entity';
import { RoomType } from '../room-types/entities/room-type.entity';
import { RoomStatus } from '../common/enums/room-status.enum';

// Trang tìm phòng (checkAvailability) chỉ tính 1 loại phòng là "phù hợp" khi nó có ít
// nhất 1 phòng vật lý status AVAILABLE — RoomType đơn thuần không đủ. Script này bổ sung
// đúng 1 phòng AVAILABLE trên tầng 3 (T301, T302, ...) cho các loại phòng đang chưa có
// phòng trống nào, để trang tìm kiếm hiển thị đủ lựa chọn cho khách thay vì chỉ vài loại.
const ROOM_TYPE_NAMES_NEEDING_ROOM = [
  'Family Suite',
  'Executive Suite',
  'Superior Room',
  'Twin Room',
  'Honeymoon Suite',
];

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    entities: [Room, RoomType],
  });

  await dataSource.initialize();
  const roomTypeRepo = dataSource.getRepository(RoomType);
  const roomRepo = dataSource.getRepository(Room);

  let seq = 1;
  for (const name of ROOM_TYPE_NAMES_NEEDING_ROOM) {
    const roomType = await roomTypeRepo.findOne({ where: { name } });
    if (!roomType) {
      console.warn(`Bỏ qua "${name}": chưa có RoomType (chạy seed:room-types trước).`);
      continue;
    }

    const hasAvailableRoom = await roomRepo.exists({
      where: { roomType: { roomTypeId: roomType.roomTypeId }, status: RoomStatus.AVAILABLE },
    });
    if (hasAvailableRoom) {
      console.log(`Bỏ qua "${name}": đã có phòng trống.`);
      continue;
    }

    const roomNumber = `T3${String(seq).padStart(2, '0')}`;
    seq += 1;
    await roomRepo.save(
      roomRepo.create({
        roomNumber,
        floor: 3,
        roomType,
        status: RoomStatus.AVAILABLE,
      }),
    );
    console.log(`Đã tạo phòng ${roomNumber} cho "${name}".`);
  }

  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Seed phòng thất bại:', err);
  process.exit(1);
});
