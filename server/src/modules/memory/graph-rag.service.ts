// GraphRAG 知识图谱服务 — 角色关系 + 事件因果链 + 伏笔推进链
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MemoryEvent } from './entities/memory-event.entity';
import { Foreshadow } from './entities/foreshadow.entity';
import { CharacterState } from './entities/character-state.entity';
import { EmbeddingService } from './embedding.service';
import { VectorSearchService, SearchResult } from './vector-search.service';

/** 图谱节点 */
export interface GraphNode {
  id: string;
  type: 'character' | 'event' | 'foreshadow' | 'location' | 'item';
  label: string;
  properties: Record<string, unknown>;
}

/** 图谱边 */
export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  weight: number;
  description?: string;
}

/** 推理查询结果 */
export interface ReasoningResult {
  answer: string;
  reasoningPath: string[];
  supportingNodes: GraphNode[];
  supportingEdges: GraphEdge[];
  confidence: number;
}

@Injectable()
export class GraphRAGService {
  private readonly logger = new Logger(GraphRAGService.name);

  constructor(
    @InjectRepository(MemoryEvent) private eventRepo: Repository<MemoryEvent>,
    @InjectRepository(Foreshadow) private foreshadowRepo: Repository<Foreshadow>,
    @InjectRepository(CharacterState) private stateRepo: Repository<CharacterState>,
    private embeddingService: EmbeddingService,
    private vectorSearch: VectorSearchService,
  ) {}

  /** 构建作品的知识图谱 */
  async buildGraph(bookId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    const [events, foreshadows, states] = await Promise.all([
      this.eventRepo.find({ where: { bookId } }),
      this.foreshadowRepo.find({ where: { bookId } }),
      this.stateRepo
        .createQueryBuilder('cs')
        .innerJoin('characters', 'c', 'c.id = cs.character_id')
        .where('c.book_id = :bookId', { bookId })
        .orderBy('cs.chapterTimestamp', 'DESC')
        .getMany(),
    ]);

    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const addedNodes = new Set<string>();

    // 事件节点
    for (const e of events) {
      if (!addedNodes.has(e.id)) {
        nodes.push({
          id: e.id, type: 'event', label: e.title,
          properties: { summary: e.summary, importance: e.importance, eventType: e.eventType, createdAt: e.createdAt },
        });
        addedNodes.add(e.id);
      }
    }

    // 伏笔节点
    for (const f of foreshadows) {
      if (!addedNodes.has(f.id)) {
        nodes.push({
          id: f.id, type: 'foreshadow', label: f.title,
          properties: { description: f.description, status: f.status, type: f.type },
        });
        addedNodes.add(f.id);
      }
      // 伏笔→章节边
      if (f.plantedChapterId) {
        edges.push({
          source: f.id, target: f.plantedChapterId,
          type: 'planted_in', weight: 8, description: '在此章节埋下',
        });
      }
      if (f.resolvedChapterId) {
        edges.push({
          source: f.id, target: f.resolvedChapterId,
          type: 'resolved_in', weight: 10, description: '在此章节回收',
        });
      }
    }

    // 角色状态节点（归并同一角色）
    const charMap = new Map<string, CharacterState[]>();
    for (const s of states) {
      const list = charMap.get(s.characterId) || [];
      list.push(s);
      charMap.set(s.characterId, list);
    }

    for (const [charId, charStates] of charMap) {
      const latest = charStates[0];
      if (!addedNodes.has(charId)) {
        nodes.push({
          id: charId, type: 'character', label: charId,
          properties: {
            location: latest.location,
            emotionalState: latest.emotionalState,
            physicalState: latest.physicalState,
            possessions: latest.possessions,
            stateCount: charStates.length,
          },
        });
        addedNodes.add(charId);
      }
    }

    // 事件共现角色→构建边（通过角色名称匹配，非UUID）
    for (const e of events) {
      // 从 charStates 中提取角色名称
      const charNames = new Map<string, string>(); // charId → charName
      for (const s of states) {
        if (!charNames.has(s.characterId)) {
          // 尝试从 Character 实体获取名称（通过关联查询）
          charNames.set(s.characterId, s.characterId); // fallback 用 ID
        }
      }
      // 通过角色状态中的 location/possessions 等文本匹配
      for (const [charId, charStatesList] of charMap) {
        const latest = charStatesList[0];
        const namePatterns = [latest.location, latest.possessions, latest.emotionalState]
          .filter(Boolean) as string[];
        // 如果事件的 summary 包含角色关联的地名、物品等信息则建立边
        const isRelated = namePatterns.some(p =>
          e.summary && p && (e.summary.includes(p) || p.includes(e.summary?.substring(0, 5))),
        );
        if (isRelated) {
          edges.push({
            source: e.id, target: charId,
            type: 'involves', weight: 5, description: '角色关联',
          });
        }
      }
    }

    // 事件因果链（同类型事件按时间连接）
    const sortedEvents = [...events].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      const curr = sortedEvents[i];
      const next = sortedEvents[i + 1];
      // 高重要度事件之间建立因果链
      if ((curr.importance || 0) >= 6 && (next.importance || 0) >= 6) {
        edges.push({
          source: curr.id, target: next.id,
          type: 'precedes', weight: Math.min(curr.importance, next.importance) / 10,
          description: '时序因果链',
        });
      }
    }

