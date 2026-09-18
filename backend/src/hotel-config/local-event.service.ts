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

@Injectable()
export class LocalEventService {
  constructor(
    @InjectRepository(LocalEvent)
    private readonly localEventRepo: Repository<LocalEvent>,
  ) {}

  findAll(): Promise<LocalEvent[]> {
    return this.localEventRepo.find({ order: { createdAt: 'DESC' } });
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
      description: dto.description,
      recurrence: dto.recurrence,
      dayOfWeek: dto.dayOfWeek ?? null,
      specificDate: dto.specificDate ?? null,
    });
    return this.localEventRepo.save(event);
  }

  async update(eventId: string, dto: UpdateLocalEventDto): Promise<LocalEvent> {
    const event = await this.findByIdForAdmin(eventId);

    const nextRecurrence = dto.recurrence ?? event.recurrence;
    const nextDayOfWeek = dto.dayOfWeek ?? event.dayOfWeek ?? undefined;
    const nextSpecificDate =
      dto.specificDate ?? event.specificDate ?? undefined;
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
      nextRecurrence === EventRecurrence.WEEKLY ? (nextDayOfWeek ?? null) : null;
    event.specificDate =
      nextRecurrence === EventRecurrence.ONCE ? (nextSpecificDate ?? null) : null;

    return this.localEventRepo.save(event);
  }

  async remove(eventId: string): Promise<{ message: string }> {
    const event = await this.findByIdForAdmin(eventId);
    await this.localEventRepo.remove(event);
    return { message: 'Đã xoá sự kiện' };
  }

  // Dùng trực tiếp bởi ai-agent (tool get_local_events), không qua HTTP. Chỉ khớp
  // WEEKLY theo dayOfWeek và ONCE theo specificDate đúng ngày truy vấn — MONTHLY chưa
  // có trường "ngày trong tháng" trong entity nên hiện chưa lọc theo ngày được, luôn bị
  // bỏ qua ở đây (không phải bug, entity hiện tại không đủ dữ liệu để so khớp MONTHLY).
  async findForDate(dateStr: string): Promise<LocalEvent[]> {
    const dayOfWeek = new Date(`${dateStr}T00:00:00Z`).getUTCDay();

    return this.localEventRepo
      .createQueryBuilder('event')
      .where(
        '(event.recurrence = :weekly AND event.dayOfWeek = :dayOfWeek) OR (event.recurrence = :once AND event.specificDate = :date)',
        {
          weekly: EventRecurrence.WEEKLY,
          dayOfWeek,
          once: EventRecurrence.ONCE,
          date: dateStr,
        },
      )
      .getMany();
  }

  private assertRecurrenceFields(
    recurrence: EventRecurrence,
    dayOfWeek?: number,
    specificDate?: string,
  ): void {
    if (recurrence === EventRecurrence.WEEKLY && dayOfWeek === undefined) {
      throw new BadRequestException(
        'Sự kiện lặp hàng tuần (WEEKLY) phải có dayOfWeek (0-6)',
      );
    }
    if (recurrence === EventRecurrence.ONCE && !specificDate) {
      throw new BadRequestException(
        'Sự kiện diễn ra một lần (ONCE) phải có specificDate',
      );
    }
  }
}
