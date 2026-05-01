import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiUrl: process.env.API_URL || 'http://localhost:3000',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3001',
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: parseInt(process.env.JWT_EXPIRES_IN || '900', 10),
    refreshSecret: process.env.JWT_REFRESH_SECRET || '',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  supabase: {
    jwtSecret: process.env.SUPABASE_JWT_SECRET || '',
    url: process.env.SUPABASE_URL || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    fromEmail: process.env.RESEND_FROM_EMAIL || 'noreply@loraloop.ai',
    fromName: process.env.RESEND_FROM_NAME || 'Loraloop',
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY || '',
  },
  logLevel: process.env.LOG_LEVEL || 'debug',
  sentryDsn: process.env.SENTRY_DSN || '',
}));
