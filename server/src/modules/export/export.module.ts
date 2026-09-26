// 导出模块
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { Chapter } from '../project/entities/chapter.entity';
import { Volume } from '../project/entities/volume.entity';
import { Book } from '../project/entities/book.entity';
import { BookService } from '../project/book.service';

@Module({
  imports: [TypeOrmModule.forFeature([Chapter, Volume, Book])],
  controllers: [ExportController],
  providers: [ExportService, BookService],
})
export class ExportModule {}
