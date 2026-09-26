// 世界观服务 — 分类管理
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorldSetting } from './entities/world-setting.entity';
import { Book } from '../project/entities/book.entity';
import { omitUndefined } from '../../common/utils/object.utils';

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

  async list(bookId: string, userId: string, category?: string) {
    await this.checkBook(bookId, userId);
    const where: any = { bookId };
    if (category) where.category = category;
    return this.wsRepo.find({ where, order: { category: 'ASC', title: 'ASC' } });
  }

  async create(bookId: string, userId: string, data: { category: string; title: string; content?: string }) {
    await this.checkBook(bookId, userId);
    const ws = this.wsRepo.create({ ...data, bookId });
    return this.wsRepo.save(ws);
  }

  async update(id: string, userId: string, data: { category?: string; title?: string; content?: string }) {
    const ws = await this.wsRepo.findOne({ where: { id } });
    if (!ws) throw new NotFoundException('世界观设定不存在');
    await this.checkBook(ws.bookId, userId);
    if (data.content !== undefined) ws.contentVersion += 1;
    Object.assign(ws, omitUndefined(data));
    return this.wsRepo.save(ws);
  }

  async delete(id: string, userId: string) {
    const ws = await this.wsRepo.findOne({ where: { id } });
    if (!ws) throw new NotFoundException('世界观设定不存在');
    await this.checkBook(ws.bookId, userId);
    await this.wsRepo.remove(ws);
  }
}
