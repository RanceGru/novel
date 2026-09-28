// 纲树实体 — outlines 表
//
// 结构（按 level 区分）：
//   book_outline     大纲   每书单例，标题固定「大纲」，只能改写 content（全书总纲）
//   detailed_outline 细纲   每书单例，是下面的组织容器（结构与目录类似）
//   volume_outline   卷纲   细纲下的顶层条目，对应目录的分卷（1:1）
//   chapter_outline  章纲   卷纲下的条目，对应目录的章节（1:1）
//                          每个卷纲默认自带第一条章纲「第N卷卷纲」——该卷的内容摘要，
//                          不可删除（isSystem = true）
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { bigintTransformer } from '../../../common/utils/transformers';

@Entity('outlines')
@Index('idx_outlines_book_level', ['bookId', 'level'])
// 每本书至多一条大纲、至多一条细纲：并发请求下也不会重复创建（部分唯一索引）
@Index('uq_outlines_book_outline', ['bookId', 'level'], {
  unique: true,
  where: `"level" = 'book_outline'`,
})
@Index('uq_outlines_detailed_outline', ['bookId', 'level'], {
  unique: true,
  where: `"level" = 'detailed_outline'`,
})
export class Outline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'book_id' })
  bookId: string;

  @Column({ type: 'varchar', length: 20 })
  level: string; // 'book_outline' | 'detailed_outline' | 'volume_outline' | 'chapter_outline'

  // 系统自带条目（如每个卷纲下的「第N卷卷纲」）：不可删除、不可改标题
  @Column({ type: 'boolean', default: false, name: 'is_system' })
  isSystem: boolean;

  // 归属：由该纲条目「生成」出来的下游产物。为空表示尚未生成（待展开）。
  // 卷纲 -> 分卷（1:1）；章纲 -> 章节（1:1）
  @Column({ type: 'uuid', nullable: true, name: 'generated_volume_id' })
  generatedVolumeId: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'generated_chapter_id' })
  generatedChapterId: string | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  content: string | null;

  // 来源追溯：卷纲由大纲分化、章纲由卷纲分化（不参与展示分组，仅作来源记录）
  @Index('idx_outlines_parent')
  @Column({ type: 'uuid', nullable: true, name: 'parent_id' })
  parentId: string | null;

  @Column({ type: 'integer', default: 0, name: 'sort_order' })
  sortOrder: number;

  @Column({ type: 'bigint', default: 1, name: 'sync_version', transformer: bigintTransformer })
  syncVersion: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
