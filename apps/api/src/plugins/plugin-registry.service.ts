import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { readdirSync } from 'fs';
import { join } from 'path';
import { IPlatformPlugin } from './platform-plugin.interface';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PluginRegistryService implements OnModuleInit {
  private readonly logger = new Logger(PluginRegistryService.name);
  private readonly plugins = new Map<string, IPlatformPlugin>();

  constructor(private prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.loadAllPlugins();
  }

  /**
   * Auto-discover platform plugins by walking `plugins/platforms/*` and importing
   * `<folder>.plugin.{js,ts}`. The exported class is expected to be named
   * `<Capitalized>Plugin`.
   */
  private async loadAllPlugins(): Promise<void> {
    const platformsDir = join(__dirname, 'platforms');

    let platformFolders: string[];
    try {
      platformFolders = readdirSync(platformsDir, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
    } catch (err) {
      this.logger.error('Could not read platforms directory:', err);
      return;
    }

    for (const folder of platformFolders) {
      try {
        const modulePath = join(platformsDir, folder, `${folder}.plugin`);
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pluginModule = await import(modulePath);
        const className = `${this.capitalize(folder)}Plugin`;
        const PluginClass = pluginModule[className];

        if (!PluginClass) {
          this.logger.warn(`No class ${className} exported from ${folder}.plugin`);
          continue;
        }

        const instance: IPlatformPlugin = new PluginClass();
        await this.register(instance);
      } catch (error) {
        this.logger.error(`Failed to load plugin '${folder}':`, error);
      }
    }

    this.logger.log(`✅ Loaded ${this.plugins.size} platform plugins`);
  }

  private async register(plugin: IPlatformPlugin): Promise<void> {
    const key = plugin.platformName.toLowerCase();

    if (this.plugins.has(key)) {
      this.logger.warn(`Plugin '${key}' already registered — skipping`);
      return;
    }

    this.plugins.set(key, plugin);

    try {
      const rateLimit = plugin.getRateLimitInfo();
      const constraints = plugin.getContentConstraints();

      await this.prisma.platformPlugin.upsert({
        where: { platformName: key },
        create: {
          platformName: key,
          displayName: plugin.displayName,
          pluginVersion: plugin.version,
          status: 'ACTIVE',
          authType: 'oauth2',
          supportsPublishing: plugin.supportedFeatures.publishing,
          supportsScheduling: plugin.supportedFeatures.scheduling,
          supportsAnalytics: plugin.supportedFeatures.analytics,
          supportsEngagement: plugin.supportedFeatures.engagement,
          supportsDMs: plugin.supportedFeatures.dms,
          maxCaptionLength: constraints.maxCaptionLength,
          maxHashtags: constraints.maxHashtags,
          supportedMediaTypes: constraints.supportedMediaTypes,
          maxVideoDurationSec: constraints.maxVideoDurationSec,
          maxFileSizeMb: constraints.maxFileSizeMb,
          rateLimitPerHour: rateLimit.requestsPerHour,
          rateLimitPerDay: rateLimit.requestsPerDay,
        },
        update: {
          pluginVersion: plugin.version,
          updatedAt: new Date(),
        },
      });
    } catch (err) {
      // Don't crash app start if DB isn't ready yet — registry stays in memory.
      this.logger.warn(`Could not persist plugin '${key}' to DB: ${(err as Error).message}`);
    }
  }

  getPlugin(platformName: string): IPlatformPlugin {
    const plugin = this.plugins.get(platformName.toLowerCase());
    if (!plugin) {
      throw new Error(`No plugin registered for platform: ${platformName}`);
    }
    return plugin;
  }

  hasPlugin(platformName: string): boolean {
    return this.plugins.has(platformName.toLowerCase());
  }

  getAllPlugins(): IPlatformPlugin[] {
    return Array.from(this.plugins.values());
  }

  getSupportedPlatforms(): string[] {
    return Array.from(this.plugins.keys());
  }

  getActivePlugins(): IPlatformPlugin[] {
    return this.getAllPlugins().filter(p => p.supportedFeatures.publishing);
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
