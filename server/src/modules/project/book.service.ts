// 书籍服务
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './entities/book.entity';
import { Volume } from './entities/volume.entity';
import { Chapter } from './entities/chapter.entity';
import { BookCleanupService } from './book-cleanup.service';
import { ph } from '../../common/utils/sql-params.util';
import { omitUndefined } from '../../common/utils/object.utils';

@Injectable()
export class BookService {
  constructor(
    @InjectRepository(Book)
    private bookRepository: Repository<Book>,
    @InjectRepository(Volume)
    private volumeRepository: Repository<Volume>,
    @InjectRepository(Chapter)
    private chapterRepository: Repository<Chapter>,
    private bookCleanup: BookCleanupService,
  ) {}

  async listByUser(userId: string): Promise<Book[]> {
    return this.bookRepository.find({
      where: { userId },
      order: { updatedAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<Book> {
    const book = await this.bookRepository.findOne({ where: { id } });
    if (!book) throw new NotFoundException('书籍不存在');
    return book;
  }

  async create(userId: string, data: { title: string; subtitle?: string; author?: string; description?: string; coverUrl?: string }): Promise<Book> {
    const book = this.bookRepository.create({
      userId, title: data.title, subtitle: data.subtitle || null,
      author: data.author || null, description: data.description || null,
      coverUrl: data.coverUrl || null,
    });
    return this.bookRepository.save(book);
  }

  async update(id: string, userId: string, data: { title?: string; subtitle?: string; author?: string; description?: string; status?: string; coverUrl?: string }): Promise<Book> {
    const book = await this.findById(id);
    if (book.userId !== userId) throw new ForbiddenException('无权操作此书籍');
    Object.assign(book, omitUndefined(data));
    return this.bookRepository.save(book);
  }

  async delete(id: string, userId: string): Promise<void> {
    const book = await this.findById(id);
    if (book.userId !== userId) throw new ForbiddenException('无权操作此书籍');

    // 级联清理：作品是几乎所有业务表的根，且多数外键没有数据库级 ON DELETE CASCADE，
    // 因此统一交给 BookCleanupService 在事务里按依赖顺序清理（含 books 行本身）。
    await this.bookCleanup.deleteBookCascade(id);
  }

  /** 更新书籍字数统计 */
  async updateWordCount(bookId: string): Promise<void> {
    // 注意：占位符必须按驱动生成。
    // 原先写的是字面量 ?，PostgreSQL 下无法绑定参数、SQLite 下则永远是 0；
    // 现在用 ph() 统一处理（PG 用 $1，SQLite 用 ?）。
    const result = await this.bookRepository.manager.query(
      `SELECT COALESCE(SUM(c.word_count), 0) as total
       FROM chapters c
       JOIN volumes v ON v.id = c.volume_id
       WHERE v.book_id = ${ph(this.bookRepository.manager, 1)}`,
      [bookId],
    );
    await this.bookRepository.update(bookId, {
      wordCount: parseInt(result[0]?.total || '0', 10),
    });
  }
}
