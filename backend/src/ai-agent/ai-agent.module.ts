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
    // Provides LLM_PROVIDER (GeminiProvider) — moved out to its own module so
    // hotel-config's AI extraction feature can import the same client without a
    // AiAgentModule <-> HotelConfigModule import cycle. Đổi provider sau này (VD sang
    // Claude) chỉ cần sửa useClass/useExisting trong llm.module.ts.
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
