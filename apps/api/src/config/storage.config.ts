import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  r2: {
    accountId:       process.env.R2_ACCOUNT_ID        || '',
    accessKeyId:     process.env.R2_ACCESS_KEY_ID     || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucketName:      process.env.R2_BUCKET_NAME       || 'laraloop-storage',
    publicUrl:       process.env.R2_PUBLIC_URL        || '',
    // Explicit endpoint override — defaults to https://{accountId}.r2.cloudflarestorage.com
    endpoint:        process.env.R2_ENDPOINT          || '',
  },
  qdrant: {
    url:    process.env.QDRANT_URL    || 'http://localhost:6333',
    apiKey: process.env.QDRANT_API_KEY || undefined,
  },
}));
