import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoryEvent } from './entities/memory-event.entity';
import { Foreshadow } from './entities/foreshadow.entity';
import { CharacterState } from './entities/character-state.entity';
import { SettingPatch } from './entities/setting-patch.entity';
import { StyleAnchor } from './entities/style-anchor.entity';
import { SubplotThread } from './entities/subplot-thread.entity';
import { Chapter } from '../project/entities/chapter.entity';
import { Volume } from '../project/entities/volume.entity';
import { Book } from '../project/entities/book.entity';
import { Character } from '../character/entities/character.entity';
import { WorldSetting } from '../worldbuilding/entities/world-setting.entity';
import { MemoryService } from './memory.service';
import { MemoryController } from './memory.controller';
import { MemoryExtractionService } from './memory-extraction.service';
import { EmbeddingService } from './embedding.service';
import { VectorSearchService } from './vector-search.service';
import { ConflictDetectorService } from './conflict-detector.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MemoryEvent, Foreshadow, CharacterState,
      SettingPatch, StyleAnchor, SubplotThread,
      Chapter, Volume, Book, Character, WorldSetting,
    ]),
  ],
  controllers: [MemoryController],
  providers: [
    MemoryService,
    MemoryExtractionService,
    EmbeddingService,
    VectorSearchService,
    ConflictDetectorService,
  ],
  exports: [MemoryService, MemoryExtractionService, EmbeddingService],
})
export class MemoryModule {}
