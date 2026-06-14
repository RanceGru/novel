// 同步系统类型

/** 同步状态 */
export type SyncStatus = 'synced' | 'syncing' | 'pending' | 'error' | 'offline';

/** 操作类型 */
export type OperationType = 'INSERT' | 'UPDATE' | 'DELETE';

/** 离线操作日志条目 */
export interface OperationLogEntry {
  id?: number;
  entityType: string;
  entityId: string;
  operation: OperationType;
  payload: string; // JSON 数据快照
  clientTimestamp: number;
  synced: number; // 0=未同步, 1=已同步
}

/** 同步冲突 */
export interface SyncConflict {
  conflictId: string;
  entityType: string;
  entityId: string;
  localVersion: {
    content: string;
    updatedAt: string;
  };
  remoteVersion: {
    content: string;
    updatedAt: string;
  };
  diff: {
    localChanges: string;
    remoteChanges: string;
    conflictSegments: Array<{
      localText: string;
      remoteText: string;
    }>;
  };
}

/** 冲突解决选项 */
export type ConflictResolution = 'keep_local' | 'keep_remote' | 'merge';

/** 同步请求 */
export interface SyncRequest {
  lastSyncTimestamp: number;
  operations?: OperationLogEntry[];
}

/** 同步响应 */
export interface SyncResponse {
  timestamp: number;
  changesApplied: number;
  conflicts?: SyncConflict[];
  serverChanges?: Array<{
    entityType: string;
    entityId: string;
    operation: OperationType;
    data: unknown;
  }>;
}
