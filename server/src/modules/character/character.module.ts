import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Character } from './entities/character.entity';
import { CharacterSection } from './entities/character-section.entity';
import { CharacterRelation } from './entities/character-relation.entity';
import { CharacterService } from './character.service';
import { CharacterController } from './character.controller';
import { Book } from '../project/entities/book.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Character, CharacterSection, CharacterRelation, Book])],
  controllers: [CharacterController],
  providers: [CharacterService],
})
export class CharacterModule {}
