// 版本管理服务
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChapterVersion } from './entities/chapter-version.entity';
import { Chapter } from '../project/entities/chapter.entity';
import { SUBSCRIPTION_PLANS } from '@novel/shared';

@Injectable()
export class VersionService {
  constructor(
    @InjectRepository(ChapterVersion) private vRepo: Repository<ChapterVersion>,
    @InjectRepository(Chapter) private chRepo: Repository<Chapter>,
  ) {}

  /** 创建快照 */
  async createSnapshot(chapterId: string, userId: string, plan: string, source: string = 'manual_save', label?: string) {
    const chapter = await this.chRepo.findOne({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException('章节不存在');

    // 获取版本号
    const last = await this.vRepo.findOne({
      where: { chapterId },
      order: { versionNumber: 'DESC' },
    });
    const versionNumber = (last?.versionNumber || 0) + 1;
    const prevContent = last?.content || '';

    const version = this.vRepo.create({
      chapterId,
      bookId: chapter.volumeId, // denormalized
      userId,
      versionNumber,
      content: chapter.content || '',
      contentPreview: (chapter.content || '').substring(0, 200),
      wordCount: chapter.wordCount,
      wordDiff: chapter.wordCount - (last?.wordCount || 0),
      label: label || null,
      source,
    });

    const saved = await this.vRepo.save(version);

    // 执行保留策略
    await this.enforceRetention(chapterId, plan);

    return saved;
  }

  /** 获取版本历史 */
  async getHistory(chapterId: string, page = 1, limit = 20, source?: string) {
    const where: any = { chapterId };
    if (source) where.source = source;

    const [items, total] = await this.vRepo.findAndCount({
      where,
      order: { versionNumber: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  /** 获取版本内容 */
  async getVersion(versionId: string) {
    const v = await this.vRepo.findOne({ where: { id: versionId } });
    if (!v) throw new NotFoundException('版本不存在');
    return v;
  }

  /** 回退到指定版本 */
  async revert(versionId: string, userId: string, plan: string) {
    const v = await this.vRepo.findOne({ where: { id: versionId } });
    if (!v) throw new NotFoundException('版本不存在');

    // 回退前自动保存当前版本
    await this.createSnapshot(v.chapterId, userId, plan, 'revert', '回退前自动保存');

    // 恢复内容
    await this.chRepo.update(v.chapterId, {
      content: v.content,
      wordCount: v.wordCount,
    });

    return { message: `已回退到版本 ${v.versionNumber}` };
  }

  /** 保留策略 */
  private async enforceRetention(chapterId: string, plan: string) {
    const planConfig = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.free;
    const limit = planConfig.versionHistoryLimit;
    if (limit < 0) return; // Pro 无限制

    const count = await this.vRepo.count({ where: { chapterId } });
    if (count > limit) {
      // 删除最旧的（保留 v1 + 最新 N-1 个）
      const toDelete = await this.vRepo.find({
        where: { chapterId },
        order: { versionNumber: 'ASC' },
        skip: 1, // 保留 v1
        take: count - limit,
      });
      if (toDelete.length > 0) {
        await this.vRepo.remove(toDelete);
      }
    }
  }
}
