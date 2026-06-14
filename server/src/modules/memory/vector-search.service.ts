// 向量搜索服务 — JS余弦相似度 + 混合检索
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MemoryEvent } from './entities/memory-event.entity';
import { Foreshadow } from './entities/foreshadow.entity';
import { CharacterState } from './entities/character-state.entity';
import { SettingPatch } from './entities/setting-patch.entity';
import { EmbeddingService } from './embedding.service';

export interface SearchResult {
  id: string; type: string; title: string; summary: string;
  score: number; scores: { vectorSimilarity: number; textRelevance: number; timeDecayFactor: number; importanceBoost: number; finalScore: number; };
  metadata: { chapterNumber?: number; chapterTitle?: string; importance?: number; createdAt: string; };
}

export interface SearchFilters {
  memoryTypes?: string[];
  characterIds?: string[];
  importanceMin?: number;
  timeRange?: { from: string; to: string };
}

@Injectable()
export class VectorSearchService {
  private readonly logger = new Logger(VectorSearchService.name);

  constructor(
    @InjectRepository(MemoryEvent) private eventRepo: Repository<MemoryEvent>,
    @InjectRepository(Foreshadow) private foreshadowRepo: Repository<Foreshadow>,
    @InjectRepository(CharacterState) private charStateRepo: Repository<CharacterState>,
    @InjectRepository(SettingPatch) private patchRepo: Repository<SettingPatch>,
    private embeddingService: EmbeddingService,
  ) {}

  /** 混合检索 */
  async search(
    bookId: string,
    query: string,
    filters?: SearchFilters,
    limit = 20,
    minScore = 0.3,
  ): Promise<SearchResult[]> {
    const queryEmbedding = await this.embeddingService.embed(query);
    const types = filters?.memoryTypes || ['event', 'foreshadow', 'character_state'];

    let results: SearchResult[] = [];

    if (types.includes('event')) {
      const events = await this.eventRepo.find({ where: { bookId } });
      results.push(...events.map(e => this.scoreItem(e, queryEmbedding, query, 'event')));
    }
    if (types.includes('foreshadow')) {
      const items = await this.foreshadowRepo.find({ where: { bookId } });
      results.push(...items.map(f => this.scoreItem(f, queryEmbedding, query, 'foreshadow')));
    }
    if (types.includes('character_state')) {
      const items = await this.charStateRepo
        .createQueryBuilder('cs')
        .innerJoin('characters', 'c', 'c.id = cs.character_id')
        .where('c.book_id = :bookId', { bookId })
        .andWhere(filters?.characterIds ? 'cs.character_id IN (:...charIds)' : '1=1', {
          charIds: filters?.characterIds || [],
        })
        .getMany();
      results.push(...items.map(c => this.scoreItem(c, queryEmbedding, query, 'character_state')));
    }
    if (types.includes('setting_patch')) {
      const items = await this.patchRepo.find({ where: { bookId } });
      results.push(...items.map(p => this.scoreItem(p, queryEmbedding, query, 'setting_patch')));
    }

    // 过滤最低分数
    results = results.filter(r => r.scores.finalScore >= minScore);

    // 排序取 top
    results.sort((a, b) => b.scores.finalScore - a.scores.finalScore);
    return results.slice(0, limit);
  }

  /** 计算混合分数 */
  private scoreItem(item: any, queryEmbedding: number[], query: string, type: string): SearchResult {
    // 向量相似度 (余弦)
    const vecSim = item.embedding ? this.cosineSimilarity(queryEmbedding, item.embedding) : 0;

    // 关键词匹配
    const textRelevance = this.keywordScore(
      `${item.title || ''} ${item.summary || ''} ${item.patchContent || ''}`,
      query,
    );

    // 时间衰减 (越新越高)
    const daysSince = item.createdAt
      ? Math.max(0, (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 86400))
      : 30;
    const timeDecay = Math.exp(-0.01 * daysSince);

    // 重要度加权
    const importance = item.importance || 5;
    const importanceBoost = importance / 10;

    // 最终分数
    const finalScore = vecSim * 0.6 + textRelevance * 0.2 + timeDecay * 0.2;

    return {
      id: item.id,
      type,
      title: item.title || '',
      summary: item.summary || item.patchContent || item.description || '',
      score: finalScore,
      scores: { vectorSimilarity: vecSim, textRelevance, timeDecayFactor: timeDecay, importanceBoost, finalScore },
      metadata: {
        importance: item.importance,
        createdAt: item.createdAt?.toISOString(),
      },
    };
  }

  /** 余弦相似度 */
  cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || !b.length || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /** 简单关键词匹配分数 */
  private keywordScore(text: string, query: string): number {
    if (!query || !text) return 0;
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/[\s,，。！？、]+/).filter(w => w.length > 1);
    const matchCount = queryWords.filter(w => textLower.includes(w)).length;
    return queryWords.length > 0 ? matchCount / queryWords.length : 0;
  }
}
