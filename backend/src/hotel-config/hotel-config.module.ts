import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelConfig } from './entities/hotel-config.entity';
import { LocalEvent } from './entities/local-event.entity';
import { HotelConfigController } from './hotel-config.controller';
import { LocalEventController } from './local-event.controller';
import { HotelConfigService } from './hotel-config.service';
import { LocalEventService } from './local-event.service';
import { PlacesService } from './places.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [TypeOrmModule.forFeature([HotelConfig, LocalEvent]), RedisModule],
  controllers: [HotelConfigController, LocalEventController],
  providers: [HotelConfigService, LocalEventService, PlacesService],
  // Export cả 3 để ai-agent gọi thẳng (PlacesService, LocalEventService) mà không qua
  // HTTP nội bộ, đúng pattern các tool khác (search_rooms, get_promotions...).
  exports: [HotelConfigService, LocalEventService, PlacesService],
})
export class HotelConfigModule {}
