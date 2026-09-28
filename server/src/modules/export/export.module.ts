// 导出模块
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';
import { Chapter } from '../project/entities/chapter.entity';
import { Volume } from '../project/entities/volume.entity';
import { Book } from '../project/entities/book.entity';
import { ProjectModule } from '../project/project.module';

@Module({
  // BookService 由 ProjectModule 提供并导出；此处不要再把它声明为本模块的 provider，
  // 否则会产生第二个实例，并因为缺少其新依赖而启动失败。
  imports: [TypeOrmModule.forFeature([Chapter, Volume, Book]), ProjectModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
