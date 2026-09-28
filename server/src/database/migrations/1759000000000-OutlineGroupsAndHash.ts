// 纲树结构 + 章纲改动检测
//
// 背景：
//   纲树是上游创作源，分卷/章节是下游生成产物。结构为：
//     大纲 book_outline（每书单例）
//     细纲 detailed_outline（每书单例，卷纲/章纲的组织容器）
//       卷纲 volume_outline（对应目录分卷，1:1）
//         章纲 chapter_outline（对应目录章节，1:1）
//         每个卷纲自带系统条目「第N卷卷纲」，isSystem=true，不可删除
//
//   1) outlines 两列语义变更：原 volume_id/chapter_id 从未被写入过，
//      改名为 generated_volume_id / generated_chapter_id，记录"由该纲条目生成出的"产物。
//   2) outlines 新增 is_system：标记系统自带、不可删除的条目。
//   3) chapters 新增 outline_hash：生成正文时章纲内容的指纹。
//      与纲树当前章纲不一致即表示"章纲已改动"，前端据此提示，但不自动改写正文。
//
// 注意：本项目实体使用跨库类型写法，此处迁移按 PostgreSQL 编写。
import { MigrationInterface, QueryRunner } from 'typeorm';

export class OutlineGroupsAndHash1759000000000 implements MigrationInterface {
  name = 'OutlineGroupsAndHash1759000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1) outlines 列改名（原列未被任何代码写入，改名不丢数据）
    await queryRunner.query(`ALTER TABLE "outlines" RENAME COLUMN "volume_id" TO "generated_volume_id"`);
    await queryRunner.query(`ALTER TABLE "outlines" RENAME COLUMN "chapter_id" TO "generated_chapter_id"`);

    // 2) 系统条目标记
    await queryRunner.query(`ALTER TABLE "outlines" ADD COLUMN IF NOT EXISTS "is_system" boolean NOT NULL DEFAULT false`);

    // 3) 按 book_id + level 的查询是纲树主要读路径，补索引
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_outlines_book_level" ON "outlines" ("book_id", "level")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_outlines_parent" ON "outlines" ("parent_id")`);

    // 4) 单例约束：每本书至多一条大纲、至多一条细纲（部分唯一索引）
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_outlines_book_outline" ON "outlines" ("book_id", "level") WHERE "level" = 'book_outline'`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "uq_outlines_detailed_outline" ON "outlines" ("book_id", "level") WHERE "level" = 'detailed_outline'`,
    );

    // 5) chapters 新增章纲快照指纹
    await queryRunner.query(`ALTER TABLE "chapters" ADD COLUMN IF NOT EXISTS "outline_hash" varchar(64)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chapters" DROP COLUMN IF EXISTS "outline_hash"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_outlines_detailed_outline"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "uq_outlines_book_outline"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_outlines_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_outlines_book_level"`);
    await queryRunner.query(`ALTER TABLE "outlines" DROP COLUMN IF EXISTS "is_system"`);
    await queryRunner.query(`ALTER TABLE "outlines" RENAME COLUMN "generated_chapter_id" TO "chapter_id"`);
    await queryRunner.query(`ALTER TABLE "outlines" RENAME COLUMN "generated_volume_id" TO "volume_id"`);
  }
}
