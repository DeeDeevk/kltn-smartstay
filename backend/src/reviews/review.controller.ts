import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ReviewService } from './review.service';
import { RoomTypeReviewSummaryService } from '../room-types/room-type-review-summary.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { QueryReviewDto } from './dto/query-review.dto';
import { ReplyReviewDto } from './dto/reply-review.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

@Controller('reviews')
export class ReviewController {
  constructor(
    private readonly reviewService: ReviewService,
    private readonly roomTypeReviewSummaryService: RoomTypeReviewSummaryService,
  ) {}

  // Công khai: trang chi tiết phòng hiện đánh giá cho cả khách chưa đăng nhập.
  @Get()
  findAll(@Query() query: QueryReviewDto) {
    return this.reviewService.findAll(query);
  }

  // Công khai: khối "AI tóm tắt đánh giá" trên trang chi tiết phòng. Đặt TRƯỚC 'me'/':id/reply'
  // không cần thiết ở đây vì tiền tố "room-type/" không trùng với route nào khác, nhưng vẫn
  // đặt gần đầu cho rõ ràng, theo đúng quy ước route tĩnh trước route động của file này.
  @Get('room-type/:roomTypeId/summary')
  getRoomTypeSummary(@Param('roomTypeId', ParseUUIDPipe) roomTypeId: string) {
    return this.roomTypeReviewSummaryService.getSummary(roomTypeId);
  }

  // Công khai: khu "Cảm nhận khách hàng" ngoài trang chủ.
  @Get('featured')
  findFeatured(
    @Query('limit', new DefaultValuePipe(3), ParseIntPipe) limit: number,
  ) {
    return this.reviewService.findFeatured(limit);
  }

  // Đặt TRƯỚC các route động để 'me' không bị hiểu thành tham số.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  findMine(@Req() req: AuthenticatedRequest) {
    return this.reviewService.findMine(req.user.userId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReviewDto) {
    return this.reviewService.create(req.user.userId, dto);
  }

  // Chạy bù cho các đánh giá chưa có kết quả phân tích.
  @Post('analyze-all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  analyzeAll() {
    return this.reviewService.analyzePending();
  }

  @Patch(':id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  reply(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ReplyReviewDto) {
    return this.reviewService.reply(id, dto);
  }
}
