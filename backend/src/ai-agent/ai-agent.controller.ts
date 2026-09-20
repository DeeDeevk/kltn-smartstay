import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../common/guards/optional-jwt-auth.guard';
import { AiAgentService } from './ai-agent.service';
import { SendMessageDto } from './dto/send-message.dto';

// user là optional: khách vãng lai (chưa đăng nhập) vẫn chat được để hỏi phòng, giá và
// chính sách; chỉ thao tác đặt phòng mới cần tài khoản.
interface AuthenticatedRequest extends Request {
  user?: { userId: string; email: string; role: string };
}

// Mỗi tin nhắn gọi Gemini (tốn quota/tiền) nên chặt hơn mức mặc định toàn cục 30 lần/phút.
// Hạn mức theo tài khoản mỗi ngày do AiAgentService kiểm tra riêng (chặn cả trường hợp đổi IP).
const AI_CHAT_THROTTLE = { default: { limit: 10, ttl: 60000 } };

@Controller('ai-agent')
@UseGuards(OptionalJwtAuthGuard)
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Post('chat')
  @Throttle(AI_CHAT_THROTTLE)
  chat(@Req() req: AuthenticatedRequest, @Body() dto: SendMessageDto) {
    // Truyền cả role: tool tra cứu đơn đặt phòng giới hạn phạm vi dữ liệu theo vai trò
    // (khách chỉ xem đơn của mình, lễ tân/admin xem toàn bộ đơn của khách sạn).
    return this.aiAgentService.sendMessage(
      req.user?.userId ?? null,
      dto,
      req.user?.role ?? 'GUEST',
    );
  }

  @Get('conversations/:id')
  getHistory(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.aiAgentService.getHistory(id, req.user?.userId ?? null);
  }
}
