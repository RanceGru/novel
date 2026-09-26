// 角色实体 — characters 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { bigintTransformer } from '../../../common/utils/transformers';

@Entity('characters')
export class Character {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  alias: string | null;

  @Column({ type: 'varchar', length: 20, default: 'supporting' })
  category: string;

  @Column({ type: 'text', nullable: true })
  background: string | null;

  @Column({ type: 'text', nullable: true })
  personality: string | null;

  @Column({ type: 'text', nullable: true })
  abilities: string | null;

  @Column({ type: 'text', nullable: true })
  appearance: string | null;

  @Column({ type: 'text', nullable: true })
  goals: string | null;

  @Column({ type: 'text', nullable: true, name: 'arc_summary' })
  arcSummary: string | null;

  @Column({ type: 'bigint', default: 1, name: 'sync_version', transformer: bigintTransformer })
  syncVersion: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
