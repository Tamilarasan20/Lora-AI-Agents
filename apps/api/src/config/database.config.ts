import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL || '',
  analyticsUrl: process.env.ANALYTICS_DATABASE_URL || '',
}));
