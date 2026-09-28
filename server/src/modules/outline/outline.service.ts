// 纲树服务
//
// 结构（outlines 表按 level 分组）：
//   book_outline     大纲   每书单例，标题固定「大纲」，只能改写 content（全书总纲）
//   detailed_outline 细纲   每书单例，是卷纲/章纲的组织容器，结构与目录类似
//   volume_outline   卷纲   细纲下的顶层条目，对应目录的分卷（1:1）
//   chapter_outline  章纲   卷纲下的条目，对应目录的章节（1:1）
//                          每个卷纲默认自带第一条章纲「第N卷卷纲」（该卷内容摘要），
//                          标记 isSystem=true，不可删除、不可改标题，但可改写内容
//
// 职责边界：纲树是「上游创作源」，分卷/章节是「下游生成产物」。
// 由章纲生成章节时写入章纲快照 chapters.chapter_outline 与其指纹 outline_hash；
// 章纲后续被改动只会让指纹不一致（前端提示），不会自动改写已生成的正文。
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Outline } from './entities/outline.entity';
import { Book } from '../project/entities/book.entity';
import { Chapter } from '../project/entities/chapter.entity';
import { Volume } from '../project/entities/volume.entity';
import { omitUndefined } from '../../common/utils/object.utils';
import { outlineHash } from './outline-hash.util';

/** 固定标题 */
export const BOOK_OUTLINE_TITLE = '大纲';
export const DETAILED_OUTLINE_TITLE = '细纲';

/** 卷纲自带章纲的标题格式 */
export const volumeSummaryTitle = (volumeNumber: number) => `第${volumeNumber}卷卷纲`;

export type OutlineSyncState = 'pending' | 'synced' | 'changed' | 'source_missing';

@Injectable()
export class OutlineService {
  constructor(
    @InjectRepository(Outline)
    private outlineRepo: Repository<Outline>,
    @InjectRepository(Book)
    private bookRepo: Repository<Book>,
    @InjectRepository(Chapter)
    private chapterRepo: Repository<Chapter>,
    @InjectRepository(Volume)
    private volumeRepo: Repository<Volume>,
  ) {}

  /** 校验书籍归属 */
  private async assertBook(bookId: string, userId: string): Promise<Book> {
    const book = await this.bookRepo.findOne({ where: { id: bookId } });
    if (!book) throw new NotFoundException('书籍不存在');
    if (book.userId !== userId) throw new ForbiddenException('无权操作');
    return book;
  }

  // ==================== 分组读取 ====================

  /**
   * 纲树分组视图。
   * 大纲、细纲为单例（不存在则自动创建）；卷纲、章纲附带同步状态。
   */
  async getGroups(bookId: string, userId: string) {
    await this.assertBook(bookId, userId);
    const [bookOutline, detailedOutline] = await Promise.all([
      this.getOrCreateBookOutline(bookId),
      this.getOrCreateDetailedOutline(bookId),
    ]);

    const volumes = await this.outlineRepo.find({
      where: { bookId, level: 'volume_outline' },
      order: { sortOrder: 'ASC' },
    });
    const chapters = await this.outlineRepo.find({
      where: { bookId, level: 'chapter_outline' },
      order: { sortOrder: 'ASC' },
    });

    const volumeRows = volumes.map(v => ({
      ...v,
      currentHash: outlineHash(v.content),
      // 卷纲：未生成分卷即待展开；已生成则同步（卷纲改动不影响正文）
      syncState: (v.generatedVolumeId ? 'synced' : 'pending') as OutlineSyncState,
    }));

    const chapterRows = await this.attachChapterStates(chapters.map(c => ({
      ...c,
      currentHash: outlineHash(c.content),
      syncState: 'pending' as OutlineSyncState,
    })));

    return {
      bookOutline: { ...bookOutline, currentHash: outlineHash(bookOutline.content), syncState: 'synced' as OutlineSyncState },
      detailedOutline: { ...detailedOutline, currentHash: outlineHash(detailedOutline.content), syncState: 'synced' as OutlineSyncState },
      volumes: volumeRows,
      chapters: chapterRows,
    };
  }

  /** 章纲状态需读章节的 outline_hash，故单独批量计算（避免 N+1） */
  private async attachChapterStates<T extends { generatedChapterId: string | null; currentHash: string; syncState: OutlineSyncState }>(
    rows: T[],
  ): Promise<T[]> {
    const ids = rows.map(r => r.generatedChapterId).filter((v): v is string => !!v);
    if (!ids.length) {
      rows.forEach(r => { r.syncState = 'pending'; });
      return rows;
    }

    const chapters = await this.chapterRepo.find({ where: ids.map(id => ({ id })) });
    const byId = new Map(chapters.map(c => [c.id, c]));

    for (const row of rows) {
      if (!row.generatedChapterId) { row.syncState = 'pending'; continue; }
      const ch = byId.get(row.generatedChapterId);
      if (!ch) { row.syncState = 'source_missing'; continue; }
      row.syncState = (ch.outlineHash ?? '') === row.currentHash ? 'synced' : 'changed';
    }
    return rows;
  }

