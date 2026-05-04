// ─────────────────────────────────────────────────────────────────────────────
// Storage Architecture — TypeScript Types
// Multi-tenant workspace-scoped storage on Cloudflare R2
// ─────────────────────────────────────────────────────────────────────────────

// ── Workspace folder categories ───────────────────────────────────────────────

export type FileCategory =
  | 'uploads'        // Generic user uploads
  | 'knowledge-base' // PDFs / DOCX / CSV for AI ingestion
  | 'ai-media'       // AI-generated images and videos
  | 'exports'        // Exported reports and data files
  | 'brand-assets';  // Logos, fonts, brand guidelines

export const FILE_CATEGORIES: ReadonlySet<FileCategory> = new Set([
  'uploads',
  'knowledge-base',
  'ai-media',
  'exports',
  'brand-assets',
]);

export function isFileCategory(value: unknown): value is FileCategory {
  return FILE_CATEGORIES.has(value as FileCategory);
}

// ── Per-category size limits (bytes) ─────────────────────────────────────────

export const CATEGORY_SIZE_LIMITS: Readonly<Record<FileCategory, number>> = {
  'uploads':        50  * 1024 * 1024, //  50 MB
  'knowledge-base': 100 * 1024 * 1024, // 100 MB
  'ai-media':       500 * 1024 * 1024, // 500 MB
  'exports':        200 * 1024 * 1024, // 200 MB
  'brand-assets':   50  * 1024 * 1024, //  50 MB
};

// ── MIME type groups ──────────────────────────────────────────────────────────

export const MIME_GROUPS = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'] as const,
  video: ['video/mp4', 'video/quicktime', 'video/webm', 'video/mpeg'] as const,
  pdf:   ['application/pdf'] as const,
  docx:  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] as const,
  csv:   ['text/csv', 'application/csv'] as const,
  zip:   ['application/zip', 'application/x-zip-compressed'] as const,
} as const;

export type AllowedMimeType =
  | typeof MIME_GROUPS.image[number]
  | typeof MIME_GROUPS.video[number]
  | typeof MIME_GROUPS.pdf[number]
  | typeof MIME_GROUPS.docx[number]
  | typeof MIME_GROUPS.csv[number]
  | typeof MIME_GROUPS.zip[number];

export const ALL_ALLOWED_MIMES: ReadonlySet<string> = new Set([
  ...MIME_GROUPS.image,
  ...MIME_GROUPS.video,
  ...MIME_GROUPS.pdf,
  ...MIME_GROUPS.docx,
  ...MIME_GROUPS.csv,
  ...MIME_GROUPS.zip,
]);

// ── Upload options ────────────────────────────────────────────────────────────

export interface UploadFileOptions {
  workspaceId:  string;
  uploadedBy:   string;   // userId
  category:     FileCategory;
  file: {
    buffer:       Buffer;
    originalname: string;
    mimetype:     string;
    size:         number; // bytes
  };
  expiresIn?: number;     // signed URL TTL in seconds, default 3600
}

// ── Upload result ─────────────────────────────────────────────────────────────

export interface UploadResult {
  id:           string;   // FileMetadata row UUID
  r2Key:        string;
  publicUrl:    string;
  signedUrl:    string;   // short-lived presigned GET URL
  originalName: string;
  mimeType:     string;
  size:         number;
  category:     FileCategory;
  workspaceId:  string;
  createdAt:    Date;
}

// ── File metadata (mirrors Prisma FileMetadata model) ─────────────────────────

export interface FileMetadataRecord {
  id:           string;
  workspaceId:  string;
  uploadedBy:   string;
  bucket:       string;
  r2Key:        string;
  originalName: string;
  mimeType:     string;
  size:         number;  // always Number, never BigInt
  category:     FileCategory;
  createdAt:    Date;
}

// ── Presigned upload result ───────────────────────────────────────────────────

export interface PresignedUploadResult {
  uploadUrl:  string;
  key:        string;
  fileId:     string;   // pre-created FileMetadata row UUID
  expiresIn:  number;
  expiresAt:  string;   // ISO-8601 timestamp
}

// ── Delete options ────────────────────────────────────────────────────────────

export interface DeleteFileOptions {
  workspaceId:  string;
  fileId:       string;
  requestedBy:  string;
}

// ── List options / result ─────────────────────────────────────────────────────

export interface ListFilesOptions {
  workspaceId:  string;
  userId:       string;   // used for ownership check
  category?:    FileCategory;
  page?:        number;
  limit?:       number;
}

export interface ListFilesResult {
  items:  FileMetadataRecord[];
  total:  number;
  page:   number;
  limit:  number;
}

// ── Move options ──────────────────────────────────────────────────────────────

export interface MoveFileOptions {
  sourceKey:      string;
  destinationKey: string;
}

// ── Low-level R2 types ────────────────────────────────────────────────────────

export interface StoredFile {
  key:        string;
  publicUrl:  string;
  size?:      number;
}

export interface PresignedUpload {
  uploadUrl:  string;
  key:        string;
  expiresIn:  number;
}

export interface MultipartInitResult {
  uploadId:  string;
  key:       string;
  partUrls:  string[];
}

export interface MultipartPart {
  partNumber: number;
  etag:       string;
}

export interface ObjectMeta {
  size:        number;
  contentType: string;
}

export interface R2ListItem {
  key:          string;
  size:         number;
  lastModified: Date;
}

// ── MIME → extension map ──────────────────────────────────────────────────────

export const MIME_TO_EXT: Readonly<Record<string, string>> = {
  'image/jpeg':    'jpg',
  'image/png':     'png',
  'image/webp':    'webp',
  'image/gif':     'gif',
  'image/svg+xml': 'svg',
  'video/mp4':     'mp4',
  'video/quicktime': 'mov',
  'video/webm':    'webm',
  'video/mpeg':    'mpeg',
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'text/csv':      'csv',
  'application/csv': 'csv',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
} as const;

// ── Prisma ↔ API category map ─────────────────────────────────────────────────

export const CATEGORY_TO_PRISMA: Readonly<Record<FileCategory, string>> = {
  'uploads':        'UPLOAD',
  'knowledge-base': 'KNOWLEDGE_BASE',
  'ai-media':       'AI_MEDIA',
  'exports':        'EXPORT',
  'brand-assets':   'BRAND_ASSET',
};

export const PRISMA_TO_CATEGORY: Readonly<Record<string, FileCategory>> = {
  'UPLOAD':         'uploads',
  'KNOWLEDGE_BASE': 'knowledge-base',
  'AI_MEDIA':       'ai-media',
  'EXPORT':         'exports',
  'BRAND_ASSET':    'brand-assets',
};
