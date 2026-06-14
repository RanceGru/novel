// 卷服务
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Volume } from './entities/volume.entity';
import { BookService } from './book.service';

@Injectable()
export class VolumeService {
  constructor(
    @InjectRepository(Volume)
    private volumeRepository: Repository<Volume>,
    private bookService: BookService,
  ) {}

  async listByBook(bookId: string, userId: string): Promise<Volume[]> {
    const book = await this.bookService.findById(bookId);
    if (book.userId !== userId) {
      throw new ForbiddenException('无权访问');
    }
    return this.volumeRepository.find({
      where: { bookId },
      order: { volumeNumber: 'ASC' },
    });
  }

  async findById(id: string): Promise<Volume> {
    const volume = await this.volumeRepository.findOne({ where: { id } });
    if (!volume) {
      throw new NotFoundException('卷不存在');
    }
    return volume;
  }

  async create(bookId: string, userId: string, data: { title: string; volumeNumber: number; summary?: string; outlinePlan?: string }): Promise<Volume> {
    const book = await this.bookService.findById(bookId);
    if (book.userId !== userId) {
      throw new ForbiddenException('无权操作');
    }
    const volume = this.volumeRepository.create({
      bookId,
      title: data.title,
      volumeNumber: data.volumeNumber,
      summary: data.summary || null,
      outlinePlan: data.outlinePlan || null,
    });
    return this.volumeRepository.save(volume);
  }

  async update(id: string, userId: string, data: { title?: string; summary?: string; outlinePlan?: string; status?: string }): Promise<Volume> {
    const volume = await this.findById(id);
    const book = await this.bookService.findById(volume.bookId);
    if (book.userId !== userId) {
      throw new ForbiddenException('无权操作');
    }
    Object.assign(volume, data);
    return this.volumeRepository.save(volume);
  }

  async delete(id: string, userId: string): Promise<void> {
    const volume = await this.findById(id);
    const book = await this.bookService.findById(volume.bookId);
    if (book.userId !== userId) {
      throw new ForbiddenException('无权操作');
    }
    await this.volumeRepository.remove(volume);
  }
}
