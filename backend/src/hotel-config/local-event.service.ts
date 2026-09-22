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

  // Dòng có dayOfWeek (WEEKLY, lặp vô hạn) được xếp trước dòng chỉ diễn ra 1 lần
  // (dayOfWeek IS NULL) đơn giản vì giá trị không NULL luôn xếp trước NULL khi dùng
  // "NULLS LAST" — không cần viết thêm biểu thức "đây có phải sự kiện lặp lại không".
  // Trong từng nhóm, thứ tự tăng dần vốn đã hữu ích sẵn: dayOfWeek 0..6 (CN..T7),
  // specificDate gần nhất lên trước.
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
    // Chỉ kế thừa dayOfWeek/specificDate CŨ khi bản thân recurrence không đổi. Nếu CÓ
    // đổi (VD WEEKLY -> ONCE chỉ gửi specificDate mới), trường của loại cũ đã lỗi thời và
    // phải coi như không có — nếu không assertRecurrenceFields bên dưới sẽ từ chối nhầm
    // 1 lần đổi loại hợp lệ vì "còn giữ" 1 trường thuộc về loại đang bị đổi RA KHỎI.
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

  // Chuyển 1 dòng do AI đề xuất (source = ai_suggested, status = pending) sang approved —
  // chỉ sau bước này get_local_events (findForDate bên dưới) mới thấy được. Kiểm tra lại
  // độ đầy đủ của ngày ở phía server dù giao diện admin đã disable nút "Duyệt" cho bản
  // nháp thiếu thông tin — kiểm tra ở UI chỉ là tiện lợi, không phải nguồn sự thật, nên 1
  // client cũ hoặc gọi API trực tiếp không thể lọt qua được 1 sự kiện thiếu thông tin ra
  // trước mặt khách. Sự kiện WEEKLY tạo qua trích xuất luôn có sẵn dayOfWeek (xem
  // LocalEventExtractionService.sanitizeExtractedEvent), nhưng sự kiện ONCE vẫn có thể
  // thiếu specificDate nếu ngày trong văn bản nguồn quá mơ hồ để trích xuất được.
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
        // Cặp ngoặc ngoài bọc cả cụm OR là bắt buộc về mặt logic, không chỉ để đẹp: AND
        // trong SQL có độ ưu tiên cao hơn OR, nên `.andWhere('(A) OR (B)')` ngay sau
        // `.where(status)` sẽ biên dịch thành `status AND (A) OR (B)` == `(status AND A)
        // OR B` — âm thầm loại bỏ điều kiện lọc status khỏi nhánh ONCE, làm lộ ra ngoài
        // các sự kiện AI đề xuất còn pending nếu trùng specificDate. Phát hiện được nhờ
        // test trực tiếp (get_local_events trả về sự kiện "Lễ hội Tháp Bà Ponagar" dù nó
        // vẫn đang pending), không phải nhờ type checker — chuỗi WHERE thô của TypeORM
        // không được kiểm tra logic kiểu này.
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

  // Cố tình loại trừ lẫn nhau: sự kiện WEEKLY được định nghĩa bằng dayOfWeek và KHÔNG
  // được kèm specificDate (và ngược lại với ONCE) — từ chối rõ ràng bằng lỗi 400 thay vì
  // âm thầm chấp nhận cả hai rồi bỏ bớt 1 cái về sau. update() chỉ chạy tới đây với đúng
  // trường mà người gọi thực sự gửi lên (xem chỗ merge dto ?? event ở update() phía
  // trên), nên request gửi cả 2 trường cùng lúc luôn bị bắt lại.
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
