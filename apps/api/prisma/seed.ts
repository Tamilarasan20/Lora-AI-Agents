import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PluginSeed {
  platformName: string;
  displayName: string;
  pluginVersion: string;
  authType: string;
  requiredScopes: string[];
  supportsPublishing: boolean;
  supportsScheduling: boolean;
  supportsAnalytics: boolean;
  supportsEngagement: boolean;
  supportsDMs: boolean;
  maxCaptionLength: number;
  maxHashtags: number;
  supportedMediaTypes: string[];
  maxVideoDurationSec: number;
  maxFileSizeMb: number;
  rateLimitPerHour: number;
  rateLimitPerDay: number;
  apiBaseUrl: string;
  documentationUrl: string;
}

const PLUGINS: PluginSeed[] = [
  {
    platformName: 'instagram',
    displayName: 'Instagram',
    pluginVersion: '1.0.0',
    authType: 'oauth2',
    requiredScopes: ['instagram_basic', 'instagram_content_publish', 'instagram_manage_comments', 'pages_show_list'],
    supportsPublishing: true,
    supportsScheduling: true,
    supportsAnalytics: true,
    supportsEngagement: true,
    supportsDMs: true,
    maxCaptionLength: 2200,
    maxHashtags: 30,
    supportedMediaTypes: ['image', 'video', 'carousel'],
    maxVideoDurationSec: 90,
    maxFileSizeMb: 100,
    rateLimitPerHour: 200,
    rateLimitPerDay: 4800,
    apiBaseUrl: 'https://graph.facebook.com/v20.0',
    documentationUrl: 'https://developers.facebook.com/docs/instagram-api',
  },
  {
    platformName: 'facebook',
    displayName: 'Facebook',
    pluginVersion: '1.0.0',
    authType: 'oauth2',
    requiredScopes: ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list', 'pages_messaging'],
    supportsPublishing: true,
    supportsScheduling: true,
    supportsAnalytics: true,
    supportsEngagement: true,
    supportsDMs: true,
    maxCaptionLength: 63206,
    maxHashtags: 30,
    supportedMediaTypes: ['image', 'video', 'link'],
    maxVideoDurationSec: 240,
    maxFileSizeMb: 1024,
    rateLimitPerHour: 200,
    rateLimitPerDay: 4800,
    apiBaseUrl: 'https://graph.facebook.com/v20.0',
    documentationUrl: 'https://developers.facebook.com/docs/graph-api',
  },
  {
    platformName: 'twitter',
    displayName: 'X (Twitter)',
    pluginVersion: '1.0.0',
    authType: 'oauth2',
    requiredScopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access', 'dm.read', 'dm.write'],
    supportsPublishing: true,
    supportsScheduling: true,
    supportsAnalytics: true,
    supportsEngagement: true,
    supportsDMs: true,
    maxCaptionLength: 280,
    maxHashtags: 10,
    supportedMediaTypes: ['image', 'video', 'gif'],
    maxVideoDurationSec: 140,
    maxFileSizeMb: 512,
    rateLimitPerHour: 300,
    rateLimitPerDay: 7200,
    apiBaseUrl: 'https://api.twitter.com/2',
    documentationUrl: 'https://developer.twitter.com/en/docs/twitter-api',
  },
  {
    platformName: 'linkedin',
    displayName: 'LinkedIn',
    pluginVersion: '1.0.0',
    authType: 'oauth2',
    requiredScopes: ['w_member_social', 'r_liteprofile', 'r_emailaddress', 'r_organization_social'],
    supportsPublishing: true,
    supportsScheduling: true,
    supportsAnalytics: true,
    supportsEngagement: true,
    supportsDMs: false,
    maxCaptionLength: 3000,
    maxHashtags: 30,
    supportedMediaTypes: ['image', 'video', 'document'],
    maxVideoDurationSec: 600,
    maxFileSizeMb: 200,
    rateLimitPerHour: 100,
    rateLimitPerDay: 1000,
    apiBaseUrl: 'https://api.linkedin.com/v2',
    documentationUrl: 'https://learn.microsoft.com/en-us/linkedin/',
  },
  {
    platformName: 'tiktok',
    displayName: 'TikTok',
    pluginVersion: '1.0.0',
    authType: 'oauth2',
    requiredScopes: ['user.info.basic', 'video.publish', 'video.upload', 'video.list'],
    supportsPublishing: true,
    supportsScheduling: true,
    supportsAnalytics: true,
    supportsEngagement: true,
    supportsDMs: false,
    maxCaptionLength: 2200,
    maxHashtags: 100,
    supportedMediaTypes: ['video'],
    maxVideoDurationSec: 600,
    maxFileSizeMb: 4096,
    rateLimitPerHour: 100,
    rateLimitPerDay: 2400,
    apiBaseUrl: 'https://open.tiktokapis.com/v2',
    documentationUrl: 'https://developers.tiktok.com/doc/content-posting-api-get-started/',
  },
  {
    platformName: 'youtube',
    displayName: 'YouTube',
    pluginVersion: '1.0.0',
    authType: 'oauth2',
    requiredScopes: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
    supportsPublishing: true,
    supportsScheduling: true,
    supportsAnalytics: true,
    supportsEngagement: true,
    supportsDMs: false,
    maxCaptionLength: 5000,
    maxHashtags: 15,
    supportedMediaTypes: ['video'],
    maxVideoDurationSec: 43200,
    maxFileSizeMb: 256000,
    rateLimitPerHour: 100,
    rateLimitPerDay: 10000,
    apiBaseUrl: 'https://www.googleapis.com/youtube/v3',
    documentationUrl: 'https://developers.google.com/youtube/v3',
  },
  {
    platformName: 'pinterest',
    displayName: 'Pinterest',
    pluginVersion: '1.0.0',
    authType: 'oauth2',
    requiredScopes: ['boards:read', 'boards:write', 'pins:read', 'pins:write'],
    supportsPublishing: true,
    supportsScheduling: true,
    supportsAnalytics: true,
    supportsEngagement: true,
    supportsDMs: false,
    maxCaptionLength: 500,
    maxHashtags: 20,
    supportedMediaTypes: ['image', 'video'],
    maxVideoDurationSec: 60,
    maxFileSizeMb: 32,
    rateLimitPerHour: 1000,
    rateLimitPerDay: 10000,
    apiBaseUrl: 'https://api.pinterest.com/v5',
    documentationUrl: 'https://developers.pinterest.com/docs/api/v5/',
  },
  {
    platformName: 'wordpress',
    displayName: 'WordPress',
    pluginVersion: '1.0.0',
    authType: 'application_password',
    requiredScopes: [],
    supportsPublishing: true,
    supportsScheduling: true,
    supportsAnalytics: false,
    supportsEngagement: true,
    supportsDMs: false,
    maxCaptionLength: 1000000,
    maxHashtags: 0,
    supportedMediaTypes: ['image', 'video', 'document'],
    maxVideoDurationSec: 3600,
    maxFileSizeMb: 100,
    rateLimitPerHour: 1000,
    rateLimitPerDay: 24000,
    apiBaseUrl: '',
    documentationUrl: 'https://developer.wordpress.org/rest-api/',
  },
];

async function main() {
  console.log('🌱 Seeding platform plugins...');

  for (const plugin of PLUGINS) {
    await prisma.platformPlugin.upsert({
      where: { platformName: plugin.platformName },
      create: { ...plugin, status: 'ACTIVE' },
      update: {
        displayName: plugin.displayName,
        pluginVersion: plugin.pluginVersion,
        updatedAt: new Date(),
      },
    });
    console.log(`  ✅ ${plugin.displayName}`);
  }

  console.log(`🎉 Seeded ${PLUGINS.length} platform plugins`);
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
