import { Module, forwardRef } from '@nestjs/common';
import { FacebookPageService } from './facebook-page.service';
import { FacebookController } from './facebook.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [PrismaModule, EncryptionModule, forwardRef(() => QueueModule)],
  controllers: [FacebookController],
  providers: [FacebookPageService],
  exports: [FacebookPageService],
})
export class FacebookModule {}
