// AI 生成服务
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ModelRouterService } from './model-router.service';
import { PromptTemplateService } from './prompt-template.service';
import { Chapter } from '../project/entities/chapter.entity';
import { Book } from '../project/entities/book.entity';
import { Volume } from '../project/entities/volume.entity';
import { TokenTransaction } from '../token/entities/token-transaction.entity';
import { BookService } from '../project/book.service';
import { MemoryService } from '../memory/memory.service';
import { MemoryExtractionService } from '../memory/memory-extraction.service';
import { ContextCompressorService } from './context-compressor.service';
import { SUBSCRIPTION_PLANS } from '@novel/shared';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(Chapter) private chapterRepository: Repository<Chapter>,
    @InjectRepository(Volume) private volumeRepository: Repository<Volume>,
    @InjectRepository(Book) private bookRepository: Repository<Book>,
    @InjectRepository(TokenTransaction) private tokenTransactionRepository: Repository<TokenTransaction>,
    private modelRouter: ModelRouterService,
    private promptTemplate: PromptTemplateService,
    private bookService: BookService,
    private memoryService: MemoryService,
    private memoryExtraction: MemoryExtractionService,
    private contextCompressor: ContextCompressorService,
  ) {}

  /** 为生成组装完整上下文（含记忆 + 自动压缩） */
  async assembleContext(bookId: string, chapterId: string, userPlan: string) {
    const planTier = SUBSCRIPTION_PLANS[userPlan]?.tier || 'free';
    // Basic+ 套餐启用记忆上下文
    if (['basic', 'plus', 'pro'].includes(planTier)) {
      try {
        const ctx = await this.memoryService.assembleContext(bookId, chapterId);
        if (!ctx) return null;

        // 自动压缩过长的上下文
        const totalChars = (ctx.recentSummary?.length || 0) +
          (ctx.activeForeshadows?.length || 0) +
          (ctx.characterStates?.length || 0) +
          (ctx.relevantMemories?.length || 0);

        if (totalChars > 3000) { // 超过 ~2000 tokens 时触发压缩
          const compressed = await this.contextCompressor.compress(ctx);
          return {
            recentSummary: compressed.recentSummary,
            activeForeshadows: compressed.activeForeshadows,
            characterStates: compressed.characterStates,
            relevantMemories: compressed.relevantMemories,
          };
        }

        return ctx;
      } catch (e: any) {
        this.logger.warn('记忆上下文组装失败: ' + e.message);
      }
    }
    return null;
  }

  /** 章节生成完成后触发记忆提取 */
  async afterGenerate(chapterId: string, bookId: string, userId: string, userPlan: string) {
    try {
      await this.memoryExtraction.extract(chapterId, bookId, userId, userPlan);
    } catch (e: any) {
      this.logger.warn('记忆提取失败: ' + e.message);
    }
  }

  /** 生成章节正文 */
  async generateContent(userId: string, plan: string, params: {
    bookId: string; chapterId: string; chapterOutline: string; instruction: string; targetWordCount: number;
  }) {
    const chapter = await this.chapterRepository.findOne({ where: { id: params.chapterId } });
    if (!chapter) throw new Error('章节不存在');
    const book = await this.bookRepository.findOne({ where: { id: params.bookId } });
    if (!book || book.userId !== userId) throw new Error('无权访问');

    // 获取记忆上下文
    let contextSummary = '';
    try {
      const ctx = await this.memoryService.assembleContext(params.bookId, params.chapterId);
      if (ctx) {
        contextSummary = [
          ctx.recentSummary ? `## 前文摘要\n${ctx.recentSummary}` : '',
          ctx.activeForeshadows ? `## 活跃伏笔\n${ctx.activeForeshadows}` : '',
          ctx.characterStates ? `## 角色状态\n${ctx.characterStates}` : '',
          ctx.relevantMemories ? `## 相关记忆\n${ctx.relevantMemories}` : '',
        ].filter(Boolean).join('\n\n');
      }
    } catch {}

    const { systemPrompt, userMessage } = this.promptTemplate.buildChapterGenerationPrompt({
      chapterOutline: params.chapterOutline,
      instruction: params.instruction,
      targetWordCount: params.targetWordCount,
      contextSummary,
    });

    const route = this.modelRouter.routeByTier(plan);
    const response = await this.callAiApi(route, systemPrompt, userMessage);

    chapter.content = response.content;
    chapter.wordCount = response.content.length;
    await this.chapterRepository.save(chapter);
    await this.bookService.updateWordCount(params.bookId);

    await this.tokenTransactionRepository.save(this.tokenTransactionRepository.create({
      userId, bookId: params.bookId, chapterId: params.chapterId,
      transactionType: 'generation',
      tokensConsumed: (response.promptTokens || 0) + (response.completionTokens || 0),
      source: 'quota',
    }));

    return {
      requestId: uuidv4(),
      metadata: { modelUsed: route.model, promptTokens: response.promptTokens, completionTokens: response.completionTokens, totalTokens: (response.promptTokens||0)+(response.completionTokens||0), wordCount: response.content.length },
      usage: { tokensConsumedThisRequest: (response.promptTokens||0)+(response.completionTokens||0), quotaTokensRemaining: 0, purchasedTokensRemaining: 0 },
    };
  }

  /** 调用 AI API (非流式) */
  async callAiApi(
    route: { provider: string; model: string; apiKey: string; baseUrl: string },
    systemPrompt: string,
    userMessage: string,
  ): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
    const url = `${route.baseUrl}/v1/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${route.apiKey}`,
      },
      body: JSON.stringify({
        model: route.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`AI API 错误: ${response.status} ${errorBody}`);
      throw new Error(`AI 服务返回错误: ${response.status}`);
    }

    const data = await response.json() as any;
    return {
      content: data.choices?.[0]?.message?.content || '',
      promptTokens: data.usage?.prompt_tokens || 0,
      completionTokens: data.usage?.completion_tokens || 0,
    };
  }

  /** 创建 AI API 流式请求 */
  async createStreamRequest(
    route: { provider: string; model: string; apiKey: string; baseUrl: string },
    systemPrompt: string,
    userMessage: string,
  ): Promise<Response> {
    const url = `${route.baseUrl}/v1/chat/completions`;

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${route.apiKey}`,
      },
      body: JSON.stringify({
        model: route.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 4096,
        stream: true,
      }),
    });
  }
}
