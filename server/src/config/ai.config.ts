// AI Provider 配置
export interface AiProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  models: {
    flash: string;
    pro: string;
  };
  rpm: number;
}

export function aiConfig(): AiProviderConfig[] {
  const providers: AiProviderConfig[] = [];

  // DeepSeek (主 Provider)
  if (process.env.DEEPSEEK_API_KEY) {
    providers.push({
      name: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: 'https://api.deepseek.com',
      models: {
        flash: process.env.DEEPSEEK_FLASH_MODEL || 'deepseek-chat',
        pro: process.env.DEEPSEEK_PRO_MODEL || 'deepseek-reasoner',
      },
      rpm: 600,
    });
  }

  // OpenAI (备用)
  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: 'https://api.openai.com/v1',
      models: {
        flash: 'gpt-4o-mini',
        pro: 'gpt-4o',
      },
      rpm: 500,
    });
  }

  return providers;
}

/** 默认模型 (第一个可用 Provider 的 Pro 模型) */
export function getDefaultModel(): string {
  const providers = aiConfig();
  if (providers.length === 0) return 'deepseek-chat';
  return providers[0].models.pro;
}

/** Token 成本估算 (每 1K Token 的 RMB 分) */
export const AI_COST_PER_1K = {
  flash: 1, // 0.01 RMB / 1K tokens
  pro: 4, // 0.04 RMB / 1K tokens
};
