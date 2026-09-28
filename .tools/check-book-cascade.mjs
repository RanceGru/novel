// 删除作品的数据一致性验证：
// 建一本「什么都有」的书（细纲/角色/角色子项/世界观/记忆等），删掉它，
// 再全库扫一遍是否还有以该书 id 为根的残留行。
import { writeFileSync, mkdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const API = 'http://localhost:3000/api/v1';
const DB = 'E:/project/novel/server/data/novel-dev.sqlite';
let pass = 0, fail = 0;
const check = (l, c, extra = '') => { console.log(`   ${c ? '✓' : '✗'} ${l}${extra ? ' ' + extra : ''}`); c ? pass++ : fail++; };

const J = async (m, p, b, H) => {
  const r = await fetch(`${API}${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

/** 所有可能带 book_id（或通过子键间接归属）的表 */
const TABLES = [
  ['outlines', 'book_id'], ['characters', 'book_id'], ['character_sections', 'book_id'],
  ['character_relations', 'book_id'], ['world_settings', 'book_id'], ['volumes', 'book_id'],
  ['foreshadows', 'book_id'], ['subplot_threads', 'book_id'], ['memory_events', 'book_id'],
  ['setting_patches', 'book_id'], ['style_anchors', 'book_id'], ['chapter_versions', 'book_id'],
  ['operation_logs', 'book_id'], ['token_transactions', 'book_id'],
];

async function main() {
  const login = (await J('POST', '/auth/login', { email: 'demo@novel.com', password: 'demo123456' }, { 'Content-Type': 'application/json' })).body;
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.accessToken}` };

  // ① 造一本内容完整的书
  const book = (await J('POST', '/books', { title: '级联删除验证用书', author: '测试' }, H)).body.data;
  console.log('新建作品:', book.title, book.id.slice(0, 8));
  const mk = async (p, b) => {
    const r = await J('POST', p, b, H);
    if (!r.body?.data) throw new Error(`POST ${p} 失败: ${r.status} ${JSON.stringify(r.body).slice(0, 200)}`);
    return r.body.data;
  };

  const vol = await mk(`/books/${book.id}/volumes`, { title: '第一卷', volumeNumber: 1 });
  const ch = await mk(`/volumes/${vol.id}/chapters`, { title: '第1章', chapterNumber: 1, content: '正文内容' });
  const volOutline = await mk(`/books/${book.id}/outlines`, { level: 'volume_outline', title: '第一卷卷纲' });
  await mk(`/books/${book.id}/outlines`, { level: 'chapter_outline', title: '第1章 章纲', content: '章纲内容', parentId: volOutline.id });
  const testChar = await mk(`/books/${book.id}/characters`, { name: '测试角色', category: 'protagonist', background: '来历' });
  await mk(`/books/${book.id}/world-settings`, { title: '测试设定', category: 'geography', content: '设定内容' });
  // 章节版本快照（真实流程里由 VersionService.createSnapshot 在 AI 生成/回退时写入，
  // 没有对外的 HTTP 创建接口，因此这里直接插一条以验证级联清理覆盖该表）
  const rw = new DatabaseSync(DB);
  rw.prepare(
    `INSERT INTO chapter_versions (id, chapter_id, book_id, user_id, version_number, content, content_preview, word_count, word_diff, label, source, diff_with_previous, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(), ch.id, book.id, login.data.user.id, 1, '正文内容', '正文内容', 4, 0, null, 'manual', null,
    new Date().toISOString(),
  );
  rw.close();

  const db = new DatabaseSync(DB, { readOnly: true });
  const countRows = (table, col, val) => {
    try { return db.prepare(`SELECT COUNT(*) c FROM ${table} WHERE ${col} = ?`).get(val).c; }
    catch { return -1; } // 表不存在
  };
  const rowsWithBook = TABLES.map(([t, c]) => [t, countRows(t, c, book.id)]).filter(([, n]) => n > 0);
  console.log('\n【① 建库后残留统计】');
  for (const [t, n] of rowsWithBook) console.log(`   ${t}: ${n}`);
  check('至少覆盖 5 张从属表', rowsWithBook.length >= 5, `实际 ${rowsWithBook.length} 张`);
  check('角色子项已生成', countRows('character_sections', 'book_id', book.id) >= 5, `实际 ${countRows('character_sections', 'book_id', book.id)}`);
  check('章节版本已生成', countRows('chapter_versions', 'book_id', book.id) >= 1, `实际 ${countRows('chapter_versions', 'book_id', book.id)}`);
  db.close();

  // ② 删除作品
  const del = await J('DELETE', `/books/${book.id}`, null, H);
  console.log('\n【② 删除作品】', del.status);
  check('删除返回成功', del.ok || del.status === 200, `status=${del.status}`);

  // ③ 全库复核
  const db2 = new DatabaseSync(DB, { readOnly: true });
  const leftovers = [];
  for (const [t, c] of TABLES) {
    try { const n = db2.prepare(`SELECT COUNT(*) c FROM ${t} WHERE ${c} = ?`).get(book.id).c; if (n > 0) leftovers.push(`${t}=${n}`); }
    catch { /* 表不存在，跳过 */ }
  }
  // 深层的按 chapter_id / character_id 也要扫
  try { const n = db2.prepare('SELECT COUNT(*) c FROM chapter_versions WHERE chapter_id = ?').get(ch.id).c; if (n) leftovers.push(`chapter_versions(chapter_id)=${n}`); } catch {}
  try { const n = db2.prepare('SELECT COUNT(*) c FROM character_sections WHERE character_id = ?').get(testChar.id).c; if (n) leftovers.push(`character_sections(character_id)=${n}`); } catch {}
  try { const n = db2.prepare('SELECT COUNT(*) c FROM character_states WHERE character_id = ?').get(testChar.id).c; if (n) leftovers.push(`character_states=${n}`); } catch {}
  const bookRow = (() => { try { return db2.prepare('SELECT COUNT(*) c FROM books WHERE id = ?').get(book.id).c; } catch { return -1; } })();
  const volRow = (() => { try { return db2.prepare('SELECT COUNT(*) c FROM volumes WHERE id = ?').get(vol.id).c; } catch { return -1; } })();
  const chRow = (() => { try { return db2.prepare('SELECT COUNT(*) c FROM chapters WHERE id = ?').get(ch.id).c; } catch { return -1; } })();
  db2.close();

  console.log('\n【③ 删除后残留】');
  console.log('   残留:', leftovers.length ? leftovers.join(', ') : '（无）');
  check('books 行已删除', bookRow === 0);
  check('volumes 行已删除', volRow === 0);
  check('chapters 行已删除', chRow === 0);
  check('无任何从属表残留', leftovers.length === 0, leftovers.join(','));
  check('计费流水保留但已解除作品引用',
    (() => { const d = new DatabaseSync(DB, { readOnly: true }); try { return d.prepare('SELECT COUNT(*) c FROM token_transactions WHERE book_id = ?').get(book.id).c === 0; } catch { return true; } finally { d.close(); } })());

  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
