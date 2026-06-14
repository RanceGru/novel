// 卷实体 — volumes 表
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('volumes')
export class Volume {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_volumes_book')
  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'integer', name: 'volume_number' })
  volumeNumber: number;

  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @Column({ type: 'text', nullable: true, name: 'outline_plan' })
  outlinePlan: string | null;

  @Column({ type: 'varchar', length: 20, default: 'draft' })
  status: string;

  @Column({ type: 'bigint', default: 1, name: 'sync_version' })
  syncVersion: number;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'datetime', name: 'updated_at' })
  updatedAt: Date;
}
