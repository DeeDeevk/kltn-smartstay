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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { LocalEventService } from './local-event.service';
import { LocalEventExtractionService } from './local-event-extraction.service';
import { CreateLocalEventDto } from './dto/create-local-event.dto';
import { UpdateLocalEventDto } from './dto/update-local-event.dto';
import { ExtractLocalEventsDto } from './dto/extract-local-events.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('local-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class LocalEventController {
  constructor(
    private readonly localEventService: LocalEventService,
    private readonly localEventExtractionService: LocalEventExtractionService,
  ) {}

  @Post('extract')
  extract(@Body() dto: ExtractLocalEventsDto) {
    return this.localEventExtractionService.extract(dto);
  }

  // Kiểm tra dung lượng ở đây (ParseFilePipeBuilder) trước khi file chạm tới service —
  // đuôi file/nội dung để LocalEventExtractionService tự kiểm tra tiếp (mimetype trình
  // duyệt gửi lên không đáng tin cho .docx).
  @Post('extract-file')
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
