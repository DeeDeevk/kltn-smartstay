import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelConfig } from './entities/hotel-config.entity';
import { LocalEvent } from './entities/local-event.entity';
import { EventScanRun } from './entities/event-scan-run.entity';
import { HotelConfigController } from './hotel-config.controller';
import { LocalEventController } from './local-event.controller';
import { HotelConfigService } from './hotel-config.service';
import { LocalEventService } from './local-event.service';
import { LocalEventExtractionService } from './local-event-extraction.service';
import { LocalEventAutoScanService } from './local-event-auto-scan.service';
import { LocalEventAutoScanJob } from './local-event-auto-scan.job';
import { PlacesService } from './places.service';
import { RedisModule } from '../redis/redis.module';
import { LlmModule } from '../ai-agent/llm/llm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([HotelConfig, LocalEvent, EventScanRun]),
    RedisModule,
    // Cho LocalEventExtractionService/LocalEventAutoScanService -> GeminiProvider (các
    // tính năng AI hỗ trợ/tự động trích xuất sự kiện).
    LlmModule,
  ],
  controllers: [HotelConfigController, LocalEventController],
  providers: [
    HotelConfigService,
    LocalEventService,
    LocalEventExtractionService,
    LocalEventAutoScanService,
    LocalEventAutoScanJob,
    PlacesService,
  ],
  // Export cả 3 để ai-agent gọi thẳng (PlacesService, LocalEventService) mà không qua
  // HTTP nội bộ, đúng pattern các tool khác (search_rooms, get_promotions...).
  exports: [HotelConfigService, LocalEventService, PlacesService],
})
export class HotelConfigModule {}
