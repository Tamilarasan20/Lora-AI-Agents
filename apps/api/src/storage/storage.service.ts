import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export interface StoredObject {
  key: string;
  publicUrl: string;
  size?: number;
}

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface MultipartInitResult {
  uploadId: string;
  key: string;
  partUrls: string[];
}

export interface ObjectMeta {
  size: number;
  contentType: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client;
  private bucket: string;
  private cdnBase: string;
  private endpoint: string;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const accountId = this.config.get<string>('storage.r2.accountId', '');
    this.bucket = this.config.get<string>('storage.r2.bucketName', 'loraloop-media');
    this.cdnBase = this.config.get<string>('storage.r2.publicUrl', '');
    this.endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: this.endpoint,
      credentials: {
        accessKeyId: this.config.get<string>('storage.r2.accessKeyId', ''),
        secretAccessKey: this.config.get<string>('storage.r2.secretAccessKey', ''),
      },
    });

    this.logger.log('✅ StorageService (Cloudflare R2) initialized');
  }

  // ── URL helpers ───────────────────────────────────────────────────────────

  getPublicUrl(key: string): string {
    return this.cdnBase
      ? `${this.cdnBase}/${key}`
      : `${this.endpoint}/${this.bucket}/${key}`;
  }

  // ── Direct upload ─────────────────────────────────────────────────────────

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
    metadata: Record<string, string> = {},
  ): Promise<StoredObject> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      }),
    );
    this.logger.debug(`Uploaded ${key} (${body.length} bytes)`);
    return { key, publicUrl: this.getPublicUrl(key), size: body.length };
  }

  // ── Presigned URLs ────────────────────────────────────────────────────────

  async generatePresignedUploadUrl(
    key: string,
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

  async generatePresignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn },
    );
  }

  // ── Multipart upload (large videos > 100 MB) ─────────────────────────────

  async initiateMultipartUpload(
    key: string,
    contentType: string,
    totalParts: number,
    partExpiresIn = 3600,
  ): Promise<MultipartInitResult> {
    const { UploadId } = await this.s3.send(
      new CreateMultipartUploadCommand({ Bucket: this.bucket, Key: key, ContentType: contentType }),
    );

    const partUrls = await Promise.all(
      Array.from({ length: totalParts }, (_, i) =>
        getSignedUrl(
          this.s3,
          new UploadPartCommand({
            Bucket: this.bucket,
            Key: key,
            UploadId: UploadId!,
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
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<StoredObject> {
    await this.s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: key,
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

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteObject(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    this.logger.debug(`Deleted ${key}`);
  }

  async deleteObjects(keys: string[]): Promise<void> {
    await Promise.all(keys.map((key) => this.deleteObject(key)));
  }

  // ── Metadata ──────────────────────────────────────────────────────────────

  async headObject(key: string): Promise<ObjectMeta | null> {
    try {
      const res = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? '' };
    } catch {
      return null;
    }
  }
}
