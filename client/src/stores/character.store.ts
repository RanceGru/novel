// 角色状态
import { create } from 'zustand';
import { apiClient } from '../services/api.service';

interface Character { id: string; name: string; alias: string | null; category: string; background: string | null; personality: string | null; abilities: string | null; appearance: string | null; goals: string | null; arcSummary: string | null; }
interface CharacterGraph { nodes: any[]; edges: any[]; }

interface CharacterState {
  characters: Character[];
  graph: CharacterGraph;
  loading: boolean;
  loadCharacters: (bookId: string) => Promise<void>;
  loadGraph: (bookId: string) => Promise<void>;
  create: (bookId: string, data: any) => Promise<void>;
  update: (id: string, data: any) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  characters: [], graph: { nodes: [], edges: [] }, loading: false,
  loadCharacters: async (bookId) => {
    set({ loading: true });
    const res = await apiClient.get(`/books/${bookId}/characters`);
    set({ characters: res.data.data, loading: false });
  },
  loadGraph: async (bookId) => {
    const res = await apiClient.get(`/books/${bookId}/characters/character-graph`);
    set({ graph: res.data.data });
  },
  create: async (bookId, data) => {
    await apiClient.post(`/books/${bookId}/characters`, data);
    get().loadCharacters(bookId);
  },
  update: async (id, data) => {
    await apiClient.patch(`/characters/${id}`, data);
  },
  remove: async (id) => { await apiClient.delete(`/characters/${id}`); },
}));
