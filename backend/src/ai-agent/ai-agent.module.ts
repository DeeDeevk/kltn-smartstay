import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiConversation } from './entities/ai-conversation.entity';
import { AiMessage } from './entities/ai-message.entity';
import { AiAgentController } from './ai-agent.controller';
import { AiAgentService } from './ai-agent.service';
import { AiAgentToolsService } from './tools/ai-agent-tools.service';
import { LLM_PROVIDER } from './llm/llm-provider.interface';
import { GeminiProvider } from './llm/gemini.provider';
import { ReservationsModule } from '../reservations/reservations.module';
import { PromotionModule } from '../promotions/promotion.module';
import { ServiceModule } from '../services/service.module';
import { PaymentModule } from '../payments/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiConversation, AiMessage]),
    ReservationsModule,
    PromotionModule,
    ServiceModule,
    PaymentModule,
  ],
  controllers: [AiAgentController],
  providers: [
    AiAgentService,
    AiAgentToolsService,
    // Đổi provider sau này (VD sang Claude) chỉ cần thay useClass ở đây.
    { provide: LLM_PROVIDER, useClass: GeminiProvider },
  ],
})
export class AiAgentModule {}
