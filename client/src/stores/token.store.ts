// Token 状态
import { create } from 'zustand';
import { apiClient } from '../services/api.service';

interface TokenState {
  balance: { purchasedTokensRemaining: number } | null;
  packages: any[];
  loadBalance: () => Promise<void>;
  loadPackages: () => Promise<void>;
  purchase: (packageId: string) => Promise<void>;
}

export const useTokenStore = create<TokenState>((set, get) => ({
  balance: null, packages: [],
  loadBalance: async () => { const r = await apiClient.get('/tokens/balance'); set({ balance: r.data.data }); },
  loadPackages: async () => { const r = await apiClient.get('/tokens/packages'); set({ packages: r.data.data }); },
  purchase: async (packageId) => { await apiClient.post('/tokens/purchase', { packageId }); get().loadBalance(); },
}));
