import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Outline } from './entities/outline.entity';
import { OutlineService } from './outline.service';
import { OutlineController } from './outline.controller';
import { Book } from '../project/entities/book.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Outline, Book])],
  controllers: [OutlineController],
  providers: [OutlineService],
  exports: [OutlineService],
})
export class OutlineModule {}
