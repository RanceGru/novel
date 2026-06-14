// 记忆服务 — 上下文组装 + 检索入口
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEvent } from './entities/memory-event.entity';
import { Foreshadow } from './entities/foreshadow.entity';
import { CharacterState } from './entities/character-state.entity';
import { Chapter } from '../project/entities/chapter.entity';
import { Volume } from '../project/entities/volume.entity';
import { Book } from '../project/entities/book.entity';
import { VectorSearchService } from './vector-search.service';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @InjectRepository(MemoryEvent) private eventRepo: Repository<MemoryEvent>,
    @InjectRepository(Foreshadow) private foreshadowRepo: Repository<Foreshadow>,
    @InjectRepository(CharacterState) private charStateRepo: Repository<CharacterState>,
    @InjectRepository(Chapter) private chapterRepo: Repository<Chapter>,
    @InjectRepository(Volume) private volumeRepo: Repository<Volume>,
    @InjectRepository(Book) private bookRepo: Repository<Book>,
    private vectorSearch: VectorSearchService,
  ) {}

  /** 为 AI 生成组装上下文记忆 */
  async assembleContext(bookId: string, chapterId: string): Promise<{
    recentSummary: string;
    activeForeshadows: string;
    characterStates: string;
    relevantMemories: string;
  }> {
    // 1. 短期：最近 3 章摘要
    const chapter = await this.chapterRepo.findOne({ where: { id: chapterId } });
    const recentChapters = await this.getRecentChapters(chapter?.volumeId || '', chapter?.chapterNumber || 0, 3);
    const recentSummary = recentChapters
      .map(c => `第${c.chapterNumber}章 ${c.title}: ${c.summary || '无摘要'}`)
      .join('\n');

    // 2. 活跃伏笔
    const activeForeshadows = await this.foreshadowRepo.find({
      where: { bookId, status: 'active' },
      take: 10,
    });
    const foreshadowText = activeForeshadows
      .map(f => `【${f.type === 'major' ? '主线伏笔' : '支线伏笔'}】${f.title}: ${f.description || ''}`)
      .join('\n');

    // 3. 角色状态
    const bookCharacters = await this.charStateRepo
      .createQueryBuilder('cs')
      .distinctOn(['cs.characterId'])
      .where('cs.characterId IN (SELECT id FROM characters WHERE book_id = :bookId)', { bookId })
      .orderBy('cs.characterId')
      .addOrderBy('cs.chapterTimestamp', 'DESC')
      .getMany();
    const characterStateText = bookCharacters
      .map(cs => `[${cs.characterId}] 位置:${cs.location || '未知'} 情感:${cs.emotionalState || '-'} 身体:${cs.physicalState || '-'}`)
      .join('\n');

    // 4. 长期记忆：搜索相关记忆
    const query = `${chapter?.title || ''} ${chapter?.chapterOutline || ''} ${chapter?.summary || ''}`;
    const memories = await this.vectorSearch.search(bookId, query, { memoryTypes: ['event'] }, 10);
    const memoryText = memories.map(m => `[相关事件] ${m.title}: ${m.summary} (相关度:${m.score.toFixed(2)})`).join('\n');

    return {
      recentSummary,
      activeForeshadows: foreshadowText,
      characterStates: characterStateText,
      relevantMemories: memoryText,
    };
  }

  /** 获取最近的章节 */
  private async getRecentChapters(volumeId: string, currentNumber: number, count: number) {
    const start = Math.max(1, currentNumber - count);
    return this.chapterRepo
      .createQueryBuilder('c')
      .where('c.volumeId = :volumeId', { volumeId })
      .andWhere('c.chapterNumber >= :start', { start })
      .andWhere('c.chapterNumber < :current', { current: currentNumber })
      .orderBy('c.chapterNumber', 'ASC')
      .getMany();
  }

  /** 获取书籍记忆摘要（用于前端面板） */
  async getMemorySummary(bookId: string) {
    const [events, foreshadows, states] = await Promise.all([
      this.eventRepo.count({ where: { bookId } }),
      this.foreshadowRepo.count({ where: { bookId } }),
      this.charStateRepo
        .createQueryBuilder('cs')
        .where(qb => {
          const subQuery = qb.subQuery()
            .select('c.id')
            .from('characters', 'c')
            .where('c.book_id = :bookId', { bookId })
            .getQuery();
          return `cs.character_id IN ${subQuery}`;
        })
        .getCount(),
    ]);

    return {
      totalEvents: events,
      activeForeshadows: await this.foreshadowRepo.count({ where: { bookId, status: 'active' } }),
      resolvedForeshadows: await this.foreshadowRepo.count({ where: { bookId, status: 'resolved' } }),
      totalCharacterStates: states,
    };
  }
}
