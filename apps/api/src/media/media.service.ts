import { Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;  // 20 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly cdnBase: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.bucket = config.get<string>('storage.r2BucketName', 'loraloop-media');
    this.cdnBase = config.get<string>('storage.r2PublicUrl', '');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: config.get<string>('storage.r2Endpoint'),
      credentials: {
        accessKeyId: config.get<string>('storage.r2AccessKeyId', ''),
        secretAccessKey: config.get<string>('storage.r2SecretAccessKey', ''),
      },
    });
  }

  async upload(
    userId: string,
    file: { buffer: Buffer; mimetype: string; originalname: string; size: number },
  ) {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(`Unsupported file type: ${file.mimetype}`);
    }

    const isImage = file.mimetype.startsWith('image/');
    const maxBytes = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > maxBytes) {
      throw new BadRequestException(`File exceeds max size of ${maxBytes / 1024 / 1024}MB`);
    }

    let processedBuffer = file.buffer;
    let width: number | undefined;
    let height: number | undefined;
    let finalMimeType = file.mimetype;

    // Resize and compress images with Sharp
    if (isImage && file.mimetype !== 'image/gif') {
      const image = sharp(file.buffer);
      const meta = await image.metadata();
      width = meta.width;
      height = meta.height;

      // Convert to webp for storage efficiency, preserve original for GIFs
      processedBuffer = await image
        .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      finalMimeType = 'image/webp';
    }

    const ext = finalMimeType === 'image/webp' ? 'webp' : file.originalname.split('.').pop() ?? 'bin';
    const r2Key = `${userId}/${randomUUID()}.${ext}`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: r2Key,
      Body: processedBuffer,
      ContentType: finalMimeType,
      Metadata: { userId, originalName: file.originalname },
    }));

    const r2Url = this.cdnBase ? `${this.cdnBase}/${r2Key}` : r2Key;

    const asset = await this.prisma.mediaAsset.create({
      data: {
        userId,
        r2Key,
        r2Url,
        mimeType: finalMimeType,
        originalName: file.originalname,
        fileSizeBytes: BigInt(processedBuffer.length),
        width,
        height,
        status: 'READY',
      },
    });

    return { ...asset, fileSizeBytes: Number(asset.fileSizeBytes) };
  }

  async getPresignedUrl(userId: string, assetId: string, expiresIn = 3600) {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id: assetId, userId } });
    if (!asset) throw new NotFoundException('Media asset not found');

    const url = await getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: asset.r2Key }),
      { expiresIn },
    );
    return { url, expiresIn };
  }

  async listAssets(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.mediaAsset.count({ where: { userId } }),
    ]);
    return {
      items: items.map((a: any) => ({ ...a, fileSizeBytes: Number(a.fileSizeBytes) })),
      total, page, limit,
    };
  }

  async delete(userId: string, assetId: string): Promise<void> {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id: assetId } });
    if (!asset) throw new NotFoundException('Media asset not found');
    if (asset.userId !== userId) throw new ForbiddenException();

    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: asset.r2Key }));
    await this.prisma.mediaAsset.delete({ where: { id: assetId } });
  }
}
