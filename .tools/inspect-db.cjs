// 直接检视数据库内容，定位数据去向
const { createRequire } = require('module');
const req = createRequire('E:/project/novel/server/package.json');
const Database = req('better-sqlite3');
const db = new Database('E:/project/novel/server/data/novel-dev.sqlite', { readonly: true });

const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all().map(t => t.name);
console.log('表数量:', tables.length);
console.log('\n各表行数:');
for (const t of tables) {
  try {
    const c = db.prepare(`SELECT COUNT(*) c FROM "${t}"`).get().c;
    if (c > 0) console.log(`  ${t.padEnd(28)} ${c}`);
  } catch (e) { /* 跳过无法统计的表 */ }
}

console.log('\nbooks 表内容:');
for (const r of db.prepare('SELECT * FROM books').all()) {
  console.log('  ', JSON.stringify(r));
}

console.log('\nusers 表内容:');
for (const r of db.prepare('SELECT id, email, display_name, created_at FROM users').all()) {
  console.log('  ', JSON.stringify(r));
}

console.log('\noutlines 行数:', db.prepare('SELECT COUNT(*) c FROM outlines').get().c);
console.log('volumes 行数:', db.prepare('SELECT COUNT(*) c FROM volumes').get().c);
console.log('chapters 行数:', db.prepare('SELECT COUNT(*) c FROM chapters').get().c);

db.close();
