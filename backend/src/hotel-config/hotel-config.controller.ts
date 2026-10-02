import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { HotelConfigService } from './hotel-config.service';
import { PlacesService } from './places.service';
import { UpdateHotelLocationDto } from './dto/update-hotel-location.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('hotel-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class HotelConfigController {
  constructor(
    private readonly hotelConfigService: HotelConfigService,
    // Inject thẳng ở đây (không phải trong HotelConfigService) để tránh circular
    // dependency: PlacesService vốn đã inject HotelConfigService (dùng toạ độ để gọi
    // Google Places).
    private readonly placesService: PlacesService,
  ) {}

  @Get()
  getConfig() {
    return this.hotelConfigService.getOrCreate();
  }

  @Patch('location')
  async updateLocation(@Body() dto: UpdateHotelLocationDto) {
    const config = await this.hotelConfigService.updateLocation(dto);
    // Vị trí đổi -> địa điểm gần đây đã cache (tính từ toạ độ cũ) không còn đúng nữa.
    await this.placesService.invalidateNearbyCache();
    return config;
  }
}
