// 版本管理服务
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChapterVersion } from './entities/chapter-version.entity';
import { Chapter } from '../project/entities/chapter.entity';
import { Volume } from '../project/entities/volume.entity';
import { Book } from '../project/entities/book.entity';
import { SUBSCRIPTION_PLANS } from '@novel/shared';

@Injectable()
export class VersionService {
  constructor(
    @InjectRepository(ChapterVersion) private vRepo: Repository<ChapterVersion>,
    @InjectRepository(Chapter) private chRepo: Repository<Chapter>,
    @InjectRepository(Volume) private volRepo: Repository<Volume>,
    @InjectRepository(Book) private bookRepo: Repository<Book>,
  ) {}

  /** 验证章节所有权 */
  private async checkChapterOwnership(chapterId: string, userId: string): Promise<{ chapter: Chapter; bookId: string }> {
    const chapter = await this.chRepo.findOne({ where: { id: chapterId } });
    if (!chapter) throw new NotFoundException('章节不存在');
    const volume = await this.volRepo.findOne({ where: { id: chapter.volumeId } });
    if (!volume) throw new NotFoundException('卷不存在');
    const book = await this.bookRepo.findOne({ where: { id: volume.bookId } });
    if (!book || book.userId !== userId) throw new ForbiddenException('无权访问');
    return { chapter, bookId: book.id };
  }

  /** 创建快照 */
  async createSnapshot(chapterId: string, userId: string, plan: string, source: string = 'manual_save', label?: string) {
    const { chapter, bookId } = await this.checkChapterOwnership(chapterId, userId);

    const last = await this.vRepo.findOne({
      where: { chapterId },
      order: { versionNumber: 'DESC' },
    });
    const versionNumber = (last?.versionNumber || 0) + 1;

    const version = this.vRepo.create({
      chapterId,
      bookId, // 正确的 bookId（来自 volume.book_id）
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
    await this.enforceRetention(chapterId, plan);
    return saved;
  }

  /** 获取版本历史 */
  async getHistory(chapterId: string, userId: string, page = 1, limit = 20, source?: string) {
    await this.checkChapterOwnership(chapterId, userId);

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
  async getVersion(versionId: string, userId: string) {
    const v = await this.vRepo.findOne({ where: { id: versionId } });
    if (!v) throw new NotFoundException('版本不存在');
    await this.checkChapterOwnership(v.chapterId, userId);
    return v;
  }

  /** 回退到指定版本 */
  async revert(versionId: string, userId: string, plan: string) {
    const v = await this.vRepo.findOne({ where: { id: versionId } });
    if (!v) throw new NotFoundException('版本不存在');
    await this.checkChapterOwnership(v.chapterId, userId);

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
    if (limit < 0) return;

    const count = await this.vRepo.count({ where: { chapterId } });
    if (count > limit) {
      const toDelete = await this.vRepo.find({
        where: { chapterId },
        order: { versionNumber: 'ASC' },
        skip: 1,
        take: count - limit,
      });
      if (toDelete.length > 0) await this.vRepo.remove(toDelete);
    }
  }
}
