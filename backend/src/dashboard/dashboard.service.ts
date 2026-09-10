import { Injectable } from '@nestjs/common';
import { UserRole } from 'src/common/enums/user-role.enum';
import { BookingStatus } from 'src/common/enums/booking-status.enum';
import { RoomStatus } from 'src/common/enums/room-status.enum';
import { UserService } from '../users/user.service';
import { BookingService } from '../bookings/booking.service';
import { RoomService } from '../rooms/room.service';
import { RoomTypeService } from '../room-types/room-type.service';

// Gộp raw rows dạng { group: string, count: string } (Postgres trả count là string)
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

// Dashboard chỉ tổng hợp số liệu — lấy qua service công khai của từng module
// (User/Booking/Room/RoomType) chứ không truy cập repository của chúng, giữ đúng
// ranh giới modular monolith.
@Injectable()
export class DashboardService {
  constructor(
    private readonly userService: UserService,
    private readonly bookingService: BookingService,
    private readonly roomService: RoomService,
    private readonly roomTypeService: RoomTypeService,
  ) {}

  async getOverview() {
    const [
      usersByRoleRows,
      bookingsByStatusRows,
      roomsByStatusRows,
      roomTypeTotal,
    ] = await Promise.all([
      this.userService.countGroupedByRole(),
      this.bookingService.countGroupedByStatus(),
      this.roomService.countGroupedByStatus(),
      this.roomTypeService.count(),
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
    const roomsTotal = Object.values(roomsByStatus).reduce((a, b) => a + b, 0);

    return {
      users: { total: usersTotal, byRole: usersByRole },
      bookings: { total: bookingsTotal, byStatus: bookingsByStatus },
      rooms: { total: roomsTotal, byStatus: roomsByStatus },
      roomTypes: { total: roomTypeTotal },
    };
  }
}
