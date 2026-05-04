# Storage Architecture — Usage Examples

## Folder Structure

```
apps/api/src/storage/
├── storage.types.ts              # TypeScript interfaces, enums, size limits
├── storage.validator.ts          # MIME, size, filename validation
├── storage.service.ts            # Low-level R2 client (S3Client singleton)
├── workspace-storage.service.ts  # Workspace-scoped uploads + metadata
├── workspace-storage.controller.ts # REST API endpoints
└── storage.module.ts             # NestJS module (global)

apps/web/src/
├── app/api/storage/upload/
│   └── route.ts                  # Next.js upload + list proxy route
└── lib/
    └── storage-client.ts         # Browser-side upload helpers

supabase/migrations/
└── 20260503400000_file_metadata.sql  # Supabase SQL (RLS + helpers)

apps/api/prisma/migrations/
└── 20260503400000_file_metadata/
    └── migration.sql             # Prisma migration
```

## R2 Folder Layout (per workspace)

```
workspaces/{workspaceId}/
├── uploads/          # Generic user files (50 MB limit)
├── knowledge-base/   # PDFs, DOCX, CSV for ingestion (100 MB)
├── ai-media/         # AI-generated images / videos (500 MB)
├── exports/          # Reports, CSV exports (200 MB)
└── brand-assets/     # Logos, fonts, brand guidelines (50 MB)
```

## Supported File Types

| Type   | MIME types                                                       |
|--------|------------------------------------------------------------------|
| Image  | image/jpeg, image/png, image/webp, image/gif, image/svg+xml      |
| Video  | video/mp4, video/quicktime, video/webm, video/mpeg               |
| PDF    | application/pdf                                                  |
| DOCX   | application/vnd.openxmlformats-officedocument.wordprocessingml.document |
| CSV    | text/csv, application/csv                                        |
| ZIP    | application/zip, application/x-zip-compressed                   |

---

## Usage: NestJS Service Injection

```typescript
@Injectable()
export class KnowledgeService {
  constructor(private readonly workspaceStorage: WorkspaceStorageService) {}

  async ingestDocument(workspaceId: string, userId: string, file: Express.Multer.File) {
    const result = await this.workspaceStorage.uploadFile({
      workspaceId,
      uploadedBy: userId,
      category:   'knowledge-base',
      file: {
        buffer:       file.buffer,
        originalname: file.originalname,
        mimetype:     file.mimetype,
        size:         file.size,
      },
    });

    // result.r2Key   → 'workspaces/{id}/knowledge-base/my-doc-{uuid}.pdf'
    // result.signedUrl → short-lived presigned URL
    // result.id       → FileMetadata row id in Supabase
    return result;
  }
}
```

## Usage: Frontend Upload (React)

```tsx
import { uploadFile, formatBytes } from '@/lib/storage-client';

function UploadButton({ workspaceId }: { workspaceId: string }) {
  const [progress, setProgress] = useState(0);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = await uploadFile(workspaceId, file, 'brand-assets', setProgress);
    console.log('Uploaded:', result.signedUrl);
  }

  return (
    <div>
      <input type="file" onChange={handleChange} />
      {progress > 0 && <progress value={progress} max={100} />}
    </div>
  );
}
```

## REST API Endpoints

| Method | Path                                                    | Description              |
|--------|---------------------------------------------------------|--------------------------|
| POST   | /v1/workspaces/:id/storage/upload?category=uploads      | Upload a file            |
| GET    | /v1/workspaces/:id/storage?category=brand-assets        | List files (paginated)   |
| GET    | /v1/workspaces/:id/storage/:fileId/signed-url           | Get presigned download   |
| POST   | /v1/workspaces/:id/storage/:fileId/move?category=export | Move to another category |
| DELETE | /v1/workspaces/:id/storage/:fileId                      | Delete file + metadata   |

## Running the Prisma Migration

```bash
# Generate Prisma client after schema change
pnpm --filter api prisma generate

# Apply migration to your database
pnpm --filter api prisma migrate deploy
```

## Running the Supabase Migration

```bash
# Push directly to Supabase project
supabase db push

# Or apply manually in the Supabase SQL editor
# File: supabase/migrations/20260503400000_file_metadata.sql
```
