// 纲树状态
//
// 结构：
//   大纲（单例，只有内容，标签形式）
//   细纲（单例，卷纲/章纲的组织容器，结构与目录类似）
//     卷纲（对应目录分卷，1:1）
//       章纲（对应目录章节，1:1）
//       每个卷纲自带系统条目「第N卷卷纲」（isSystem，不可删除）
//
// 注意：更新与删除必须带 bookId —— 后端路由是 books/:bookId/outlines/:id，
// 只写 /outlines/:id 会 404（这曾是"改名/删除点了没反应"的原因）。
import { create } from 'zustand';
import { apiClient } from '../services/api.service';

/** 章纲/卷纲与下游产物的同步状态 */
export type OutlineSyncState = 'pending' | 'synced' | 'changed' | 'source_missing';

export interface OutlineNode {
  id: string;
  bookId: string;
  level: 'book_outline' | 'detailed_outline' | 'volume_outline' | 'chapter_outline';
  title: string;
  content: string | null;
  parentId: string | null;
  /** 系统自带条目（如「第N卷卷纲」）：不可删除、标题不可改 */
  isSystem: boolean;
  generatedVolumeId: string | null;
  generatedChapterId: string | null;
  sortOrder: number;
  currentHash?: string;
  syncState?: OutlineSyncState;
}

interface OutlineGroups {
  bookOutline: OutlineNode | null;
  detailedOutline: OutlineNode | null;
  volumes: OutlineNode[];
  chapters: OutlineNode[];
}

interface OutlineState extends OutlineGroups {
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  loadGroups: (bookId: string) => Promise<void>;
  /** 更新大纲内容（标题固定，只改 content） */
  saveBookOutline: (bookId: string, content: string) => Promise<void>;
  createNode: (bookId: string, data: { level: string; title: string; content?: string; parentId?: string }) => Promise<void>;
  updateNode: (bookId: string, id: string, data: { title?: string; content?: string }) => Promise<void>;
  deleteNode: (bookId: string, id: string) => Promise<void>;
  generateChapter: (bookId: string, outlineId: string) => Promise<any>;
  generateVolume: (bookId: string, outlineId: string) => Promise<any>;
  selectNode: (id: string | null) => void;
  clearError: () => void;
}

export const useOutlineStore = create<OutlineState>((set, get) => ({
  bookOutline: null,
  detailedOutline: null,
  volumes: [],
  chapters: [],
  loading: false,
  error: null,
  selectedId: null,

  clearError: () => set({ error: null }),

  loadGroups: async (bookId) => {
    set({ loading: true, error: null });
    try {
      const res = await apiClient.get(`/books/${bookId}/outlines`);
      const d = res.data.data || {};
      set({
        bookOutline: d.bookOutline ?? null,
        detailedOutline: d.detailedOutline ?? null,
        volumes: d.volumes ?? [],
        chapters: d.chapters ?? [],
        loading: false,
      });
    } catch (e: any) {
      set({ loading: false, error: e?.response?.data?.error?.message || e?.message || '加载纲树失败' });
    }
  },

  saveBookOutline: async (bookId, content) => {
    set({ error: null });
    try {
      await apiClient.patch(`/books/${bookId}/outlines/book-outline`, { content });
      await get().loadGroups(bookId);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '保存大纲失败';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  createNode: async (bookId, data) => {
    set({ error: null });
    try {
      await apiClient.post(`/books/${bookId}/outlines`, data);
      await get().loadGroups(bookId);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '创建失败';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  updateNode: async (bookId, id, data) => {
    set({ error: null });
    try {
      await apiClient.patch(`/books/${bookId}/outlines/${id}`, data);
      await get().loadGroups(bookId);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '保存失败';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  deleteNode: async (bookId, id) => {
    set({ error: null });
    try {
      await apiClient.delete(`/books/${bookId}/outlines/${id}`);
      await get().loadGroups(bookId);
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '删除失败';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  generateChapter: async (bookId, outlineId) => {
    set({ error: null });
    try {
      const res = await apiClient.post(`/books/${bookId}/outlines/${outlineId}/generate-chapter`);
      await get().loadGroups(bookId);
      return res.data.data;
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '生成章节失败';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  generateVolume: async (bookId, outlineId) => {
    set({ error: null });
    try {
      const res = await apiClient.post(`/books/${bookId}/outlines/${outlineId}/generate-volume`);
      await get().loadGroups(bookId);
      return res.data.data;
    } catch (e: any) {
      const msg = e?.response?.data?.error?.message || e?.message || '生成分卷失败';
      set({ error: msg });
      throw new Error(msg);
    }
  },

  selectNode: (id) => set({ selectedId: id }),
}));
