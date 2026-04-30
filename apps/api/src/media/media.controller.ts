import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus,
  Param, Post, Query, Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsString, IsArray, ValidateNested, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { MediaService } from './media.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';

class InitiateMultipartDto {
  @ApiProperty() @IsString() filename: string;
  @ApiProperty() @IsString() contentType: string;
  @ApiProperty() @IsNumber() @Min(1) @Max(100) totalParts: number;
}

class PartDto {
  @ApiProperty() @IsNumber() partNumber: number;
  @ApiProperty() @IsString() etag: string;
}

class CompleteMultipartDto {
  @ApiProperty() @IsString() key: string;
  @ApiProperty() @IsString() uploadId: string;
  @ApiProperty() @IsString() originalName: string;
  @ApiProperty({ type: [PartDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartDto)
  parts: PartDto[];
}

@ApiTags('Media')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOperation({ summary: 'Upload image or video (≤500 MB). Images are auto-resized to WebP.' })
  async upload(@CurrentUser() user: AuthUser, @Req() req: FastifyRequest) {
    const data = await req.file();
    if (!data) throw new Error('No file provided');
    const buffer = await data.toBuffer();
    return this.mediaService.upload(user.id, {
      buffer,
      mimetype: data.mimetype,
      originalname: data.filename,
      size: buffer.byteLength,
    });
  }

  // ── Multipart upload for large videos ────────────────────────────────────

  @Post('multipart/initiate')
  @ApiOperation({ summary: 'Initiate a multipart upload for large video files. Returns presigned part URLs.' })
  initiateMultipart(@CurrentUser() user: AuthUser, @Body() dto: InitiateMultipartDto) {
    return this.mediaService.initiateMultipartUpload(
      user.id, dto.filename, dto.contentType, dto.totalParts,
    );
  }

  @Post('multipart/complete')
  @ApiOperation({ summary: 'Complete a multipart upload after all parts are uploaded directly to R2.' })
  completeMultipart(@CurrentUser() user: AuthUser, @Body() dto: CompleteMultipartDto) {
    return this.mediaService.completeMultipartUpload(
      user.id, dto.key, dto.uploadId, dto.parts, dto.originalName,
    );
  }

  // ── Standard endpoints ────────────────────────────────────────────────────

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
  @ApiOperation({ summary: 'Get a temporary presigned download URL for a private asset' })
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
