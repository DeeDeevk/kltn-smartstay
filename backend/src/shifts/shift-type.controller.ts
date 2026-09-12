import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ShiftTypeService } from './shift-type.service';
import { CreateShiftTypeDto } from './dto/create-shift-type.dto';
import { UpdateShiftTypeDto } from './dto/update-shift-type.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('shift-types')
export class ShiftTypeController {
  constructor(private readonly shiftTypeService: ShiftTypeService) {}

  // Mở cho mọi user đã đăng nhập (kể cả STAFF) vì cần hiển thị tên/giờ ca khi
  // xem lịch phân ca của chính mình — chỉ ADMIN mới được tạo/sửa/xoá loại ca.
  @Get()
  @UseGuards(JwtAuthGuard)
  findAll() {
    return this.shiftTypeService.findAll();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateShiftTypeDto) {
    return this.shiftTypeService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftTypeDto,
  ) {
    return this.shiftTypeService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.shiftTypeService.remove(id);
  }
}
