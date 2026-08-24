import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseFilePipeBuilder,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UploadService } from './upload.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/role.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post('image')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadImage(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({ errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY }),
    )
    file: Express.Multer.File,
  ) {
    const result = await this.uploadService.uploadImage(file);
    return { url: result.secure_url, publicId: result.public_id };
  }
}
