// 清理历史孤儿数据：
// 在修好 book.delete() 的级联清理之前，删除作品会留下 outlines / characters /
// world_settings / memory_* 等表的残留行。旧实现还留下过一个副作用：
// volumes 被删了但 chapters 没删（早前版本先删 volumes 的顺序问题），
// 于是出现「所属分卷已不存在」的孤儿章节。
//
// 本脚本按同一份依赖清单清理「book_id 不在 books 表中」的整棵子树。
// 默认只报告；加 --apply 才真正删除。
import { DatabaseSync } from 'node:sqlite';

const DB = 'E:/project/novel/server/data/novel-dev.sqlite';
const APPLY = process.argv.includes('--apply');

const db = new DatabaseSync(DB);
const liveBooks = new Set(db.prepare('SELECT id FROM books').all().map(r => r.id));
const liveVolumes = new Set(db.prepare('SELECT id FROM volumes').all().map(r => r.id));
const liveChapters = new Set(db.prepare('SELECT id FROM chapters').all().map(r => r.id));
const liveChars = new Set(db.prepare('SELECT id FROM characters').all().map(r => r.id));

const tableExists = (t) => !!db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get(t);
const count = (t, where = '', p = []) => { try { return db.prepare(`SELECT COUNT(*) c FROM ${t} ${where}`).get(...p).c; } catch { return -1; } };

console.log('现存作品:', liveBooks.size, '| 现存分卷:', liveVolumes.size, '| 现存章节:', liveChapters.size);
console.log(APPLY ? '\n模式: 实际删除\n' : '\n模式: 只报告（加 --apply 才删除）\n');

// 每张表用一条子查询判定「已无归属」的行，避免手工拼 id 列表时漏项
// （例如孤儿章节的 volume_id 早已被删，凭 volumes 表反推是找不到的）
const RULES = [
  ['outlines', 'book_id NOT IN (SELECT id FROM books)'],
  ['characters', 'book_id NOT IN (SELECT id FROM books)'],
  ['character_sections', 'book_id NOT IN (SELECT id FROM books)'],
  ['character_relations', 'book_id NOT IN (SELECT id FROM books)'],
  ['world_settings', 'book_id NOT IN (SELECT id FROM books)'],
  ['foreshadows', 'book_id NOT IN (SELECT id FROM books)'],
  ['subplot_threads', 'book_id NOT IN (SELECT id FROM books)'],
  ['memory_events', 'book_id NOT IN (SELECT id FROM books)'],
  ['setting_patches', 'book_id NOT IN (SELECT id FROM books)'],
  ['style_anchors', 'book_id NOT IN (SELECT id FROM books)'],
  ['chapter_versions', 'book_id NOT IN (SELECT id FROM books)'],
  ['operation_logs', 'book_id NOT IN (SELECT id FROM books)'],
  ['character_states', 'character_id NOT IN (SELECT id FROM characters)'],
  ['chapters', 'volume_id NOT IN (SELECT id FROM volumes)'],
];

let total = 0;
db.exec('BEGIN');
for (const [t, where] of RULES) {
  if (!tableExists(t)) continue;
  const rows = count(t, `WHERE ${where}`);
  if (rows <= 0) continue;
  if (APPLY) db.prepare(`DELETE FROM ${t} WHERE ${where}`).run();
  console.log(`  ${APPLY ? '已删除' : '待删除'} ${t}: ${rows} 行`);
  total += rows;
}
db.exec(APPLY ? 'COMMIT' : 'ROLLBACK');

console.log(`\n${APPLY ? '共删除' : '共待删除'}: ${total} 行`);

// 复核
const left = [];
for (const [t, where] of RULES) {
  if (!tableExists(t)) continue;
  const n = count(t, `WHERE ${where}`);
  if (n > 0) left.push(`${t}=${n}`);
}
console.log('复核 — 残留孤儿:', left.length ? left.join(', ') : '（无）');
db.close();
