// 套餐权限守卫 — 检查功能开关 + 字数限制 + Token余额
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SUBSCRIPTION_PLANS } from '@novel/shared';

export const REQUIRED_FEATURE_KEY = 'requiredFeature';
export const RequiredFeature = (feature: string) => {
  return (target: any, key?: string, descriptor?: any) => {
    Reflect.defineMetadata(REQUIRED_FEATURE_KEY, feature, descriptor?.value || target);
  };
};

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return true; // @Public 路由没有 user

    const plan = SUBSCRIPTION_PLANS[user.plan] || SUBSCRIPTION_PLANS.free;

    // 检查特定功能权限(从装饰器获取)
    const requiredFeature = this.reflector.get<string>(REQUIRED_FEATURE_KEY, context.getHandler());
    if (requiredFeature) {
      const hasFeature = this.checkFeature(plan, requiredFeature);
      if (!hasFeature) {
        throw new ForbiddenException(`当前套餐不支持此功能: ${requiredFeature}`);
      }
    }

    return true;
  }

  private checkFeature(plan: any, feature: string): boolean {
    switch (feature) {
      case 'offline_mode': return plan.offlineMode;
      case 'ai_dehumanize': return plan.aiDehumanizeReview;
      case 'pro_model': return plan.modelType === 'PRO';
      default: return true;
    }
  }
}
