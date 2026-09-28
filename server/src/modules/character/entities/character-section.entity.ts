// 角色子项实体 — character_sections 表
//
// 用途：角色下的可展开子项（类似分卷下的章节），用于承载角色的长文本内容。
// 与分卷/章节的差异：子项**不带序号**，命名就是普通标题。
//
// 与 characters 上既有字段的关系：
//   characters.background / personality / abilities / appearance / goals 为旧字段，
//   新建角色时会自动生成同名子项并把内容迁入；旧字段保留只读以兼容历史数据。
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { bigintTransformer } from '../../../common/utils/transformers';

@Entity('character_sections')
export class CharacterSection {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_char_sections_book')
  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Index('idx_char_sections_character')
  @Column({ type: 'uuid', name: 'character_id' })
  characterId: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  @Column({ type: 'integer', default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'bigint', default: 1, name: 'sync_version', transformer: bigintTransformer })
  syncVersion: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
