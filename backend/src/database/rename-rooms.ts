import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Room } from '../rooms/entities/room.entity';
import { RoomType } from '../room-types/entities/room-type.entity';

// Đổi tên toàn bộ phòng về quy ước T{tầng}{số thứ tự 2 chữ số}:
//   - T101 = phòng 1 tầng 1, T102 = phòng 2 tầng 1
//   - T201 = phòng 1 tầng 2 ...
// Thứ tự phòng trong mỗi tầng giữ theo tên hiện tại (sắp xếp tự nhiên) cho ổn định.

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

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
  const roomRepo = dataSource.getRepository(Room);

  const rooms = await roomRepo.find();

  // Nhóm theo tầng, giữ thứ tự theo tên hiện tại (sắp xếp tự nhiên) trước khi đổi.
  const byFloor = new Map<number, Room[]>();
  for (const room of rooms) {
    if (!byFloor.has(room.floor)) byFloor.set(room.floor, []);
    byFloor.get(room.floor)!.push(room);
  }
  for (const floorRooms of byFloor.values()) {
    floorRooms.sort((a, b) => naturalCompare(a.roomNumber, b.roomNumber));
  }

  // Tính tên mới trước khi ghi đè.
  const plan: Array<{ room: Room; from: string; to: string }> = [];
  for (const [floor, floorRooms] of [...byFloor.entries()].sort(
    ([a], [b]) => a - b,
  )) {
    floorRooms.forEach((room, index) => {
      const seq = String(index + 1).padStart(2, '0');
      plan.push({ room, from: room.roomNumber, to: `T${floor}${seq}` });
    });
  }

  // Pass 1: đặt tên tạm (ngắn, <= 20 ký tự) để tránh đụng ràng buộc UNIQUE(roomNumber).
  rooms.forEach((room, i) => {
    room.roomNumber = `_tmp${i}`;
  });
  await roomRepo.save(rooms);

  // Pass 2: đặt tên chính thức theo quy ước.
  for (const { room, to } of plan) {
    room.roomNumber = to;
  }
  await roomRepo.save(rooms);

  for (const { from, to } of plan) {
    console.log(`${from}  ->  ${to}`);
  }
  console.log(`Đã đổi tên ${rooms.length} phòng.`);

  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Đổi tên phòng thất bại:', err);
  process.exit(1);
});
