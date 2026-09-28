// 项目模块 — 书籍/卷/章节管理
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookController } from './book.controller';
import { BookService } from './book.service';
import { BookCleanupService } from './book-cleanup.service';
import { VolumeController } from './volume.controller';
import { VolumeService } from './volume.service';
import { ChapterController } from './chapter.controller';
import { ChapterService } from './chapter.service';
import { Book } from './entities/book.entity';
import { Volume } from './entities/volume.entity';
import { Chapter } from './entities/chapter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Book, Volume, Chapter])],
  controllers: [BookController, VolumeController, ChapterController],
  providers: [BookService, VolumeService, ChapterService, BookCleanupService],
  exports: [BookService, VolumeService, ChapterService, BookCleanupService],
})
export class ProjectModule {}
