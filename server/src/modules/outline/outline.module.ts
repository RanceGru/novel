import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outline } from './entities/outline.entity';
import { OutlineService } from './outline.service';
import { OutlineController } from './outline.controller';
import { Book } from '../project/entities/book.entity';
import { Volume } from '../project/entities/volume.entity';
import { Chapter } from '../project/entities/chapter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Outline, Book, Volume, Chapter])],
  controllers: [OutlineController],
  providers: [OutlineService],
  exports: [OutlineService],
})
export class OutlineModule {}
