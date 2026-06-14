import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OperationLog } from './entities/operation-log.entity';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { ConflictResolverService } from './conflict-resolver.service';
import { Book } from '../project/entities/book.entity';
import { Volume } from '../project/entities/volume.entity';
import { Chapter } from '../project/entities/chapter.entity';
import { Outline } from '../outline/entities/outline.entity';
import { Character } from '../character/entities/character.entity';
import { WorldSetting } from '../worldbuilding/entities/world-setting.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    OperationLog, Book, Volume, Chapter, Outline, Character, WorldSetting,
  ])],
  controllers: [SyncController],
  providers: [SyncService, ConflictResolverService],
  exports: [SyncService],
})
export class SyncModule {}
