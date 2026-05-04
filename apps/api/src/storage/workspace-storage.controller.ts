import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FastifyRequest } from 'fastify';
import { WorkspaceStorageService } from './workspace-storage.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthUser } from '../auth/strategies/jwt.strategy';
import { isFileCategory, FileCategory } from './storage.types';

// ─────────────────────────────────────────────────────────────────────────────
// WorkspaceStorageController
// Versioned prefix (via enableVersioning in main.ts): /v1/workspaces/:id/storage
// Auth: global JwtAuthGuard via APP_GUARD in AppModule
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ENUM = ['uploads', 'knowledge-base', 'ai-media', 'exports', 'brand-assets'] as const;

function parseCategory(value: unknown, fallback: FileCategory = 'uploads'): FileCategory {
  if (value === undefined || value === null || value === '') return fallback;
  if (!isFileCategory(value)) {
    throw new BadRequestException(
      `Invalid category "${value}". Must be one of: ${CATEGORY_ENUM.join(', ')}.`,
    );
  }
  return value;
}

@ApiTags('Workspace Storage')
@ApiBearerAuth()
@Controller({ version: '1', path: 'workspaces/:workspaceId/storage' })
export class WorkspaceStorageController {
  constructor(private readonly workspaceStorage: WorkspaceStorageService) {}

  // ── POST /upload — server-side upload (≤ 500 MB, streams to R2) ───────────

