// 记忆服务 — 上下文组装 + 检索入口 + Redis缓存集成
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
import { CacheService } from '../cache/cache.service';

const CACHE_TTL = {
  CONTEXT: 120,
  SUMMARY: 300,
  FORESHADOWS: 180,
  CHARACTER_STATES: 180,
};

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
    private cacheService: CacheService,
  ) {}

  /** 为 AI 生成组装上下文记忆（带缓存） */
  async assembleContext(bookId: string, chapterId: string): Promise<{
    recentSummary: string;
    activeForeshadows: string;
    characterStates: string;
    relevantMemories: string;
  }> {
    const cacheKey = `memory:context:${bookId}:${chapterId}`;

    return this.cacheService.getOrSet(cacheKey, CACHE_TTL.CONTEXT, async () => {
      const chapter = await this.chapterRepo.findOne({ where: { id: chapterId } });

      const [recentSummary, foreshadowText, characterStateText, memoryText] = await Promise.all([
        this.getRecentSummary(chapter),
        this.getActiveForeshadows(bookId),
        this.getCharacterStates(bookId),
        this.getRelevantMemories(bookId, chapter),
      ]);

      return { recentSummary, activeForeshadows: foreshadowText, characterStates: characterStateText, relevantMemories: memoryText };
    });
  }

  /** 获取最近章节摘要 */
  private async getRecentSummary(chapter: Chapter | null): Promise<string> {
    if (!chapter) return '';
    const recentChapters = await this.getRecentChapters(chapter.volumeId, chapter.chapterNumber, 3);
    return recentChapters
      .map(c => `第${c.chapterNumber}章 ${c.title}: ${c.summary || '无摘要'}`)
      .join('\n');
  }

  /** 获取活跃伏笔（带缓存） */
  private async getActiveForeshadows(bookId: string): Promise<string> {
    const cacheKey = `memory:foreshadows:${bookId}`;
    return this.cacheService.getOrSet(cacheKey, CACHE_TTL.FORESHADOWS, async () => {
      const active = await this.foreshadowRepo.find({ where: { bookId, status: 'active' }, take: 10 });
      return active
        .map(f => `【${f.type === 'major' ? '主线伏笔' : '支线伏笔'}】${f.title}: ${f.description || ''}`)
        .join('\n');
    });
  }

  /** 获取角色状态（带缓存） */
  private async getCharacterStates(bookId: string): Promise<string> {
    const cacheKey = `memory:states:${bookId}`;
    return this.cacheService.getOrSet(cacheKey, CACHE_TTL.CHARACTER_STATES, async () => {
      const states = await this.charStateRepo
        .createQueryBuilder('cs')
        .distinctOn(['cs.characterId'])
        .where('cs.characterId IN (SELECT id FROM characters WHERE book_id = :bookId)', { bookId })
        .orderBy('cs.characterId')
        .addOrderBy('cs.chapterTimestamp', 'DESC')
        .getMany();
      return states
        .map(cs => `[${cs.characterId}] 位置:${cs.location || '未知'} 情感:${cs.emotionalState || '-'} 身体:${cs.physicalState || '-'}`)
        .join('\n');
    });
  }

  /** 获取相关长期记忆 */
  private async getRelevantMemories(bookId: string, chapter: Chapter | null): Promise<string> {
    const query = `${chapter?.title || ''} ${chapter?.chapterOutline || ''} ${chapter?.summary || ''}`;
    const memories = await this.vectorSearch.search(bookId, query, { memoryTypes: ['event'] }, 10);
    return memories.map(m => `[相关事件] ${m.title}: ${m.summary} (相关度:${m.score.toFixed(2)})`).join('\n');
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

  /** 获取书籍记忆摘要（用于前端面板，带缓存） */
  async getMemorySummary(bookId: string) {
    const cacheKey = `memory:summary:${bookId}`;
    return this.cacheService.getOrSet(cacheKey, CACHE_TTL.SUMMARY, async () => {
      const [totalEvents, totalForeshadows, activeF, resolvedF, totalStates] = await Promise.all([
        this.eventRepo.count({ where: { bookId } }),
        this.foreshadowRepo.count({ where: { bookId } }),
        this.foreshadowRepo.count({ where: { bookId, status: 'active' } }),
        this.foreshadowRepo.count({ where: { bookId, status: 'resolved' } }),
        this.charStateRepo
          .createQueryBuilder('cs')
          .where(qb => {
            const subQuery = qb.subQuery()
              .select('c.id').from('characters', 'c')
              .where('c.book_id = :bookId', { bookId }).getQuery();
            return `cs.character_id IN ${subQuery}`;
          }).getCount(),
      ]);
      return { totalEvents, totalForeshadows, activeForeshadows: activeF, resolvedForeshadows: resolvedF, totalCharacterStates: totalStates };
    });
  }
}
