// 向量搜索服务 — 双模式：pgvector原生SQL / JS余弦回退 + 混合检索 + 重排序
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
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
  /**
   * 是否启用 pgvector 原生检索。
   *
   * ⚠️ 当前为「接口预留」状态：即便数据库是 PostgreSQL，只要实例上未安装 pgvector 扩展，
   * 原生 SQL 就会失败并自动回退到 JS 余弦计算（见 searchNative 的 catch）。这是预期行为。
   *
   * 启用原生检索的完整条件（缺一不可）：
   *   1. Postgres 实例安装 pgvector 扩展：CREATE EXTENSION vector;
   *   2. embedding 列由 simple-json(text) 迁移为 vector(1536)：
   *        ALTER TABLE memory_events ALTER COLUMN embedding TYPE vector(1536)
   *          USING embedding::vector;
   *      （setting_patches / style_anchors 同理）
   *   3. 建立向量索引（HNSW，支持增量写入，无需 IVFFlat 的 lists 预训练）：
   *        CREATE INDEX ON memory_events USING hnsw (embedding vector_cosine_ops);
   *   4. 安装中文分词扩展 zhparser，否则下方 plainto_tsquery('chinese', ...) 仍会报错回退。
   *
   * 注意：pgvector 不为零向量建立余弦索引，未配置 embedding API Key 时写入的全零向量
   * 将无法被向量检索命中（见 EmbeddingService 的降级逻辑）。
   */
  private readonly useNativeVector: boolean;

  constructor(
    @InjectRepository(MemoryEvent) private eventRepo: Repository<MemoryEvent>,
    @InjectRepository(Foreshadow) private foreshadowRepo: Repository<Foreshadow>,
    @InjectRepository(CharacterState) private charStateRepo: Repository<CharacterState>,
    @InjectRepository(SettingPatch) private patchRepo: Repository<SettingPatch>,
    private embeddingService: EmbeddingService,
    private dataSource: DataSource,
  ) {
    // 自动检测数据库类型：PostgreSQL 启用原生向量检索，SQLite 回退到 JS
    this.useNativeVector = dataSource.options.type === 'postgres';
    this.logger.log(
      this.useNativeVector
        ? '🔍 向量检索模式: pgvector 原生 SQL'
        : '⚠️ 向量检索模式: JS 余弦回退 (SQLite)',
    );
  }

  /** 混合检索（含可选重排序） */
  async search(
    bookId: string,
    query: string,
    filters?: SearchFilters,
    limit = 20,
    minScore = 0.3,
    rerank = false,
  ): Promise<SearchResult[]> {
    const types = filters?.memoryTypes || ['event', 'foreshadow', 'character_state'];
    const queryEmbedding = await this.embeddingService.embed(query);

    let results: SearchResult[] = [];

    // 根据数据库类型选择检索策略
    if (this.useNativeVector) {
      results = await this.searchNative(bookId, query, queryEmbedding, types, filters);
    } else {
      results = await this.searchFallback(bookId, query, queryEmbedding, types, filters);
    }

    // 过滤最低分数
    results = results.filter(r => r.scores.finalScore >= minScore);

    // 排序取 top-K（K 取大一些留给重排序）
    results.sort((a, b) => b.scores.finalScore - a.scores.finalScore);
    const candidates = results.slice(0, Math.max(limit * 4, 40));

    // 重排序（可选）
    if (rerank && candidates.length > limit) {
      return this.reRank(query, candidates, limit);
    }

    return candidates.slice(0, limit);
  }

  /** pgvector 原生 SQL 检索 */
  private async searchNative(
    bookId: string,
    query: string,
    queryEmbedding: number[],
    types: string[],
    filters?: SearchFilters,
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const vecStr = `[${queryEmbedding.join(',')}]`;

    if (types.includes('event')) {
      try {
        // pgvector <=> 余弦距离运算符
        const events = await this.dataSource.query(
          `SELECT id, title, summary, importance, event_type, created_at,
                  1 - (embedding <=> $1::vector) AS similarity,
                  ts_rank(search_vector, plainto_tsquery('chinese', $2)) AS text_rank,
                  EXP(-0.01 * EXTRACT(DAY FROM (NOW() - created_at))) AS time_decay
           FROM memory_events
           WHERE book_id = $3
           ORDER BY (1 - (embedding <=> $1::vector)) * 0.6 +
                    COALESCE(ts_rank(search_vector, plainto_tsquery('chinese', $2)), 0) * 0.2 +
                    EXP(-0.01 * EXTRACT(DAY FROM (NOW() - created_at))) * 0.2 DESC
           LIMIT 100`,
          [vecStr, query, bookId],
        );
        results.push(...events.map((e: any) => this.mapNativeResult(e, 'event')));
      } catch (e: any) {
        this.logger.warn('pgvector 检索失败，回退到 JS 模式: ' + e.message);
        // pgvector 不可用时回退
        const fallbackEvents = await this.eventRepo.find({ where: { bookId } });
        results.push(...fallbackEvents.map(e => this.scoreItem(e, queryEmbedding, query, 'event')));
      }
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

    return results;
  }

  /** 映射 pgvector 原生查询结果 */
  private mapNativeResult(row: any, type: string): SearchResult {
    const vecSim = row.similarity || 0;
    const textRel = row.text_rank || 0;
    const timeDecay = row.time_decay || 1;
    const importance = row.importance || 5;
    const finalScore = vecSim * 0.6 + textRel * 0.2 + timeDecay * 0.2 + (importance / 100);

    return {
      id: row.id,
      type,
      title: row.title || '',
      summary: row.summary || '',
      score: finalScore,
      scores: {
        vectorSimilarity: vecSim,
        textRelevance: textRel,
        timeDecayFactor: timeDecay,
        importanceBoost: importance / 10,
        finalScore,
      },
      metadata: {
        importance,
        createdAt: row.created_at?.toISOString(),
      },
    };
  }

  /** JS 回退检索（当前 SQLite 行为） */
  private async searchFallback(
    bookId: string,
    query: string,
    queryEmbedding: number[],
    types: string[],
    filters?: SearchFilters,
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

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

    return results;
  }

  /** LLM 重排序：从 Top-K 候选中精选最终结果 */
  async reRank(query: string, candidates: SearchResult[], topN: number = 5): Promise<SearchResult[]> {
    if (candidates.length <= topN) return candidates;

    const candidateList = candidates
      .map((c, i) => `[${i}] [${c.type}] ${c.title}: ${c.summary}`)
      .join('\n');

    const apiKey = process.env.DEEPSEEK_API_KEY || '';
    if (!apiKey) {
      this.logger.warn('未配置 DEEPSEEK_API_KEY，跳过重排序');
      return candidates.slice(0, topN);
    }

    try {
      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: `你是小说信息检索专家。根据用户的查询，从候选项中选出最相关的 ${topN} 个结果。
规则：
1. 优先选择与查询语义最相关的记忆
2. 优先选择主线事件和高重要度记忆
3. 优先选择时间更近的记忆
4. 只返回候选编号（JSON数组），如 [3, 0, 7, 1, 5]`,
            },
            {
              role: 'user',
              content: `查询：${query}\n\n候选列表：\n${candidateList}\n\n请选出最相关的 ${topN} 个候选编号。`,
            },
          ],
          temperature: 0.1,
          max_tokens: 100,
        }),
      });

      if (!response.ok) return candidates.slice(0, topN);

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content || '';

      // 解析 JSON 数组 [3, 0, 7, 1, 5]
      const match = text.match(/\[[\d,\s]+\]/);
      if (match) {
        const indices: number[] = JSON.parse(match[0]);
        const reranked = indices
          .map((i: number) => candidates[i])
          .filter(Boolean);
        this.logger.log(`重排序完成: ${candidates.length} → ${reranked.length}`);
        return reranked.length > 0 ? reranked : candidates.slice(0, topN);
      }
    } catch (e: any) {
      this.logger.warn(`重排序失败: ${e.message}`);
    }

    return candidates.slice(0, topN);
  }

  /** 计算混合分数（JS回退模式） */
  private scoreItem(item: any, queryEmbedding: number[], query: string, type: string): SearchResult {
    const vecSim = item.embedding
      ? this.cosineSimilarity(queryEmbedding, item.embedding)
      : 0;

    const textRelevance = this.keywordScore(
      `${item.title || ''} ${item.summary || ''} ${item.patchContent || ''}`,
      query,
    );

    const daysSince = item.createdAt
      ? Math.max(0, (Date.now() - new Date(item.createdAt).getTime()) / (1000 * 86400))
      : 30;
    const timeDecay = Math.exp(-0.01 * daysSince);

    const importance = item.importance || 5;
    const importanceBoost = importance / 10;

    const finalScore = vecSim * 0.6 + textRelevance * 0.2 + timeDecay * 0.2 + importanceBoost * 0.1;

    return {
      id: item.id,
      type,
      title: item.title || '',
      summary: item.summary || item.patchContent || item.description || '',
      score: finalScore,
      scores: {
        vectorSimilarity: vecSim,
        textRelevance,
        timeDecayFactor: timeDecay,
        importanceBoost,
        finalScore,
      },
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

  /** 增强的关键词匹配（中文友好的NGram分词） */
  private keywordScore(text: string, query: string): number {
    if (!query || !text) return 0;
    const textLower = text.toLowerCase();
    const queryLower = query.toLowerCase();

    // NGram 子串匹配（中文2-4字窗口）
    let ngramScore = 0;
    for (let n = 2; n <= 4; n++) {
      for (let i = 0; i <= queryLower.length - n; i++) {
        const ngram = queryLower.substring(i, i + n);
        if (textLower.includes(ngram)) {
          ngramScore += 1.0 / (4 - n + 1); // 长匹配权重更高
        }
      }
    }
    const maxNgram = queryLower.length - 1; // 2-gram 最大可能匹配数
    const ngramNorm = maxNgram > 0 ? ngramScore / Math.max(maxNgram, 1) : 0;

    // 精确子串匹配加分
    const exactBoost = textLower.includes(queryLower) ? 0.3 : 0;

    return Math.min(1, ngramNorm + exactBoost);
  }
}
