import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AiAgentService } from './ai-agent.service';
import { SendMessageDto } from './dto/send-message.dto';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

@Controller('ai-agent')
@UseGuards(JwtAuthGuard)
export class AiAgentController {
  constructor(private readonly aiAgentService: AiAgentService) {}

  @Post('chat')
  chat(@Req() req: AuthenticatedRequest, @Body() dto: SendMessageDto) {
    // Truyền cả role: tool tra cứu đơn đặt phòng giới hạn phạm vi dữ liệu theo vai trò
    // (khách chỉ xem đơn của mình, lễ tân/admin xem toàn bộ đơn của khách sạn).
    return this.aiAgentService.sendMessage(req.user.userId, dto, req.user.role);
  }

  @Get('conversations/:id')
  getHistory(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.aiAgentService.getHistory(id, req.user.userId);
  }
}
