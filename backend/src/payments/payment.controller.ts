import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { PaymentService } from './payment.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

@Controller('payments/payos')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':bookingId/link')
  @UseGuards(JwtAuthGuard)
  createLink(@Req() req: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    return this.paymentService.createLinkForBooking(bookingId, req.user);
  }

  @Get(':bookingId/sync')
  @UseGuards(JwtAuthGuard)
  sync(@Req() req: AuthenticatedRequest, @Param('bookingId') bookingId: string) {
    return this.paymentService.syncStatus(bookingId, req.user);
  }

  // PayOS gọi endpoint này server-to-server khi có giao dịch — chỉ nhận được khi
  // backend có URL public (không hoạt động trên localhost), không cần auth.
  @Post('webhook')
  webhook(@Body() body: unknown) {
    return this.paymentService.handleWebhook(body);
  }
}
