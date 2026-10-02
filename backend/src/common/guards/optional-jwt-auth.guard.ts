import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

// Giống JwtAuthGuard nhưng KHÔNG chặn request thiếu/sai token: request vẫn đi tiếp với
// req.user = undefined. Dùng cho endpoint phục vụ cả khách vãng lai lẫn khách đã đăng
// nhập (vd. chat với trợ lý AI) — nơi cần thì tự kiểm tra req.user để giới hạn quyền.
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_err: unknown, user: TUser): TUser | undefined {
    return user || undefined;
  }
}
