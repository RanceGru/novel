// 角色状态快照实体 — character_states 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('character_states')
export class CharacterState {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'character_id' })
  characterId: string;

  @Column({ type: 'uuid', name: 'chapter_id' })
  chapterId: string;

  @Column({ type: 'text', nullable: true, name: 'physical_state' })
  physicalState: string | null;

  @Column({ type: 'text', nullable: true, name: 'mental_state' })
  mentalState: string | null;

  @Column({ type: 'text', nullable: true, name: 'emotional_state' })
  emotionalState: string | null;

  @Column({ type: 'text', nullable: true })
  location: string | null;

  @Column({ type: 'text', nullable: true })
  possessions: string | null;

  @Column({ type: 'integer', nullable: true, name: 'chapter_timestamp' })
  chapterTimestamp: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
