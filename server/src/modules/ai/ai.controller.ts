// AI 生成控制器 — SSE 流式端点
import { Controller, Post, Body, Res, Req, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AiService } from './ai.service';
import { StreamingService } from './streaming.service';
import { PromptTemplateService } from './prompt-template.service';
import { ModelRouterService } from './model-router.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from '../project/entities/chapter.entity';
import { Volume } from '../project/entities/volume.entity';
import { Book } from '../project/entities/book.entity';
import { TokenTransaction } from '../token/entities/token-transaction.entity';
import { BookService } from '../project/book.service';

@ApiTags('AI 生成')
@Controller('ai')
export class AiController {
  private readonly logger = new Logger(AiController.name);

  constructor(
    private readonly aiService: AiService,
    private readonly streamingService: StreamingService,
    private readonly promptTemplate: PromptTemplateService,
    private readonly modelRouter: ModelRouterService,
    @InjectRepository(Chapter)
    private chapterRepository: Repository<Chapter>,
    @InjectRepository(Volume)
    private volumeRepository: Repository<Volume>,
    @InjectRepository(Book)
    private bookRepository: Repository<Book>,
    @InjectRepository(TokenTransaction)
    private tokenTransactionRepository: Repository<TokenTransaction>,
    private bookService: BookService,
  ) {}

  @Post('generate-content')
  @ApiOperation({ summary: 'AI 生成章节正文 (SSE 流式)' })
  async generateContent(
    @CurrentUser() user: { id: string; plan: string },
    @Body() body: {
      bookId: string;
      chapterId: string;
      chapterOutline: string;
      instruction: string;
      targetWordCount: number;
    },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    // 设置 SSE 头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    try {
      // 验证权限
      const chapter = await this.chapterRepository.findOne({ where: { id: body.chapterId } });
      if (!chapter) {
        this.streamingService.sendEvent(res, 'error', { code: 'RES_NOT_FOUND', message: '章节不存在', retryable: false });
        res.end();
        return;
      }

      const volume = await this.volumeRepository.findOne({ where: { id: chapter.volumeId } });
      if (!volume) {
        this.streamingService.sendEvent(res, 'error', { code: 'RES_NOT_FOUND', message: '卷不存在', retryable: false });
        res.end();
        return;
      }

      const book = await this.bookRepository.findOne({ where: { id: body.bookId } });
      if (!book || book.userId !== user.id) {
        this.streamingService.sendEvent(res, 'error', { code: 'PERM_RESOURCE_NOT_OWNED', message: '无权访问', retryable: false });
        res.end();
        return;
      }

      // 构建 Prompt
      const { systemPrompt, userMessage } = this.promptTemplate.buildChapterGenerationPrompt({
        chapterOutline: body.chapterOutline,
        instruction: body.instruction,
        targetWordCount: body.targetWordCount,
      });

      // 路由
      const route = this.modelRouter.routeByTier(user.plan);

      // 创建流式请求
      const response = await this.aiService.createStreamRequest(route, systemPrompt, userMessage);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`AI API 错误: ${response.status} ${errorText}`);
        this.streamingService.sendEvent(res, 'error', {
          code: 'AI_PROVIDER_UNAVAILABLE',
          message: `AI 服务返回错误: ${response.status}`,
          retryable: true,
          retryAfter: 5,
        });
        res.end();
        return;
      }

      // 客户端断开时取消上游流
      let aborted = false;
      req.on('close', () => {
        aborted = true;
        reader?.cancel().catch(() => {});
        this.logger.warn('客户端断开，取消 AI 流式请求');
      });

      // 流式代理
      const reader = response.body?.getReader();
      if (!reader) {
        this.streamingService.sendEvent(res, 'error', { code: 'AI_GENERATION_FAILED', message: '无法读取流', retryable: true });
        res.end();
        return;
      }

      const TextDecoderClass = TextDecoder;
      const buffer = '';

      // 代理流式数据
      await this.streamingService.proxyStream(
        res,
        this.parseSSEStream(reader, TextDecoderClass, buffer),
        {
          modelUsed: route.model,
          modelTier: user.plan.includes('pro') || user.plan === 'basic' || user.plan === 'plus' ? 'pro' : 'flash',
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          generationDurationMs: 0,
          wordCount: 0,
          finishReason: 'stop',
        },
        {
          tokensConsumedThisRequest: 0,
          quotaTokensRemaining: 0,
          purchasedTokensRemaining: 0,
          totalWordsGeneratedThisMonth: 0,
        },
        async (fullText: string) => {
          // 保存生成结果
          chapter.content = fullText;
          chapter.wordCount = fullText.length;
          await this.chapterRepository.save(chapter);
          await this.bookService.updateWordCount(body.bookId);

          this.logger.log(`章节 ${body.chapterId} 内容已保存 (${fullText.length} 字)`);

          // 触发记忆提取（后台异步，不阻塞响应）
          this.aiService.afterGenerate(body.chapterId, body.bookId, user.id, user.plan).catch(e =>
            this.logger.warn('记忆提取失败(非阻塞): ' + e.message),
          );
        },
      );

      res.end();
    } catch (error: any) {
      this.logger.error(`生成异常: ${error.message}`);
      this.streamingService.sendEvent(res, 'error', {
        code: 'AI_GENERATION_FAILED',
        message: error.message || 'AI 生成异常',
        retryable: true,
      });
      res.end();
    }
  }

  /** 将 fetch ReadableStream 解析为异步迭代器 */
  private parseSSEStream(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    decoder: typeof TextDecoder,
    initialBuffer: string,
  ): AsyncIterable<any> {
    let buffer = initialBuffer;
    const self = this;

    return {
      [Symbol.asyncIterator]: async function* () {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const decoderInstance = new decoder();
            buffer += decoderInstance.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6).trim();
                if (data === '[DONE]') return;
                try {
                  yield JSON.parse(data);
                } catch {
                  // 忽略解析失败的行
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      },
    };
  }
}
