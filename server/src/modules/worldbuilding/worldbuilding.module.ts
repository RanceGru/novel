import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorldSetting } from './entities/world-setting.entity';
import { WorldbuildingService } from './worldbuilding.service';
import { WorldbuildingController } from './worldbuilding.controller';
import { Book } from '../project/entities/book.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WorldSetting, Book])],
  controllers: [WorldbuildingController],
  providers: [WorldbuildingService],
})
export class WorldbuildingModule {}
