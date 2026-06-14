// 角色系统类型

/** 角色类别 */
export type CharacterCategory = 'protagonist' | 'supporting' | 'antagonist' | 'ensemble';

/** 角色 */
export interface Character {
  id: string;
  bookId: string;
  name: string;
  alias: string | null;
  category: CharacterCategory;
  background: string | null;
  personality: string | null;
  abilities: string | null;
  appearance: string | null;
  goals: string | null;
  arcSummary: string | null;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** 创建角色请求 */
export interface CreateCharacterRequest {
  name: string;
  alias?: string;
  category?: CharacterCategory;
  background?: string;
  personality?: string;
  abilities?: string;
  appearance?: string;
  goals?: string;
  arcSummary?: string;
}

/** 更新角色请求 */
export interface UpdateCharacterRequest {
  name?: string;
  alias?: string;
  category?: CharacterCategory;
  background?: string;
  personality?: string;
  abilities?: string;
  appearance?: string;
  goals?: string;
  arcSummary?: string;
}

/** 角色关系 */
export interface CharacterRelation {
  id: string;
  bookId: string;
  sourceCharId: string;
  targetCharId: string;
  relationType: string;
  description: string | null;
  intensity: number;
  sourceCharName?: string;
  targetCharName?: string;
  createdAt: string;
  updatedAt: string;
}

/** 角色状态快照 */
export interface CharacterState {
  id: string;
  characterId: string;
  chapterId: string;
  physicalState: string | null;
  mentalState: string | null;
  emotionalState: string | null;
  location: string | null;
  possessions: string | null;
  chapterTimestamp: number | null;
  createdAt: string;
}

/** 角色关系图数据 */
export interface CharacterGraph {
  nodes: Array<{
    id: string;
    name: string;
    category: CharacterCategory;
    group: string;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    relationType: string;
    intensity: number;
  }>;
}
