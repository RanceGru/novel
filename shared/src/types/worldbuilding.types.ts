// 世界观设定类型

/** 世界观设定类别 */
export type WorldSettingCategory =
  | 'era'
  | 'society'
  | 'power_system'
  | 'resources'
  | 'culture'
  | 'geography'
  | 'custom';

/** 世界观设定条目 */
export interface WorldSetting {
  id: string;
  bookId: string;
  category: WorldSettingCategory;
  title: string;
  content: string | null;
  contentVersion: number;
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
}

/** 创建设定请求 */
export interface CreateWorldSettingRequest {
  category: WorldSettingCategory;
  title: string;
  content?: string;
}

/** 更新设定请求 */
export interface UpdateWorldSettingRequest {
  category?: WorldSettingCategory;
  title?: string;
  content?: string;
}
