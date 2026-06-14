// Token 系统类型

/** Token 套餐 */
export interface TokenPackage {
  id: string;
  name: string;
  tokenAmount: number;
  price: number; // 分
  discountLabel: string | null;
  isActive: boolean;
  sortOrder: number;
}

/** Token 余额 */
export interface TokenBalance {
  purchasedTokensRemaining: number;
  lifetimePurchasedTokens: number;
  lifetimeConsumedTokens: number;
}

/** Token 交易记录 */
export interface TokenTransaction {
  id: string;
  userId: string;
  bookId: string | null;
  chapterId: string | null;
  transactionType: TokenTransactionType;
  tokensConsumed: number;
  source: TokenSource;
  createdAt: string;
}

/** Token 交易类型 */
export type TokenTransactionType =
  | 'generation'
  | 'review'
  | 'style_analysis'
  | 'memory_extraction';

/** Token 来源 */
export type TokenSource = 'quota' | 'purchased';

/** Token 购买请求 */
export interface PurchaseTokensRequest {
  packageId: string;
}

/** Token 购买响应 */
export interface PurchaseTokensResponse {
  purchaseId: string;
  paymentUrl: string;
  amount: number;
  tokenAmount: number;
}

/** Token 使用预估 */
export interface TokenEstimate {
  baseTokens: number;
  contextTokens: number;
  estimatedTotalTokens: number;
  estimatedWords: number;
  availableQuotaTokens: number;
  availablePurchasedTokens: number;
  isEnough: boolean;
}
