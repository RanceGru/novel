// 角色子项（character_sections）
//
// 背景：角色原先把「背景/性格/能力/外貌/目标」五个长文本字段直接放在 characters 上，
// 只能通过弹窗编辑。现改为像「分卷下的章节」那样在角色下挂可增删改的子项，
// 子项不带序号（命名就是普通标题）。
//
// 兼容策略：characters 上的旧字段保留只读，不做破坏性删除；
// 新建角色时会自动生成同名子项并把旧字段内容迁入。
//
// 注意：本项目实体使用跨库类型写法，此处迁移按 PostgreSQL 编写。
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CharacterSections1759100000000 implements MigrationInterface {
  name = 'CharacterSections1759100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "character_sections" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "book_id" uuid NOT NULL,
        "character_id" uuid NOT NULL,
        "title" text NOT NULL,
        "content" text,
        "sort_order" integer NOT NULL DEFAULT 0,
        "sync_version" bigint NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_character_sections" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_char_sections_book" ON "character_sections" ("book_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_char_sections_character" ON "character_sections" ("character_id")`);

    // 把已有角色的旧字段迁入子项（仅当该角色尚无任何子项时执行，可重复运行）
    const defaults: Array<[string, string]> = [
      ['background', '背景'], ['personality', '性格'], ['abilities', '能力'],
      ['appearance', '外貌'], ['goals', '目标'],
    ];
    for (const [col, title] of defaults) {
      await queryRunner.query(`
        INSERT INTO "character_sections" ("book_id", "character_id", "title", "content", "sort_order")
        SELECT c."book_id", c."id", $1, c."${col}", $2
        FROM "characters" c
        WHERE c."${col}" IS NOT NULL AND c."${col}" <> ''
          AND NOT EXISTS (SELECT 1 FROM "character_sections" s WHERE s."character_id" = c."id")
      `, [title, defaults.findIndex(d => d[0] === col)]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_char_sections_character"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_char_sections_book"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "character_sections"`);
  }
}
