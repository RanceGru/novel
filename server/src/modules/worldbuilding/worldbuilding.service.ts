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
 * 默认自带的条目（顺序即展示顺序）。
 * category 沿用原分类键，便于后续按类型取用；title 就是界面上显示的名称。
 */
const DEFAULT_SETTINGS: Array<{ category: string; title: string }> = [
  { category: 'era', title: '时代信息' },
  { category: 'society', title: '社会背景' },
  { category: 'power_system', title: '力量体系' },
  { category: 'politics', title: '政治体系' },
  { category: 'economy', title: '经济体系' },
  { category: 'culture', title: '文化体系' },
  { category: 'geography', title: '地理位置' },
  { category: 'other', title: '其他补充' },
];

/** 新增条目的默认分类与命名 */
const NEW_SETTING_CATEGORY = 'other';
const NEW_SETTING_TITLE = '其他补充';

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
   * 新建条目。标题留空时用默认名「其他补充」；
   * sortOrder 取当前最大值 +1，保证排在默认条目之后。
   */
  async create(bookId: string, userId: string, data: { category?: string; title?: string; content?: string }) {
    await this.checkBook(bookId, userId);
    const max = await this.wsRepo
      .createQueryBuilder('w')
      .select('MAX(w.sort_order)', 'max')
      .where('w.book_id = :bookId', { bookId })
      .getRawOne<{ max: number | null }>();
    const ws = this.wsRepo.create({
      bookId,
      category: data.category || NEW_SETTING_CATEGORY,
      title: (data.title ?? '').trim() || NEW_SETTING_TITLE,
      content: data.content ?? null,
      sortOrder: (max?.max ?? 0) + 1,
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