    this.logger.log(`图谱构建完成: ${nodes.length} 节点, ${edges.length} 边`);
    return { nodes, edges };
  }

  /** 推理查询：基于图谱回答复杂问题 */
  async reasoningQuery(bookId: string, question: string): Promise<ReasoningResult> {
    // 1. 语义搜索找到相关节点
    const relevant = await this.vectorSearch.search(bookId, question, {
      memoryTypes: ['event', 'foreshadow', 'character_state'],
    }, 15, 0.3, true); // 启用重排序

    // 2. 构建局部子图
    const { nodes, edges } = await this.buildGraph(bookId);
    const relevantIds = new Set(relevant.map(r => r.id));
    const subNodes = nodes.filter(n => relevantIds.has(n.id));
    const subEdges = edges.filter(e => relevantIds.has(e.source) || relevantIds.has(e.target));

    // 3. 调用 LLM 进行图谱推理
    const apiKey = process.env.DEEPSEEK_API_KEY || '';
    if (!apiKey) {
      return {
        answer: '未配置 AI API，无法执行推理查询',
        reasoningPath: [],
        supportingNodes: subNodes,
        supportingEdges: subEdges,
        confidence: 0,
      };
    }

    const graphContext = [
      '## 相关节点',
      ...subNodes.map(n => `[${n.type}] ${n.label}: ${JSON.stringify(n.properties)}`),
      '## 相关关系',
      ...subEdges.map(e => `${e.source} --[${e.type}]--> ${e.target} (${e.description || ''})`),
    ].join('\n');

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
              content: `你是小说知识图谱推理专家。根据提供的知识图谱节点和关系，回答用户的问题。
推理过程应该基于图谱中的事实，逐步推导。请用JSON格式回复：
{
  "answer": "最终答案（自然语言）",
  "reasoning_path": ["步骤1: ...", "步骤2: ...", ...],
  "confidence": 0.0-1.0
}`,
            },
            {
              role: 'user',
              content: `问题：${question}\n\n知识图谱：\n${graphContext}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) throw new Error(`API错误: ${response.status}`);

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content || '';
      const json = text.match(/\{[\s\S]*\}/);
      const parsed = json ? JSON.parse(json[0]) : { answer: text };

      return {
        answer: parsed.answer || '无法回答',
        reasoningPath: parsed.reasoning_path || [],
        supportingNodes: subNodes,
        supportingEdges: subEdges,
        confidence: parsed.confidence || 0.5,
      };
    } catch (e: any) {
      this.logger.warn('推理查询失败: ' + e.message);
      return {
        answer: `推理查询失败: ${e.message}`,
        reasoningPath: [],
        supportingNodes: subNodes,
        supportingEdges: subEdges,
        confidence: 0,
      };
    }
  }

  /** 查找两节点之间的关联路径 */
  async findPaths(bookId: string, sourceLabel: string, targetLabel: string): Promise<GraphEdge[][]> {
    const { nodes, edges } = await this.buildGraph(bookId);

    // 模糊匹配节点
    const sourceNodes = nodes.filter(n =>
      n.label.includes(sourceLabel) || JSON.stringify(n.properties).includes(sourceLabel),
    );
    const targetNodes = nodes.filter(n =>
      n.label.includes(targetLabel) || JSON.stringify(n.properties).includes(targetLabel),
    );

    if (!sourceNodes.length || !targetNodes.length) return [];

    // BFS 查找所有长度 ≤ 3 的路径
    const paths: GraphEdge[][] = [];
    for (const src of sourceNodes) {
      for (const tgt of targetNodes) {
        if (src.id === tgt.id) continue;
        const found = this.bfs(src.id, tgt.id, edges, 3);
        paths.push(...found);
      }
    }

    return paths;
  }

  /** BFS 最短路径 */
  private bfs(
    start: string, end: string, edges: GraphEdge[], maxDepth: number,
  ): GraphEdge[][] {
    const paths: GraphEdge[][] = [];
    const queue: { node: string; path: GraphEdge[] }[] = [{ node: start, path: [] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      if (path.length >= maxDepth) continue;

      for (const e of edges) {
        const next = e.source === node ? e.target : e.target === node ? e.source : null;
        if (!next || visited.has(next)) continue;

        const newPath = [...path, e];
        if (next === end) {
          paths.push(newPath);
          continue;
        }

        visited.add(next);
        queue.push({ node: next, path: newPath });
      }
    }

    return paths;
  }
}
