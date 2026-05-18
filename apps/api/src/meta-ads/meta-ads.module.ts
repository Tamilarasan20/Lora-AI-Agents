import { Module } from '@nestjs/common';
import { MetaAdsService } from './meta-ads.service';
import { MetaAdsController } from './meta-ads.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [PrismaModule, EncryptionModule],
  controllers: [MetaAdsController],
  providers: [MetaAdsService],
  exports: [MetaAdsService],
})
export class MetaAdsModule {}
