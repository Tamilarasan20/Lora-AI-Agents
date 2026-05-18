import { Module, forwardRef } from '@nestjs/common';
import { MetaService } from './meta.service';
import { MetaController } from './meta.controller';
import { MetaWebhookService } from './meta-webhook.service';
import { InstagramPublishService } from './instagram-publish.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { QueueModule } from '../queue/queue.module';
import { FacebookModule } from '../facebook/facebook.module';
import { MetaAdsModule } from '../meta-ads/meta-ads.module';

@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    forwardRef(() => QueueModule),
    forwardRef(() => FacebookModule),
    forwardRef(() => MetaAdsModule),
  ],
  controllers: [MetaController],
  providers: [MetaService, MetaWebhookService, InstagramPublishService],
  exports: [MetaService, InstagramPublishService, MetaWebhookService],
})
export class MetaModule {}
