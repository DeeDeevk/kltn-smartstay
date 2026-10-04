import {
  Body,
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
import { RefundRequestService } from './refund-request.service';
import { QueryRefundRequestDto } from './dto/query-refund-request.dto';
import { CompleteRefundRequestDto } from './dto/complete-refund-request.dto';
import { RejectRefundRequestDto } from './dto/reject-refund-request.dto';
import { LinkConversationDto } from './dto/link-conversation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

// Quy trình BÁN TỰ ĐỘNG (xem chú thích đầu RefundRequest entity) — mọi endpoint ở đây chỉ
// ghi nhận/đổi trạng thái, KHÔNG gọi bất kỳ API PayOS nào để tự động chuyển tiền.
//
// ADMIN + STAFF (không chỉ ADMIN): STAFF mới là người trực tiếp xem hội thoại/ảnh QR xác
// minh (GET /chat/conversations/:id/messages vẫn CHỈ cho STAFF, xem
// ChatService.assertCanAccess — cố tình KHÔNG nới lỏng cho ADMIN ở đây), nên STAFF cần tự
// đánh dấu hoàn tiền/từ chối sau khi xác minh xong; ADMIN xem để giám sát tổng thể.
@Controller('refund-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.STAFF)
export class RefundRequestController {
  constructor(private readonly refundRequestService: RefundRequestService) {}

  // Khách TỰ xem được yêu cầu hoàn tiền của CHÍNH MÌNH (lọc theo userId đang đăng nhập,
  // không phải xem của người khác) — trang "Lịch sử đặt phòng" cần hiện trạng thái này cho
  // khách thay vì chỉ có thông báo. @Roles ở ĐÂY ghi đè @Roles(ADMIN, STAFF) của class
  // (Reflector.getAllAndOverride ưu tiên method-level) — phải khai đủ cả 3 role, không bỏ
  // trống @Roles vì RolesGuard fail-closed khi không có metadata nào.
  //
  // Đặt TRƯỚC @Get(':id') — nếu không, "/refund-requests/mine" sẽ bị hiểu nhầm thành
  // @Get(':id') với id = "mine" vì route động khớp trước route tĩnh khai sau nó.
  @Get('mine')
  @Roles(UserRole.CUSTOMER, UserRole.STAFF, UserRole.ADMIN)
  findMine(@Req() req: AuthenticatedRequest) {
    return this.refundRequestService.findMine(req.user.userId);
  }

  @Get()
  findAll(@Query() query: QueryRefundRequestDto) {
    return this.refundRequestService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.refundRequestService.findById(id);
  }

  @Patch(':id/complete')
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteRefundRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.refundRequestService.complete(id, dto, req.user.userId);
  }

  @Patch(':id/reject')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectRefundRequestDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.refundRequestService.reject(id, dto, req.user.userId);
  }

  @Patch(':id/conversation')
  linkConversation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkConversationDto,
  ) {
    return this.refundRequestService.linkConversation(id, dto);
  }
}
