import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { StreamingService } from './streaming.service';
import { PromptTemplateService } from './prompt-template.service';
import { ModelRouterService } from './model-router.service';
import { Chapter } from '../project/entities/chapter.entity';
import { Book } from '../project/entities/book.entity';
import { Volume } from '../project/entities/volume.entity';
import { BookService } from '../project/book.service';
import { TokenTransaction } from '../token/entities/token-transaction.entity';
import { MemoryModule } from '../memory/memory.module';
import { AgentsModule } from './agents/agents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Chapter, Book, Volume, TokenTransaction]),
    MemoryModule,
    AgentsModule,
  ],
  controllers: [AiController],
  providers: [
    AiService, StreamingService, PromptTemplateService, ModelRouterService, BookService,
  ],
  exports: [AiService],
})
export class AiModule {}
