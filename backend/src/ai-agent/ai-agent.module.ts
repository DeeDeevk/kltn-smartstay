import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { Faq } from './entities/faq.entity';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { AiAgentToolsService } from './tools/ai-agent-tools.service';
import { FaqEmbeddingService } from './rag/faq-embedding.service';
import { FaqController } from './faq/faq.controller';
import { FaqService } from './faq/faq.service';
import { LlmModule } from './llm/llm.module';
import { ReservationsModule } from '../reservations/reservations.module';
import { PromotionModule } from '../promotions/promotion.module';
import { ServiceModule } from '../services/service.module';
import { PaymentModule } from '../payments/payment.module';
import { HotelConfigModule } from '../hotel-config/hotel-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiConversation, AiMessage, Faq]),
    ReservationsModule,
    PromotionModule,
    ServiceModule,
    PaymentModule,
    HotelConfigModule,
    // Cung cấp LLM_PROVIDER (GeminiProvider) — tách ra module riêng để tính năng AI
    // trích xuất của hotel-config import được cùng client mà không tạo vòng lặp import
    // AiAgentModule <-> HotelConfigModule. Đổi provider sau này (VD sang Claude) chỉ cần
    // sửa useClass/useExisting trong llm.module.ts.
    LlmModule,
  ],
  controllers: [AiAgentController, FaqController],
  providers: [
    AiAgentService,
    AiAgentToolsService,
    FaqEmbeddingService,
    FaqService,
  ],
})
export class AiAgentModule {}
