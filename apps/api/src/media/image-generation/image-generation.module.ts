import { Module } from '@nestjs/common';
import { ImageGenerationService } from './image-generation.service';
import { OpenAIImageProvider } from './providers/openai-image.provider';
import { GeminiImageProvider } from './providers/gemini-image.provider';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [StorageModule],
  providers: [ImageGenerationService, OpenAIImageProvider, GeminiImageProvider],
  exports: [ImageGenerationService],
})
export class ImageGenerationModule {}
