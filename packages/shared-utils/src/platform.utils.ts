import type { Platform } from '@loraloop/shared-types';

export const PLATFORM_DISPLAY_NAMES: Record<Platform, string> = {
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  facebook: 'Facebook',
  pinterest: 'Pinterest',
  wordpress: 'WordPress',
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  instagram: '#E1306C',
  twitter: '#000000',
  linkedin: '#0077B5',
  tiktok: '#010101',
  youtube: '#FF0000',
  facebook: '#1877F2',
  pinterest: '#E60023',
  wordpress: '#21759B',
};

export function getPlatformDisplayName(platform: string): string {
  return PLATFORM_DISPLAY_NAMES[platform as Platform] ?? capitalize(platform);
}

export function getPlatformColor(platform: string): string {
  return PLATFORM_COLORS[platform as Platform] ?? '#6B7280';
}

export function isValidPlatform(platform: string): platform is Platform {
  return platform in PLATFORM_DISPLAY_NAMES;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
