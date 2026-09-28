// 角色界面测试后的数据恢复：把被测试改过的角色/子项名改回原样
// （测试过程会把「林逸」改成「林逸尘」、「外貌」改成「外貌特征」并新建/删除临时角色）
const API = 'http://localhost:3000/api/v1';
const J = async (m, p, b, H) => {
  const r = await fetch(`${API}${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
  return { status: r.status, body: await r.json().catch(() => ({})) };
};

async function main() {
  const login = (await J('POST', '/auth/login', { email: 'demo@novel.com', password: 'demo123456' }, { 'Content-Type': 'application/json' })).body;
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.accessToken}` };
  const books = (await J('GET', '/books', null, H)).body.data;
  const book = books.find(b => b.title === '示例作品') || books[0];
  if (!book) throw new Error('没有作品');

  const fix = { 林逸尘: '林逸', 外貌特征: '外貌' };
  const chars = (await J('GET', `/books/${book.id}/characters`, null, H)).body.data;
  for (const c of chars) {
    if (fix[c.name]) {
      await J('PATCH', `/books/${book.id}/characters/${c.id}`, { name: fix[c.name] }, H);
      console.log(`角色改名: ${c.name} → ${fix[c.name]}`);
    }
  }
  const secs = (await J('GET', `/books/${book.id}/characters/sections`, null, H)).body.data;
  for (const s of secs) {
    if (fix[s.title]) {
      await J('PATCH', `/books/${book.id}/characters/sections/${s.id}`, { title: fix[s.title] }, H);
      console.log(`子项改名: ${s.title} → ${fix[s.title]}`);
    }
  }
  // 清掉测试遗留的临时角色
  for (const c of chars) {
    if (/待删除|验证/.test(c.name)) {
      await J('DELETE', `/books/${book.id}/characters/${c.id}`, null, H);
      console.log('删除临时角色:', c.name);
    }
  }
  const after = (await J('GET', `/books/${book.id}/characters`, null, H)).body.data;
  const afterSecs = (await J('GET', `/books/${book.id}/characters/sections`, null, H)).body.data;
  console.log('角色:', after.map(c => c.name).join(', '));
  console.log('子项:', afterSecs.map(s => s.title).join(', '));
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
