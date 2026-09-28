// 世界观状态
import { create } from 'zustand';
import { apiClient } from '../services/api.service';

interface WorldSetting {
  id: string; bookId: string; category: string; title: string;
  content: string | null; sortOrder: number;
}

interface WBState {
  settings: WorldSetting[];
  loading: boolean;
  loadSettings: (bookId: string, category?: string) => Promise<void>;
  create: (bookId: string, data: any) => Promise<void>;
  // 注意：控制器挂在 books/:bookId/world-settings/:id 下，
  // 原先写成 /world-settings/:id 会 404（静默失败），故这里需要 bookId。
  update: (bookId: string, id: string, data: any) => Promise<void>;
  remove: (bookId: string, id: string) => Promise<void>;
}

export const useWorldbuildingStore = create<WBState>((set, get) => ({
  settings: [], loading: false,
  loadSettings: async (bookId, category?) => {
    set({ loading: true });
    const res = await apiClient.get(`/books/${bookId}/world-settings`, { params: category ? { category } : {} });
    set({ settings: res.data.data, loading: false });
  },
  create: async (bookId, data) => {
    await apiClient.post(`/books/${bookId}/world-settings`, data);
    get().loadSettings(bookId);
  },
  update: async (bookId, id, data) => {
    await apiClient.patch(`/books/${bookId}/world-settings/${id}`, data);
    get().loadSettings(bookId);
  },
  remove: async (bookId, id) => {
    await apiClient.delete(`/books/${bookId}/world-settings/${id}`);
    get().loadSettings(bookId);
  },
}));