  // ==================== 大纲（单例） ====================

  /** 取每本书唯一的大纲节点；不存在则创建（标题固定） */
  async getOrCreateBookOutline(bookId: string): Promise<Outline> {
    const existing = await this.outlineRepo.findOne({ where: { bookId, level: 'book_outline' } });
    if (existing) return existing;

    const node = this.outlineRepo.create({
      bookId, level: 'book_outline', title: BOOK_OUTLINE_TITLE,
      content: null, parentId: null, sortOrder: 0,
    });
    return this.outlineRepo.save(node);
  }

  /** 更新大纲内容（仅 content 可改，标题固定） */
  async updateBookOutline(bookId: string, userId: string, content: string) {
    await this.assertBook(bookId, userId);
    const node = await this.getOrCreateBookOutline(bookId);
    node.content = content ?? '';
    return this.outlineRepo.save(node);
  }

  // ==================== 细纲（单例） ====================

  /** 取每本书唯一的细纲节点；不存在则创建（标题固定）。
   *  细纲是卷纲/章纲的组织容器，与目录结构类似。 */
  async getOrCreateDetailedOutline(bookId: string): Promise<Outline> {
    const existing = await this.outlineRepo.findOne({ where: { bookId, level: 'detailed_outline' } });
    if (existing) return existing;

    const node = this.outlineRepo.create({
      bookId, level: 'detailed_outline', title: DETAILED_OUTLINE_TITLE,
      content: null, parentId: null, sortOrder: 0, isSystem: true,
    });
    return this.outlineRepo.save(node);
  }

  // ==================== 卷纲 / 章纲 CRUD ====================

  /** 创建卷纲或章纲（大纲/细纲均不允许通过此接口创建） */
  async create(bookId: string, userId: string, data: {
    level: string;
    title: string;
    content?: string;
    parentId?: string;
    sortOrder?: number;
  }) {
    await this.assertBook(bookId, userId);

    if (data.level === 'book_outline') {
      throw new BadRequestException('大纲为每本书唯一，不能新增，请直接修改内容');
    }
    if (data.level === 'detailed_outline') {
      throw new BadRequestException('细纲为每本书唯一，不能新增');
    }
    if (data.level !== 'volume_outline' && data.level !== 'chapter_outline') {
      throw new BadRequestException(`不支持的纲层级: ${data.level}`);
    }

    if (data.level === 'volume_outline') {
      // 卷纲挂在细纲下
      const detailed = await this.getOrCreateDetailedOutline(bookId);
      const node = this.outlineRepo.create({
        bookId, level: 'volume_outline', title: data.title,
        content: data.content || null, parentId: detailed.id,
        sortOrder: data.sortOrder ?? 0,
      });
      const saved = await this.outlineRepo.save(node);

      // 每个卷纲默认自带第一条章纲「第N卷卷纲」——该卷内容摘要，不可删除
      const volumeNumber = await this.nextVolumeOutlineNumber(bookId);
      await this.outlineRepo.save(this.outlineRepo.create({
        bookId, level: 'chapter_outline',
        title: volumeSummaryTitle(volumeNumber),
        content: null, parentId: saved.id, sortOrder: 0, isSystem: true,
      }));

      return saved;
    }

    // 章纲必须归属于某个卷纲
    if (!data.parentId) throw new BadRequestException('章纲必须指定所属卷纲');
    const parent = await this.outlineRepo.findOne({ where: { id: data.parentId } });
    if (!parent || parent.bookId !== bookId || parent.level !== 'volume_outline') {
      throw new BadRequestException('所属卷纲不存在或不属于本书');
    }

    // 排在系统自带的卷纲章之后
    let sortOrder = data.sortOrder;
    if (sortOrder === undefined) {
      const siblings = await this.outlineRepo.find({ where: { parentId: parent.id } });
      sortOrder = siblings.length ? Math.max(...siblings.map(s => s.sortOrder)) + 1 : 1;
    }

    const node = this.outlineRepo.create({
      bookId, level: 'chapter_outline', title: data.title,
      content: data.content || null, parentId: parent.id, sortOrder,
    });
    return this.outlineRepo.save(node);
  }

  /** 下一个卷纲序号（用于「第N卷卷纲」命名） */
  private async nextVolumeOutlineNumber(bookId: string): Promise<number> {
    const volumes = await this.outlineRepo.find({ where: { bookId, level: 'volume_outline' } });
    return volumes.length;
  }

  /** 更新纲条目（大纲标题固定；系统条目标题不可改） */
  async update(id: string, userId: string, data: {
    title?: string;
    content?: string;
    sortOrder?: number;
  }) {
    const node = await this.findOwned(id, userId);

    if (node.level === 'book_outline' || node.level === 'detailed_outline' || node.isSystem) {
      // 标题固定，只允许改 content / sortOrder
      const patch = omitUndefined({ content: data.content, sortOrder: data.sortOrder });
      Object.assign(node, patch);
      return this.outlineRepo.save(node);
    }

    Object.assign(node, omitUndefined(data));
    return this.outlineRepo.save(node);
  }

