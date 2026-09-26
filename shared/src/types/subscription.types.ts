// 订阅套餐类型

/** 订阅等级 */
export type SubscriptionTier = 'free' | 'lite' | 'basic' | 'plus' | 'pro';

/** 订阅状态 */
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'paused';

/** 订阅信息 */
export interface Subscription {
  id: string;
  userId: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string | null;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 套餐摘要（展示用） */
export interface PlanSummary {
  tier: SubscriptionTier;
  name: string;
  monthlyPrice: number;
  features: string[];
  isCurrent: boolean;
}

/** 月度使用统计 */
export interface MonthlyUsage {
  id: string;
  userId: string;
  yearMonth: string; // YYYY-MM
  quotaTokensUsed: number;
  purchasedTokensUsed: number;
  totalWordsGenerated: number;
}

/** 使用统计响应 */
export interface UsageStats {
  currentPlan: SubscriptionTier;
  currentPlanName: string;
  wordCountUsed: number;
  wordCountLimit: number;
  wordCountPercent: number;
  monthlyTokensUsed: number;
  monthlyTokenQuota: number;
  monthlyTokensPercent: number;
  purchasedTokensRemaining: number;
  activeParallelSlots: number;
  totalParallelSlots: number;
}

/** 支付记录 */
export interface Payment {
  id: string;
  userId: string;
  paymentType: 'subscription' | 'token_purchase';
  amount: number; // 分
  currency: string;
  provider: string;
  status: 'pending' | 'paid' | 'failed' | 'refunded';
  paidAt: string | null;
  createdAt: string;
}
