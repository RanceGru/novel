// 测试数据重置：删除 demo 账号下所有作品（级联删除分卷与章节），
// 再建立一份干净数据：作品 + 第1/2卷 + 各卷若干章节（章号 1..3）
const API = 'http://localhost:3000/api/v1';

async function main() {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@novel.com', password: 'demo123456' }),
  })).json();
  if (!login.success) throw new Error('登录失败: ' + JSON.stringify(login));
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.accessToken}` };

  // 1) 清空所有作品
  const books = (await (await fetch(`${API}/books`, { headers: H })).json()).data;
  for (const b of books) {
    await fetch(`${API}/books/${b.id}`, { method: 'DELETE', headers: H });
    console.log('已删除作品:', b.title);
  }

  // 2) 建立干净数据
  const book = (await (await fetch(`${API}/books`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ title: '编号验证用书', author: '测试' }),
  })).json()).data;
  console.log('新建作品:', book.title);

  const mk = async (path, body) =>
    (await (await fetch(`${API}${path}`, { method: 'POST', headers: H, body: JSON.stringify(body) })).json()).data;

  const v1 = await mk(`/books/${book.id}/volumes`, { title: '第一卷·风起', volumeNumber: 1 });
  const v2 = await mk(`/books/${book.id}/volumes`, { title: '第二卷·云涌', volumeNumber: 2 });
  console.log('新建分卷: 第1卷, 第2卷');

  for (const n of [1, 2, 3]) {
    await mk(`/volumes/${v1.id}/chapters`, { title: `第${n}章 测试`, chapterNumber: n });
  }
  console.log('第1卷 建章: 1, 2, 3');

  // 3) 复核
  const vols = (await (await fetch(`${API}/books/${book.id}/volumes`, { headers: H })).json()).data;
  for (const v of vols) {
    const chs = (await (await fetch(`${API}/volumes/${v.id}/chapters`, { headers: H })).json()).data;
    console.log(`  第${v.volumeNumber}卷 「${v.title}」 章号=[${chs.map(c => c.chapterNumber).sort((a, b) => a - b)}]`);
  }
  console.log('\n数据已重置为干净状态');
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
