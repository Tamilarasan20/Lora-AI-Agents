import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException, Logger,
} from '@nestjs/common';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
];
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;   // 20 MB
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;  // 500 MB

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

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
      throw new BadRequestException(`File exceeds ${maxBytes / 1024 / 1024} MB limit`);
    }

    let processedBuffer = file.buffer;
    let width: number | undefined;
    let height: number | undefined;
    let finalMimeType = file.mimetype;

    if (isImage && file.mimetype !== 'image/gif') {
      const image = sharp(file.buffer);
      const meta = await image.metadata();
      width = meta.width;
      height = meta.height;

      processedBuffer = await image
        .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
      finalMimeType = 'image/webp';
    }

    const ext = finalMimeType === 'image/webp' ? 'webp' : (file.originalname.split('.').pop() ?? 'bin');
    const r2Key = `${userId}/${randomUUID()}.${ext}`;

    const stored = await this.storage.putObject(r2Key, processedBuffer, finalMimeType, {
      userId,
      originalName: file.originalname,
    });

    const asset = await this.prisma.mediaAsset.create({
      data: {
        userId,
        r2Key,
        r2Url: stored.publicUrl,
        mimeType: finalMimeType,
        originalName: file.originalname,
        fileSizeBytes: BigInt(processedBuffer.length),
        width,
        height,
        status: 'READY',
      },
    });

    this.logger.log(`Media uploaded: ${r2Key} (${finalMimeType})`);
    return { ...asset, fileSizeBytes: Number(asset.fileSizeBytes) };
  }

  async getPresignedUrl(userId: string, assetId: string, expiresIn = 3600) {
    const asset = await this.prisma.mediaAsset.findFirst({ where: { id: assetId, userId } });
    if (!asset) throw new NotFoundException('Media asset not found');

    const url = await this.storage.generatePresignedDownloadUrl(asset.r2Key, expiresIn);
    return { url, expiresIn };
  }

  async initiateMultipartUpload(
    userId: string,
    filename: string,
    contentType: string,
    totalParts: number,
  ) {
    if (!contentType.startsWith('video/')) {
      throw new BadRequestException('Multipart upload is only supported for video files');
    }
    const ext = filename.split('.').pop() ?? 'mp4';
    const key = `${userId}/${randomUUID()}.${ext}`;
    return this.storage.initiateMultipartUpload(key, contentType, totalParts);
  }

  async completeMultipartUpload(
    userId: string,
    key: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
    originalName: string,
  ) {
    const stored = await this.storage.completeMultipartUpload(key, uploadId, parts);
    const meta = await this.storage.headObject(key);

    const asset = await this.prisma.mediaAsset.create({
      data: {
        userId,
        r2Key: key,
        r2Url: stored.publicUrl,
        mimeType: 'video/mp4',
        originalName,
        fileSizeBytes: BigInt(meta?.size ?? 0),
        status: 'READY',
      },
    });

    return { ...asset, fileSizeBytes: Number(asset.fileSizeBytes) };
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

    await this.storage.deleteObject(asset.r2Key);
    await this.prisma.mediaAsset.delete({ where: { id: assetId } });
  }
}
