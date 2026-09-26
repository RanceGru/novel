// Agent 基类 — 统一接口
import { Logger } from '@nestjs/common';
import { ModelRouterService } from '../model-router.service';
import { SUBSCRIPTION_PLANS } from '@novel/shared';

export interface AgentResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  metadata: {
    agentName: string;
    modelUsed: string;
    tokensUsed: number;
    durationMs: number;
  };
}

/** 记忆上下文（由记忆管家组装） */
export interface MemoryContext {
  recentSummary?: string;
  activeForeshadows?: string;
  characterStates?: string;
  relevantMemories?: string;
}

export abstract class BaseAgent {
  protected readonly logger: Logger;
  abstract readonly name: string;
  abstract readonly description: string;

  /** 需要的最低套餐 */
  abstract readonly requiredTier: string;

  constructor(protected modelRouter: ModelRouterService) {
    this.logger = new Logger(this.constructor.name);
  }

  /** 检查套餐权限 */
  canExecute(userPlan: string): boolean {
    const planTiers = ['free', 'lite', 'basic', 'plus', 'pro'];
    const requiredIndex = planTiers.indexOf(this.requiredTier);
    const userIndex = planTiers.indexOf(userPlan);
    return userIndex >= requiredIndex;
  }

  /** 执行 Agent 任务 */
  async execute<T = any>(userPlan: string, input: any, memoryContext?: MemoryContext): Promise<AgentResult<T>> {
    const startTime = Date.now();

    if (!this.canExecute(userPlan)) {
      return {
        success: false,
        error: `当前套餐不支持 ${this.name}，需要 ${this.requiredTier} 及以上套餐`,
        metadata: { agentName: this.name, modelUsed: '', tokensUsed: 0, durationMs: Date.now() - startTime },
      };
    }

    try {
      const route = this.modelRouter.routeByTier(userPlan);
      const prompt = this.buildPrompt(input, memoryContext);
      const result = await this.callLLM(route.apiKey, route.baseUrl, route.model, prompt);
      const parsed = this.parseResult(result.content);
      return {
        success: true, data: parsed,
        metadata: { agentName: this.name, modelUsed: route.model, tokensUsed: result.tokens, durationMs: Date.now() - startTime },
      };
    } catch (error: any) {
      this.logger.error(`${this.name} 执行失败: ${error.message}`);
      return {
        success: false, error: error.message,
        metadata: { agentName: this.name, modelUsed: '', tokensUsed: 0, durationMs: Date.now() - startTime },
      };
    }
  }

  /** 子类实现：构建 Prompt */
  abstract buildPrompt(input: any, memoryContext?: MemoryContext): { system: string; user: string };

  /** 子类实现：解析结果 */
  abstract parseResult(content: string): any;

  /** 通用 LLM 调用 */
  protected async callLLM(apiKey: string, baseUrl: string, model: string, prompt: { system: string; user: string }) {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) throw new Error(`LLM 调用失败: ${response.status}`);
    const data = await response.json() as any;
    return {
      content: data.choices?.[0]?.message?.content || '',
      tokens: (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0),
    };
  }

  /** 从 LLM 回复中提取 JSON */
  protected extractJSON(text: string): any {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    const arrayMatch = text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try { return JSON.parse(arrayMatch[0]); } catch {}
    }
    return null;
  }
}
