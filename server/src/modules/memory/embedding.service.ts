// Embedding 服务 — 调用 OpenAI text-embedding-3-small
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.openai.com/v1';
  private readonly model = 'text-embedding-3-small';
  private readonly dimensions = 1536;
  private cache = new Map<string, number[]>();

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
  }

  /** 单文本嵌入 */
  async embed(text: string): Promise<number[]> {
    const key = text.substring(0, 200);
    if (this.cache.has(key)) return this.cache.get(key)!;

    const results = await this.embedBatch([text]);
    const result = results[0];
    this.cache.set(key, result);
    return result;
  }

  /** 批量嵌入（最多 20 条） */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      this.logger.warn('未设置 OPENAI_API_KEY，使用零向量');
      return texts.map(() => new Array(this.dimensions).fill(0));
    }

    // 限制每批最多20条
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += 20) {
      batches.push(texts.slice(i, i + 20));
    }

    const allEmbeddings: number[][] = [];

    for (const batch of batches) {
      try {
        const response = await fetch(`${this.baseUrl}/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            input: batch,
            dimensions: this.dimensions,
          }),
        });

        if (!response.ok) {
          throw new Error(`Embedding API error: ${response.status}`);
        }

        const data = await response.json() as any;
        const embeddings = data.data
          .sort((a: any, b: any) => a.index - b.index)
          .map((d: any) => d.embedding as number[]);
        allEmbeddings.push(...embeddings);
      } catch (error: any) {
        this.logger.error(`Embedding失败: ${error.message}`);
        // 失败时返回零向量
        batch.forEach(() => allEmbeddings.push(new Array(this.dimensions).fill(0)));
      }
    }

    return allEmbeddings;
  }
}
