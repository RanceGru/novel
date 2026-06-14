import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChapterVersion } from './entities/chapter-version.entity';
import { Chapter } from '../project/entities/chapter.entity';
import { Volume } from '../project/entities/volume.entity';
import { Book } from '../project/entities/book.entity';
import { VersionService } from './version.service';
import { VersionController } from './version.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ChapterVersion, Chapter, Volume, Book])],
  controllers: [VersionController],
  providers: [VersionService],
  exports: [VersionService],
})
export class VersionModule {}
