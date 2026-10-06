import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { RefundRequestService } from './refund-request.service';
import { UploadService } from '../uploads/upload.service';
import { QueryRefundRequestDto } from './dto/query-refund-request.dto';
import { CompleteRefundRequestDto } from './dto/complete-refund-request.dto';
import { RejectRefundRequestDto } from './dto/reject-refund-request.dto';
import { LinkConversationDto } from './dto/link-conversation.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

// Ảnh biên lai lưu riêng khỏi "room-types"/"chat" (xem UploadService.uploadImage keyPrefix),
// cùng giới hạn định dạng/kích thước với POST /chat/attachments.
const REFUND_PROOF_KEY_PREFIX = 'vikahotel/refund-proof';

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
  constructor(
    private readonly refundRequestService: RefundRequestService,
    private readonly uploadService: UploadService,
  ) {}

  // Admin/STAFF chọn ảnh biên lai -> upload trước lấy URL (cùng pattern POST /chat/
  // attachments, tái dùng đúng UploadService.uploadImage), rồi FE gửi URL đó kèm adminNote
  // vào PATCH :id/complete. Không thêm @Roles riêng -> kế thừa @Roles(ADMIN, STAFF) ở
  // class-level, giống mọi endpoint refund-requests khác (STAFF là người trực tiếp đánh dấu
  // hoàn tiền sau khi xác minh qua chat, nên cũng là người cần upload ảnh này).
  @Post('attachments')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadAttachment(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.uploadService.uploadImage(
      file,
      REFUND_PROOF_KEY_PREFIX,
    );
    return { url: result.url };
  }

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

  // Ghép thêm refundProcessingSlaHours/qrImageUrl ở ĐÂY (controller) thay vì đổi return type
  // của RefundRequestService.findById() — hàm đó còn được dùng nội bộ bởi complete()/
  // reject()/linkConversation()/assertPending() để lấy entity rồi save() lại, đổi shape của
  // nó sẽ rủi ro cho các chỗ dùng nội bộ đó (KAN-122/123).
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const [refund, refundProcessingSlaHours] = await Promise.all([
      this.refundRequestService.findById(id),
      this.refundRequestService.getRefundProcessingSlaHours(),
    ]);
    return {
      ...refund,
      refundProcessingSlaHours,
      qrImageUrl: this.refundRequestService.buildQrImageUrl(refund),
    };
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
