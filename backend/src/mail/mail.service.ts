import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    const port = Number(this.configService.get<string>('MAIL_PORT') || 587);

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST', 'smtp-relay.brevo.com'),
      port,
      secure: this.configService.get<string>('MAIL_SECURE', 'false') === 'true',
      auth: {
        user: this.configService.get<string>('BREVO_SMTP_LOGIN'),
        pass: this.configService.get<string>('BREVO_SMTP_KEY'),
      },
    });
  }

  async sendOtp(email: string, otp: string): Promise<void> {
    const senderEmail =
      this.configService.getOrThrow<string>('MAIL_FROM_EMAIL');
    const senderName = this.configService.get<string>(
      'MAIL_FROM_NAME',
      'Vika Hotel',
    );
    try {
      const result = await this.transporter.sendMail({
        from: {
          name: senderName,
          address: senderEmail,
        },
        to: email,
        subject: 'Mã xác thực tài khoản Vika Hotel',
        text: [
          `Mã OTP của bạn là: ${otp}`,
          'Mã có hiệu lực trong 5 phút.',
          'Nếu bạn không yêu cầu mã này, hãy bỏ qua email.',
        ].join('\n'),
        html: `
          <div style="
            max-width: 520px;
            margin: 0 auto;
            padding: 32px;
            font-family: Arial, sans-serif;
            color: #0f172a;
          ">
            <h2 style="color: #2563eb">
              Xác thực tài khoản Vika Hotel
            </h2>

            <p>Mã OTP của bạn là:</p>

            <div style="
              margin: 24px 0;
              padding: 20px;
              border-radius: 12px;
              background: #eff6ff;
              color: #2563eb;
              text-align: center;
              font-size: 32px;
              font-weight: bold;
              letter-spacing: 8px;
            ">
              ${otp}
            </div>

            <p>Mã này có hiệu lực trong 5 phút.</p>

            <p style="color: #64748b; font-size: 14px">
              Nếu bạn không yêu cầu mã này, hãy bỏ qua email.
            </p>
          </div>
        `,
      });

      this.logger.log(`OTP email accepted: ${result.messageId}`);
    } catch (error) {
      this.logger.error(
        `Không gửi được OTP tới ${email}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException('Không thể gửi email OTP');
    }
  }

  async verifyEmail(): Promise<boolean> {
    return this.transporter.verify();
  }
}
