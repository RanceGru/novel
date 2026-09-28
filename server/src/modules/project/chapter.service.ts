// 章节服务
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Chapter } from './entities/chapter.entity';
import { Volume } from './entities/volume.entity';
import { BookService } from './book.service';
import { omitUndefined } from '../../common/utils/object.utils';
import { outlineHash } from '../outline/outline-hash.util';

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
      order: { chapterNumber: 'DESC' },
      select: ['id', 'volumeId', 'title', 'chapterNumber', 'wordCount', 'status', 'updatedAt'],
    });
  }

  async findById(id: string, userId?: string): Promise<Chapter> {
    const chapter = await this.chapterRepository.findOne({ where: { id } });
    if (!chapter) {
      throw new NotFoundException('章节不存在');
    }
    // 权限校验：如果提供了 userId，验证所有权
    if (userId) {
      const volume = await this.volumeRepository.findOne({ where: { id: chapter.volumeId } });
      if (volume) {
        const book = await this.bookService.findById(volume.bookId);
        if (book.userId !== userId) throw new ForbiddenException('无权访问');
      }
    }
    return chapter;
  }

  async create(volumeId: string, userId: string, data: { title: string; chapterNumber: number; chapterOutline?: string; instruction?: string; content?: string }): Promise<Chapter> {
    const volume = await this.volumeRepository.findOne({ where: { id: volumeId } });
    if (!volume) throw new NotFoundException('卷不存在');
    const book = await this.bookService.findById(volume.bookId);
    if (book.userId !== userId) throw new ForbiddenException('无权操作');

    const outlineContent = data.chapterOutline || null;
    const chapter = this.chapterRepository.create({
      volumeId,
      title: data.title,
      chapterNumber: data.chapterNumber,
      chapterOutline: outlineContent,
      // 快照指纹：用于与纲树当前章纲比对，判断章纲是否在生成后被改动
      outlineHash: outlineContent ? outlineHash(outlineContent) : null,
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
    // 快照被直接编辑时同步刷新指纹，避免把「用户改快照」误报成「章纲有改动」
    if (data.chapterOutline !== undefined) {
      chapter.outlineHash = data.chapterOutline ? outlineHash(data.chapterOutline) : null;
    }
    Object.assign(chapter, omitUndefined(data));
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
