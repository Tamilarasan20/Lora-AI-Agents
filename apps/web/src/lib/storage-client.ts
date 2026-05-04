// ─────────────────────────────────────────────────────────────────────────────
// Storage Client — browser-side helpers for workspace file operations
//
// Upload flow:
//   • Small files (≤ 10 MB)  → POST /api/storage/upload (Next.js proxy)
//   • Large files (> 10 MB)  → GET  /api/storage/presigned-upload → PUT to R2
//
// All direct NestJS calls (delete, signed-url, move) include a Bearer token
// retrieved from the Supabase browser session.
// ─────────────────────────────────────────────────────────────────────────────

import { createBrowserClient } from '@supabase/ssr';

export type FileCategory =
  | 'uploads'
  | 'knowledge-base'
  | 'ai-media'
  | 'exports'
  | 'brand-assets';

export interface UploadResult {
  id:           string;
  r2Key:        string;
  publicUrl:    string;
  signedUrl:    string;
  originalName: string;
  mimeType:     string;
  size:         number;
  category:     FileCategory;
  workspaceId:  string;
  createdAt:    string;
}

export interface FileRecord {
  id:           string;
  workspaceId:  string;
  uploadedBy:   string;
  bucket:       string;
  r2Key:        string;
  originalName: string;
  mimeType:     string;
  size:         number;
  category:     FileCategory;
  createdAt:    string;
}

export interface ListFilesResult {
  items: FileRecord[];
  total: number;
  page:  number;
  limit: number;
}

export interface PresignedUploadResult {
  uploadUrl:  string;
  key:        string;
  fileId:     string;
  expiresIn:  number;
  expiresAt:  string;
}

// ── Supabase auth — memoised per page load ────────────────────────────────────

let _supabase: ReturnType<typeof createBrowserClient> | null = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return _supabase;
}

async function getAccessToken(): Promise<string> {
  const { data: { session }, error } = await getSupabase().auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('Not authenticated — please sign in first.');
  }
  return session.access_token;
}

const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10 MB
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000';

// ── Upload ────────────────────────────────────────────────────────────────────
// Routes through Next.js proxy (/api/storage/upload) for small files so the
// session cookie is used for auth.
// Routes directly to R2 via presigned URL for large files to avoid piping
// hundreds of MB through the Next.js server.

export async function uploadFile(
  workspaceId: string,
  file:        File,
  category:    FileCategory = 'uploads',
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  if (file.size > LARGE_FILE_THRESHOLD) {
    return uploadLargeFile(workspaceId, file, category, onProgress);
  }

  const params   = new URLSearchParams({ workspaceId, category });
  const formData = new FormData();
  formData.append('file', file);

  if (onProgress) {
    return uploadWithProgress(`/api/storage/upload?${params}`, formData, onProgress);
  }

  const res = await fetch(`/api/storage/upload?${params}`, {
    method: 'POST',
    body:   formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Upload failed (${res.status})` }));
    throw new Error(err.error ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}

// ── Large file upload (direct PUT to R2) ─────────────────────────────────────

async function uploadLargeFile(
  workspaceId: string,
  file:        File,
  category:    FileCategory,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  const token = await getAccessToken();

  // 1. Get presigned URL + pre-created fileId
  const params = new URLSearchParams({
    filename:    file.name,
    mimeType:    file.type,
    size:        String(file.size),
    category,
  });

  const presignedRes = await fetch(
    `${API}/v1/workspaces/${workspaceId}/storage/presigned-upload?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!presignedRes.ok) {
    const err = await presignedRes.json().catch(() => ({}));
    throw new Error(err.message ?? `Failed to get upload URL (${presignedRes.status})`);
  }

  const { uploadUrl, fileId, expiresAt } = (await presignedRes.json()) as PresignedUploadResult;

  if (new Date(expiresAt) <= new Date()) {
    throw new Error('Presigned URL expired before upload could start.');
  }

  // 2. PUT directly to R2
  if (onProgress) {
    await putToR2WithProgress(uploadUrl, file, onProgress);
  } else {
    const putRes = await fetch(uploadUrl, {
      method:  'PUT',
      headers: { 'Content-Type': file.type },
      body:    file,
    });
    if (!putRes.ok) throw new Error(`R2 upload failed (${putRes.status})`);
  }

  // 3. Fetch the finalised metadata row
  const metaRes = await fetch(
    `${API}/v1/workspaces/${workspaceId}/storage/${fileId}/signed-url`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  // Return a minimal UploadResult — the caller can re-fetch full metadata if needed
  return {
    id:           fileId,
    r2Key:        '',
    publicUrl:    '',
    signedUrl:    metaRes.ok ? (await metaRes.json()).url : '',
    originalName: file.name,
    mimeType:     file.type,
    size:         file.size,
    category,
    workspaceId,
    createdAt:    new Date().toISOString(),
  };
}

// ── List workspace files ──────────────────────────────────────────────────────

export async function listFiles(
  workspaceId: string,
  opts: { category?: FileCategory; page?: number; limit?: number } = {},
): Promise<ListFilesResult> {
  const params = new URLSearchParams({ workspaceId });
  if (opts.category) params.set('category', opts.category);
  if (opts.page)     params.set('page',     String(opts.page));
  if (opts.limit)    params.set('limit',    String(opts.limit));

  const res = await fetch(`/api/storage/upload?${params}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Failed to list files (${res.status})`);
  }
  return res.json();
}

// ── Delete a file ─────────────────────────────────────────────────────────────

export async function deleteFile(workspaceId: string, fileId: string): Promise<void> {
  const token = await getAccessToken();
  const res   = await fetch(
    `${API}/v1/workspaces/${workspaceId}/storage/${fileId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Delete failed (${res.status})`);
  }
}

