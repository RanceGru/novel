// 角色服务 — 角色档案 + 关系管理
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from './entities/character.entity';
import { CharacterRelation } from './entities/character-relation.entity';
import { Book } from '../project/entities/book.entity';

@Injectable()
export class CharacterService {
  constructor(
    @InjectRepository(Character) private charRepo: Repository<Character>,
    @InjectRepository(CharacterRelation) private relRepo: Repository<CharacterRelation>,
    @InjectRepository(Book) private bookRepo: Repository<Book>,
  ) {}

  private async checkBook(bookId: string, userId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('书籍不存在');
    if (book.userId !== userId) throw new ForbiddenException('无权操作');
    return book;
  }

  async list(bookId: string, userId: string) {
    await this.checkBook(bookId, userId);
    return this.charRepo.find({ where: { bookId }, order: { name: 'ASC' } });
  }

  async create(bookId: string, userId: string, data: Partial<Character>) {
    await this.checkBook(bookId, userId);
    const char = this.charRepo.create({ ...data, bookId });
    return this.charRepo.save(char);
  }

  async update(id: string, userId: string, data: Partial<Character>) {
    const char = await this.charRepo.findOne({ where: { id } });
    if (!char) throw new NotFoundException('角色不存在');
    await this.checkBook(char.bookId, userId);
    Object.assign(char, data);
    return this.charRepo.save(char);
  }

  async delete(id: string, userId: string) {
    const char = await this.charRepo.findOne({ where: { id } });
    if (!char) throw new NotFoundException('角色不存在');
    await this.checkBook(char.bookId, userId);
    // 删除关联关系
    await this.relRepo.delete({ sourceCharId: id });
    await this.relRepo.delete({ targetCharId: id });
    await this.charRepo.remove(char);
  }

  /** 获取角色关系图数据 */
  async getGraph(bookId: string, userId: string) {
    await this.checkBook(bookId, userId);
    const characters = await this.charRepo.find({ where: { bookId } });
    const relations = await this.relRepo.find({ where: { bookId } });

    const nodes = characters.map(c => ({
      id: c.id,
      name: c.name,
      category: c.category,
      group: c.category,
    }));

    const edges = relations.map(r => ({
      id: r.id,
      source: r.sourceCharId,
      target: r.targetCharId,
      relationType: r.relationType,
      intensity: r.intensity,
    }));

    return { nodes, edges };
  }

  /** 创建角色关系 */
  async createRelation(bookId: string, userId: string, data: {
    sourceCharId: string; targetCharId: string;
    relationType?: string; description?: string; intensity?: number;
  }) {
    await this.checkBook(bookId, userId);
    const rel = this.relRepo.create({ ...data, bookId });
    return this.relRepo.save(rel);
  }

  /** 删除角色关系 */
  async deleteRelation(relationId: string, userId: string) {
    const rel = await this.relRepo.findOne({ where: { id: relationId } });
    if (!rel) throw new NotFoundException('关系不存在');
    await this.checkBook(rel.bookId, userId);
    await this.relRepo.remove(rel);
  }
}
