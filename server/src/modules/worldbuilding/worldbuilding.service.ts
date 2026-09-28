// 世界观服务 — 条目管理
//
// 设计：世界观下的条目本身就是「可填写的一项」（如 力量体系、地理位置），
// 它们下面没有更深一层的子项。新作品首次读取时自动补齐这 8 个默认条目。
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorldSetting } from './entities/world-setting.entity';
import { Book } from '../project/entities/book.entity';
import { omitUndefined } from '../../common/utils/object.utils';

/**
 * 默认自带的固定条目（顺序即展示顺序）。
 *
 * 这些是「世界观的下级条目」，相当于分卷下的章节：
 * 界面上没有展开箭头、不可点击、也不需要输入框，只展示其内容。
 * 用户可以自己新增条目（默认命名「其他补充N」），那些才是可编辑的。
 */
const DEFAULT_SETTINGS: Array<{ category: string; title: string }> = [
  { category: 'era', title: '时代信息' },
  { category: 'society', title: '社会背景' },
  { category: 'power_system', title: '力量体系' },
  { category: 'politics', title: '政治体系' },
  { category: 'economy', title: '经济体系' },
  { category: 'culture', title: '文化体系' },
  { category: 'geography', title: '地理位置' },
];

/** 固定条目的分类键；其余分类都视为用户自建条目 */
export const FIXED_SETTING_CATEGORIES = DEFAULT_SETTINGS.map((d) => d.category);

/** 新增条目的默认分类与命名前缀（默认名形如「其他补充1」） */
const NEW_SETTING_CATEGORY = 'other';
const NEW_SETTING_TITLE_PREFIX = '其他补充';

@Injectable()
export class WorldbuildingService {
  constructor(
    @InjectRepository(WorldSetting) private wsRepo: Repository<WorldSetting>,
    @InjectRepository(Book) private bookRepo: Repository<Book>,
  ) {}

  private async checkBook(bookId: string, userId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('书籍不存在');
    if (book.userId !== userId) throw new ForbiddenException('无权操作');
  }

  /**
   * 补齐默认条目。只在该作品「一条都没有」时执行，
   * 这样用户主动删掉某个默认条目后不会在下次读取时又冒出来。
   */
  private async seedDefaults(bookId: string): Promise<void> {
    const count = await this.wsRepo.count({ where: { bookId } });
    if (count > 0) return;
    const rows = DEFAULT_SETTINGS.map((d, i) =>
      this.wsRepo.create({
        bookId,
        category: d.category,
        title: d.title,
        content: null,
        sortOrder: i + 1,
      }),
    );
    await this.wsRepo.save(rows);
  }

  async list(bookId: string, userId: string, category?: string) {
    await this.checkBook(bookId, userId);
    // 首次读取时带上默认条目（放在权限校验之后，避免给别人的作品建数据）
    await this.seedDefaults(bookId);
    const where: any = { bookId };
    if (category) where.category = category;
    return this.wsRepo.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * 新建条目。标题留空时用默认名「其他补充N」——N 取该作品下
   * 「其他补充N」形式标题的最大序号 +1，与章节编号的做法一致。
   * sortOrder 取当前最大值 +1，保证排在默认条目之后。
   */
  async create(bookId: string, userId: string, data: { category?: string; title?: string; content?: string }) {
    await this.checkBook(bookId, userId);
    const rows = await this.wsRepo.find({ where: { bookId }, select: ['title', 'sortOrder'] });
    const maxSort = rows.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0);

    const explicit = (data.title ?? '').trim();
    let title = explicit;
    if (!title) {
      let maxNo = 0;
      const re = new RegExp(`^${NEW_SETTING_TITLE_PREFIX}(\\d+)$`);
      for (const r of rows) {
        const m = re.exec((r.title || '').trim());
        if (m) maxNo = Math.max(maxNo, Number(m[1]));
      }
      title = `${NEW_SETTING_TITLE_PREFIX}${maxNo + 1}`;
    }

    const ws = this.wsRepo.create({
      bookId,
      category: data.category || NEW_SETTING_CATEGORY,
      title,
      content: data.content ?? null,
      sortOrder: maxSort + 1,
    });
    return this.wsRepo.save(ws);
  }

  async update(id: string, userId: string, data: { category?: string; title?: string; content?: string }) {
    const ws = await this.wsRepo.findOne({ where: { id } });
    if (!ws) throw new NotFoundException('世界观设定不存在');
    await this.checkBook(ws.bookId, userId);
    if (data.content !== undefined) ws.contentVersion += 1;
    // 标题不允许改成空白，否则界面上会出现一行没有名字的条目
    const patch: any = omitUndefined(data);
    if (typeof patch.title === 'string' && !patch.title.trim()) delete patch.title;
    Object.assign(ws, patch);
    return this.wsRepo.save(ws);
  }

  async delete(id: string, userId: string) {
    const ws = await this.wsRepo.findOne({ where: { id } });
    if (!ws) throw new NotFoundException('世界观设定不存在');
    await this.checkBook(ws.bookId, userId);
    await this.wsRepo.remove(ws);
  }
}
