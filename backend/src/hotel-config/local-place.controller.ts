import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LocalPlaceService } from './local-place.service';
import { LocalPlaceExtractionService } from './local-place-extraction.service';
import { CreateLocalPlaceDto } from './dto/create-local-place.dto';
import { UpdateLocalPlaceDto } from './dto/update-local-place.dto';
import { ExtractLocalPlacesDto } from './dto/extract-local-places.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

// Endpoint gọi Gemini tốn quota free tier, còn kéo theo tải mạng ngoài (fetch link) — cùng
// mức với EXTRACT_THROTTLE ở local-event.controller.ts (local-events/extract).
const EXTRACT_THROTTLE = { default: { limit: 5, ttl: 60000 } };

@Controller('local-places')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class LocalPlaceController {
  constructor(
    private readonly localPlaceService: LocalPlaceService,
    private readonly localPlaceExtractionService: LocalPlaceExtractionService,
  ) {}

  @Post('extract')
  @Throttle(EXTRACT_THROTTLE)
  extract(@Body() dto: ExtractLocalPlacesDto) {
    return this.localPlaceExtractionService.extract(dto);
  }

  @Get()
  findAll() {
    return this.localPlaceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.localPlaceService.findByIdForAdmin(id);
  }

  @Post()
  create(@Body() dto: CreateLocalPlaceDto) {
    return this.localPlaceService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocalPlaceDto) {
    return this.localPlaceService.update(id, dto);
  }

  @Patch(':id/approve')
  approve(@Param('id') id: string) {
    return this.localPlaceService.approve(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.localPlaceService.remove(id);
  }
}
