// 同步冲突解决服务
import { Injectable, Logger } from '@nestjs/common';

export interface SyncConflict {
  conflictId: string;
  entityType: string;
  entityId: string;
  localVersion: { content: string; updatedAt: string };
  remoteVersion: { content: string; updatedAt: string };
  type: 'content_conflict' | 'delete_vs_update';
}

export type ConflictResolution = 'keep_local' | 'keep_remote' | 'merge';

@Injectable()
export class ConflictResolverService {
  private readonly logger = new Logger(ConflictResolverService.name);
  private conflicts: Map<string, SyncConflict> = new Map();

  /** 检测冲突：对比本地和远程版本 */
  detectConflict(
    entityType: string, entityId: string,
    local: { content: string; updatedAt: string },
    remote: { content: string; updatedAt: string },
  ): SyncConflict | null {
    // 内容相同则无冲突
    if (local.content === remote.content) return null;

    const conflictId = `${entityType}_${entityId}_${Date.now()}`;
    const type = !local.content ? 'delete_vs_update' : 'content_conflict';

    const conflict: SyncConflict = {
      conflictId, entityType, entityId,
      localVersion: local,
      remoteVersion: remote,
      type,
    };

    this.conflicts.set(conflictId, conflict);
    this.logger.warn(`检测到冲突: ${type} on ${entityType}/${entityId}`);
    return conflict;
  }

  /** 解决冲突 */
  resolve(conflictId: string, resolution: ConflictResolution): { content: string } | null {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) return null;

    let content: string;
    switch (resolution) {
      case 'keep_local': content = conflict.localVersion.content; break;
      case 'keep_remote': content = conflict.remoteVersion.content; break;
      case 'merge':
        content = `${conflict.localVersion.content}\n\n--- 远程版本 ---\n\n${conflict.remoteVersion.content}`;
        break;
    }

    this.conflicts.delete(conflictId);
    return { content };
  }

  /** 获取未解决的冲突列表 */
  getPendingConflicts(): SyncConflict[] {
    return Array.from(this.conflicts.values());
  }
}
