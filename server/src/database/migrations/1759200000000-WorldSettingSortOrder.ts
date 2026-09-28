// 世界观条目增加展示顺序（world_settings.sort_order）
//
// 背景：世界观下的条目本身就是「可填写的一项」（时代信息 / 社会背景 / 力量体系 …），
// 它们下面没有更深的子项。新作品首次读取时会自动补齐这 8 个默认条目，
// 因此需要一列稳定的展示顺序，不能靠 title 或 category 排序。
//
// 对已有数据：按 created_at 顺序回填 sort_order，保证现有条目的相对顺序不变。
//
// 注意：本项目实体使用跨库类型写法，此处迁移按 PostgreSQL 编写。
import { MigrationInterface, QueryRunner } from 'typeorm';

export class WorldSettingSortOrder1759200000000 implements MigrationInterface {
  name = 'WorldSettingSortOrder1759200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "world_settings" ADD COLUMN IF NOT EXISTS "sort_order" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_world_settings_book_sort" ON "world_settings" ("book_id", "sort_order")`,
    );

    // 回填：同一作品内按创建时间编号，已有序的相对顺序保持不变
    await queryRunner.query(`
      UPDATE "world_settings" w
      SET "sort_order" = t.rn
      FROM (
        SELECT "id", ROW_NUMBER() OVER (PARTITION BY "book_id" ORDER BY "created_at", "id") AS rn
        FROM "world_settings"
        WHERE "sort_order" = 0
      ) t
      WHERE w."id" = t."id"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_world_settings_book_sort"`);
    await queryRunner.query(`ALTER TABLE "world_settings" DROP COLUMN IF EXISTS "sort_order"`);
  }
}
