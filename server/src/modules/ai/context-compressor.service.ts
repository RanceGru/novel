// 上下文压缩服务 — 控制 Prompt Token 长度
import { Injectable, Logger } from '@nestjs/common';

export interface CompressedContext {
  recentSummary: string;
  activeForeshadows: string;
  characterStates: string;
  relevantMemories: string;
  /** 压缩后的总 Token 估算 */
  estimatedTokens: number;
  /** 是否进行了压缩 */
  wasCompressed: boolean;
}

@Injectable()
export class ContextCompressorService {
  private readonly logger = new Logger(ContextCompressorService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.deepseek.com';

  /** Token 预算上限（可根据模型调整） */
  private readonly TOKEN_BUDGET = 2000;
  /** 中文：约 1.5 字符 = 1 Token */
  private readonly CHARS_PER_TOKEN = 1.5;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
  }

  /**
   * 压缩记忆上下文，确保在 Token 预算内
   * @param context 原始上下文（来自 MemoryService.assembleContext）
   * @returns 压缩后的上下文
   */
  async compress(context: {
    recentSummary: string;
    activeForeshadows: string;
    characterStates: string;
    relevantMemories: string;
  }): Promise<CompressedContext> {
    const totalChars =
      (context.recentSummary?.length || 0) +
      (context.activeForeshadows?.length || 0) +
      (context.characterStates?.length || 0) +
      (context.relevantMemories?.length || 0);

    const estimatedTokens = Math.ceil(totalChars / this.CHARS_PER_TOKEN);

    if (estimatedTokens <= this.TOKEN_BUDGET) {
      // 无需压缩
      return {
        ...context,
        estimatedTokens,
        wasCompressed: false,
      };
    }

    this.logger.log(`上下文过长 (${estimatedTokens} tokens)，开始压缩...`);

    // 压缩优先级：长期记忆 > 角色状态 > 伏笔 > 前文摘要
    // 前文摘要最重要，尽量保留原文
    const [compressedMemories, compressedStates, compressedForeshadows] = await Promise.all([
      this.compressSection(context.relevantMemories, '事件记忆', 200),
      this.compressSection(context.characterStates, '角色状态', 150),
      this.compressSection(context.activeForeshadows, '伏笔', 150),
    ]);

    // 前文摘要保留原文但截断
    const truncatedSummary = context.recentSummary.length > 500
      ? context.recentSummary.substring(0, 500) + '...(已截断)'
      : context.recentSummary;

    // 重新计算压缩后的 Token 估算
    const foreshadowsLen = ((compressedForeshadows || context.activeForeshadows)?.length) || 0;
    const statesLen = ((compressedStates || context.characterStates)?.length) || 0;
    const memoriesLen = ((compressedMemories || context.relevantMemories)?.length) || 0;

    const compressed = {
      recentSummary: truncatedSummary,
      activeForeshadows: compressedForeshadows || context.activeForeshadows,
      characterStates: compressedStates || context.characterStates,
      relevantMemories: compressedMemories || context.relevantMemories,
      estimatedTokens: Math.ceil(
        (truncatedSummary.length + foreshadowsLen + statesLen + memoriesLen) / this.CHARS_PER_TOKEN,
      ),
      wasCompressed: true,
    };

    this.logger.log(`压缩完成: ${estimatedTokens} → ${compressed.estimatedTokens} tokens`);
    return compressed;
  }

  /** 压缩单个上下文段 */
  private async compressSection(text: string, label: string, maxChars: number): Promise<string | null> {
    if (!text || text.length <= maxChars) return null;

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            { role: 'system', content: `你是文本压缩专家。将以下${label}信息压缩为简洁摘要，控制在${maxChars}字以内，保留关键信息。` },
            { role: 'user', content: text },
          ],
          temperature: 0.1,
          max_tokens: Math.ceil(maxChars / 2),
        }),
      });

      if (!response.ok) return null;

      const data = await response.json() as any;
      return data.choices?.[0]?.message?.content || null;
    } catch (e: any) {
      this.logger.warn(`${label}压缩失败: ${e.message}`);
      return null;
    }
  }

  /** 估算文本 Token 数 */
  estimateTokens(text: string): number {
    return Math.ceil((text?.length || 0) / this.CHARS_PER_TOKEN);
  }
}
