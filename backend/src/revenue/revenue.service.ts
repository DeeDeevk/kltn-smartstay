import { BadRequestException, Injectable } from '@nestjs/common';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingService } from '../bookings/booking.service';
import { RoomService } from '../rooms/room.service';
import { QueryRevenueDto, RevenueGroupBy } from './dto/query-revenue.dto';

// Thuế GTGT trên tiền phòng — giữ đồng bộ với BookingService.
const VAT_RATE = 0.08;

// 1 đêm lưu trú đã được phân bổ tiền, kèm thông tin để gom nhóm.
interface NightSlice {
  date: string; // 'YYYY-MM-DD'
  roomRevenue: number; // tiền phòng thuần (đã trừ khuyến mãi, chưa gồm VAT)
  serviceRevenue: number;
  vatAmount: number;
  totalRevenue: number;
  roomTypeId: string;
  roomTypeName: string;
  staffId: string | null;
  staffName: string;
  bookingId: string;
}

const UNASSIGNED = '__unassigned__';

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseKey(key: string): Date {
  return new Date(`${key}T00:00:00`);
}

function addDays(key: string, amount: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + amount);
  return toDateKey(d);
}

function diffDays(fromKey: string, toKey: string): number {
  return Math.round(
    (parseKey(toKey).getTime() - parseKey(fromKey).getTime()) / 86_400_000,
  );
}

function mondayOf(key: string): string {
  const d = parseKey(key);
  const day = d.getDay(); // 0 = Chủ nhật
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return toDateKey(d);
}

// Chia `amount` thành `parts` phần nguyên, phần dư rải vào các phần đầu để tổng
// cộng lại khớp tuyệt đối với `amount` (không thất thoát do làm tròn).
function splitEvenly(amount: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(amount / parts);
  let remainder = amount - base * parts;
  return Array.from({ length: parts }, () => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return base + extra;
  });
}

@Injectable()
export class RevenueService {
  constructor(
    private readonly bookingService: BookingService,
    private readonly roomService: RoomService,
  ) {}

  // Báo cáo doanh thu tổng cho Admin.
  async getSummary(query: QueryRevenueDto) {
    const { from, to, groupBy } = this.normalizeQuery(query);
    const slices = await this.buildNightSlices(from, to);

    const totals = this.sumSlices(slices);
    const totalRooms = await this.roomService.count();
    const days = diffDays(from, to) + 1;
    const availableRoomNights = totalRooms * days;
    const roomNightsSold = slices.length;

    // Gom theo trục thời gian cho biểu đồ cột
    const buckets = new Map<string, NightSlice[]>();
    for (const slice of slices) {
      const key = this.bucketKey(slice.date, groupBy);
      const list = buckets.get(key);
      if (list) {
        list.push(slice);
      } else {
        buckets.set(key, [slice]);
      }
    }
    const series = this.allBuckets(from, to, groupBy).map((bucket) => {
      const sum = this.sumSlices(buckets.get(bucket) ?? []);
      return {
        bucket,
        label: this.bucketLabel(bucket, groupBy),
        roomRevenue: sum.roomRevenue,
        serviceRevenue: sum.serviceRevenue,
        vatAmount: sum.vatAmount,
        totalRevenue: sum.totalRevenue,
      };
    });

    // Gom theo loại phòng cho biểu đồ tròn
    const byTypeMap = new Map<
      string,
      {
        roomTypeId: string;
        name: string;
        totalRevenue: number;
        roomNights: number;
      }
    >();
    for (const slice of slices) {
      const entry = byTypeMap.get(slice.roomTypeId) ?? {
        roomTypeId: slice.roomTypeId,
        name: slice.roomTypeName,
        totalRevenue: 0,
        roomNights: 0,
      };
      entry.totalRevenue += slice.totalRevenue;
      entry.roomNights += 1;
      byTypeMap.set(slice.roomTypeId, entry);
    }

    return {
      from,
      to,
      groupBy,
      totals: {
        ...totals,
        roomNightsSold,
        bookingCount: new Set(slices.map((s) => s.bookingId)).size,
      },
      // Bộ chỉ số chuẩn ngành khách sạn
      metrics: {
        totalRooms,
        availableRoomNights,
        occupancyRate: availableRoomNights
          ? roomNightsSold / availableRoomNights
          : 0,
        adr: roomNightsSold
          ? Math.round(totals.roomRevenue / roomNightsSold)
          : 0,
        revpar: availableRoomNights
          ? Math.round(totals.roomRevenue / availableRoomNights)
          : 0,
      },
      series,
      byRoomType: [...byTypeMap.values()].sort(
        (a, b) => b.totalRevenue - a.totalRevenue,
      ),
    };
  }

