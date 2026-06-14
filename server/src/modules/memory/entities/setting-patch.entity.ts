// 设定补丁实体 — setting_patches 表
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('setting_patches')
export class SettingPatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'uuid', nullable: true, name: 'world_setting_id' })
  worldSettingId: string | null;

  @Column({ type: 'text', name: 'patch_content' })
  patchContent: string;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'patch_type' })
  patchType: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'chapter_id' })
  chapterId: string | null;

  @Column({ type: 'simple-json', nullable: true })
  embedding: number[] | null;

  @CreateDateColumn({ type: 'datetime', name: 'created_at' })
  createdAt: Date;
}
