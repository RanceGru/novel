// 模型路由器 — 简化版（按套餐选择模型）
import { Injectable, Logger } from '@nestjs/common';
import { aiConfig } from '../../config/ai.config';
import { ModelType } from '@novel/shared';

@Injectable()
export class ModelRouterService {
  private readonly logger = new Logger(ModelRouterService.name);
  private providers = aiConfig();

  /** 根据模型类型选择 Provider 和模型 */
  route(modelType: ModelType): { provider: string; model: string; apiKey: string; baseUrl: string } {
    if (this.providers.length === 0) {
      throw new Error('没有配置任何 AI Provider');
    }

    // 优先使用 DeepSeek，如果没有则用 OpenAI
    const primary = this.providers.find(p => p.name === 'deepseek') || this.providers[0];
    const model = modelType === ModelType.PRO ? primary.models.pro : primary.models.flash;

    this.logger.log(`路由: ${primary.name}/${model} (${modelType})`);

    return {
      provider: primary.name,
      model,
      apiKey: primary.apiKey,
      baseUrl: primary.baseUrl,
    };
  }

  /** 按套餐等级路由 */
  routeByTier(plan: string): { provider: string; model: string; apiKey: string; baseUrl: string } {
    // free 和 lite 用 Flash，其他用 Pro
    const modelType = plan === 'free' || plan === 'lite' ? ModelType.FLASH : ModelType.PRO;
    return this.route(modelType);
  }
}
