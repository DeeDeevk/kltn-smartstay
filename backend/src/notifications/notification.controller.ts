import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
  Param,
  ParseUUIDPipe,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

// Thông báo luôn là "của chính tôi" — không có endpoint nào xem được thông báo của
// người khác, userId lấy từ token chứ không nhận từ client.
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findMine(
    @Req() req: AuthenticatedRequest,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.notificationService.findMine(req.user.userId, page, limit);
  }

  // Đặt trước route động bên dưới để 'read-all' không bị hiểu thành một id.
  @Patch('read-all')
  markAllRead(@Req() req: AuthenticatedRequest) {
    return this.notificationService.markAllRead(req.user.userId);
  }

  @Patch(':id/read')
  markRead(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.notificationService.markRead(req.user.userId, id);
  }
}
