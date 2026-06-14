// 记忆控制器
import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { VectorSearchService } from './vector-search.service';
import { MemoryExtractionService } from './memory-extraction.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEvent } from './entities/memory-event.entity';
import { Foreshadow } from './entities/foreshadow.entity';

@ApiTags('记忆系统')
@Controller('books/:bookId/memory')
export class MemoryController {
  constructor(
    private memoryService: MemoryService,
    private vectorSearch: VectorSearchService,
    private extractionService: MemoryExtractionService,
    @InjectRepository(MemoryEvent) private eventRepo: Repository<MemoryEvent>,
    @InjectRepository(Foreshadow) private foreshadowRepo: Repository<Foreshadow>,
  ) {}

  @Get('summary')
  @ApiOperation({ summary: '记忆摘要统计' })
  async getSummary(@Param('bookId') bookId: string) {
    return this.memoryService.getMemorySummary(bookId);
  }

  @Post('search')
  @ApiOperation({ summary: '语义记忆搜索' })
  async search(@Param('bookId') bookId: string, @Body() body: { query: string; filters?: any; limit?: number }) {
    return this.vectorSearch.search(bookId, body.query, body.filters, body.limit);
  }

  @Get('events')
  async getEvents(@Param('bookId') bookId: string) {
    return this.eventRepo.find({ where: { bookId }, order: { createdAt: 'DESC' }, take: 50 });
  }

  @Get('foreshadows')
  async getForeshadows(@Param('bookId') bookId: string, @Query('status') status?: string) {
    const where: any = { bookId };
    if (status) where.status = status;
    return this.foreshadowRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  @Post('extract')
  @ApiOperation({ summary: '手动触发记忆提取' })
  async extract(
    @Param('bookId') bookId: string,
    @Body('chapterId') chapterId: string,
    @CurrentUser() user: { id: string; plan: string },
  ) {
    const result = await this.extractionService.extract(chapterId, bookId, user.id, user.plan);
    return { message: '记忆提取完成', result };
  }

  @Post('context')
  @ApiOperation({ summary: '获取当前写作上下文记忆' })
  async getContext(
    @Param('bookId') bookId: string,
    @Body('chapterId') chapterId: string,
  ) {
    return this.memoryService.assembleContext(bookId, chapterId);
  }
}
