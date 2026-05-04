import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import { StorageValidator } from './storage.validator';
import {
  FileCategory,
  UploadFileOptions,
  UploadResult,
  DeleteFileOptions,
  ListFilesOptions,
  ListFilesResult,
  FileMetadataRecord,
  PresignedUploadResult,
  R2ListItem,
  CATEGORY_TO_PRISMA,
  PRISMA_TO_CATEGORY,
} from './storage.types';

// ─────────────────────────────────────────────────────────────────────────────
// WorkspaceStorageService
//
// Single source of truth for all file operations within a workspace.
// Enforces:
//   • workspace ownership check on every operation
//   • MIME type + file size validation before any R2 write
//   • atomic metadata persistence (DB row created/deleted in sync with R2)
//   • workspace-scoped R2 paths:
//       workspaces/{workspaceId}/{category}/{sanitised-uuid.ext}
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class WorkspaceStorageService {
  private readonly logger = new Logger(WorkspaceStorageService.name);
  private readonly bucket: string;

  constructor(
    private readonly storage:   StorageService,
    private readonly prisma:    PrismaService,
    private readonly validator: StorageValidator,
    private readonly config:    ConfigService,
  ) {
    this.bucket = this.config.get<string>('storage.r2.bucketName') ?? 'laraloop-storage';
  }

  // ── Upload (server-side) ──────────────────────────────────────────────────

  async uploadFile(opts: UploadFileOptions): Promise<UploadResult> {
    const { workspaceId, uploadedBy, file, category, expiresIn = 3600 } = opts;

    await this.assertWorkspaceAccess(uploadedBy, workspaceId);

    const { sanitizedName, mimeType } = this.validator.validateAndSanitize(
      file.originalname,
      file.mimetype,
      file.size,
      category,
    );

    const r2Key = this.validator.buildR2Key(workspaceId, category, sanitizedName);

    // Upload to R2 first — if this fails, no DB row is created (no orphan risk)
    const stored = await this.storage.uploadFile(r2Key, file.buffer, mimeType, {
      workspaceId,
      uploadedBy,
      originalName: file.originalname,
      category,
    });

    // Persist metadata — if this fails, the R2 object is orphaned.
    // The file is still inaccessible through the API (no DB row), and a
    // background reconciliation job can clean up orphaned R2 objects.
    let meta: Prisma.FileMetadataGetPayload<object>;
    try {
      meta = await this.prisma.fileMetadata.create({
        data: {
          workspaceId,
          uploadedBy,
          bucket:      this.bucket,
          r2Key,
          originalName: file.originalname,
          mimeType,
          size:        BigInt(file.size),
          category:    CATEGORY_TO_PRISMA[category] as any,
        },
      });
    } catch (err) {
      // Attempt cleanup of the orphaned R2 object — fire and forget
      this.storage.deleteFile(r2Key).catch((e) =>
        this.logger.error(`Orphan cleanup failed for ${r2Key}: ${(e as Error).message}`),
      );
      throw new InternalServerErrorException('Failed to save file metadata. Upload rolled back.');
    }

    const signedUrl = await this.storage.getSignedUrl(r2Key, expiresIn);

    this.logger.log(
      `✅ Uploaded [${category}] "${sanitizedName}" (${Math.round(file.size / 1024)} KB) ` +
      `for workspace ${workspaceId}`,
    );

    return {
      id:           meta.id,
      r2Key,
      publicUrl:    stored.publicUrl,
      signedUrl,
      originalName: file.originalname,
      mimeType,
      size:         file.size,
      category,
      workspaceId,
      createdAt:    meta.createdAt,
    };
  }

  // ── Presigned direct-upload URL (browser → R2) ────────────────────────────
  // Creates a metadata row immediately so the fileId is known upfront.
  // Size from the client is trusted for validation only; actual uploaded size
  // is not verified (R2 does not enforce ContentLength on signed PUTs).
  // Orphaned PENDING rows (user never uploads) should be pruned by a scheduled
  // cleanup job filtering on createdAt < NOW() - interval '2 hours'.

  async getPresignedUploadUrl(
    userId:       string,
    workspaceId:  string,
    originalname: string,
    mimetype:     string,
    size:         number,
    category:     FileCategory,
    expiresIn = 3600,
  ): Promise<PresignedUploadResult> {
    await this.assertWorkspaceAccess(userId, workspaceId);

    const { sanitizedName, mimeType } = this.validator.validateAndSanitize(
      originalname,
      mimetype,
      size,
      category,
    );

    const r2Key  = this.validator.buildR2Key(workspaceId, category, sanitizedName);
    const meta   = await this.prisma.fileMetadata.create({
      data: {
        workspaceId,
        uploadedBy:  userId,
        bucket:      this.bucket,
        r2Key,
        originalName: originalname,
        mimeType,
        size:        BigInt(size),
        category:    CATEGORY_TO_PRISMA[category] as any,
      },
    });

    const presigned = await this.storage.getPresignedUploadUrl(r2Key, mimeType, expiresIn);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    return { uploadUrl: presigned.uploadUrl, key: r2Key, fileId: meta.id, expiresIn, expiresAt };
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteFile(opts: DeleteFileOptions): Promise<void> {
    const { workspaceId, fileId, requestedBy } = opts;

    const meta = await this.prisma.fileMetadata.findUnique({ where: { id: fileId } });
    if (!meta || meta.workspaceId !== workspaceId) {
      // Treat "not in this workspace" the same as "not found" — don't reveal existence
      throw new NotFoundException('File not found.');
    }

    await this.assertWorkspaceAccess(requestedBy, workspaceId);

    // Remove DB row first so the file becomes inaccessible immediately.
    // If R2 delete subsequently fails, the file is orphaned in R2 but
    // cannot be accessed or listed through the API.
    await this.prisma.fileMetadata.delete({ where: { id: fileId } });

    await this.storage.deleteFile(meta.r2Key).catch((err) =>
      this.logger.error(
        `R2 delete failed for key ${meta.r2Key} (already removed from DB): ${(err as Error).message}`,
      ),
    );

    this.logger.log(`Deleted file ${fileId} (${meta.r2Key}) by user ${requestedBy}`);
  }

  // ── Signed URL ────────────────────────────────────────────────────────────

  async getSignedUrl(
    userId:      string,
    workspaceId: string,
    fileId:      string,
    expiresIn = 3600,
  ): Promise<{ url: string; expiresIn: number; expiresAt: string }> {
    await this.assertWorkspaceAccess(userId, workspaceId);

    const meta = await this.prisma.fileMetadata.findUnique({ where: { id: fileId } });
    if (!meta || meta.workspaceId !== workspaceId) {
      throw new NotFoundException('File not found.');
    }

    const url       = await this.storage.getSignedUrl(meta.r2Key, expiresIn);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
    return { url, expiresIn, expiresAt };
  }

  // ── Public URL ────────────────────────────────────────────────────────────

  getPublicUrl(r2Key: string): string {
    return this.storage.getPublicUrl(r2Key);
  }

  // ── Move ──────────────────────────────────────────────────────────────────

  async moveFile(
    userId:      string,
    workspaceId: string,
    fileId:      string,
    newCategory: FileCategory,
  ): Promise<FileMetadataRecord> {
    await this.assertWorkspaceAccess(userId, workspaceId);

    const meta = await this.prisma.fileMetadata.findUnique({ where: { id: fileId } });
    if (!meta || meta.workspaceId !== workspaceId) {
      throw new NotFoundException('File not found.');
    }

    const filename = meta.r2Key.split('/').at(-1)!;
    const newKey   = this.validator.buildR2Key(workspaceId, newCategory, filename);

    // Copy to new location in R2
    await this.storage.moveFile({ sourceKey: meta.r2Key, destinationKey: newKey });

    // Update DB — if this fails, the old R2 key is gone and the new one exists
    // but points nowhere. Roll back by copying back then re-deleting.
    let updated: Prisma.FileMetadataGetPayload<object>;
    try {
      updated = await this.prisma.fileMetadata.update({
        where: { id: fileId },
        data:  { r2Key: newKey, category: CATEGORY_TO_PRISMA[newCategory] as any },
      });
    } catch (err) {
      // Attempt rollback: copy new key back to old, delete new
      await this.storage
        .moveFile({ sourceKey: newKey, destinationKey: meta.r2Key })
        .catch((e) => this.logger.error(`Move rollback failed: ${(e as Error).message}`));
      throw new InternalServerErrorException('Move failed — metadata update error.');
    }

    return this.toRecord(updated);
  }

  // ── List (paginated, from Supabase/Prisma) ────────────────────────────────

  async listFiles(opts: ListFilesOptions): Promise<ListFilesResult> {
    const { workspaceId, userId, category, page = 1, limit = 20 } = opts;

    await this.assertWorkspaceAccess(userId, workspaceId);

    const clampedLimit = Math.min(Math.max(1, limit), 100);
    const skip         = (Math.max(1, page) - 1) * clampedLimit;

    const where: Prisma.FileMetadataWhereInput = { workspaceId };
    if (category) where.category = CATEGORY_TO_PRISMA[category] as any;

    const [items, total] = await Promise.all([
      this.prisma.fileMetadata.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: clampedLimit,
      }),
      this.prisma.fileMetadata.count({ where }),
    ]);

    return {
      items: items.map((i) => this.toRecord(i)),
      total,
      page:  Math.max(1, page),
      limit: clampedLimit,
    };
  }

  // ── Raw R2 listing (reconciliation / admin use) ───────────────────────────

  async listR2Objects(workspaceId: string, category?: FileCategory): Promise<R2ListItem[]> {
    const prefix = category
      ? `workspaces/${workspaceId}/${category}/`
      : `workspaces/${workspaceId}/`;
    return this.storage.listFiles(prefix);
  }

  // ── Workspace storage usage (bytes) ──────────────────────────────────────

  async getStorageUsed(userId: string, workspaceId: string): Promise<number> {
    await this.assertWorkspaceAccess(userId, workspaceId);

    const result = await this.prisma.fileMetadata.aggregate({
      where:  { workspaceId },
      _sum:   { size: true },
    });

    return Number(result._sum.size ?? 0);
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async assertWorkspaceAccess(userId: string, workspaceId: string): Promise<void> {
    const count = await this.prisma.workspace.count({
      where: { id: workspaceId, userId },
    });
    if (!count) {
      // Intentionally generic — don't reveal whether the workspace exists
      throw new ForbiddenException('Workspace not found or access denied.');
    }
  }

  private toRecord(row: Prisma.FileMetadataGetPayload<object>): FileMetadataRecord {
    return {
      id:           row.id,
      workspaceId:  row.workspaceId,
      uploadedBy:   row.uploadedBy,
      bucket:       row.bucket,
      r2Key:        row.r2Key,
      originalName: row.originalName,
      mimeType:     row.mimeType,
      size:         Number(row.size),
      category:     PRISMA_TO_CATEGORY[row.category] ?? 'uploads',
      createdAt:    row.createdAt,
    };
  }
}
