import { Module } from '@nestjs/common';
import { LLM_PROVIDER } from './llm-provider.interface';
import { GeminiProvider } from './gemini.provider';

// Tách ra khỏi AiAgentModule để các module khác dùng lại ĐÚNG client/config API key Gemini
// này, thay vì dựng thêm 1 kết nối GoogleGenerativeAI thứ hai với logic đọc biến môi
// trường trùng lặp — VD tính năng "AI trích xuất sự kiện địa phương" của hotel-config
// (LocalEventExtractionService) inject GeminiProvider trực tiếp từ đây thay vì qua
// interface LLM_PROVIDER (interface đó chỉ mô hình hoá vòng lặp chat gọi-tool của agent;
// trích xuất là 1 lệnh gọi JSON one-shot, hoàn toàn khác dạng request).
// Dùng useExisting (không phải useClass) để cả token GeminiProvider lẫn symbol
// LLM_PROVIDER đều trỏ về đúng 1 singleton — chỉ 1 client, không phải 2.
@Module({
  providers: [
    GeminiProvider,
    { provide: LLM_PROVIDER, useExisting: GeminiProvider },
  ],
  exports: [GeminiProvider, LLM_PROVIDER],
})
export class LlmModule {}
