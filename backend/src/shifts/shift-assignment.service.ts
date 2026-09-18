import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  In,
  LessThanOrEqual,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { ShiftAssignment } from './entities/shift-assignment.entity';
import { ShiftType } from './entities/shift-type.entity';
import { CreateShiftAssignmentDto } from './dto/create-shift-assignment.dto';
import { QueryShiftAssignmentDto } from './dto/query-shift-assignment.dto';
import { ShiftAssignmentStatus } from '../common/enums/shift-assignment-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { UserService } from '../users/user.service';
import { PaymentTransactionService } from '../cash-ledger/payment-transaction.service';
import { CheckInShiftDto } from './dto/check-in-shift.dto';
import { CheckOutShiftDto } from './dto/check-out-shift.dto';

// Thao tác ngày trên chuỗi 'YYYY-MM-DD' (khớp kiểu cột 'date' của workDate) —
// so sánh chuỗi 'YYYY-MM-DD' theo thứ tự từ điển cũng là theo thứ tự thời gian.
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayKey(): string {
  return toDateKey(new Date());
}

function addDaysToKey(key: string, amount: number): string {
  const d = new Date(`${key}T00:00:00`);
  d.setDate(d.getDate() + amount);
  return toDateKey(d);
}

function diffDays(fromKey: string, toKey: string): number {
  const a = new Date(`${fromKey}T00:00:00`).getTime();
  const b = new Date(`${toKey}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

// Cho phép vô ca sớm tối đa 30 phút trước giờ bắt đầu ca — thực tế nhân viên
// thường tới sớm để nhận bàn giao từ ca trước.
const CHECK_IN_EARLY_GRACE_MINUTES = 30;

// Cột 'time' của Postgres trả 'HH:mm:ss'; phòng trường hợp chỉ có 'HH:mm'.
function normalizeTime(time: string): string {
  return time.length === 5 ? `${time}:00` : time;
}

// Khung thời gian thực tế của 1 ca = workDate + giờ bắt đầu/kết thúc của loại ca.
// Nếu giờ kết thúc <= giờ bắt đầu (vd. Ca đêm 22:00-06:00) thì ca kết thúc vào
// ngày hôm sau.
function buildShiftWindow(
  workDate: string,
  startTime: string,
  endTime: string,
): { start: Date; end: Date } {
  const start = new Date(`${workDate}T${normalizeTime(startTime)}`);
  const end = new Date(`${workDate}T${normalizeTime(endTime)}`);
  if (end <= start) {
    end.setDate(end.getDate() + 1);
  }
  return { start, end };
}

// Tự format thay vì toLocaleString để không phụ thuộc dữ liệu ICU của Node.
function formatHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDayMonth(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Vô ca trễ không quá số phút này vẫn tính là đúng giờ.
const LATE_GRACE_MINUTES = 15;

// Quá giờ kết thúc ca bao lâu mà chưa kết ca thì hệ thống tự đóng ca, và lễ tân
// không còn được thu tiền trên ca đó nữa.
const AUTO_CLOSE_GRACE_MINUTES = 60;

export type ShiftAssignmentWithLate = ShiftAssignment & {
  isLate: boolean;
  lateMinutes: number;
};

// Tính trễ lúc trả dữ liệu (không lưu DB): so checkInAt với giờ bắt đầu ca. Hệ quả:
// nếu sau này sửa giờ bắt đầu của loại ca, các ca cũ cũng được tính lại theo giờ mới.
function withLateInfo(assignment: ShiftAssignment): ShiftAssignmentWithLate {
  if (!assignment.checkInAt) {
    return { ...assignment, isLate: false, lateMinutes: 0 };
  }
  const { start } = buildShiftWindow(
    assignment.workDate,
    assignment.shiftType.startTime,
    assignment.shiftType.endTime,
  );
  const delay = Math.floor(
    (new Date(assignment.checkInAt).getTime() - start.getTime()) / 60_000,
  );
  const isLate = delay > LATE_GRACE_MINUTES;
  return { ...assignment, isLate, lateMinutes: isLate ? delay : 0 };
}

@Injectable()
export class ShiftAssignmentService {
  constructor(
    @InjectRepository(ShiftAssignment)
    private readonly shiftAssignmentRepo: Repository<ShiftAssignment>,
    @InjectRepository(ShiftType)
    private readonly shiftTypeRepo: Repository<ShiftType>,
    private readonly userService: UserService,
    private readonly paymentTransactionService: PaymentTransactionService,
  ) {}

  // Admin xem lịch phân ca — lọc theo khoảng ngày (thường là 1 tuần) và tuỳ
  // chọn theo 1 nhân viên cụ thể.
  async findForAdmin(
    query: QueryShiftAssignmentDto,
  ): Promise<ShiftAssignmentWithLate[]> {
    const assignments = await this.shiftAssignmentRepo.find({
      where: {
        workDate: Between(query.from, query.to),
        ...(query.staffId ? { staff: { userId: query.staffId } } : {}),
      },
      relations: { staff: true, shiftType: true },
      order: { workDate: 'ASC' },
    });
    return assignments.map(withLateInfo);
  }

  // Staff xem lịch của chính mình — luôn khoá theo userId đang đăng nhập, không
  // nhận staffId từ query để tránh xem được lịch của người khác.
  async findForStaff(
    staffId: string,
    query: Pick<QueryShiftAssignmentDto, 'from' | 'to'>,
  ): Promise<ShiftAssignmentWithLate[]> {
    const assignments = await this.shiftAssignmentRepo.find({
      where: {
        staff: { userId: staffId },
        workDate: Between(query.from, query.to),
      },
      relations: { shiftType: true },
      order: { workDate: 'ASC' },
    });
    return assignments.map(withLateInfo);
  }

  private readonly DUPLICATE_MESSAGE =
    'Nhân viên này đã được phân vào ca này trong ngày đã chọn';

  async create(dto: CreateShiftAssignmentDto): Promise<ShiftAssignment> {
    if (dto.workDate < todayKey()) {
      throw new BadRequestException('Không thể phân ca cho ngày trong quá khứ');
    }

    const staff = await this.userService.findById(dto.staffId);
    if (staff.role !== UserRole.STAFF && staff.role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'Chỉ có thể phân ca cho tài khoản Nhân viên hoặc Quản trị viên',
      );
    }

    const shiftType = await this.shiftTypeRepo.findOne({
      where: { shiftTypeId: dto.shiftTypeId },
    });
    if (!shiftType) {
      throw new NotFoundException('Không tìm thấy loại ca');
    }

    const existed = await this.shiftAssignmentRepo.findOne({
      where: {
        staff: { userId: dto.staffId },
        shiftType: { shiftTypeId: dto.shiftTypeId },
        workDate: dto.workDate,
      },
    });
    if (existed) {
      throw new ConflictException(this.DUPLICATE_MESSAGE);
    }

    const assignment = this.shiftAssignmentRepo.create({
      staff,
      shiftType,
      workDate: dto.workDate,
      note: dto.note ?? null,
    });
    try {
      return await this.shiftAssignmentRepo.save(assignment);
    } catch (err) {
      // 2 admin cùng phân đúng 1 ô: pre-check ở trên có khe TOCTOU, ràng buộc
      // UNIQUE (staff, shiftType, workDate) ở DB là chốt chặn cuối — dịch lỗi
      // 23505 (Postgres unique violation) thành 409 thay vì để lọt ra 500.
      if (
        err instanceof QueryFailedError &&
        (err as unknown as { code?: string }).code === '23505'
      ) {
        throw new ConflictException(this.DUPLICATE_MESSAGE);
      }
      throw err;
    }
  }

  // Sao chép toàn bộ ca của 1 tuần (7 ngày kể từ sourceWeekStart) sang tuần khác,
  // giữ nguyên thứ trong tuần và ghi chú. Bỏ qua ca rơi vào ngày quá khứ hoặc đã
  // tồn tại ở tuần đích.
  async copyWeek(
    sourceWeekStart: string,
    targetWeekStart: string,
  ): Promise<{ created: number; skipped: number }> {
    const sourceEnd = addDaysToKey(sourceWeekStart, 6);
    const targetEnd = addDaysToKey(targetWeekStart, 6);
    const today = todayKey();

    const [sourceAssignments, targetAssignments] = await Promise.all([
      this.shiftAssignmentRepo.find({
        where: { workDate: Between(sourceWeekStart, sourceEnd) },
        relations: { staff: true, shiftType: true },
      }),
      this.shiftAssignmentRepo.find({
        where: { workDate: Between(targetWeekStart, targetEnd) },
        relations: { staff: true, shiftType: true },
      }),
    ]);

    const existingKeys = new Set(
      targetAssignments.map(
        (a) => `${a.staff.userId}_${a.shiftType.shiftTypeId}_${a.workDate}`,
      ),
    );

    const toCreate: ShiftAssignment[] = [];
    let skipped = 0;
    for (const src of sourceAssignments) {
      const offset = diffDays(sourceWeekStart, src.workDate);
      const targetDate = addDaysToKey(targetWeekStart, offset);
      const key = `${src.staff.userId}_${src.shiftType.shiftTypeId}_${targetDate}`;

      if (targetDate < today || existingKeys.has(key)) {
        skipped += 1;
        continue;
      }
      existingKeys.add(key);
      toCreate.push(
        this.shiftAssignmentRepo.create({
          staff: src.staff,
          shiftType: src.shiftType,
          workDate: targetDate,
          note: src.note,
        }),
      );
    }

    if (toCreate.length > 0) {
      await this.shiftAssignmentRepo.save(toCreate);
    }
    return { created: toCreate.length, skipped };
  }

  async remove(shiftAssignmentId: string): Promise<{ message: string }> {
    const assignment = await this.shiftAssignmentRepo.findOne({
      where: { shiftAssignmentId },
    });
    if (!assignment) {
      throw new NotFoundException('Không tìm thấy lịch phân ca');
    }
    if (assignment.workDate < todayKey()) {
      throw new BadRequestException('Không thể gỡ ca của ngày đã qua');
    }
    if (assignment.status !== ShiftAssignmentStatus.SCHEDULED) {
      throw new BadRequestException(
        'Không thể gỡ ca đã bắt đầu diễn ra hoặc đã kết thúc',
      );
    }

    await this.shiftAssignmentRepo.delete({ shiftAssignmentId });
    return { message: 'Đã gỡ lịch phân ca' };
  }

  // Nhân viên "vô ca": chỉ cho phép trên đúng ca của chính mình, ca còn ở trạng
  // thái SCHEDULED, và thời điểm hiện tại phải nằm trong khung giờ của ca (được
  // phép sớm hơn giờ bắt đầu tối đa CHECK_IN_EARLY_GRACE_MINUTES phút).
  // Việc kiểm tra khung giờ đã bao hàm luôn "đúng ngày", đồng thời xử lý được cả
  // ca qua đêm (kết thúc sang ngày hôm sau).
  async checkIn(
    shiftAssignmentId: string,
    requesterId: string,
    dto: CheckInShiftDto,
  ): Promise<ShiftAssignmentWithLate> {
    const assignment = await this.findOwnedAssignmentOrThrow(
      shiftAssignmentId,
      requesterId,
    );

    if (assignment.status !== ShiftAssignmentStatus.SCHEDULED) {
      throw new BadRequestException(
        'Ca này không ở trạng thái chờ vô ca (đã vô ca, đã kết ca hoặc đã bị đánh dấu vắng mặt)',
      );
    }

    // Mỗi nhân viên chỉ được mở 1 ca tại 1 thời điểm — nếu không, khoảng thời gian
    // của 2 ca chồng nhau và cùng 1 khoản tiền bị tính vào báo cáo của cả 2 ca.
    const openShift = await this.shiftAssignmentRepo.findOne({
      where: {
        staff: { userId: requesterId },
        status: ShiftAssignmentStatus.CHECKEDIN,
      },
      relations: { shiftType: true },
    });
    if (openShift) {
      throw new BadRequestException(
        `Bạn đang còn ca "${openShift.shiftType.name}" ngày ${openShift.workDate} chưa kết ca. Hãy kết ca đó trước khi vô ca mới.`,
      );
    }

    const { start, end } = buildShiftWindow(
      assignment.workDate,
      assignment.shiftType.startTime,
      assignment.shiftType.endTime,
    );
    const earliest = new Date(
      start.getTime() - CHECK_IN_EARLY_GRACE_MINUTES * 60_000,
    );
    const now = new Date();

    if (now < earliest) {
      throw new BadRequestException(
        `Chưa đến giờ vô ca. Ca "${assignment.shiftType.name}" bắt đầu lúc ${formatHm(start)} ngày ${formatDayMonth(start)}, chỉ được vô ca sớm nhất từ ${formatHm(earliest)}.`,
      );
    }
    if (now > end) {
      throw new BadRequestException(
        `Ca "${assignment.shiftType.name}" đã kết thúc lúc ${formatHm(end)} ngày ${formatDayMonth(end)}, không thể vô ca.`,
      );
    }

    assignment.status = ShiftAssignmentStatus.CHECKEDIN;
    assignment.checkInAt = now;
    assignment.openingCash = dto.openingCash;
    return withLateInfo(await this.shiftAssignmentRepo.save(assignment));
  }

  // Nhân viên "kết ca": chỉ cho phép trên đúng ca của chính mình và phải đang
  // ở trạng thái CHECKEDIN (đã vô ca trước đó). Lưu tiền đếm được trong két để
  // báo cáo ca so với tiền dự kiến.
  async checkOut(
    shiftAssignmentId: string,
    requesterId: string,
    dto: CheckOutShiftDto,
  ) {
    const assignment = await this.findOwnedAssignmentOrThrow(
      shiftAssignmentId,
      requesterId,
    );

    if (assignment.status !== ShiftAssignmentStatus.CHECKEDIN) {
      throw new BadRequestException('Phải vô ca trước khi có thể kết ca');
    }

    assignment.status = ShiftAssignmentStatus.CHECKEDOUT;
    assignment.checkOutAt = new Date();
    assignment.closingCash = dto.closingCash;
    const saved = await this.shiftAssignmentRepo.save(assignment);
    return {
      assignment: withLateInfo(saved),
      report: await this.buildReport(saved),
    };
  }

  // Báo cáo chốt két của 1 ca: chủ ca hoặc Admin xem được. Ca đang diễn ra thì tính
  // tới thời điểm hiện tại.
  async getReport(
    shiftAssignmentId: string,
    requester: { userId: string; role: string },
  ) {
    const assignment = await this.shiftAssignmentRepo.findOne({
      where: { shiftAssignmentId },
      relations: { staff: true, shiftType: true },
    });
    if (!assignment) {
      throw new NotFoundException('Không tìm thấy lịch phân ca');
    }
    if (
      requester.role !== UserRole.ADMIN &&
      assignment.staff.userId !== requester.userId
    ) {
      throw new ForbiddenException('Đây không phải ca làm việc của bạn');
    }
    return {
      assignment: withLateInfo(assignment),
      report: await this.buildReport(assignment),
    };
  }

  // Lễ tân chỉ được thao tác thu tiền/nhận trả phòng khi đang trong ca, để mọi khoản
  // tiền mặt đều rơi vào 1 ca và chốt két được.
  // Ngoài trạng thái CHECKEDIN còn kiểm tra khung giờ ca, vì cron tự đóng ca chỉ
  // chạy định kỳ — không để ca quên kết từ hôm trước tiếp tục thu tiền.
  async assertOnDuty(staffId: string): Promise<void> {
    const openShift = await this.shiftAssignmentRepo.findOne({
      where: {
        staff: { userId: staffId },
        status: ShiftAssignmentStatus.CHECKEDIN,
      },
      relations: { shiftType: true },
    });
    if (!openShift) {
      throw new ForbiddenException(
        'Bạn cần vô ca trước khi check-in/check-out cho khách',
      );
    }
    const { end } = buildShiftWindow(
      openShift.workDate,
      openShift.shiftType.startTime,
      openShift.shiftType.endTime,
    );
    if (Date.now() > end.getTime() + AUTO_CLOSE_GRACE_MINUTES * 60_000) {
      throw new ForbiddenException(
        `Ca "${openShift.shiftType.name}" đã quá giờ kết thúc, hãy kết ca trước`,
      );
    }
  }

  // Gọi định kỳ bởi ShiftAutoCloseJob:
  // - Ca SCHEDULED đã qua giờ kết thúc mà chưa vô ca -> ABSENT.
  // - Ca CHECKEDIN quá giờ kết thúc + AUTO_CLOSE_GRACE_MINUTES -> CHECKEDOUT với
  //   checkOutAt = giờ kết thúc ca (báo cáo không cộng dồn tiền sau ca) và
  //   closingCash = null. Kết ca thủ công luôn bắt nhập closingCash, nên
  //   CHECKEDOUT + closingCash null nghĩa là "hệ thống tự đóng, chưa chốt két".
  async closeOverdueShifts(): Promise<{ absent: number; autoClosed: number }> {
    const now = new Date();
    const candidates = await this.shiftAssignmentRepo.find({
      where: {
        status: In([
          ShiftAssignmentStatus.SCHEDULED,
          ShiftAssignmentStatus.CHECKEDIN,
        ]),
        workDate: LessThanOrEqual(todayKey()),
      },
      relations: { shiftType: true },
    });

    let absent = 0;
    let autoClosed = 0;
    const toSave: ShiftAssignment[] = [];
    for (const assignment of candidates) {
      const { end } = buildShiftWindow(
        assignment.workDate,
        assignment.shiftType.startTime,
        assignment.shiftType.endTime,
      );
      if (assignment.status === ShiftAssignmentStatus.SCHEDULED && now > end) {
        assignment.status = ShiftAssignmentStatus.ABSENT;
        absent += 1;
        toSave.push(assignment);
      } else if (
        assignment.status === ShiftAssignmentStatus.CHECKEDIN &&
        now.getTime() > end.getTime() + AUTO_CLOSE_GRACE_MINUTES * 60_000
      ) {
        assignment.status = ShiftAssignmentStatus.CHECKEDOUT;
        assignment.checkOutAt = end;
        autoClosed += 1;
        toSave.push(assignment);
      }
    }

    if (toSave.length > 0) {
      await this.shiftAssignmentRepo.save(toSave);
    }
    return { absent, autoClosed };
  }

  private async buildReport(assignment: ShiftAssignment) {
    if (!assignment.checkInAt) {
      return null;
    }
    const to = assignment.checkOutAt ?? new Date();
    const { transactions, totals } =
      await this.paymentTransactionService.findCollectedByStaff(
        assignment.staff.userId,
        assignment.checkInAt,
        to,
      );
    const openingCash = assignment.openingCash ?? 0;
    // PayOS/chuyển khoản không vào két nên không cộng vào tiền dự kiến.
    const expectedCash = openingCash + totals.cash;
    return {
      openingCash,
      cashCollected: totals.cash,
      transferCollected: totals.transfer,
      expectedCash,
      closingCash: assignment.closingCash,
      difference:
        assignment.closingCash === null
          ? null
          : assignment.closingCash - expectedCash,
      transactions: transactions.map((t) => ({
        paymentTransactionId: t.paymentTransactionId,
        bookingId: t.booking.bookingId,
        guestName: t.booking.guestInfo?.fullName ?? null,
        roomNumber: t.booking.room?.roomNumber ?? null,
        amount: t.amount,
        method: t.method,
        collectedAt: t.collectedAt,
      })),
    };
  }

  // Dùng chung cho checkIn/checkOut: nạp ca kèm quan hệ staff, và chặn ngay nếu
  // không phải ca của chính người gọi — không tin shiftAssignmentId gửi lên là đủ.
  private async findOwnedAssignmentOrThrow(
    shiftAssignmentId: string,
    requesterId: string,
  ): Promise<ShiftAssignment> {
    const assignment = await this.shiftAssignmentRepo.findOne({
      where: { shiftAssignmentId },
      relations: { staff: true, shiftType: true },
    });
    if (!assignment) {
      throw new NotFoundException('Không tìm thấy lịch phân ca');
    }
    if (assignment.staff.userId !== requesterId) {
      throw new ForbiddenException('Đây không phải ca làm việc của bạn');
    }
    return assignment;
  }
}
