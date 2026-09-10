import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, QueryFailedError, Repository } from 'typeorm';
import { ShiftAssignment } from './entities/shift-assignment.entity';
import { ShiftType } from './entities/shift-type.entity';
import { CreateShiftAssignmentDto } from './dto/create-shift-assignment.dto';
import { QueryShiftAssignmentDto } from './dto/query-shift-assignment.dto';
import { ShiftAssignmentStatus } from '../common/enums/shift-assignment-status.enum';
import { UserRole } from '../common/enums/user-role.enum';
import { UserService } from '../users/user.service';

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

@Injectable()
export class ShiftAssignmentService {
  constructor(
    @InjectRepository(ShiftAssignment)
    private readonly shiftAssignmentRepo: Repository<ShiftAssignment>,
    @InjectRepository(ShiftType)
    private readonly shiftTypeRepo: Repository<ShiftType>,
    private readonly userService: UserService,
  ) {}

  // Admin xem lịch phân ca — lọc theo khoảng ngày (thường là 1 tuần) và tuỳ
  // chọn theo 1 nhân viên cụ thể.
  findForAdmin(query: QueryShiftAssignmentDto): Promise<ShiftAssignment[]> {
    return this.shiftAssignmentRepo.find({
      where: {
        workDate: Between(query.from, query.to),
        ...(query.staffId ? { staff: { userId: query.staffId } } : {}),
      },
      relations: { staff: true, shiftType: true },
      order: { workDate: 'ASC' },
    });
  }

  // Staff xem lịch của chính mình — luôn khoá theo userId đang đăng nhập, không
  // nhận staffId từ query để tránh xem được lịch của người khác.
  findForStaff(
    staffId: string,
    query: Pick<QueryShiftAssignmentDto, 'from' | 'to'>,
  ): Promise<ShiftAssignment[]> {
    return this.shiftAssignmentRepo.find({
      where: {
        staff: { userId: staffId },
        workDate: Between(query.from, query.to),
      },
      relations: { shiftType: true },
      order: { workDate: 'ASC' },
    });
  }

  private readonly DUPLICATE_MESSAGE =
    'Nhân viên này đã được phân vào ca này trong ngày đã chọn';

  async create(dto: CreateShiftAssignmentDto): Promise<ShiftAssignment> {
    if (dto.workDate < todayKey()) {
      throw new BadRequestException(
        'Không thể phân ca cho ngày trong quá khứ',
      );
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
}
