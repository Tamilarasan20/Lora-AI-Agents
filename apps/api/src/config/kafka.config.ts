import { registerAs } from '@nestjs/config';

export default registerAs('kafka', () => ({
  brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
  ssl: process.env.KAFKA_SSL === 'true',
  username: process.env.KAFKA_USERNAME || undefined,
  password: process.env.KAFKA_PASSWORD || undefined,
  clientId: process.env.KAFKA_CLIENT_ID || 'loraloop-api',
  groupId: process.env.KAFKA_GROUP_ID || 'loraloop-api',
}));
