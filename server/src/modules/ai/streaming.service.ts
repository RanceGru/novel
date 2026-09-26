// SSE 流式传输服务
import { Injectable, Logger } from '@nestjs/common';
import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export interface StreamMetadata {
  modelUsed: string;
  modelTier: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  generationDurationMs: number;
  wordCount: number;
  finishReason: string;
}

export interface StreamUsage {
  tokensConsumedThisRequest: number;
  quotaTokensRemaining: number;
  purchasedTokensRemaining: number;
  totalWordsGeneratedThisMonth: number;
}

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  /** 向客户端发送 SSE 事件 */
  sendEvent(res: Response, event: string, data: unknown) {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  /** 从 AI API 流式代理到客户端 */
  async proxyStream(
    res: Response,
    stream: AsyncIterable<any>,
    metadata: StreamMetadata,
    usage: StreamUsage,
    onComplete?: (fullText: string) => Promise<void>,
  ) {
    const requestId = uuidv4();
    const startTime = Date.now();
    const estimatedTotal = metadata.totalTokens || 500;
    let fullText = '';
    let tokenIndex = 0;

    // 发送开始事件
    this.sendEvent(res, 'start', {
      requestId,
      estimatedTokens: estimatedTotal,
    });

    try {
      for await (const chunk of stream) {
        const delta = this.extractDelta(chunk);
        if (delta) {
          fullText += delta;
          tokenIndex++;
          this.sendEvent(res, 'token', { text: delta, index: tokenIndex });

          // 每 50 个 token 发送一次进度
          if (tokenIndex % 50 === 0) {
            this.sendEvent(res, 'progress', {
              tokensGenerated: tokenIndex,
              estimatedProgress: Math.min(tokenIndex / Math.max(estimatedTotal, tokenIndex + 100), 0.99),
            });
          }
        }
      }

      // 计算最终数据
      const duration = Date.now() - startTime;
      metadata.generationDurationMs = duration;
      metadata.wordCount = fullText.length; // 简化为字数
      metadata.completionTokens = tokenIndex;
      metadata.totalTokens = (metadata.promptTokens || 0) + tokenIndex;

      // 完成后回调
      if (onComplete) {
        await onComplete(fullText);
      }

      // 发送完成事件
      this.sendEvent(res, 'complete', {
        requestId,
        fullText,
        metadata,
        usage,
        reviewTaskId: undefined, // Phase 4 实现
      });

      this.logger.log(`生成完成: ${requestId}, ${metadata.wordCount} 字, ${duration}ms`);
    } catch (error: any) {
      this.logger.error(`流式生成错误: ${error.message}`);
      this.sendEvent(res, 'error', {
        code: 'AI_GENERATION_FAILED',
        message: error.message || 'AI 生成失败',
        retryable: true,
        retryAfter: 5,
      });
    }
  }

  /** 从 API 响应 chunk 中提取文本增量 */
  private extractDelta(chunk: any): string {
    // DeepSeek / OpenAI 格式
    if (chunk.choices?.[0]?.delta?.content) {
      return chunk.choices[0].delta.content;
    }
    if (chunk.choices?.[0]?.text) {
      return chunk.choices[0].text;
    }
    // Anthropic 格式 (streaming text)
    if (chunk.delta?.text) {
      return chunk.delta.text;
    }
    if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
      return chunk.delta.text;
    }
    return '';
  }
}
