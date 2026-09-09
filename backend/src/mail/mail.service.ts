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

  async sendOtp(email: string, otp: string, ttlSeconds: number): Promise<void> {
    await this.sendOtpEmail({
      email,
      otp,
      ttlSeconds,
      subject: 'Mã xác thực tài khoản Vika Hotel',
      heading: 'Xác thực tài khoản Vika Hotel',
      warning: 'Nếu bạn không yêu cầu mã này, hãy bỏ qua email.',
    });
  }

  async sendPasswordResetOtp(
    email: string,
    otp: string,
    ttlSeconds: number,
  ): Promise<void> {
    await this.sendOtpEmail({
      email,
      otp,
      ttlSeconds,
      subject: 'Đặt lại mật khẩu Vika Hotel',
      heading: 'Đặt lại mật khẩu Vika Hotel',
      warning:
        'Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này — mật khẩu của bạn sẽ không thay đổi.',
    });
  }

  // Gửi thông tin đăng nhập cho nhân viên vừa được Admin tạo tài khoản. Đây là
  // nơi DUY NHẤT mật khẩu tạm xuất hiện dạng plaintext — sau khi gửi, hệ thống
  // chỉ còn lưu bản hash, nên nếu email này gửi thất bại thì AuthService.createStaff
  // sẽ rollback luôn việc tạo tài khoản.
  async sendStaffCredentials(
    email: string,
    fullName: string,
    tempPassword: string,
  ): Promise<void> {
    const senderEmail =
      this.configService.getOrThrow<string>('MAIL_FROM_EMAIL');
    const senderName = this.configService.get<string>(
      'MAIL_FROM_NAME',
      'Vika Hotel',
    );
    const loginUrl = `${this.configService.get<string>(
      'CORS_ORIGIN',
      'http://localhost:5173',
    )}/login`;

    try {
      const result = await this.transporter.sendMail({
        from: { name: senderName, address: senderEmail },
        to: email,
        subject: 'Tài khoản nhân viên Vika Hotel của bạn đã được tạo',
        text: [
          `Xin chào ${fullName},`,
          '',
          'Quản trị viên hệ thống Vika Hotel vừa tạo cho bạn một tài khoản nhân viên ' +
            'để đăng nhập vào trang quản trị (Vika Hotel Admin). Từ tài khoản này, bạn ' +
            'có thể sử dụng các chức năng được phân quyền như xem sơ đồ phòng, quản lý ' +
            'ca làm việc, xử lý check-in/check-out cho khách và các nghiệp vụ khác tuỳ ' +
            'theo vai trò được cấp.',
          '',
          'Thông tin đăng nhập lần đầu của bạn:',
          `- Tên đăng nhập (email): ${email}`,
          `- Mật khẩu tạm thời: ${tempPassword}`,
          `- Đăng nhập tại: ${loginUrl}`,
          '',
          'Vì đây là mật khẩu tạm do hệ thống tự sinh, ngay khi đăng nhập lần đầu ' +
            'tiên bạn sẽ được yêu cầu đổi sang mật khẩu mới do chính bạn đặt trước ' +
            'khi có thể sử dụng các chức năng khác.',
          '',
          'Lưu ý bảo mật: không chia sẻ mật khẩu này cho bất kỳ ai, kể cả đồng nghiệp ' +
            'hay quản trị viên. Nếu bạn không biết về việc tài khoản này được tạo, ' +
            'hoặc nghi ngờ có sai sót, vui lòng liên hệ ngay với quản trị viên/bộ phận ' +
            'quản lý nhân sự của khách sạn để được hỗ trợ và khoá tài khoản kịp thời.',
          '',
          'Trân trọng,',
          'Vika Hotel',
        ].join('\n'),
        html: `
          <div style="
            max-width: 560px;
            margin: 0 auto;
            padding: 32px;
            font-family: Arial, sans-serif;
            color: #0f172a;
          ">
            <h2 style="color: #2563eb">Tài khoản nhân viên của bạn đã được tạo</h2>

            <p>Xin chào <strong>${fullName}</strong>,</p>

            <p>
              Quản trị viên hệ thống <strong>Vika Hotel</strong> vừa tạo cho bạn một
              tài khoản nhân viên để đăng nhập vào trang quản trị (Vika Hotel Admin).
              Từ tài khoản này, bạn có thể sử dụng các chức năng được phân quyền như
              xem sơ đồ phòng, quản lý ca làm việc, xử lý check-in/check-out cho khách
              và các nghiệp vụ khác tuỳ theo vai trò được cấp.
            </p>

            <div style="
              margin: 24px 0;
              padding: 20px;
              border-radius: 12px;
              background: #eff6ff;
            ">
              <p style="margin: 0 0 8px">
                Tên đăng nhập (email): <strong>${email}</strong>
              </p>
              <p style="margin: 0; font-size: 15px">
                Mật khẩu tạm thời:
                <span style="
                  display: inline-block;
                  margin-left: 6px;
                  padding: 4px 10px;
                  border-radius: 8px;
                  background: #fff;
                  color: #2563eb;
                  font-weight: bold;
                  letter-spacing: 2px;
                ">${tempPassword}</span>
              </p>
            </div>

            <p style="text-align: center; margin: 28px 0">
              <a href="${loginUrl}" style="
                display: inline-block;
                padding: 12px 28px;
                border-radius: 10px;
                background: #2563eb;
                color: #ffffff;
                font-weight: bold;
                text-decoration: none;
              ">Đăng nhập ngay</a>
            </p>

            <p style="
              padding: 14px 16px;
              border-radius: 10px;
              background: #fffbeb;
              color: #92400e;
              font-size: 14px;
            ">
              Vì đây là mật khẩu tạm do hệ thống tự sinh, ngay khi đăng nhập lần đầu
              tiên bạn sẽ được yêu cầu đổi sang mật khẩu mới do chính bạn đặt trước khi
              có thể sử dụng các chức năng khác.
            </p>

            <p style="color: #64748b; font-size: 13px">
              Lưu ý bảo mật: không chia sẻ mật khẩu này cho bất kỳ ai, kể cả đồng
              nghiệp hay quản trị viên. Nếu bạn không biết về việc tài khoản này được
              tạo, hoặc nghi ngờ có sai sót, vui lòng liên hệ ngay với quản trị
              viên/bộ phận quản lý nhân sự của khách sạn để được hỗ trợ và khoá tài
              khoản kịp thời.
            </p>
          </div>
        `,
      });

      this.logger.log(`Staff credential email accepted: ${result.messageId}`);
    } catch (error) {
      this.logger.error(
        `Không gửi được email tài khoản nhân viên tới ${email}`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        'Không thể gửi email tài khoản cho nhân viên',
      );
    }
  }

  private async sendOtpEmail({
    email,
    otp,
    ttlSeconds,
    subject,
    heading,
    warning,
  }: {
    email: string;
    otp: string;
    ttlSeconds: number;
    subject: string;
    heading: string;
    warning: string;
  }): Promise<void> {
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
        subject,
        text: [
          `Mã OTP của bạn là: ${otp}`,
          `Mã có hiệu lực trong ${ttlSeconds} giây.`,
          warning,
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
              ${heading}
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

            <p>Mã này có hiệu lực trong ${ttlSeconds} giây.</p>

            <p style="color: #64748b; font-size: 14px">
              ${warning}
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
