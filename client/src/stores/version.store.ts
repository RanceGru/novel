// 版本状态
import { create } from 'zustand';
import { apiClient } from '../services/api.service';

interface Version { id: string; versionNumber: number; wordCount: number; wordDiff: number; label: string | null; source: string; contentPreview: string; createdAt: string; }

interface VersionState {
  versions: Version[];
  currentDiff: any | null;
  loading: boolean;
  loadHistory: (chapterId: string) => Promise<void>;
  revert: (versionId: string) => Promise<void>;
  getVersion: (versionId: string) => Promise<any>;
}

export const useVersionStore = create<VersionState>((set) => ({
  versions: [], currentDiff: null, loading: false,
  loadHistory: async (chapterId) => {
    set({ loading: true });
    const r = await apiClient.get(`/chapters/${chapterId}/versions`);
    set({ versions: r.data.data?.items || r.data.data, loading: false });
  },
  revert: async (versionId) => { await apiClient.post(`/versions/${versionId}/revert`); },
  getVersion: async (versionId) => { const r = await apiClient.get(`/versions/${versionId}`); return r.data.data; },
}));
