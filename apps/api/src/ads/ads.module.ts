import { Module } from '@nestjs/common';
import { AdNetworkService } from './ad-network.service';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionModule } from '../encryption/encryption.module';

@Module({
  imports: [PrismaModule, EncryptionModule],
  providers: [AdNetworkService],
  exports: [AdNetworkService],
})
export class AdsModule {}
