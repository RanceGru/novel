// 纲树状态
import { create } from 'zustand';
import { apiClient } from '../services/api.service';

interface OutlineNode {
  id: string; bookId: string; level: string; title: string; content: string | null;
  parentId: string | null; volumeId: string | null; chapterId: string | null;
  sortOrder: number; children: OutlineNode[];
}

interface OutlineState {
  tree: OutlineNode[];
  loading: boolean;
  selectedId: string | null;
  loadTree: (bookId: string) => Promise<void>;
  createNode: (bookId: string, data: any) => Promise<void>;
  updateNode: (id: string, data: any) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  selectNode: (id: string | null) => void;
}

export const useOutlineStore = create<OutlineState>((set, get) => ({
  tree: [], loading: false, selectedId: null,
  loadTree: async (bookId) => {
    set({ loading: true });
    const res = await apiClient.get(`/books/${bookId}/outlines`);
    set({ tree: res.data.data, loading: false });
  },
  createNode: async (bookId, data) => {
    await apiClient.post(`/books/${bookId}/outlines`, data);
    get().loadTree(bookId);
  },
  updateNode: async (id, data) => {
    await apiClient.patch(`/outlines/${id}`, data);
  },
  deleteNode: async (id) => {
    await apiClient.delete(`/outlines/${id}`);
  },
  selectNode: (id) => set({ selectedId: id }),
}));
