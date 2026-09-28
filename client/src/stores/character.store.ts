// 角色状态
//
// 注意：更新与删除必须带 bookId —— 后端路由是 books/:bookId/characters/:id，
// 只写 /characters/:id 会 404（这曾是"角色编辑/删除点了没反应"的原因）。
import { create } from 'zustand';
import { apiClient } from '../services/api.service';

export interface Character {
  id: string; bookId: string; name: string; alias: string | null; category: string;
  background: string | null; personality: string | null; abilities: string | null;
  appearance: string | null; goals: string | null; arcSummary: string | null;
}

/** 角色子项（类似分卷下的章节，但不带序号） */
export interface CharacterSection {
  id: string; bookId: string; characterId: string;
  title: string; content: string | null; sortOrder: number;
}

interface CharacterGraph { nodes: any[]; edges: any[]; }

interface CharacterState {
  characters: Character[];
  sections: CharacterSection[];
  graph: CharacterGraph;
  loading: boolean;
  error: string | null;
  loadCharacters: (bookId: string) => Promise<void>;
  loadGraph: (bookId: string) => Promise<void>;
  create: (bookId: string, data: any) => Promise<void>;
  update: (bookId: string, id: string, data: any) => Promise<void>;
  remove: (bookId: string, id: string) => Promise<void>;
  /** 子项 */
  createSection: (bookId: string, characterId: string, data: { title: string; content?: string }) => Promise<void>;
  updateSection: (bookId: string, id: string, data: { title?: string; content?: string }) => Promise<void>;
  deleteSection: (bookId: string, id: string) => Promise<void>;
  clearError: () => void;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [], sections: [], graph: { nodes: [], edges: [] }, loading: false, error: null,

  clearError: () => set({ error: null }),

  loadCharacters: async (bookId) => {
    set({ loading: true, error: null });
    try {
      // 角色与其子项一并拉取
      const [chars, secs] = await Promise.all([
        apiClient.get(`/books/${bookId}/characters`),
        apiClient.get(`/books/${bookId}/characters/sections`),
      ]);
      set({ characters: chars.data.data, sections: secs.data.data, loading: false });
    } catch (e: any) {
      set({ loading: false, error: e?.response?.data?.error?.message || e?.message || '加载角色失败' });
    }
  },

  loadGraph: async (bookId) => {
    const res = await apiClient.get(`/books/${bookId}/characters/character-graph`);
    set({ graph: res.data.data });
  },

  create: async (bookId, data) => {
    set({ error: null });
    try {
      await apiClient.post(`/books/${bookId}/characters`, data);
      await get().loadCharacters(bookId);
    } catch (e: any) {
      set({ error: e?.response?.data?.error?.message || e?.message || '创建角色失败' });
      throw e;
    }
  },

  update: async (bookId, id, data) => {
    set({ error: null });
    try {
      await apiClient.patch(`/books/${bookId}/characters/${id}`, data);
      await get().loadCharacters(bookId);
    } catch (e: any) {
      set({ error: e?.response?.data?.error?.message || e?.message || '保存角色失败' });
      throw e;
    }
  },

  remove: async (bookId, id) => {
    set({ error: null });
    try {
      await apiClient.delete(`/books/${bookId}/characters/${id}`);
      await get().loadCharacters(bookId);
    } catch (e: any) {
      set({ error: e?.response?.data?.error?.message || e?.message || '删除角色失败' });
      throw e;
    }
  },

  createSection: async (bookId, characterId, data) => {
    set({ error: null });
    try {
      await apiClient.post(`/books/${bookId}/characters/${characterId}/sections`, data);
      await get().loadCharacters(bookId);
    } catch (e: any) {
      set({ error: e?.response?.data?.error?.message || e?.message || '新建子项失败' });
      throw e;
    }
  },

  updateSection: async (bookId, id, data) => {
    set({ error: null });
    try {
      await apiClient.patch(`/books/${bookId}/characters/sections/${id}`, data);
      await get().loadCharacters(bookId);
    } catch (e: any) {
      set({ error: e?.response?.data?.error?.message || e?.message || '保存子项失败' });
      throw e;
    }
  },

  deleteSection: async (bookId, id) => {
    set({ error: null });
    try {
      await apiClient.delete(`/books/${bookId}/characters/sections/${id}`);
      await get().loadCharacters(bookId);
    } catch (e: any) {
      set({ error: e?.response?.data?.error?.message || e?.message || '删除子项失败' });
      throw e;
    }
  },
}));
