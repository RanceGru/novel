// 一次性数据修复：把「正文改纯文本」之前留下的 HTML 正文清理干净，并重算字数。
//
// 背景：正文原先用 Tiptap 富文本（存 HTML），现已改为纯文本。历史行可能仍带标签，
// 会造成字数虚高、txt 导出带标签、doc 导出嵌套。本脚本按类型分别处理：
//   · 含 HTML 标签的行 → 剥标签后写回纯文本
//   · 字数全部按「去空白字符数」重算（与后端 countWords 口径一致）
// 默认只报告，加 --apply 才写库。
import { DatabaseSync } from 'node:sqlite';

const DB = 'E:/project/novel/server/data/novel-dev.sqlite';
const APPLY = process.argv.includes('--apply');

/** 与后端 server/src/common/utils/text.util.ts 保持一致 */
function stripHtml(input) {
  if (!input) return '';
  return String(input)
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|h[1-6]|li|blockquote)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
const countWords = (s) => stripHtml(s).replace(/\s/g, '').length;
const hasHtml = (s) => /<[a-z][\s\S]*>/i.test(s || '');

const db = new DatabaseSync(DB);
console.log(APPLY ? '模式: 实际写库\n' : '模式: 只报告（加 --apply 才写库）\n');

const chapters = db.prepare('SELECT id,title,content,word_count FROM chapters').all();
let cleaned = 0, recounted = 0;
db.exec('BEGIN');
for (const c of chapters) {
  const plain = stripHtml(c.content);
  const next = countWords(c.content);
  const needClean = hasHtml(c.content);
  const needCount = c.word_count !== next;
  if (!needClean && !needCount) continue;

  if (needClean) {
    console.log(`  剥标签: ${c.title}  ${(c.content || '').length} → ${plain.length} 字符`);
    if (APPLY) db.prepare('UPDATE chapters SET content = ? WHERE id = ?').run(plain, c.id);
    cleaned++;
  }
  if (needCount) {
    console.log(`  重算字数: ${c.title}  ${c.word_count} → ${next}`);
    if (APPLY) db.prepare('UPDATE chapters SET word_count = ? WHERE id = ?').run(next, c.id);
    recounted++;
  }
}

// 作品字数 = 其下章节字数之和（与后端 updateWordCount 同一口径）
let books = 0;
for (const b of db.prepare('SELECT id,title,word_count FROM books').all()) {
  const total = db.prepare(`
    SELECT COALESCE(SUM(c.word_count),0) t
    FROM chapters c JOIN volumes v ON v.id = c.volume_id
    WHERE v.book_id = ?
  `).get(b.id).t;
  if (b.word_count !== total) {
    console.log(`  作品字数: ${b.title}  ${b.word_count} → ${total}`);
    if (APPLY) db.prepare('UPDATE books SET word_count = ? WHERE id = ?').run(total, b.id);
    books++;
  }
}
db.exec(APPLY ? 'COMMIT' : 'ROLLBACK');
console.log(`\n${APPLY ? '已处理' : '待处理'}: 正文剥标签 ${cleaned} 章，字数重算 ${recounted} 章，作品字数 ${books} 本`);
db.close();
