import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseFilePipeBuilder,
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
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { LocalEventService } from './local-event.service';
import { LocalEventExtractionService } from './local-event-extraction.service';
import { LocalEventAutoScanService } from './local-event-auto-scan.service';
import { CreateLocalEventDto } from './dto/create-local-event.dto';
import { UpdateLocalEventDto } from './dto/update-local-event.dto';
import { ExtractLocalEventsDto } from './dto/extract-local-events.dto';
import { TriggerAutoScanDto } from './dto/trigger-auto-scan.dto';
import { QueryScanRunsDto } from './dto/query-scan-runs.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { EventScanTriggeredBy } from '../common/enums/event-scan-triggered-by.enum';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

// 3 endpoint gọi Gemini đều tốn quota free tier, extract()/autoScan() còn kéo theo lưu
// lượng mạng ngoài (fetch link / search-grounding) — chặt hơn mức mặc định toàn cục để 1
// admin bấm liên tục không vô tình đốt hết quota chung của cả hệ thống. Cùng mức với
// AI_CHAT_THROTTLE (ai-agent.controller.ts) vì bản chất là cùng loại chi phí (1 request =
// 1 lượt gọi LLM).
const EXTRACT_THROTTLE = { default: { limit: 5, ttl: 60000 } };

@Controller('local-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class LocalEventController {
  constructor(
    private readonly localEventService: LocalEventService,
    private readonly localEventExtractionService: LocalEventExtractionService,
    private readonly localEventAutoScanService: LocalEventAutoScanService,
  ) {}

  @Post('extract')
  @Throttle(EXTRACT_THROTTLE)
  extract(@Body() dto: ExtractLocalEventsDto) {
    return this.localEventExtractionService.extract(dto);
  }

  @Post('auto-scan')
  @Throttle(EXTRACT_THROTTLE)
  autoScan(@Req() req: AuthenticatedRequest, @Body() dto: TriggerAutoScanDto) {
    return this.localEventAutoScanService.scan(
      dto.fromDate,
      dto.toDate,
      EventScanTriggeredBy.MANUAL,
      req.user.userId,
    );
  }

  // Đặt TRƯỚC @Get(':id') — nếu không, "/local-events/scan-runs" sẽ bị NestJS hiểu nhầm
  // thành @Get(':id') với id = "scan-runs" vì route động 1 đoạn khớp trước route tĩnh khai
  // sau nó.
  @Get('scan-runs')
  findScanRuns(@Query() query: QueryScanRunsDto) {
    return this.localEventService.findScanRuns(query);
  }

  @Get('scan-runs/:id')
  findScanRunById(@Param('id') id: string) {
    return this.localEventService.findScanRunById(id);
  }

  // Kiểm tra dung lượng ở đây (ParseFilePipeBuilder) trước khi file chạm tới service —
  // đuôi file/nội dung để LocalEventExtractionService tự kiểm tra tiếp (mimetype trình
  // duyệt gửi lên không đáng tin cho .docx).
  @Post('extract-file')
  @Throttle(EXTRACT_THROTTLE)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  extractFromFile(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: true,
        }),
    )
    file: Express.Multer.File,
  ) {
    return this.localEventExtractionService.extractFromFile(file);
  }

  @Get()
  findAll() {
    return this.localEventService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.localEventService.findByIdForAdmin(id);
  }

  @Post()
  create(@Body() dto: CreateLocalEventDto) {
    return this.localEventService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocalEventDto) {
    return this.localEventService.update(id, dto);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.localEventService.approve(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.localEventService.remove(id);
  }
}
