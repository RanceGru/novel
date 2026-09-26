// 订阅服务
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from './entities/subscription.entity';
import { TokenBalance } from '../token/entities/token-balance.entity';
import { TokenTransaction } from '../token/entities/token-transaction.entity';
import { SUBSCRIPTION_PLANS, PlanFeatures } from '@novel/shared';

@Injectable()
export class SubscriptionService {
  constructor(
    @InjectRepository(Subscription) private subRepo: Repository<Subscription>,
    @InjectRepository(TokenBalance) private tbRepo: Repository<TokenBalance>,
    @InjectRepository(TokenTransaction) private ttRepo: Repository<TokenTransaction>,
  ) {}

  /** 获取所有套餐定义 */
  getPlans() {
    return Object.values(SUBSCRIPTION_PLANS).map(p => ({
      tier: p.tier,
      name: p.name,
      monthlyPrice: p.monthlyPrice,
      totalWordLimit: p.totalWordLimit,
      workStorageSlots: p.workStorageSlots,
      monthlyTokenQuota: p.monthlyTokenQuota,
      modelType: p.modelType,
      parallelSlots: p.parallelSlots,
      offlineMode: p.offlineMode,
      aiDehumanizeReview: p.aiDehumanizeReview,
      agentAccess: p.agentAccess,
    }));
  }

  /** 获取当前用户的套餐 */
  async getCurrent(userId: string) {
    const sub = await this.subRepo.findOne({ where: { userId, status: 'active' } });
    if (!sub) {
      // 返回默认 Free
      return { tier: 'free', plan: SUBSCRIPTION_PLANS.free, subscription: null };
    }
    const plan = SUBSCRIPTION_PLANS[sub.tier] || SUBSCRIPTION_PLANS.free;
    return { tier: sub.tier, plan, subscription: sub };
  }

  /** 获取用户使用统计 */
  async getUsage(userId: string) {
    const sub = await this.subRepo.findOne({ where: { userId, status: 'active' } });
    const plan = SUBSCRIPTION_PLANS[sub?.tier || 'free'];
    const balance = await this.tbRepo.findOne({ where: { userId } });

    // 统计本月 Token 消费
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const txQuery = this.ttRepo
      .createQueryBuilder('tx')
      .select('SUM(tx.tokensConsumed)', 'total')
      .where('tx.userId = :userId', { userId })
      .andWhere('tx.createdAt >= :monthStart', { monthStart: monthStart.toISOString() });
    const result = await txQuery.getRawOne();

    return {
      currentPlan: plan.tier,
      currentPlanName: plan.name,
      wordCountLimit: plan.totalWordLimit,
      monthlyTokenQuota: plan.monthlyTokenQuota,
      monthlyTokensUsed: parseInt(result?.total || '0'),
      purchasedTokensRemaining: balance?.purchasedTokensRemaining || 0,
      parallelSlots: plan.parallelSlots,
      subscription: sub,
    };
  }

  /** 订阅/切换套餐 */
  async subscribe(userId: string, tier: string) {
    if (!SUBSCRIPTION_PLANS[tier]) throw new NotFoundException('套餐不存在');

    // 取消现有订阅
    await this.subRepo.update({ userId, status: 'active' }, { status: 'cancelled', autoRenew: false });

    // 创建新订阅
    const sub = this.subRepo.create({ userId, tier, status: 'active', startedAt: new Date(), autoRenew: true });
    return this.subRepo.save(sub);
  }

  /** 取消自动续费 */
  async cancel(userId: string) {
    await this.subRepo.update({ userId, status: 'active' }, { autoRenew: false });
    return { message: '已取消自动续费' };
  }
}
