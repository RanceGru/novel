// 订阅套餐限制常量
// 五级套餐：Free / Lite / Basic / Plus / Pro

import type { SubscriptionTier } from '../types/subscription.types';

/** 模型类型 */
export enum ModelType {
  FLASH = 'FLASH',
  PRO = 'PRO',
}

/** 套餐权益定义 */
export interface PlanFeatures {
  tier: SubscriptionTier;
  name: string;
  monthlyPrice: number; // CNY
  totalWordLimit: number;
  workStorageSlots: number;
  monthlyTokenQuota: number;
  modelType: ModelType;
  parallelSlots: number;
  offlineMode: boolean;
  aiDehumanizeReview: boolean;
  agentAccess: string[]; // 可用 Agent 列表
  customStyleLimit: number;
  versionHistoryLimit: number; // -1 = 无限制
  tokenPurchaseEnabled: boolean;
  apiAccess: boolean;
  supportLevel: 'community' | 'email' | 'priority';
}

/** 各套餐权益详情 */
export const SUBSCRIPTION_PLANS: Record<string, PlanFeatures> = {
  free: {
    tier: 'free' as SubscriptionTier,
    name: 'Free',
    monthlyPrice: 0,
    totalWordLimit: 200000,
    workStorageSlots: 1,
    monthlyTokenQuota: 200000,
    modelType: ModelType.FLASH,
    parallelSlots: 1,
    offlineMode: false,
    aiDehumanizeReview: false,
    agentAccess: [],
    customStyleLimit: 0,
    versionHistoryLimit: 3,
    tokenPurchaseEnabled: true,
    apiAccess: false,
    supportLevel: 'community',
  },
  lite: {
    tier: 'lite' as SubscriptionTier,
    name: 'Lite',
    monthlyPrice: 29,
    totalWordLimit: 500000,
    workStorageSlots: 3,
    monthlyTokenQuota: 500000,
    modelType: ModelType.FLASH,
    parallelSlots: 3,
    offlineMode: true,
    aiDehumanizeReview: false,
    agentAccess: ['architect'],
    customStyleLimit: 1,
    versionHistoryLimit: 10,
    tokenPurchaseEnabled: true,
    apiAccess: false,
    supportLevel: 'email',
  },
  basic: {
    tier: 'basic' as SubscriptionTier,
    name: 'Basic',
    monthlyPrice: 69,
    totalWordLimit: 1000000,
    workStorageSlots: 5,
    monthlyTokenQuota: 1000000,
    modelType: ModelType.PRO,
    parallelSlots: 5,
    offlineMode: true,
    aiDehumanizeReview: true,
    agentAccess: ['architect', 'character-designer', 'quality-inspector'],
    customStyleLimit: 2,
    versionHistoryLimit: 30,
    tokenPurchaseEnabled: true,
    apiAccess: false,
    supportLevel: 'email',
  },
  plus: {
    tier: 'plus' as SubscriptionTier,
    name: 'Plus',
    monthlyPrice: 129,
    totalWordLimit: 2000000,
    workStorageSlots: 7,
    monthlyTokenQuota: 2000000,
    modelType: ModelType.PRO,
    parallelSlots: 7,
    offlineMode: true,
    aiDehumanizeReview: true,
    agentAccess: ['architect', 'character-designer', 'quality-inspector', 'world-builder'],
    customStyleLimit: 3,
    versionHistoryLimit: 100,
    tokenPurchaseEnabled: true,
    apiAccess: false,
    supportLevel: 'priority',
  },
  pro: {
    tier: 'pro' as SubscriptionTier,
    name: 'Pro',
    monthlyPrice: 249,
    totalWordLimit: 5000000,
    workStorageSlots: 15,
    monthlyTokenQuota: 5000000,
    modelType: ModelType.PRO,
    parallelSlots: 9,
    offlineMode: true,
    aiDehumanizeReview: true,
    agentAccess: [
      'architect',
      'character-designer',
      'quality-inspector',
      'world-builder',
      'style-mimic',
    ],
    customStyleLimit: 5,
    versionHistoryLimit: -1, // 无限制
    tokenPurchaseEnabled: true,
    apiAccess: true,
    supportLevel: 'priority',
  },
};

/** 各套餐 RPM (每分钟请求数) 限制 */
export const TIER_RPM_LIMITS: Record<string, number> = {
  free: 30,
  lite: 60,
  basic: 120,
  plus: 300,
  pro: 600,
};

/** 各套餐 RPD (每天请求数) 限制 */
export const TIER_RPD_LIMITS: Record<string, number> = {
  free: 500,
  lite: 2000,
  basic: 5000,
  plus: 10000,
  pro: 20000,
};

/** Token 增量包定义 */
export const TOKEN_PACKAGES = [
  {
    id: 'token-small',
    name: '小额包',
    tokenAmount: 50000,
    price: 900, // 9 CNY (分)
    discountLabel: undefined,
    sortOrder: 1,
  },
  {
    id: 'token-standard',
    name: '标准包',
    tokenAmount: 200000,
    price: 2900, // 29 CNY (分)
    discountLabel: '热门',
    sortOrder: 2,
  },
  {
    id: 'token-large',
    name: '大额包',
    tokenAmount: 600000,
    price: 7900, // 79 CNY (分)
    discountLabel: '省12%',
    sortOrder: 3,
  },
  {
    id: 'token-extra-large',
    name: '超大包',
    tokenAmount: 2000000,
    price: 19900, // 199 CNY (分)
    discountLabel: '最划算',
    sortOrder: 4,
  },
] as const;

/** Token 消耗比例: 1 字正文 ≈ 1.5 Token */
export const TOKEN_PER_WORD_RATIO = 1.5;
