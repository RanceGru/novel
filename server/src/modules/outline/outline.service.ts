// 纲树服务 — 三级树 CRUD
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Outline } from './entities/outline.entity';
import { Book } from '../project/entities/book.entity';
import { omitUndefined } from '../../common/utils/object.utils';

@Injectable()
export class OutlineService {
  constructor(
    @InjectRepository(Outline)
    private outlineRepo: Repository<Outline>,
    @InjectRepository(Book)
    private bookRepo: Repository<Book>,
  ) {}

  /** 获取书籍的完整纲树 */
  async getTree(bookId: string, userId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('书籍不存在');
    if (book.userId !== userId) throw new ForbiddenException('无权访问');

    const nodes = await this.outlineRepo.find({
      where: { bookId },
      order: { sortOrder: 'ASC' },
    });
    return this.buildTree(nodes);
  }

  /** 创建纲树节点 */
  async create(bookId: string, userId: string, data: {
    level: string;
    title: string;
    content?: string;
    parentId?: string;
    volumeId?: string;
    chapterId?: string;
    sortOrder?: number;
  }) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('书籍不存在');
    if (book.userId !== userId) throw new ForbiddenException('无权操作');

    const node = this.outlineRepo.create({
      bookId,
      level: data.level,
      title: data.title,
      content: data.content || null,
      parentId: data.parentId || null,
      volumeId: data.volumeId || null,
      chapterId: data.chapterId || null,
      sortOrder: data.sortOrder ?? 0,
    });

    return this.outlineRepo.save(node);
  }

  /** 更新纲树节点 */
  async update(id: string, userId: string, data: {
    title?: string;
    content?: string;
    parentId?: string;
    sortOrder?: number;
  }) {
    const node = await this.outlineRepo.findOne({ where: { id } });
    if (!node) throw new NotFoundException('纲树节点不存在');

    const book = await this.bookRepo.findOne({ where: { id: node.bookId } });
    if (!book || book.userId !== userId) throw new ForbiddenException('无权操作');

    Object.assign(node, omitUndefined(data));
    return this.outlineRepo.save(node);
  }

  /** 删除纲树节点（级联删除子节点） */
  async delete(id: string, userId: string) {
    const node = await this.outlineRepo.findOne({ where: { id } });
    if (!node) throw new NotFoundException('纲树节点不存在');

    const book = await this.bookRepo.findOne({ where: { id: node.bookId } });
    if (!book || book.userId !== userId) throw new ForbiddenException('无权操作');

    // 级联删除所有子节点
    await this.deleteChildren(id);
    await this.outlineRepo.remove(node);
  }

  private MAX_DEPTH = 100;

  private async deleteChildren(parentId: string, depth = 0) {
    if (depth > this.MAX_DEPTH) {
      throw new Error('纲树层级过深（>100层），可能存在环形引用');
    }
    const children = await this.outlineRepo.find({ where: { parentId } });
    // 批量删除子节点 (避免 N+1)
    const childIds = children.map(c => c.id);
    for (const childId of childIds) {
      await this.deleteChildren(childId, depth + 1);
    }
    if (children.length > 0) {
      await this.outlineRepo.remove(children);
    }
  }

  /** 将扁平列表构建为树形结构 */
  private buildTree(nodes: Outline[]): any[] {
    const map = new Map<string, any>();
    const roots: any[] = [];

    for (const node of nodes) {
      map.set(node.id, { ...node, children: [] });
    }

    for (const node of nodes) {
      const mapped = map.get(node.id);
      if (node.parentId && map.has(node.parentId)) {
        map.get(node.parentId).children.push(mapped);
      } else {
        roots.push(mapped);
      }
    }

    return roots;
  }
}
