// 角色服务 — 角色档案 + 子项 + 关系管理
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Character } from './entities/character.entity';
import { CharacterSection } from './entities/character-section.entity';
import { CharacterRelation } from './entities/character-relation.entity';
import { Book } from '../project/entities/book.entity';
import { omitUndefined } from '../../common/utils/object.utils';

/** 新建角色时自动带出的默认子项（原 characters 上的长文本字段迁入此处） */
const DEFAULT_SECTIONS: Array<{ key: keyof Character; title: string }> = [
  { key: 'background', title: '背景' },
  { key: 'personality', title: '性格' },
  { key: 'abilities', title: '能力' },
  { key: 'appearance', title: '外貌' },
  { key: 'goals', title: '目标' },
];

@Injectable()
export class CharacterService {
  constructor(
    @InjectRepository(Character) private charRepo: Repository<Character>,
    @InjectRepository(CharacterSection) private sectionRepo: Repository<CharacterSection>,
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
    const char = await this.charRepo.save(this.charRepo.create({ ...data, bookId }));

    // 自动带出默认子项；若旧字段已有内容则一并迁入，避免丢失
    await this.sectionRepo.save(DEFAULT_SECTIONS.map((s, i) => this.sectionRepo.create({
      bookId,
      characterId: char.id,
      title: s.title,
      content: (char as any)[s.key] || null,
      sortOrder: i,
    })));

    return char;
  }

  async update(id: string, userId: string, data: Partial<Character>) {
    const char = await this.charRepo.findOne({ where: { id } });
    if (!char) throw new NotFoundException('角色不存在');
    await this.checkBook(char.bookId, userId);
    Object.assign(char, omitUndefined(data));
    return this.charRepo.save(char);
  }

  async delete(id: string, userId: string) {
    const char = await this.charRepo.findOne({ where: { id } });
    if (!char) throw new NotFoundException('角色不存在');
    await this.checkBook(char.bookId, userId);
    // 级联清理：子项与关系
    await this.sectionRepo.delete({ characterId: id });
    await this.relRepo.delete({ sourceCharId: id });
    await this.relRepo.delete({ targetCharId: id });
    await this.charRepo.remove(char);
  }

  // ==================== 角色子项 ====================

  /** 该书全部角色子项（按角色分组，前端据此展开显示） */
  async listSections(bookId: string, userId: string) {
    await this.checkBook(bookId, userId);
    return this.sectionRepo.find({
      where: { bookId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  /** 新建子项：标题留空时默认命名「子项N」（N 取已有同类标题最大序号 +1，与新增章节一致） */
  async createSection(characterId: string, userId: string, data: { title: string; content?: string }) {
    const char = await this.charRepo.findOne({ where: { id: characterId } });
    if (!char) throw new NotFoundException('角色不存在');
    await this.checkBook(char.bookId, userId);

    const siblings = await this.sectionRepo.find({ where: { characterId } });
    const sortOrder = siblings.length ? Math.max(...siblings.map(s => s.sortOrder)) + 1 : 0;

    const explicit = (data.title ?? '').trim();
    let title = explicit;
    if (!title) {
      let maxNo = 0;
      for (const s of siblings) {
        const m = /^子项(\d+)$/.exec((s.title || '').trim());
        if (m) maxNo = Math.max(maxNo, Number(m[1]));
      }
      title = `子项${maxNo + 1}`;
    }

    return this.sectionRepo.save(this.sectionRepo.create({
      bookId: char.bookId,
      characterId,
      title,
      content: data.content || null,
      sortOrder,
    }));
  }

  async updateSection(id: string, userId: string, data: { title?: string; content?: string }) {
    const section = await this.sectionRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundException('角色子项不存在');
    await this.checkBook(section.bookId, userId);
    const patch: any = omitUndefined(data);
    // 标题不允许改成空白，否则界面上会出现一行没有名字的子项
    if (typeof patch.title === 'string' && !patch.title.trim()) delete patch.title;
    Object.assign(section, patch);
    return this.sectionRepo.save(section);
  }

  async deleteSection(id: string, userId: string) {
    const section = await this.sectionRepo.findOne({ where: { id } });
    if (!section) throw new NotFoundException('角色子项不存在');
    await this.checkBook(section.bookId, userId);
    await this.sectionRepo.remove(section);
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
