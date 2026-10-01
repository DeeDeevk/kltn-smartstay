import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LocalEventAutoScanService } from './local-event-auto-scan.service';
import { EventScanTriggeredBy } from 'src/common/enums/event-scan-triggered-by.enum';
import { EventScanStatus } from 'src/common/enums/event-scan-status.enum';

// Tự quét sự kiện 2 tuần tới, chạy mỗi tuần 1 lần — khoảng [hôm nay, hôm nay+14] luôn được
// tính LẠI mỗi lần chạy (không hard-code ngày cố định), nên lần chạy tuần sau tự động dịch
// theo đúng thời điểm chạy đó, không bị lệch theo thời gian.
@Injectable()
export class LocalEventAutoScanJob {
  private readonly logger = new Logger(LocalEventAutoScanJob.name);

  constructor(private readonly autoScanService: LocalEventAutoScanService) {}

  @Cron(CronExpression.EVERY_WEEK)
  async handle() {
    const fromDate = this.toDateStr(new Date());
    const toDate = this.toDateStr(this.addDays(new Date(), 14));

    try {
      const run = await this.autoScanService.scan(
        fromDate,
        toDate,
        EventScanTriggeredBy.CRON,
        null,
      );
      if (run.status === EventScanStatus.SUCCESS) {
        this.logger.log(
          `Quét tự động ${fromDate} → ${toDate}: tạo ${run.createdEventsCount} sự kiện, bỏ qua ${run.skippedDuplicateCount} trùng.`,
        );
      } else {
        this.logger.warn(
          `Quét tự động ${fromDate} → ${toDate} thất bại: ${run.errorMessage}`,
        );
      }
    } catch (err) {
      // scan() chỉ throw trước khi kịp ghi EventScanRun (vd. đang có lượt quét khác chạy,
      // hoặc validate khoảng ngày thất bại — không thể xảy ra ở đây vì khoảng ngày tự tính
      // luôn hợp lệ, nhưng vẫn bắt phòng hờ để cron không làm sập tiến trình backend).
      this.logger.error(
        `Quét tự động ${fromDate} → ${toDate} lỗi trước khi ghi nhật ký: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private toDateStr(date: Date): string {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }
}
