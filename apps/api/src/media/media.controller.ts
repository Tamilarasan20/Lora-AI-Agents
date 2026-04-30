import {
  Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Post, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { MediaService } from './media.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload image or video. Images are auto-resized and converted to WebP.' })
  async upload(@CurrentUser() user: AuthUser, @Req() req: FastifyRequest) {
    const data = await req.file();
    if (!data) throw new Error('No file uploaded');

    const buffer = await data.toBuffer();
    return this.mediaService.upload(user.id, {
      buffer,
      mimetype: data.mimetype,
      originalname: data.filename,
      size: buffer.byteLength,
    });
  }

  @Get()
  @ApiOperation({ summary: 'List uploaded media assets' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.mediaService.listAssets(user.id, parseInt(page, 10), parseInt(limit, 10));
  }

  @Get(':id/presigned-url')
  @ApiOperation({ summary: 'Get a temporary pre-signed URL for a private asset' })
  presignedUrl(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.mediaService.getPresignedUrl(user.id, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a media asset (removes from R2 and DB)' })
  async delete(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    await this.mediaService.delete(user.id, id);
  }
}
