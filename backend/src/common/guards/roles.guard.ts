import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/role.decorator';
import { UserRole } from '../enums/user-role.enum';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      // Gắn RolesGuard mà quên khai báo @Roles() là lỗi cấu hình — fail-closed
      // (từ chối) thay vì fail-open, để lỗi cấu hình lộ ra ngay thay vì âm thầm
      // mở route cho mọi người.
      return false;
    }

    const user = context.switchToHttp().getRequest();
    return requiredRoles.includes(user.user.role);
  }
}