  @Post('upload')
  @ApiOperation({
    summary:     'Upload a file to R2 through the server',
    description: 'Validates ownership, MIME type, and size limit before writing. ' +
                 'Returns a signed URL valid for 1 hour. ' +
                 'For files > 10 MB prefer /presigned-upload to bypass the server.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiQuery({ name: 'category', enum: CATEGORY_ENUM, required: false, description: 'Default: uploads' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, description: 'File uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type, size, or category' })
  @ApiResponse({ status: 403, description: 'Workspace access denied' })
  async upload(
    @CurrentUser()                                user:        AuthUser,
    @Param('workspaceId', ParseUUIDPipe)          workspaceId: string,
    @Query('category')                            rawCategory: string | undefined,
    @Req()                                        req:         FastifyRequest,
  ) {
    const category = parseCategory(rawCategory);
    const data     = await req.file();
    if (!data) throw new BadRequestException('No file provided in the request.');

    const buffer = await data.toBuffer();

    return this.workspaceStorage.uploadFile({
      workspaceId,
      uploadedBy: user.id,
      category,
      file: {
        buffer,
        originalname: data.filename,
        mimetype:     data.mimetype,
        size:         buffer.byteLength,
      },
    });
  }

  // ── GET /presigned-upload — direct browser → R2 (recommended for large files) ─

  @Get('presigned-upload')
  @ApiOperation({
    summary:     'Get a presigned PUT URL for direct browser → R2 upload',
    description: 'The client PUTs the binary directly to R2 — the file never passes ' +
                 'through the server. Ideal for AI-media and videos. ' +
                 'A metadata row is created immediately so fileId is available upfront.',
  })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiQuery({ name: 'filename',   required: true, description: 'Original filename' })
  @ApiQuery({ name: 'mimeType',   required: true, description: 'MIME type of the file' })
  @ApiQuery({ name: 'size',       required: true, type: Number, description: 'File size in bytes (for validation)' })
  @ApiQuery({ name: 'category',   enum: CATEGORY_ENUM, required: false })
  @ApiQuery({ name: 'expiresIn',  required: false, type: Number, description: 'URL TTL in seconds (default: 3600)' })
  @ApiResponse({ status: 200, description: 'Presigned upload URL and pre-created file metadata ID' })
  getPresignedUploadUrl(
    @CurrentUser()                                user:        AuthUser,
    @Param('workspaceId', ParseUUIDPipe)          workspaceId: string,
    @Query('filename')                            filename:    string,
    @Query('mimeType')                            mimeType:    string,
    @Query('size', ParseIntPipe)                  size:        number,
    @Query('category')                            rawCategory: string | undefined,
    @Query('expiresIn', new ParseIntPipe({ optional: true })) expiresIn: number | undefined,
  ) {
    if (!filename?.trim()) throw new BadRequestException('filename is required.');
    if (!mimeType?.trim()) throw new BadRequestException('mimeType is required.');

    const category = parseCategory(rawCategory);
    return this.workspaceStorage.getPresignedUploadUrl(
      user.id, workspaceId, filename, mimeType, size, category, expiresIn ?? 3600,
    );
  }

  // ── GET / — list files (paginated, Supabase-backed) ───────────────────────

  @Get()
  @ApiOperation({ summary: 'List files in a workspace (paginated)' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiQuery({ name: 'category', enum: CATEGORY_ENUM, required: false })
  @ApiQuery({ name: 'page',     required: false, type: Number, description: 'Default: 1' })
  @ApiQuery({ name: 'limit',    required: false, type: Number, description: 'Default: 20, max: 100' })
  listFiles(
    @CurrentUser()                                user:        AuthUser,
    @Param('workspaceId', ParseUUIDPipe)          workspaceId: string,
    @Query('category')                            rawCategory: string | undefined,
    @Query('page',  new ParseIntPipe({ optional: true })) page:  number | undefined,
    @Query('limit', new ParseIntPipe({ optional: true })) limit: number | undefined,
  ) {
    const category = rawCategory ? parseCategory(rawCategory) : undefined;
    return this.workspaceStorage.listFiles({
      workspaceId,
      userId:   user.id,
      category,
      page:     page  ?? 1,
      limit:    limit ?? 20,
    });
  }

  // ── GET /:fileId/signed-url ────────────────────────────────────────────────

  @Get(':fileId/signed-url')
  @ApiOperation({ summary: 'Get a presigned download URL for a private file' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiParam({ name: 'fileId',      description: 'FileMetadata UUID' })
  @ApiQuery({ name: 'expiresIn',   required: false, type: Number, description: 'TTL in seconds (default: 3600, max: 86400)' })
  @ApiResponse({ status: 200, description: 'Signed URL with expiry timestamp' })
  getSignedUrl(
    @CurrentUser()                                user:        AuthUser,
    @Param('workspaceId', ParseUUIDPipe)          workspaceId: string,
    @Param('fileId',      ParseUUIDPipe)          fileId:      string,
    @Query('expiresIn', new ParseIntPipe({ optional: true })) expiresIn: number | undefined,
  ) {
    const ttl = Math.min(expiresIn ?? 3600, 86_400); // cap at 24 h
    return this.workspaceStorage.getSignedUrl(user.id, workspaceId, fileId, ttl);
  }

  // ── POST /:fileId/move ─────────────────────────────────────────────────────

  @Post(':fileId/move')
  @ApiOperation({ summary: 'Move a file to a different category folder' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiParam({ name: 'fileId',      description: 'FileMetadata UUID' })
  @ApiQuery({ name: 'category',    enum: CATEGORY_ENUM, required: true })
  @ApiResponse({ status: 200, description: 'Updated file metadata' })
  moveFile(
    @CurrentUser()                                user:        AuthUser,
    @Param('workspaceId', ParseUUIDPipe)          workspaceId: string,
    @Param('fileId',      ParseUUIDPipe)          fileId:      string,
    @Query('category')                            rawCategory: string,
  ) {
    const category = parseCategory(rawCategory);
    return this.workspaceStorage.moveFile(user.id, workspaceId, fileId, category);
  }

  // ── GET /usage — workspace storage consumed ────────────────────────────────

  @Get('usage')
  @ApiOperation({ summary: 'Total storage used by this workspace in bytes' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiResponse({ status: 200, description: '{ bytes: number }' })
  async getUsage(
    @CurrentUser()                        user:        AuthUser,
    @Param('workspaceId', ParseUUIDPipe)  workspaceId: string,
  ) {
    const bytes = await this.workspaceStorage.getStorageUsed(user.id, workspaceId);
    return { bytes };
  }

  // ── DELETE /:fileId ────────────────────────────────────────────────────────

  @Delete(':fileId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file from R2 and remove its metadata' })
  @ApiParam({ name: 'workspaceId', description: 'Workspace UUID' })
  @ApiParam({ name: 'fileId',      description: 'FileMetadata UUID' })
  @ApiResponse({ status: 204, description: 'File deleted' })
  @ApiResponse({ status: 404, description: 'File not found' })
  async deleteFile(
    @CurrentUser()                                user:        AuthUser,
    @Param('workspaceId', ParseUUIDPipe)          workspaceId: string,
    @Param('fileId',      ParseUUIDPipe)          fileId:      string,
  ) {
    await this.workspaceStorage.deleteFile({ workspaceId, fileId, requestedBy: user.id });
  }
}
