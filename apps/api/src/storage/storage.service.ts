import {
  Injectable, Logger, OnModuleInit, InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  NoSuchKey,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  StoredFile,
  PresignedUpload,
  MultipartInitResult,
  MultipartPart,
  ObjectMeta,
  R2ListItem,
  MoveFileOptions,
} from './storage.types';

// ─────────────────────────────────────────────────────────────────────────────
// StorageService — low-level Cloudflare R2 client (singleton S3Client)
//
// All workspace path logic lives in WorkspaceStorageService.
// This service only knows about R2 keys and bytes.
//
// R2 layout:
//   workspaces/{workspaceId}/uploads/
//   workspaces/{workspaceId}/knowledge-base/
//   workspaces/{workspaceId}/ai-media/
//   workspaces/{workspaceId}/exports/
//   workspaces/{workspaceId}/brand-assets/
// ─────────────────────────────────────────────────────────────────────────────

const LIST_MAX_PAGES = 50; // safety cap for paginated listFiles

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3!: S3Client;
  private bucket!: string;
  private cdnBase!: string;
  private endpoint!: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const accountId    = this.config.get<string>('storage.r2.accountId')   ?? '';
    const accessKeyId  = this.config.get<string>('storage.r2.accessKeyId') ?? '';
    const secretKey    = this.config.get<string>('storage.r2.secretAccessKey') ?? '';
    this.bucket        = this.config.get<string>('storage.r2.bucketName')  ?? 'laraloop-storage';
    this.cdnBase       = this.config.get<string>('storage.r2.publicUrl')   ?? '';
    this.endpoint      = this.config.get<string>('storage.r2.endpoint')
      || `https://${accountId}.r2.cloudflarestorage.com`;

    if (!accountId || !accessKeyId || !secretKey) {
      this.logger.warn(
        '⚠️  StorageService: R2 credentials are incomplete — uploads will fail. ' +
        'Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in your environment.',
      );
    }

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      credentials: { accessKeyId, secretAccessKey: secretKey },
      // R2 uses virtual-hosted style — path-style is NOT required and breaks signed URLs
      forcePathStyle: false,
    });

    this.logger.log(
      `✅ StorageService (Cloudflare R2) ready — bucket: ${this.bucket}, ` +
      `endpoint: ${this.endpoint}`,
    );
  }

  // ── Public URL ────────────────────────────────────────────────────────────

  getPublicUrl(key: string): string {
    if (this.cdnBase) return `${this.cdnBase.replace(/\/$/, '')}/${key}`;
    return `${this.endpoint}/${this.bucket}/${key}`;
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  // Uses @aws-sdk/lib-storage which auto-selects single PUT or multipart
  // based on file size (threshold: 5 MB). This avoids OOM on large buffers
  // by streaming in chunks instead of a single PutObject.

  async uploadFile(
    key:         string,
    body:        Buffer,
    contentType: string,
    metadata:    Record<string, string> = {},
  ): Promise<StoredFile> {
    const upload = new Upload({
      client: this.s3,
      params: {
        Bucket:      this.bucket,
        Key:         key,
        Body:        body,
        ContentType: contentType,
        Metadata:    metadata,
      },
      partSize:  5 * 1024 * 1024, // 5 MB — R2 minimum multipart part size
      queueSize: 4,                // parallel part uploads
    });

    await upload.done();
    this.logger.debug(`Uploaded ${key} (${body.length} bytes, ${contentType})`);
    return { key, publicUrl: this.getPublicUrl(key), size: body.length };
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteFile(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.debug(`Deleted ${key}`);
  }

  async deleteFiles(keys: string[]): Promise<void> {
    if (keys.length === 0) return;

    // Batch in chunks of 1000 (S3/R2 API limit per request)
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      const result = await this.s3.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: {
            Objects: batch.map((Key) => ({ Key })),
            Quiet:   true,
          },
        }),
      );
      if (result.Errors?.length) {
        this.logger.error(
          `Batch delete had ${result.Errors.length} errors: ` +
          result.Errors.map((e) => `${e.Key}: ${e.Message}`).join(', '),
        );
      }
    }
    this.logger.debug(`Batch deleted ${keys.length} objects`);
  }

  // ── Signed URL (download) ─────────────────────────────────────────────────

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  // ── Presigned upload URL (direct browser → R2) ───────────────────────────

  async getPresignedUploadUrl(
    key:         string,
    contentType: string,
    expiresIn = 3600,
  ): Promise<PresignedUpload> {
    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
      { expiresIn },
    );
    return { uploadUrl, key, expiresIn };
  }

  // ── Move (copy → delete source) ──────────────────────────────────────────

  async moveFile({ sourceKey, destinationKey }: MoveFileOptions): Promise<StoredFile> {
    await this.s3.send(
      new CopyObjectCommand({
        Bucket:     this.bucket,
        CopySource: `${this.bucket}/${sourceKey}`,
        Key:        destinationKey,
      }),
    );
    // Only delete source after successful copy
    await this.deleteFile(sourceKey);
    this.logger.debug(`Moved ${sourceKey} → ${destinationKey}`);
    return { key: destinationKey, publicUrl: this.getPublicUrl(destinationKey) };
  }

  // ── List objects under a prefix (paginated) ───────────────────────────────

  async listFiles(prefix: string, maxKeys = 1000): Promise<R2ListItem[]> {
    const results: R2ListItem[] = [];
    let continuationToken: string | undefined;
    let pageCount = 0;

    do {
      if (++pageCount > LIST_MAX_PAGES) {
        this.logger.warn(`listFiles: hit ${LIST_MAX_PAGES}-page safety limit for prefix "${prefix}"`);
        break;
      }

      const res = await this.s3.send(
        new ListObjectsV2Command({
          Bucket:            this.bucket,
          Prefix:            prefix,
          MaxKeys:           maxKeys,
          ContinuationToken: continuationToken,
        }),
      );

      for (const obj of res.Contents ?? []) {
        if (obj.Key) {
          results.push({
            key:          obj.Key,
            size:         obj.Size         ?? 0,
            lastModified: obj.LastModified ?? new Date(),
          });
        }
      }

      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    return results;
  }

  // ── Object metadata (HEAD request) ───────────────────────────────────────

  async headObject(key: string): Promise<ObjectMeta | null> {
    try {
      const res = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? '' };
    } catch (err: unknown) {
      // 404 / NoSuchKey → object genuinely doesn't exist
      if (
        err instanceof NoSuchKey ||
        (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404 ||
        (err as { name?: string }).name === 'NotFound'
      ) {
        return null;
      }
      // Anything else (network, auth) → propagate
      throw new InternalServerErrorException(
        `R2 HeadObject failed for key "${key}": ${(err as Error).message}`,
      );
    }
  }

  // ── Manual multipart upload (kept for backwards compat with MediaService) ─
  // For new code, prefer uploadFile() — @aws-sdk/lib-storage handles multipart
  // automatically without needing manual presigned part URLs.

  async initiateMultipartUpload(
    key:          string,
    contentType:  string,
    totalParts:   number,
    partExpiresIn = 3600,
  ): Promise<MultipartInitResult> {
    const { UploadId } = await this.s3.send(
      new CreateMultipartUploadCommand({
        Bucket:      this.bucket,
        Key:         key,
        ContentType: contentType,
      }),
    );

    const partUrls = await Promise.all(
      Array.from({ length: totalParts }, (_, i) =>
        getSignedUrl(
          this.s3,
          new UploadPartCommand({
            Bucket:     this.bucket,
            Key:        key,
            UploadId:   UploadId!,
            PartNumber: i + 1,
          }),
          { expiresIn: partExpiresIn },
        ),
      ),
    );

    this.logger.log(`Initiated multipart upload for ${key} (${totalParts} parts)`);
    return { uploadId: UploadId!, key, partUrls };
  }

  async completeMultipartUpload(
    key:      string,
    uploadId: string,
    parts:    MultipartPart[],
  ): Promise<StoredFile> {
    await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket:   this.bucket,
        Key:      key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.etag })),
        },
      }),
    );
    this.logger.log(`Completed multipart upload for ${key}`);
    return { key, publicUrl: this.getPublicUrl(key) };
  }

  async abortMultipartUpload(key: string, uploadId: string): Promise<void> {
    await this.s3.send(
      new AbortMultipartUploadCommand({ Bucket: this.bucket, Key: key, UploadId: uploadId }),
    );
  }

  // ── Deprecated aliases (backwards compat with MediaService) ──────────────

  /** @deprecated Use uploadFile */
  async putObject(key: string, body: Buffer, contentType: string, metadata: Record<string,string> = {}): Promise<StoredFile> {
    return this.uploadFile(key, body, contentType, metadata);
  }

  /** @deprecated Use deleteFile */
  async deleteObject(key: string): Promise<void> { return this.deleteFile(key); }

  /** @deprecated Use deleteFiles */
  async deleteObjects(keys: string[]): Promise<void> { return this.deleteFiles(keys); }

  /** @deprecated Use getSignedUrl */
  async generatePresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    return this.getSignedUrl(key, expiresIn);
  }

  /** @deprecated Use getPresignedUploadUrl */
  async generatePresignedUploadUrl(key: string, contentType: string, expiresIn = 3600): Promise<PresignedUpload> {
    return this.getPresignedUploadUrl(key, contentType, expiresIn);
  }
}
