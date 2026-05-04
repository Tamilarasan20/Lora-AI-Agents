import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import {
  FileCategory,
  isFileCategory,
  ALL_ALLOWED_MIMES,
  CATEGORY_SIZE_LIMITS,
  MIME_GROUPS,
  MIME_TO_EXT,
} from './storage.types';

export interface ValidationResult {
  sanitizedName: string;
  extension:     string;
  mimeType:      string;
}

// ─────────────────────────────────────────────────────────────────────────────
// StorageValidator — Injectable NestJS service
//
// Validates and sanitises all file upload parameters before they touch R2.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class StorageValidator {

  validateAndSanitize(
    originalname: string,
    mimetype:     string,
    sizeBytes:    number,
    category:     unknown,
  ): ValidationResult {
    const safeCategory = this.validateCategory(category);
    this.validateMimeType(mimetype);
    this.validateFileSize(sizeBytes, safeCategory);

    const ext           = this.resolveExtension(mimetype);
    const sanitizedName = this.sanitizeFilename(originalname, ext);

    return { sanitizedName, extension: ext, mimeType: mimetype };
  }

  // ── Category ─────────────────────────────────────────────────────────────

  validateCategory(category: unknown): FileCategory {
    if (!isFileCategory(category)) {
      throw new BadRequestException(
        `Invalid category "${String(category)}". ` +
        `Must be one of: uploads, knowledge-base, ai-media, exports, brand-assets.`,
      );
    }
    return category;
  }

  // ── MIME type ─────────────────────────────────────────────────────────────

  private validateMimeType(mimetype: string): void {
    if (!ALL_ALLOWED_MIMES.has(mimetype)) {
      throw new BadRequestException(
        `File type "${mimetype}" is not permitted. ` +
        `Allowed: images (jpeg/png/webp/gif/svg), videos (mp4/mov/webm), ` +
        `PDF, DOCX, CSV, ZIP.`,
      );
    }
  }

  // ── File size ─────────────────────────────────────────────────────────────

  private validateFileSize(sizeBytes: number, category: FileCategory): void {
    if (sizeBytes <= 0) {
      throw new BadRequestException('File must not be empty.');
    }

    const limitBytes = CATEGORY_SIZE_LIMITS[category];
    if (sizeBytes > limitBytes) {
      const limitMb = Math.round(limitBytes / 1024 / 1024);
      throw new BadRequestException(
        `File size (${Math.round(sizeBytes / 1024 / 1024)} MB) exceeds the ` +
        `${limitMb} MB limit for category "${category}".`,
      );
    }
  }

  // ── Extension ─────────────────────────────────────────────────────────────
  // Always derive extension from MIME type — never trust the filename extension
  // to prevent extension-spoofing attacks (e.g. shell.php → image/jpeg).

  private resolveExtension(mimetype: string): string {
    return MIME_TO_EXT[mimetype] ?? 'bin';
  }

  // ── Filename sanitisation ─────────────────────────────────────────────────
  // Strips path components, normalises to ASCII-safe characters, and appends
  // a UUID to prevent collisions and enumeration.

  sanitizeFilename(originalname: string, ext: string): string {
    // Strip all directory components — path traversal guard
    const basename = path.basename(originalname);
    // Remove extension and normalise
    const stem = path.basename(basename, path.extname(basename))
      .toLowerCase()
      .replace(/\./g, '-')              // dots → dashes (no double-extension tricks)
      .replace(/[^a-z0-9_-]/g, '-')    // non-alphanumeric → dashes
      .replace(/-{2,}/g, '-')           // collapse repeated dashes
      .replace(/^-+|-+$/g, '')          // trim leading/trailing dashes
      .slice(0, 60);                    // max 60 chars for the stem

    return `${stem || 'file'}-${randomUUID()}.${ext}`;
  }

  // ── R2 key builder ────────────────────────────────────────────────────────

  buildR2Key(workspaceId: string, category: FileCategory, filename: string): string {
    return `workspaces/${workspaceId}/${category}/${filename}`;
  }

  // ── Type helpers ──────────────────────────────────────────────────────────

  isImage(mimetype: string): boolean {
    return (MIME_GROUPS.image as readonly string[]).includes(mimetype);
  }

  isVideo(mimetype: string): boolean {
    return (MIME_GROUPS.video as readonly string[]).includes(mimetype);
  }
}
