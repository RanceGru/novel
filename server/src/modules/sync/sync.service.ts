// 同步服务
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OperationLog } from './entities/operation-log.entity';
import { Book } from '../project/entities/book.entity';
import { Volume } from '../project/entities/volume.entity';
import { Chapter } from '../project/entities/chapter.entity';
import { Outline } from '../outline/entities/outline.entity';
import { Character } from '../character/entities/character.entity';
import { WorldSetting } from '../worldbuilding/entities/world-setting.entity';
import { ConflictResolverService } from './conflict-resolver.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(OperationLog) private opLogRepo: Repository<OperationLog>,
    @InjectRepository(Book) private bookRepo: Repository<Book>,
    @InjectRepository(Volume) private volumeRepo: Repository<Volume>,
    @InjectRepository(Chapter) private chapterRepo: Repository<Chapter>,
    @InjectRepository(Outline) private outlineRepo: Repository<Outline>,
    @InjectRepository(Character) private charRepo: Repository<Character>,
    @InjectRepository(WorldSetting) private wsRepo: Repository<WorldSetting>,
    private conflictResolver: ConflictResolverService,
  ) {}

  /** 导出书籍完整数据包 */
  async exportBook(bookId: string, userId: string) {
    const book = await this.bookRepo.findOne({ where: { id: bookId, userId } });
    if (!book) throw new Error('书籍不存在或无权访问');

    const [volumes, outlines, characters, worldSettings] = await Promise.all([
      this.volumeRepo.find({ where: { bookId } }),
      this.outlineRepo.find({ where: { bookId } }),
      this.charRepo.find({ where: { bookId } }),
      this.wsRepo.find({ where: { bookId } }),
    ]);

    // 获取所有章节
    let chapters: Chapter[] = [];
    for (const vol of volumes) {
      const volChapters = await this.chapterRepo.find({ where: { volumeId: vol.id } });
      chapters = chapters.concat(volChapters);
    }

    return {
      exportedAt: new Date().toISOString(),
      book,
      volumes,
      chapters,
      outlines,
      characters,
      worldSettings,
    };
  }

  /** 导入离线操作日志 */
  async importOperations(userId: string, operations: Array<{
    entityType: string; entityId: string; operation: string;
    payload: string; clientTimestamp: number;
  }>) {
    const results: any[] = [];

    for (const op of operations) {
      try {
        // 检查冲突
        const existing = await this.getEntityCurrent(op.entityType, op.entityId);
        if (existing) {
          const payload = JSON.parse(op.payload || '{}');
          const conflict = this.conflictResolver.detectConflict(
            op.entityType, op.entityId,
            { content: payload.content || '', updatedAt: new Date(op.clientTimestamp).toISOString() },
            { content: existing.content || '', updatedAt: existing.updatedAt?.toISOString() || '' },
          );

          if (conflict) {
            results.push({ entityType: op.entityType, entityId: op.entityId, status: 'conflict', conflict });
            continue;
          }
        }

        // 无冲突，记录操作日志
        const log = this.opLogRepo.create({
          userId, bookId: op.payload ? JSON.parse(op.payload).bookId : '',
          entityType: op.entityType, entityId: op.entityId,
          operation: op.operation, payload: op.payload,
          clientTimestamp: op.clientTimestamp, synced: true,
        });
        await this.opLogRepo.save(log);

        results.push({ entityType: op.entityType, entityId: op.entityId, status: 'synced' });
      } catch (e: any) {
        results.push({ entityType: op.entityType, entityId: op.entityId, status: 'error', error: e.message });
      }
    }

    return results;
  }

  /** 获取实体当前版本 */
  private async getEntityCurrent(entityType: string, entityId: string): Promise<any> {
    switch (entityType) {
      case 'chapter': return this.chapterRepo.findOne({ where: { id: entityId } });
      case 'outline': return this.outlineRepo.findOne({ where: { id: entityId } });
      case 'character': return this.charRepo.findOne({ where: { id: entityId } });
      case 'world_setting': return this.wsRepo.findOne({ where: { id: entityId } });
      default: return null;
    }
  }

  /** 获取冲突列表 */
  getConflicts() {
    return this.conflictResolver.getPendingConflicts();
  }

  /** 解决冲突 */
  resolveConflict(conflictId: string, resolution: 'keep_local' | 'keep_remote' | 'merge') {
    return this.conflictResolver.resolve(conflictId, resolution);
  }
}
