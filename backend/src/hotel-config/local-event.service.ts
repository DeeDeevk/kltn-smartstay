import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LocalEvent } from './entities/local-event.entity';
import { CreateLocalEventDto } from './dto/create-local-event.dto';
import { UpdateLocalEventDto } from './dto/update-local-event.dto';
import { EventRecurrence } from 'src/common/enums/event-recurrence.enum';
import { LocalEventStatus } from 'src/common/enums/local-event-status.enum';

@Injectable()
export class LocalEventService {
  constructor(
    @InjectRepository(LocalEvent)
    private readonly localEventRepo: Repository<LocalEvent>,
  ) {}

  // Rows with a dayOfWeek (WEEKLY, recurs indefinitely) sort before one-time rows (dayOfWeek
  // IS NULL) simply because non-null values sort before NULL under "NULLS LAST" — no extra
  // "is this recurring" expression needed. Within each group, ascending order is already
  // the useful one: dayOfWeek 0..6 (Sun..Sat), specificDate soonest-first.
  findAll(): Promise<LocalEvent[]> {
    return this.localEventRepo
      .createQueryBuilder('event')
      .orderBy('event.dayOfWeek', 'ASC', 'NULLS LAST')
      .addOrderBy('event.specificDate', 'ASC', 'NULLS LAST')
      .getMany();
  }

  async findByIdForAdmin(eventId: string): Promise<LocalEvent> {
    const event = await this.localEventRepo.findOne({ where: { eventId } });
    if (!event) {
      throw new NotFoundException('Không tìm thấy sự kiện');
    }
    return event;
  }

