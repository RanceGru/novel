// 章节服务
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from './entities/chapter.entity';
import { Volume } from './entities/volume.entity';
import { BookService } from './book.service';

@Injectable()
export class ChapterService {
  constructor(
    @InjectRepository(Chapter)
    private chapterRepository: Repository<Chapter>,
    @InjectRepository(Volume)
    private volumeRepository: Repository<Volume>,
    private bookService: BookService,
  ) {}

  async listByVolume(volumeId: string, userId: string): Promise<Chapter[]> {
    const volume = await this.volumeRepository.findOne({ where: { id: volumeId } });
    if (!volume) throw new NotFoundException('卷不存在');
    // 权限检查
    await this.bookService.findById(volume.bookId);
    return this.chapterRepository.find({
      where: { volumeId },
      order: { chapterNumber: 'ASC' },
      select: ['id', 'volumeId', 'title', 'chapterNumber', 'wordCount', 'status', 'updatedAt'],
    });
  }

  async findById(id: string): Promise<Chapter> {
    const chapter = await this.chapterRepository.findOne({ where: { id } });
    if (!chapter) {
      throw new NotFoundException('章节不存在');
    }
    return chapter;
  }

  async create(volumeId: string, userId: string, data: { title: string; chapterNumber: number; chapterOutline?: string; instruction?: string; content?: string }): Promise<Chapter> {
    const volume = await this.volumeRepository.findOne({ where: { id: volumeId } });
    if (!volume) throw new NotFoundException('卷不存在');
    const book = await this.bookService.findById(volume.bookId);
    if (book.userId !== userId) throw new ForbiddenException('无权操作');

    const chapter = this.chapterRepository.create({
      volumeId,
      title: data.title,
      chapterNumber: data.chapterNumber,
      chapterOutline: data.chapterOutline || null,
      instruction: data.instruction || null,
      content: data.content || null,
      wordCount: data.content ? data.content.length : 0,
    });
    const saved = await this.chapterRepository.save(chapter);
    await this.bookService.updateWordCount(volume.bookId);
    return saved;
  }

  async update(id: string, userId: string, data: { title?: string; chapterOutline?: string; instruction?: string; content?: string; summary?: string; status?: string }): Promise<Chapter> {
    const chapter = await this.findById(id);
    const volume = await this.volumeRepository.findOne({ where: { id: chapter.volumeId } });
    if (!volume) throw new NotFoundException('卷不存在');
    const book = await this.bookService.findById(volume.bookId);
    if (book.userId !== userId) throw new ForbiddenException('无权操作');

    if (data.content !== undefined) {
      chapter.wordCount = data.content ? data.content.length : 0;
    }
    Object.assign(chapter, data);
    const saved = await this.chapterRepository.save(chapter);
    await this.bookService.updateWordCount(volume.bookId);
    return saved;
  }

  async delete(id: string, userId: string): Promise<void> {
    const chapter = await this.findById(id);
    const volume = await this.volumeRepository.findOne({ where: { id: chapter.volumeId } });
    if (!volume) throw new NotFoundException('卷不存在');
    const book = await this.bookService.findById(volume.bookId);
    if (book.userId !== userId) throw new ForbiddenException('无权操作');

    await this.chapterRepository.remove(chapter);
    await this.bookService.updateWordCount(volume.bookId);
  }
}
