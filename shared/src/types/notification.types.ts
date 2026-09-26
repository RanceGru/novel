// 通知系统类型

/** 通知类型 */
export type NotificationType = 'conflict' | 'quota' | 'review' | 'system' | 'milestone';

/** 通知 */
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string | null;
  data: Record<string, unknown> | null;
  isRead: boolean;
  createdAt: string;
}
