// 删除作品时的数据清理服务
//
// 背景：作品是几乎所有业务表的根（book_id），而这些外键大多是「裸 uuid 列」，
// 没有数据库级 ON DELETE CASCADE。此前 book.delete() 只删了 分卷/章节，
// 于是 outlines / characters / world_settings / memory_* 等表会留下孤儿行
// （实测 19 个已删除作品残留 52 条 outline）。
//
// 这里做「应用层级联」：按依赖顺序逐表清理。用原生 SQL 而不是实体仓储，
// 是为了让依赖清单集中在一处、一眼看全，新增表时只需在下面加一行。
// 清理与删书同处一个事务，避免半途失败导致更脏的中间状态。
//
// 参数占位符一律通过 sql-params.util 生成（PG 与 SQLite 语法不同）。
import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { hasColumn, inList, ph } from '../../common/utils/sql-params.util';

/** 按 book_id 直接归属的表 */
const BY_BOOK_ID = [
  'outlines',
  'world_settings',
  'foreshadows',
  'subplot_threads',
  'memory_events',
  'setting_patches',
  'style_anchors',
  'chapter_versions',
  'operation_logs',
];

@Injectable()
export class BookCleanupService {
  private readonly logger = new Logger(BookCleanupService.name);

  constructor(
    // 注入 DataSource 而不是 Book 仓储：这样本服务不依赖任何 forFeature 注册，
    // 任何 import 了 ProjectModule 的模块都能直接复用。
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  /**
   * 清理某本书的全部从属数据，并在最后删除 books 行。
   * 调用方需已完成归属校验。
   */
  async deleteBookCascade(id: string): Promise<void> {
    await this.dataSource.transaction(async (m) => {
      // 先取出三类主键，深层子表通过它们定位
      const volumeIds = await this.idsBy(m, 'volumes', 'book_id', id);
      const chapterIds = await this.idsIn(m, 'chapters', 'volume_id', volumeIds);
      const characterIds = await this.idsBy(m, 'characters', 'book_id', id);

      // ① 章节的从属表（必须先于 chapters 删）
      await this.deleteIn(m, 'chapter_versions', 'chapter_id', chapterIds);
      await this.deleteIn(m, 'character_states', 'chapter_id', chapterIds);

      // ② 角色的从属表（必须先于 characters 删）
      await this.deleteIn(m, 'character_sections', 'character_id', characterIds);
      await this.deleteIn(m, 'character_states', 'character_id', characterIds);
      await this.deleteIn(m, 'character_relations', 'source_char_id', characterIds);
      await this.deleteIn(m, 'character_relations', 'target_char_id', characterIds);

      // ③ 分卷与章节本体
      await this.deleteIn(m, 'chapters', 'volume_id', volumeIds);
      await this.deleteIn(m, 'volumes', 'id', volumeIds);

      // ④ 直接按 book_id 归属的表（chapter_versions 已按 chapter_id 删过，多删一次无害）
      for (const table of BY_BOOK_ID) {
        await this.deleteByBook(m, table, id);
      }

      // ⑤ 角色本体
      await this.deleteByBook(m, 'characters', id);

      // ⑥ token 交易是计费流水：保留记录，只解除作品引用（避免留下悬空 UUID）
      await m.query(
        `UPDATE token_transactions SET book_id = NULL, chapter_id = NULL WHERE book_id = ${ph(m, 1)}`,
        [id],
      );

      // ⑦ 记忆向量：pgvector 启用时清空，未启用则无此列
      if (await hasColumn(m, 'memory_events', 'embedding')) {
        await m.query(`UPDATE memory_events SET embedding = NULL WHERE book_id = ${ph(m, 1)}`, [id]);
      }

      // ⑧ 最后删书自身
      await m.query(`DELETE FROM books WHERE id = ${ph(m, 1)}`, [id]);
    });
    this.logger.log(`已级联清理作品数据: ${id}`);
  }

  /** 表名/列名来自上方常量，不来自外部输入；取值一律走参数占位符。 */
  private async idsBy(m: EntityManager, table: string, col: string, value: string): Promise<string[]> {
    const rows: Array<{ id: string }> = await m.query(
      `SELECT id FROM ${table} WHERE ${col} = ${ph(m, 1)}`,
      [value],
    );
    return rows.map((r) => r.id);
  }

  private async idsIn(m: EntityManager, table: string, col: string, values: string[]): Promise<string[]> {
    if (!values.length) return [];
    const { sql, params } = inList(m, col, values);
    const rows: Array<{ id: string }> = await m.query(`SELECT id FROM ${table} WHERE ${sql}`, params);
    return rows.map((r) => r.id);
  }

  private async deleteByBook(m: EntityManager, table: string, bookId: string): Promise<void> {
    await m.query(`DELETE FROM ${table} WHERE book_id = ${ph(m, 1)}`, [bookId]);
  }

  private async deleteIn(m: EntityManager, table: string, col: string, values: string[]): Promise<void> {
    if (!values.length) return;
    const { sql, params } = inList(m, col, values);
    await m.query(`DELETE FROM ${table} WHERE ${sql}`, params);
  }
}
