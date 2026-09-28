// 世界观设定实体 — world_settings 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { bigintTransformer } from '../../../common/utils/transformers';

@Entity('world_settings')
export class WorldSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  /** 展示顺序：默认自带的 8 个条目按固定顺序排在前面，新增的排在其后 */
  @Index('idx_world_settings_book_sort')
  @Column({ type: 'integer', default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'integer', default: 1, name: 'content_version' })
  contentVersion: number;

  @Column({ type: 'bigint', default: 1, name: 'sync_version', transformer: bigintTransformer })
  syncVersion: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
