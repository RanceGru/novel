// 检查删除作品后的孤儿数据
const { createRequire } = require('module');
const req = createRequire('E:/project/novel/server/package.json');
const Database = req('better-sqlite3');
const db = new Database('E:/project/novel/server/data/novel-dev.sqlite', { readonly: true });

const bookIds = new Set(db.prepare('SELECT id FROM books').all().map(r => r.id));
console.log('现存作品数:', bookIds.size);

const outlines = db.prepare('SELECT id, book_id, level, title, parent_id, generated_chapter_id, generated_volume_id FROM outlines').all();
const orphanOutlines = outlines.filter(o => !bookIds.has(o.book_id));
console.log(`\noutlines 总 ${outlines.length} 行，孤儿 ${orphanOutlines.length} 行`);
const byLevel = {};
for (const o of orphanOutlines) byLevel[o.level] = (byLevel[o.level] || 0) + 1;
console.log('孤儿按 level 分布:', JSON.stringify(byLevel));
console.log('涉及的不同 book_id 数:', new Set(orphanOutlines.map(o => o.book_id)).size);

const chapters = db.prepare('SELECT id, volume_id, title, chapter_number FROM chapters').all();
console.log(`\nchapters 总 ${chapters.length} 行`);
const volumeIds = new Set(db.prepare('SELECT id FROM volumes').all().map(r => r.id));
const orphanChapters = chapters.filter(c => !volumeIds.has(c.volume_id));
console.log(`  孤儿（所属分卷不存在）: ${orphanChapters.length} 行`);
for (const c of orphanChapters) console.log(`    「${c.title}」 volume_id=${c.volume_id?.slice(0, 8)}`);

// 纲树里引用了已删除章节的
const chapterIds = new Set(chapters.map(c => c.id));
const danglingRefs = outlines.filter(o => o.generated_chapter_id && !chapterIds.has(o.generated_chapter_id));
console.log(`\noutlines 中 generated_chapter_id 指向不存在章节: ${danglingRefs.length} 行`);

// 纲树里 parent 指向不存在节点的
const outlineIds = new Set(outlines.map(o => o.id));
const danglingParents = outlines.filter(o => o.parent_id && !outlineIds.has(o.parent_id));
console.log(`outlines 中 parent_id 指向不存在节点: ${danglingParents.length} 行`);

db.close();
