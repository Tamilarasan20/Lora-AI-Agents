import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { StorageValidator } from './storage.validator';
import { WorkspaceStorageService } from './workspace-storage.service';
import { WorkspaceStorageController } from './workspace-storage.controller';
import { WorkspaceModule } from '../workspace/workspace.module';

@Global()
@Module({
  imports:     [WorkspaceModule],
  controllers: [WorkspaceStorageController],
  providers:   [StorageService, StorageValidator, WorkspaceStorageService],
  exports:     [StorageService, StorageValidator, WorkspaceStorageService],
})
export class StorageModule {}
