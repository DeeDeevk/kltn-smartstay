import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface TurnstileResponse {
  success: boolean;
  hostname?: string;
  action?: string;
}

@Injectable()
export class TurnstileService {
  private readonly secretKey: string;
  private readonly allowedHostnames: Set<string>;

  constructor(config: ConfigService) {
    const secretKey = config
      .get<string>('TURNSTILE_SECRET_KEY')
      ?.trim();

    const hostnames = (
      config.get<string>('TURNSTILE_ALLOWED_HOSTNAMES') ?? ''
    )
      .split(',')
      .map((hostname) => hostname.trim())
      .filter(Boolean);

    if (!secretKey || hostnames.length === 0) {
      throw new Error('Thiếu cấu hình Turnstile trong backend/.env');
    }

    this.secretKey = secretKey;
    this.allowedHostnames = new Set(hostnames);
  }

  async verify(
    token: string,
    expectedAction: 'login' | 'register',
  ): Promise<void> {
    if (
      typeof token !== 'string' ||
      !token.trim() ||
      token.length > 2048
    ) {
      throw new BadRequestException('Token xác minh không hợp lệ.');
    }

    let result: TurnstileResponse;

    try {
      const response = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            secret: this.secretKey,
            response: token,
          }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!response.ok) {
        throw new Error('Cloudflare Siteverify không phản hồi thành công');
      }

      result = (await response.json()) as TurnstileResponse;
    } catch {
      throw new ServiceUnavailableException(
        'Dịch vụ xác minh tạm thời không khả dụng. Vui lòng thử lại.',
      );
    }

    if (
      !result ||
      result.success !== true ||
      result.action !== expectedAction ||
      !this.allowedHostnames.has(result.hostname ?? '')
    ) {
      throw new BadRequestException(
        'Xác minh bảo mật thất bại. Vui lòng xác minh lại.',
      );
    }
  }
}