// ── Get a presigned download URL ──────────────────────────────────────────────

export async function getSignedUrl(
  workspaceId: string,
  fileId:      string,
  expiresIn = 3600,
): Promise<{ url: string; expiresIn: number; expiresAt: string }> {
  const token  = await getAccessToken();
  const params = new URLSearchParams({ expiresIn: String(expiresIn) });
  const res    = await fetch(
    `${API}/v1/workspaces/${workspaceId}/storage/${fileId}/signed-url?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Failed to get signed URL (${res.status})`);
  }
  return res.json();
}

// ── Move a file to a different category ──────────────────────────────────────

export async function moveFile(
  workspaceId:    string,
  fileId:         string,
  targetCategory: FileCategory,
): Promise<FileRecord> {
  const token  = await getAccessToken();
  const params = new URLSearchParams({ category: targetCategory });
  const res    = await fetch(
    `${API}/v1/workspaces/${workspaceId}/storage/${fileId}/move?${params}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `Move failed (${res.status})`);
  }
  return res.json();
}

// ── Workspace storage usage ───────────────────────────────────────────────────

export async function getStorageUsed(workspaceId: string): Promise<{ bytes: number }> {
  const token = await getAccessToken();
  const res   = await fetch(
    `${API}/v1/workspaces/${workspaceId}/storage/usage`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error(`Failed to fetch usage (${res.status})`);
  return res.json();
}

// ── Utilities ─────────────────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes < 1024)               return `${bytes} B`;
  if (bytes < 1024 ** 2)          return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3)          return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function uploadWithProgress(
  url:        string,
  formData:   FormData,
  onProgress: (pct: number) => void,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);

    xhr.upload.onprogress = ({ loaded, total, lengthComputable }) => {
      if (lengthComputable) onProgress(Math.round((loaded / total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText) as UploadResult);
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror  = () => reject(new Error('Network error during upload.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out.'));
    xhr.send(formData);
  });
}

function putToR2WithProgress(
  url:        string,
  file:       File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = ({ loaded, total, lengthComputable }) => {
      if (lengthComputable) onProgress(Math.round((loaded / total) * 100));
    };

    xhr.onload  = () => (xhr.status < 300 ? resolve() : reject(new Error(`R2 PUT ${xhr.status}`)));
    xhr.onerror  = () => reject(new Error('Network error during R2 upload.'));
    xhr.ontimeout = () => reject(new Error('R2 upload timed out.'));
    xhr.send(file);
  });
}
