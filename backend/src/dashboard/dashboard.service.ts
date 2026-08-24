import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { Booking } from 'src/bookings/entities/booking.entity';
import { Room } from 'src/rooms/entities/room.entity';
import { RoomType } from 'src/room-types/entities/room-type.entity';
import { UserRole } from 'src/common/enums/user-role.enum';
import { BookingStatus } from 'src/common/enums/booking-status.enum';
import { RoomStatus } from 'src/common/enums/room-status.enum';

// Gộp raw rows dạng { [groupCol]: string, count: string } (Postgres trả count là string)
// thành map đầy đủ mọi giá trị enum, giá trị nào không xuất hiện trong rows thì mặc định 0.
function toCountMap<T extends string>(
  rows: Array<{ group: string; count: string }>,
  enumValues: T[],
): Record<T, number> {
  const map = Object.fromEntries(enumValues.map((v) => [v, 0])) as Record<
    T,
    number
  >;
  for (const row of rows) {
    map[row.group as T] = Number(row.count);
  }
  return map;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(Room) private readonly roomRepo: Repository<Room>,
    @InjectRepository(RoomType)
    private readonly roomTypeRepo: Repository<RoomType>,
  ) {}

  async getOverview() {
    const [
      usersByRoleRows,
      bookingsByStatusRows,
      roomsByStatusRows,
      roomTypeTotal,
    ] = await Promise.all([
      this.userRepo
        .createQueryBuilder('user')
        .select('user.role', 'group')
        .addSelect('COUNT(*)', 'count')
        .groupBy('user.role')
        .getRawMany<{ group: string; count: string }>(),
      this.bookingRepo
        .createQueryBuilder('booking')
        .select('booking.status', 'group')
        .addSelect('COUNT(*)', 'count')
        .groupBy('booking.status')
        .getRawMany<{ group: string; count: string }>(),
      this.roomRepo
        .createQueryBuilder('room')
        .select('room.status', 'group')
        .addSelect('COUNT(*)', 'count')
        .groupBy('room.status')
        .getRawMany<{ group: string; count: string }>(),
      this.roomTypeRepo.count(),
    ]);

    const usersByRole = toCountMap(usersByRoleRows, Object.values(UserRole));
    const bookingsByStatus = toCountMap(
      bookingsByStatusRows,
      Object.values(BookingStatus),
    );
    const roomsByStatus = toCountMap(
      roomsByStatusRows,
      Object.values(RoomStatus),
    );

    const usersTotal = Object.values(usersByRole).reduce((a, b) => a + b, 0);
    const bookingsTotal = Object.values(bookingsByStatus).reduce(
      (a, b) => a + b,
      0,
    );
    const roomsTotal = Object.values(roomsByStatus).reduce(
      (a, b) => a + b,
      0,
    );

    return {
      users: { total: usersTotal, byRole: usersByRole },
      bookings: { total: bookingsTotal, byStatus: bookingsByStatus },
      rooms: { total: roomsTotal, byStatus: roomsByStatus },
      roomTypes: { total: roomTypeTotal },
    };
  }
}
