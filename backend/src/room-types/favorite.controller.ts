import {
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { FavoriteService } from './favorite.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

interface AuthenticatedRequest extends Request {
  user: { userId: string; email: string; role: string };
}

@Controller('favorites')
@UseGuards(JwtAuthGuard)
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @Get('me')
  findMine(@Req() req: AuthenticatedRequest) {
    return this.favoriteService.findMine(req.user.userId);
  }

  @Post(':roomTypeId')
  add(
    @Req() req: AuthenticatedRequest,
    @Param('roomTypeId', ParseUUIDPipe) roomTypeId: string,
  ) {
    return this.favoriteService.add(req.user.userId, roomTypeId);
  }

  @Delete(':roomTypeId')
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('roomTypeId', ParseUUIDPipe) roomTypeId: string,
  ) {
    return this.favoriteService.remove(req.user.userId, roomTypeId);
  }
}