  async create(dto: CreateLocalEventDto): Promise<LocalEvent> {
    this.assertRecurrenceFields(
      dto.recurrence,
      dto.dayOfWeek,
      dto.specificDate,
    );

    const event = this.localEventRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      recurrence: dto.recurrence,
      dayOfWeek: dto.dayOfWeek ?? null,
      specificDate: dto.specificDate ?? null,
    });
    return this.localEventRepo.save(event);
  }

  async update(eventId: string, dto: UpdateLocalEventDto): Promise<LocalEvent> {
    const event = await this.findByIdForAdmin(eventId);

    const nextRecurrence = dto.recurrence ?? event.recurrence;
    // Only inherit the PREVIOUS dayOfWeek/specificDate when recurrence itself isn't
    // changing. If it IS changing (e.g. WEEKLY -> ONCE sending only the new
    // specificDate), the old type's field is stale and must be treated as absent —
    // otherwise assertRecurrenceFields below would wrongly reject a legitimate type
    // switch for "carrying" a field that belongs to the type being switched AWAY from.
    const recurrenceUnchanged = nextRecurrence === event.recurrence;
    const nextDayOfWeek =
      dto.dayOfWeek ??
      (recurrenceUnchanged ? (event.dayOfWeek ?? undefined) : undefined);
    const nextSpecificDate =
      dto.specificDate ??
      (recurrenceUnchanged ? (event.specificDate ?? undefined) : undefined);
    this.assertRecurrenceFields(
      nextRecurrence,
      nextDayOfWeek,
      nextSpecificDate,
    );

    event.title = dto.title ?? event.title;
    event.description = dto.description ?? event.description;
    event.recurrence = nextRecurrence;
    // Object.assign(event, dto) trước đây chỉ ghi đè field có mặt trong dto -> đổi
    // WEEKLY sang ONCE (chỉ gửi specificDate) để sót dayOfWeek cũ trong DB. Field của
    // loại lặp không còn áp dụng phải về null tường minh, không "kế thừa" từ giá trị cũ.
    event.dayOfWeek =
      nextRecurrence === EventRecurrence.WEEKLY
        ? (nextDayOfWeek ?? null)
        : null;
    event.specificDate =
      nextRecurrence === EventRecurrence.ONCE
        ? (nextSpecificDate ?? null)
        : null;

    return this.localEventRepo.save(event);
  }

  async remove(eventId: string): Promise<{ message: string }> {
    const event = await this.findByIdForAdmin(eventId);
    await this.localEventRepo.remove(event);
    return { message: 'Đã xoá sự kiện' };
  }

  // Flips an AI-suggested (source = ai_suggested, status = pending) row to approved —
  // only after this does get_local_events (findForDate below) ever see it. Re-validates
  // date completeness server-side even though the admin UI already disables the "Duyệt"
  // button for an incomplete draft — the UI check is a convenience, not the source of
  // truth, so a stale client or a direct API call can't sneak an incomplete event past
  // guests. WEEKLY events created via extraction always carry a dayOfWeek anyway (see
  // LocalEventExtractionService.sanitizeExtractedEvent), but ONCE events may still be
  // missing specificDate if the source text's date was too ambiguous to extract.
  async approve(eventId: string): Promise<LocalEvent> {
    const event = await this.findByIdForAdmin(eventId);
    const hasCompleteDate =
      (event.recurrence === EventRecurrence.WEEKLY &&
        event.dayOfWeek !== null) ||
      (event.recurrence === EventRecurrence.ONCE &&
        event.specificDate !== null);
    if (!hasCompleteDate) {
      throw new BadRequestException(
        'Sự kiện chưa đủ thông tin ngày, vui lòng bổ sung trước khi duyệt.',
      );
    }
    event.status = LocalEventStatus.APPROVED;
    return this.localEventRepo.save(event);
  }

  // Dùng trực tiếp bởi ai-agent (tool get_local_events), không qua HTTP. Chỉ khớp
  // WEEKLY theo dayOfWeek và ONCE theo specificDate đúng ngày truy vấn — MONTHLY chưa
  // có trường "ngày trong tháng" trong entity nên hiện chưa lọc theo ngày được, luôn bị
  // bỏ qua ở đây (không phải bug, entity hiện tại không đủ dữ liệu để so khớp MONTHLY).
  // status = APPROVED bắt buộc: sự kiện AI đề xuất còn "pending" (chưa admin duyệt)
  // TUYỆT ĐỐI không được lộ ra cho khách qua trợ lý AI.
  async findForDate(dateStr: string): Promise<LocalEvent[]> {
    const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();

    return (
      this.localEventRepo
        .createQueryBuilder('event')
        .where('event.status = :status', { status: LocalEventStatus.APPROVED })
        // Outer parens around the whole OR clause are load-bearing, not just style: SQL's
        // AND binds tighter than OR, so `.andWhere('(A) OR (B)')` after `.where(status)`
        // would compile to `status AND (A) OR (B)` == `(status AND A) OR B` — silently
        // dropping the status filter from the ONCE branch and leaking pending AI-suggested
        // events with a matching specificDate. Caught via live testing (get_local_events
        // returned a still-pending "Lễ hội Tháp Bà Ponagar" to a guest), not by the type
        // checker — TypeORM's raw WHERE strings aren't validated for this.
        .andWhere(
          '((event.recurrence = :weekly AND event.dayOfWeek = :dayOfWeek) OR (event.recurrence = :once AND event.specificDate = :date))',
          {
            weekly: EventRecurrence.WEEKLY,
            dayOfWeek,
            once: EventRecurrence.ONCE,
            date: dateStr,
          },
        )
        .getMany()
    );
  }

  // Mutually exclusive by design: a WEEKLY event is defined by dayOfWeek and must NOT also
  // carry a specificDate (and vice versa for ONCE) — reject explicitly with a 400 instead
  // of silently accepting both and discarding one later. update() only reaches here with
  // whichever field the caller actually sent still attached (see update()'s dto ?? event
  // merge above), so a request that sends both together always gets caught.
  private assertRecurrenceFields(
    recurrence: EventRecurrence,
    dayOfWeek?: number,
    specificDate?: string,
  ): void {
    if (recurrence === EventRecurrence.WEEKLY) {
      if (dayOfWeek === undefined) {
        throw new BadRequestException(
          'Sự kiện lặp hàng tuần (WEEKLY) phải có dayOfWeek (0-6)',
        );
      }
      if (specificDate) {
        throw new BadRequestException(
          'Sự kiện lặp hàng tuần (WEEKLY) không được có specificDate',
        );
      }
    }
    if (recurrence === EventRecurrence.ONCE) {
      if (!specificDate) {
        throw new BadRequestException(
          'Sự kiện diễn ra một lần (ONCE) phải có specificDate',
        );
      }
      if (dayOfWeek !== undefined) {
        throw new BadRequestException(
          'Sự kiện diễn ra một lần (ONCE) không được có dayOfWeek',
        );
      }
    }
  }
}