  // Báo cáo doanh thu theo từng nhân viên.
  async getByStaff(query: QueryRevenueDto) {
    const { from, to, groupBy } = this.normalizeQuery(query);
    const slices = await this.buildNightSlices(from, to);

    const staffMap = new Map<
      string,
      {
        staffId: string | null;
        fullName: string;
        roomRevenue: number;
        serviceRevenue: number;
        vatAmount: number;
        totalRevenue: number;
        roomNights: number;
        bookingIds: Set<string>;
      }
    >();
    for (const slice of slices) {
      const key = slice.staffId ?? UNASSIGNED;
      const entry = staffMap.get(key) ?? {
        staffId: slice.staffId,
        fullName: slice.staffName,
        roomRevenue: 0,
        serviceRevenue: 0,
        vatAmount: 0,
        totalRevenue: 0,
        roomNights: 0,
        bookingIds: new Set<string>(),
      };
      entry.roomRevenue += slice.roomRevenue;
      entry.serviceRevenue += slice.serviceRevenue;
      entry.vatAmount += slice.vatAmount;
      entry.totalRevenue += slice.totalRevenue;
      entry.roomNights += 1;
      entry.bookingIds.add(slice.bookingId);
      staffMap.set(key, entry);
    }

    const staff = [...staffMap.values()]
      .map((entry) => ({
        staffId: entry.staffId,
        fullName: entry.fullName,
        roomRevenue: entry.roomRevenue,
        serviceRevenue: entry.serviceRevenue,
        vatAmount: entry.vatAmount,
        totalRevenue: entry.totalRevenue,
        roomNights: entry.roomNights,
        bookingCount: entry.bookingIds.size,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Chuỗi thời gian: mỗi mốc liệt kê doanh thu của từng nhân viên (biểu đồ cột nhóm)
    const bucketMap = new Map<string, Map<string, number>>();
    for (const slice of slices) {
      const bucket = this.bucketKey(slice.date, groupBy);
      const key = slice.staffId ?? UNASSIGNED;
      const inner = bucketMap.get(bucket) ?? new Map<string, number>();
      inner.set(key, (inner.get(key) ?? 0) + slice.totalRevenue);
      bucketMap.set(bucket, inner);
    }
    const series = this.allBuckets(from, to, groupBy).map((bucket) => ({
      bucket,
      label: this.bucketLabel(bucket, groupBy),
      items: staff.map((s) => ({
        staffId: s.staffId,
        fullName: s.fullName,
        totalRevenue: bucketMap.get(bucket)?.get(s.staffId ?? UNASSIGNED) ?? 0,
      })),
    }));

    return {
      from,
      to,
      groupBy,
      totals: {
        ...this.sumSlices(slices),
        roomNightsSold: slices.length,
        bookingCount: new Set(slices.map((s) => s.bookingId)).size,
        staffCount: staff.length,
      },
      staff,
      series,
    };
  }

  // ------------------------------------------------------------------
  // Lõi: phân bổ tiền của mỗi đơn ra từng đêm lưu trú (mức 2 — accrual).
  // Doanh thu của 1 đơn 3 đêm được chia cho đúng 3 đêm đó, thay vì dồn hết
  // vào ngày trả phòng.
  // ------------------------------------------------------------------
  private async buildNightSlices(
    from: string,
    to: string,
  ): Promise<NightSlice[]> {
    const bookings = await this.bookingService.findStaysOverlapping(from, to);
    const slices: NightSlice[] = [];

    for (const booking of bookings) {
      const nights = this.stayNights(booking);
      if (nights.length === 0) continue;

      // Tiền của cả đơn — khớp công thức trong BookingService.toDetailResponse
      const serviceAmount = (booking.serviceItems ?? []).reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );
      const netRoomAmount =
        booking.roomAmount + booking.lateCheckoutFee - booking.discountAmount;
      const vatAmount = Math.round(netRoomAmount * VAT_RATE);

      const roomParts = splitEvenly(netRoomAmount, nights.length);
      const serviceParts = splitEvenly(serviceAmount, nights.length);
      const vatParts = splitEvenly(vatAmount, nights.length);

      nights.forEach((date, index) => {
        // Chỉ giữ các đêm nằm trong khoảng đang xem
        if (date < from || date > to) return;
        slices.push({
          date,
          roomRevenue: roomParts[index],
          serviceRevenue: serviceParts[index],
          vatAmount: vatParts[index],
          totalRevenue:
            roomParts[index] + serviceParts[index] + vatParts[index],
          roomTypeId: booking.roomType?.roomTypeId ?? '__unknown__',
          roomTypeName: booking.roomType?.name ?? 'Không xác định',
          staffId: booking.staff?.userId ?? null,
          staffName: booking.staff?.fullName ?? 'Chưa xác định',
          bookingId: booking.bookingId,
        });
      });
    }

    return slices;
  }

  // Các đêm lưu trú của 1 đơn: từ ngày check-in tới trước ngày check-out.
  private stayNights(booking: Booking): string[] {
    const nights: string[] = [];
    let cursor = booking.checkInDate;
    let guard = 0;
    while (cursor < booking.checkOutDate && guard < 400) {
      nights.push(cursor);
      cursor = addDays(cursor, 1);
      guard += 1;
    }
    return nights;
  }

  private sumSlices(slices: NightSlice[]) {
    return slices.reduce(
      (acc, s) => ({
        roomRevenue: acc.roomRevenue + s.roomRevenue,
        serviceRevenue: acc.serviceRevenue + s.serviceRevenue,
        vatAmount: acc.vatAmount + s.vatAmount,
        totalRevenue: acc.totalRevenue + s.totalRevenue,
      }),
      { roomRevenue: 0, serviceRevenue: 0, vatAmount: 0, totalRevenue: 0 },
    );
  }

  private normalizeQuery(query: QueryRevenueDto) {
    const from = query.from.slice(0, 10);
    const to = query.to.slice(0, 10);
    if (from > to) {
      throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
    }
    if (diffDays(from, to) > 366 * 5) {
      throw new BadRequestException('Khoảng thống kê tối đa 5 năm');
    }
    return { from, to, groupBy: query.groupBy ?? RevenueGroupBy.DAY };
  }

  private bucketKey(date: string, groupBy: RevenueGroupBy): string {
    if (groupBy === RevenueGroupBy.YEAR) return date.slice(0, 4);
    if (groupBy === RevenueGroupBy.MONTH) return date.slice(0, 7);
    if (groupBy === RevenueGroupBy.WEEK) return mondayOf(date);
    return date;
  }

  private bucketLabel(bucket: string, groupBy: RevenueGroupBy): string {
    if (groupBy === RevenueGroupBy.YEAR) return bucket;
    if (groupBy === RevenueGroupBy.MONTH) {
      const [y, m] = bucket.split('-');
      return `${m}/${y}`;
    }
    const d = parseKey(bucket);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    if (groupBy === RevenueGroupBy.WEEK) {
      const end = parseKey(addDays(bucket, 6));
      const ed = String(end.getDate()).padStart(2, '0');
      const em = String(end.getMonth() + 1).padStart(2, '0');
      return `${dd}/${mm}-${ed}/${em}`;
    }
    return `${dd}/${mm}`;
  }

  // Sinh đủ mọi mốc trong khoảng (kể cả mốc doanh thu = 0) để biểu đồ không đứt quãng.
  private allBuckets(
    from: string,
    to: string,
    groupBy: RevenueGroupBy,
  ): string[] {
    const keys: string[] = [];
    const seen = new Set<string>();
    let cursor = from;
    let guard = 0;
    while (cursor <= to && guard < 2000) {
      const key = this.bucketKey(cursor, groupBy);
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
      cursor = addDays(cursor, 1);
      guard += 1;
    }
    return keys;
  }
}
