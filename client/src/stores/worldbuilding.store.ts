// 世界观状态
import { create } from 'zustand';
import { apiClient } from '../services/api.service';

interface WorldSetting { id: string; bookId: string; category: string; title: string; content: string | null; }

interface WBState {
  settings: WorldSetting[];
  loading: boolean;
  loadSettings: (bookId: string, category?: string) => Promise<void>;
  create: (bookId: string, data: any) => Promise<void>;
  update: (id: string, data: any) => Promise<void>;
  remove: (id: string) => Promise<void>;
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
  update: async (id, data) => { await apiClient.patch(`/world-settings/${id}`, data); },
  remove: async (id) => { await apiClient.delete(`/world-settings/${id}`); },
}));
