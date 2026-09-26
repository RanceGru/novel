// 订阅状态
import { create } from 'zustand';
import { apiClient } from '../services/api.service';

interface Usage { currentPlan: string; currentPlanName: string; wordCountLimit: number; monthlyTokenQuota: number; monthlyTokensUsed: number; purchasedTokensRemaining: number; parallelSlots: number; }

interface SubState {
  plans: any[];
  currentPlan: string | null;
  usage: Usage | null;
  loadPlans: () => Promise<void>;
  loadCurrent: () => Promise<void>;
  loadUsage: () => Promise<void>;
  subscribe: (tier: string) => Promise<void>;
}

export const useSubscriptionStore = create<SubState>((set, get) => ({
  plans: [], currentPlan: null, usage: null,
  loadPlans: async () => { const r = await apiClient.get('/subscription/plans'); set({ plans: r.data.data }); },
  loadCurrent: async () => { const r = await apiClient.get('/subscription/current'); set({ currentPlan: r.data.data?.tier }); },
  loadUsage: async () => { const r = await apiClient.get('/subscription/usage'); set({ usage: r.data.data }); },
  subscribe: async (tier) => { await apiClient.post('/subscription/subscribe', { tier }); get().loadCurrent(); },
}));
