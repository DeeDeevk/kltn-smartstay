import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShiftAssignmentService } from './shift-assignment.service';

// Định kỳ dọn các ca đã hết giờ: chưa vô ca -> ABSENT, quên kết ca -> tự đóng.
// Chạy lặp nhiều lần (hoặc nhiều instance cùng chạy) vẫn cho cùng kết quả.
@Injectable()
export class ShiftAutoCloseJob {
  private readonly logger = new Logger(ShiftAutoCloseJob.name);

  constructor(
    private readonly shiftAssignmentService: ShiftAssignmentService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handle() {
    try {
      const result = await this.shiftAssignmentService.closeOverdueShifts();
      if (result.absent || result.autoClosed) {
        this.logger.log(
          `Vắng mặt: ${result.absent}, tự đóng ca: ${result.autoClosed}`,
        );
      }
    } catch (err) {
      this.logger.error('Không thể dọn ca quá giờ', err as Error);
    }
  }
}
