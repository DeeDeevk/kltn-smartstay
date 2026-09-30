import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationService } from './notification.service';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

// Mọi endpoint chỉ thao tác trên thông báo của chính user đang đăng nhập.
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  findMine(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryNotificationDto,
  ) {
    return this.notificationService.findMine(
      req.user.userId,
      query.isRead,
      query.page,
    );
  }

  @Get('unread-count')
  unreadCount(@Req() req: AuthenticatedRequest) {
    return this.notificationService.unreadCount(req.user.userId);
  }

  // Khai báo trước ':id/read' để "read-all" không bị hiểu nhầm là một id.
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
