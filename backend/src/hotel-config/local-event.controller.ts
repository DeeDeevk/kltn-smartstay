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
import { LocalEventService } from './local-event.service';
import { CreateLocalEventDto } from './dto/create-local-event.dto';
import { UpdateLocalEventDto } from './dto/update-local-event.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('local-events')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class LocalEventController {
  constructor(private readonly localEventService: LocalEventService) {}

  @Get()
  findAll() {
    return this.localEventService.findAll();
  }

  @Post()
  create(@Body() dto: CreateLocalEventDto) {
    return this.localEventService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLocalEventDto) {
    return this.localEventService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.localEventService.remove(id);
  }
}
