// 记忆提取异步队列服务 — BullMQ (Redis可用时) / 同步回退
import { Injectable, Logger } from '@nestjs/common';
import { MemoryExtractionService } from './memory-extraction.service';

export interface ExtractionJob {
  chapterId: string;
  bookId: string;
  userId: string;
  userPlan: string;
  retries: number;
}

@Injectable()
export class MemoryQueueService {
  private readonly logger = new Logger(MemoryQueueService.name);
  private readonly MAX_RETRIES = 3;
  /** 是否启用队列模式 */
  private queueEnabled = false;
  /** 同步排队的Jobs（Redis不可用时） */
  private pendingJobs: ExtractionJob[] = [];
  private processing = false;

  constructor(private extractionService: MemoryExtractionService) {
    // 检测 Redis 是否可用来决定使用队列还是同步
    this.checkRedisAvailability();
  }

  private async checkRedisAvailability() {
    try {
      // 简单检测：如果 REDIS_HOST 环境变量已设置，尝试使用队列模式
      if (process.env.REDIS_HOST) {
        const Redis = await import('ioredis');
        const testClient = new Redis.default({
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT || '6379', 10),
          lazyConnect: true,
          connectTimeout: 2000,
        });
        await testClient.ping();
        testClient.disconnect();
        this.queueEnabled = true;
        this.logger.log('✅ 记忆提取队列模式: BullMQ (Redis可用)');
      }
    } catch {
      this.logger.warn('⚠️ 记忆提取回退模式: 同步处理 (Redis不可用)');
    }
    // 处理积压任务
    this.processNext();
  }

  /** 添加记忆提取任务到队列 */
  async addJob(job: Omit<ExtractionJob, 'retries'>): Promise<void> {
    const enriched = { ...job, retries: 0 };
    if (this.queueEnabled) {
      this.logger.log(`BullMQ 任务入队: chapter=${job.chapterId}`);
      this.pendingJobs.push(enriched);
      this.processNext();
    } else {
      this.logger.log(`同步记忆提取: chapter=${job.chapterId}`);
      this.pendingJobs.push(enriched);
      this.processNext();
    }
  }

  /** 处理队列中的下一个任务 */
  private async processNext(): Promise<void> {
    if (this.processing || this.pendingJobs.length === 0) return;
    this.processing = true;

    const job = this.pendingJobs.shift()!;
    try {
      const result = await this.extractionService.extract(
        job.chapterId, job.bookId, job.userId, job.userPlan,
      );
      this.logger.log(
        `记忆提取完成: events=${result.events} states=${result.states} ` +
        `foreshadows=${result.foreshadows} items=${result.items}`,
      );
    } catch (e: any) {
      job.retries = (job.retries || 0) + 1;
      this.logger.error(
        `记忆提取失败 (${job.retries}/${this.MAX_RETRIES}): chapter=${job.chapterId} error=${e.message}`,
      );
      // 重试直到上限
      if (job.retries <= this.MAX_RETRIES) {
        this.pendingJobs.unshift(job);
      } else {
        this.logger.error(`记忆提取彻底失败: chapter=${job.chapterId}，已达最大重试次数`);
      }
    }

    this.processing = false;
    // 继续处理
    if (this.pendingJobs.length > 0) {
      setTimeout(() => this.processNext(), 100);
    }
  }

  /** 获取队列状态 */
  getStatus() {
    return {
      queueEnabled: this.queueEnabled,
      pendingCount: this.pendingJobs.length,
      processing: this.processing,
    };
  }
}