  /** 删除卷纲或章纲（大纲/细纲/系统条目不可删）。不触碰已生成的分卷/章节。 */
  async delete(id: string, userId: string) {
    const node = await this.findOwned(id, userId);

    if (node.level === 'book_outline') throw new BadRequestException('大纲不可删除');
    if (node.level === 'detailed_outline') throw new BadRequestException('细纲不可删除');
    if (node.isSystem) throw new BadRequestException(`「${node.title}」为系统自带条目，不可删除`);

    // 删除卷纲时级联删除其下的章纲条目（章纲本身是规划，可随卷纲一起移除）
    if (node.level === 'volume_outline') {
      await this.outlineRepo.delete({ parentId: node.id });
    }
    await this.outlineRepo.remove(node);
  }

  private async findOwned(id: string, userId: string): Promise<Outline> {
    const node = await this.outlineRepo.findOne({ where: { id } });
    if (!node) throw new NotFoundException('纲条目不存在');
    const book = await this.bookRepo.findOne({ where: { id: node.bookId } });
    if (!book || book.userId !== userId) throw new ForbiddenException('无权操作');
    return node;
  }

  // ==================== 由纲生成下游产物 ====================

  /**
   * 从章纲生成章节：
   *   - 分卷由章纲所属卷纲的 generatedVolumeId 决定（1:1）；若卷纲尚未生成分卷则先建
   *   - 章节标题取章纲标题，章纲 content 写入 chapters.chapter_outline 作为快照
   *   - 同时写入 outline_hash，用于后续改动检测
   *   - 回写章纲的 generatedChapterId
   */
  async generateChapter(outlineId: string, userId: string) {
    const node = await this.findOwned(outlineId, userId);
    if (node.level !== 'chapter_outline') {
      throw new BadRequestException('只有章纲可以生成章节');
    }
    if (node.generatedChapterId) {
      const existing = await this.chapterRepo.findOne({ where: { id: node.generatedChapterId } });
      if (existing) throw new BadRequestException('该章纲已生成章节');
    }
    if (!node.parentId) throw new BadRequestException('该章纲未归属任何卷纲');

    const volOutline = await this.outlineRepo.findOne({ where: { id: node.parentId } });
    if (!volOutline) throw new BadRequestException('所属卷纲不存在');
    const volumeId = await this.ensureVolumeForOutline(volOutline);

    // 章号：同一分卷内取最大号 + 1
    const siblings = await this.chapterRepo.find({ where: { volumeId } });
    const chapterNumber = siblings.length ? Math.max(...siblings.map(c => c.chapterNumber)) + 1 : 1;

    const content = node.content ?? '';
    const chapter = this.chapterRepo.create({
      volumeId,
      title: node.title,
      chapterNumber,
      chapterOutline: content,
      outlineHash: outlineHash(content),
      content: null,
    });
    const saved = await this.chapterRepo.save(chapter);

    node.generatedChapterId = saved.id;
    await this.outlineRepo.save(node);

    return { chapter: saved, volumeId };
  }

  /** 确保卷纲已生成对应分卷（1:1）。已生成则直接返回其 id。 */
  async ensureVolumeForOutline(volOutline: Outline): Promise<string> {
    if (volOutline.generatedVolumeId) {
      const exists = await this.volumeRepo.findOne({ where: { id: volOutline.generatedVolumeId } });
      if (exists) return exists.id;
      // 分卷已被删除：清空归属后重新生成
      volOutline.generatedVolumeId = null;
    }

    const volumes = await this.volumeRepo.find({ where: { bookId: volOutline.bookId } });
    const normal = volumes.filter(v => v.title !== '默认');
    const volumeNumber = normal.length ? Math.max(...normal.map(v => v.volumeNumber)) + 1 : 1;

    const savedVolume = await this.volumeRepo.save(this.volumeRepo.create({
      bookId: volOutline.bookId,
      title: volOutline.title,
      volumeNumber,
    }));

    volOutline.generatedVolumeId = savedVolume.id;
    await this.outlineRepo.save(volOutline);
    return savedVolume.id;
  }

  /** 由卷纲生成分卷（供"生成分卷"入口使用） */
  async generateVolume(outlineId: string, userId: string) {
    const node = await this.findOwned(outlineId, userId);
    if (node.level !== 'volume_outline') {
      throw new BadRequestException('只有卷纲可以生成分卷');
    }
    if (node.generatedVolumeId) {
      const exists = await this.volumeRepo.findOne({ where: { id: node.generatedVolumeId } });
      if (exists) throw new BadRequestException('该卷纲已生成分卷');
    }
    const volumeId = await this.ensureVolumeForOutline(node);
    return this.volumeRepo.findOne({ where: { id: volumeId } });
  }

  // ==================== 兼容：原有树形接口 ====================

  /** 获取书籍的完整纲树（保留兼容，前端新版使用 getGroups） */
  async getTree(bookId: string, userId: string) {
    await this.assertBook(bookId, userId);
    const nodes = await this.outlineRepo.find({
      where: { bookId },
      order: { sortOrder: 'ASC' },
    });
    return this.buildTree(nodes);
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
