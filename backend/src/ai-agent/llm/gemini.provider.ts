import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Content,
  FunctionDeclarationSchema,
  FunctionDeclarationsTool,
  GoogleGenerativeAI,
  Part,
  SchemaType,
} from '@google/generative-ai';
import {
  LlmChatResult,
  LlmMessage,
  LlmProvider,
  LlmTool,
  LlmToolCallResult,
  LlmToolParameterSchema,
} from './llm-provider.interface';

const SCHEMA_TYPE_MAP: Record<LlmToolParameterSchema['type'], SchemaType> = {
  string: SchemaType.STRING,
  number: SchemaType.NUMBER,
  integer: SchemaType.INTEGER,
  boolean: SchemaType.BOOLEAN,
  array: SchemaType.ARRAY,
  object: SchemaType.OBJECT,
};

@Injectable()
export class GeminiProvider implements LlmProvider {
  private readonly logger = new Logger(GeminiProvider.name);
  private readonly client: GoogleGenerativeAI;
  private readonly modelName: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new InternalServerErrorException(
        'Thiếu biến môi trường GEMINI_API_KEY',
      );
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.modelName =
      this.config.get<string>('GEMINI_MODEL') ?? 'gemini-flash-lite-latest';
  }

  async chat(messages: LlmMessage[], tools: LlmTool[]): Promise<LlmChatResult> {
    const systemInstruction = messages
      .filter((m) => m.role === 'system')
      .flatMap((m) => m.parts)
      .filter(
        (p): p is Extract<typeof p, { type: 'text' }> => p.type === 'text',
      )
      .map((p) => p.text)
      .join('\n\n');

    const contents: Content[] = messages
      .filter((m) => m.role !== 'system')
      .map((m) => this.toGeminiContent(m));

    const model = this.client.getGenerativeModel({
      model: this.modelName,
      systemInstruction: systemInstruction || undefined,
      tools: tools.length > 0 ? [this.toGeminiTool(tools)] : undefined,
    });

    const result = await model.generateContent({ contents });
    const candidate = result.response.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];

    let text: string | null = null;
    const toolCalls: LlmToolCallResult[] = [];
    let callIndex = 0;
    for (const part of parts) {
      if (part.text) {
        text = (text ?? '') + part.text;
      } else if (part.functionCall) {
        toolCalls.push({
          // Gemini không cấp id cho function call -> tự sinh id ổn định trong
          // phạm vi 1 lượt trả lời để ghép đúng cặp functionCall/functionResponse.
          id: `${part.functionCall.name}-${callIndex}`,
          name: part.functionCall.name,
          args: (part.functionCall.args ?? {}) as Record<string, unknown>,
          // SDK @google/generative-ai chưa khai báo field này trong type Part, nhưng
          // Gemini 3.x vẫn trả về trong response JSON thật -> đọc qua `unknown` cast.
          thoughtSignature: (part as unknown as { thoughtSignature?: string })
            .thoughtSignature,
        });
        callIndex += 1;
      }
    }

    return { text, toolCalls };
  }

  private toGeminiContent(message: LlmMessage): Content {
    if (message.role === 'tool') {
      const parts: Part[] = message.parts
        .filter((p) => p.type === 'tool_result')
        .map((p) => {
          const toolResult = p;
          return {
            functionResponse: {
              name: toolResult.name,
              response: { content: toolResult.result },
            },
          };
        });
      return { role: 'user', parts };
    }

    const parts: Part[] = message.parts.map((p) => {
      if (p.type === 'text') return { text: p.text };
      if (p.type === 'tool_call') {
        return {
          functionCall: { name: p.name, args: p.args },
          ...(p.thoughtSignature
            ? { thoughtSignature: p.thoughtSignature }
            : {}),
        };
      }
      // 'tool_result' không xuất hiện trong message role user/model.
      this.logger.warn(`Unexpected part type in role=${message.role}`);
      return { text: '' };
    });

    return { role: message.role === 'model' ? 'model' : 'user', parts };
  }

  private toGeminiTool(tools: LlmTool[]): FunctionDeclarationsTool {
    return {
      functionDeclarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: this.toGeminiSchema(
          tool.parameters,
        ) as FunctionDeclarationSchema,
      })),
    };
  }

  private toGeminiSchema(schema: LlmToolParameterSchema): unknown {
    return {
      type: SCHEMA_TYPE_MAP[schema.type],
      description: schema.description,
      enum: schema.enum,
      items: schema.items ? this.toGeminiSchema(schema.items) : undefined,
      properties: schema.properties
        ? Object.fromEntries(
            Object.entries(schema.properties).map(([key, value]) => [
              key,
              this.toGeminiSchema(value),
            ]),
          )
        : undefined,
      required: schema.required,
    };
  }
}
