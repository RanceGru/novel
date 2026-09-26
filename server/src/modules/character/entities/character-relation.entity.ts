// 角色关系实体 — character_relations 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('character_relations')
export class CharacterRelation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'uuid', name: 'source_char_id' })
  sourceCharId: string;

  @Column({ type: 'uuid', name: 'target_char_id' })
  targetCharId: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'relation_type' })
  relationType: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'integer', default: 0 })
  intensity: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
