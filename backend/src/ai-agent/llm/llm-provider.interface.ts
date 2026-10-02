// Abstraction giữa business logic của ai-agent và nhà cung cấp LLM cụ thể (Gemini,
// Claude, ...). AiAgentService chỉ làm việc với các kiểu dữ liệu trung lập ở file này —
// muốn đổi sang Claude API sau này chỉ cần viết thêm 1 class implements LlmProvider,
// không phải sửa AiAgentService hay AiAgentToolsService.

export type LlmMessageRole = 'system' | 'user' | 'model' | 'tool';

export interface LlmTextPart {
  type: 'text';
  text: string;
}

export interface LlmToolCallPart {
  type: 'tool_call';
  id: string;
  name: string;
  args: Record<string, unknown>;
  // Gemini 3.x yêu cầu gửi lại nguyên vẹn thought_signature của lượt gọi tool trước đó
  // khi đưa functionCall vào lịch sử hội thoại của lượt gọi tiếp theo, nếu không sẽ bị
  // từ chối với lỗi "missing thought_signature". Provider khác không cần field này.
  thoughtSignature?: string;
}

export interface LlmToolResultPart {
  type: 'tool_result';
  id: string;
  name: string;
  result: unknown;
}

export type LlmMessagePart = LlmTextPart | LlmToolCallPart | LlmToolResultPart;

export interface LlmMessage {
  role: LlmMessageRole;
  parts: LlmMessagePart[];
}

// Schema tham số của tool ở dạng JSON-Schema tối giản, trung lập giữa các nhà cung
// cấp — mỗi provider tự dịch sang định dạng riêng của mình (VD Gemini dùng SchemaType).
export type LlmToolParameterType =
  'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';

export interface LlmToolParameterSchema {
  type: LlmToolParameterType;
  description?: string;
  enum?: string[];
  items?: LlmToolParameterSchema;
  properties?: Record<string, LlmToolParameterSchema>;
  required?: string[];
}

export interface LlmTool {
  name: string;
  description: string;
  parameters: LlmToolParameterSchema;
}

export interface LlmToolCallResult {
  id: string;
  name: string;
  args: Record<string, unknown>;
  thoughtSignature?: string;
}

export interface LlmChatResult {
  text: string | null;
  toolCalls: LlmToolCallResult[];
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmProvider {
  chat(messages: LlmMessage[], tools: LlmTool[]): Promise<LlmChatResult>;
}
