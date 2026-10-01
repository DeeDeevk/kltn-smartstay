import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotelConfig } from './entities/hotel-config.entity';
import { LocalEvent } from './entities/local-event.entity';
import { EventScanRun } from './entities/event-scan-run.entity';
import { LocalPlace } from './entities/local-place.entity';
import { HotelConfigController } from './hotel-config.controller';
import { LocalEventController } from './local-event.controller';
import { LocalPlaceController } from './local-place.controller';
import { HotelConfigService } from './hotel-config.service';
import { LocalEventService } from './local-event.service';
import { LocalEventExtractionService } from './local-event-extraction.service';
import { LocalEventAutoScanService } from './local-event-auto-scan.service';
import { LocalEventAutoScanJob } from './local-event-auto-scan.job';
import { LocalPlaceService } from './local-place.service';
import { LocalPlaceExtractionService } from './local-place-extraction.service';
import { SourceContentService } from './source-content.service';
import { PlacesService } from './places.service';
import { RedisModule } from '../redis/redis.module';
import { LlmModule } from '../ai-agent/llm/llm.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HotelConfig,
      LocalEvent,
      EventScanRun,
      LocalPlace,
    ]),
    RedisModule,
    // Cho LocalEventExtractionService/LocalEventAutoScanService/LocalPlaceExtractionService
    // -> GeminiProvider (các tính năng AI hỗ trợ/tự động trích xuất).
    LlmModule,
  ],
  controllers: [
    HotelConfigController,
    LocalEventController,
    LocalPlaceController,
  ],
  providers: [
    HotelConfigService,
    LocalEventService,
    LocalEventExtractionService,
    LocalEventAutoScanService,
    LocalEventAutoScanJob,
    LocalPlaceService,
    LocalPlaceExtractionService,
    // Dùng chung giữa LocalEventExtractionService và LocalPlaceExtractionService — xem
    // source-content.service.ts.
    SourceContentService,
    PlacesService,
  ],
  // Export để ai-agent gọi thẳng (PlacesService, LocalEventService, LocalPlaceService) mà
  // không qua HTTP nội bộ, đúng pattern các tool khác (search_rooms, get_promotions...).
  exports: [
    HotelConfigService,
    LocalEventService,
    LocalPlaceService,
    PlacesService,
  ],
})
export class HotelConfigModule {}
