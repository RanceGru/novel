// 记忆系统类型

/** 记忆事件 */
export interface MemoryEvent {
  id: string;
  bookId: string;
  chapterId: string | null;
  title: string;
  summary: string | null;
  eventType: string | null;
  importance: number;
  createdAt: string;
}

/** 伏笔 */
export interface Foreshadow {
  id: string;
  bookId: string;
  title: string;
  description: string | null;
  type: 'major' | 'minor';
  status: 'active' | 'partially_resolved' | 'resolved';
  plantedChapterId: string | null;
  resolvedChapterId: string | null;
  progressNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

/** 设定补丁类型 */
export type PatchType = 'addition' | 'modification' | 'deprecation';

/** 设定补丁 */
export interface SettingPatch {
  id: string;
  bookId: string;
  worldSettingId: string | null;
  patchContent: string;
  patchType: PatchType;
  chapterId: string | null;
  createdAt: string;
}

/** 风格锚点 */
export interface StyleAnchor {
  id: string;
  bookId: string;
  chapterId: string | null;
  styleFeatures: Record<string, unknown>;
  sampleText: string | null;
  createdAt: string;
}

/** 子线线程 */
export interface SubplotThread {
  id: string;
  bookId: string;
  title: string;
  description: string | null;
  status: 'active' | 'resolved' | 'abandoned';
  startedChapterId: string | null;
  endedChapterId: string | null;
  createdAt: string;
}

/** 记忆搜索请求 */
export interface MemorySearchRequest {
  query: string;
  queryEmbedding?: number[];
  filters?: {
    memoryTypes?: ('event' | 'foreshadow' | 'character_state' | 'setting_patch')[];
    characterIds?: string[];
    timeRange?: { from: string; to: string };
    importanceMin?: number;
    eventTypes?: string[];
  };
  limit?: number;
  minScore?: number;
}

/** 记忆搜索响应条目 */
export interface MemorySearchResult {
  id: string;
  type: string;
  title: string;
  summary: string;
  score: number;
  scores: {
    vectorSimilarity: number;
    textRelevance: number;
    timeDecayFactor: number;
    importanceBoost: number;
    finalScore: number;
  };
  metadata: {
    chapterNumber?: number;
    chapterTitle?: string;
    characters?: string[];
    importance?: number;
    createdAt: string;
  };
  relatedResults?: MemorySearchResult[];
}
