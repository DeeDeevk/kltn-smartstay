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
import { PaymentService } from './payment.service';
import { CheckoutLinkDto } from './dto/checkout-link.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

@Controller('payments/payos')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post(':bookingId/link')
  @UseGuards(JwtAuthGuard)
  createLink(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.paymentService.createLinkForBooking(bookingId, req.user);
  }

  // Lễ tân tạo QR PayOS để thu phần còn lại khi trả phòng (số tiền do màn Check-out gửi lên).
  @Post(':bookingId/checkout-link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  createCheckoutLink(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
    @Body() dto: CheckoutLinkDto,
  ) {
    return this.paymentService.createCheckoutLink(
      bookingId,
      dto.amount,
      req.user,
    );
  }

  // Lễ tân bấm "Kiểm tra" ở màn Check-out — hỏi PayOS xem link vừa tạo đã trả chưa.
  @Get(':bookingId/checkout-sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STAFF, UserRole.ADMIN)
  checkoutSync(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.paymentService.checkoutSyncStatus(bookingId, req.user);
  }

  @Get(':bookingId/sync')
  @UseGuards(JwtAuthGuard)
  sync(
    @Req() req: AuthenticatedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.paymentService.syncStatus(bookingId, req.user);
  }

  // PayOS gọi endpoint này server-to-server khi có giao dịch — chỉ nhận được khi
  // backend có URL public (không hoạt động trên localhost), không cần auth.
  @Post('webhook')
  webhook(@Body() body: unknown) {
    return this.paymentService.handleWebhook(body);
  }
}
