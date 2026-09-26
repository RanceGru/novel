// 书籍服务
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './entities/book.entity';
import { Volume } from './entities/volume.entity';
import { Chapter } from './entities/chapter.entity';
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

    // 级联删除：先删章节
    const volumes = await this.volumeRepository.find({ where: { bookId: id } });
    for (const vol of volumes) {
      await this.chapterRepository.delete({ volumeId: vol.id });
    }
    // 再删分卷
    await this.volumeRepository.delete({ bookId: id });
    // 最后删书籍
    await this.bookRepository.remove(book);
  }

  /** 更新书籍字数统计 */
  async updateWordCount(bookId: string): Promise<void> {
    const result = await this.bookRepository.manager.query(
      `SELECT COALESCE(SUM(c.word_count), 0) as total
       FROM chapters c
       JOIN volumes v ON v.id = c.volume_id
       WHERE v.book_id = ?`,
      [bookId],
    );
    await this.bookRepository.update(bookId, {
      wordCount: parseInt(result[0]?.total || '0', 10),
    });
  }
}
