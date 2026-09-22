import { Module } from '@nestjs/common';
import { LLM_PROVIDER } from './llm-provider.interface';
import { GeminiProvider } from './gemini.provider';

// Extracted out of AiAgentModule so other modules can reuse the SAME Gemini client/API-key
// config instead of standing up a second GoogleGenerativeAI connection with duplicated env
// var handling — e.g. hotel-config's AI-assisted local event extraction
// (LocalEventExtractionService) injects GeminiProvider directly from here rather than going
// through the LLM_PROVIDER interface (that interface only models the agent's tool-calling
// chat loop; extraction is a one-shot JSON call, a different shape of request entirely).
// useExisting (not useClass) so both the GeminiProvider token and the LLM_PROVIDER symbol
// resolve to the exact same singleton instance — one client, not two.
@Module({
  providers: [
    GeminiProvider,
    { provide: LLM_PROVIDER, useExisting: GeminiProvider },
  ],
  exports: [GeminiProvider, LLM_PROVIDER],
})
export class LlmModule {}
