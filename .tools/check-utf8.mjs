// 中文编码端到端校验：用 UTF-8 正确发送中文并读回，确认服务端与数据库编码正常
const API = 'http://localhost:3000/api/v1';

async function main() {
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test@novel.com', password: 'test123456' }),
  });
  const login = await loginRes.json();
  const token = login.data.accessToken;
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const title = '剑起长安';
  const author = '云中客';
  const desc = '一个关于少年剑客与家国山河的故事——测试中文往返。';

  const created = await (
    await fetch(`${API}/books`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ title, author, description: desc }),
    })
  ).json();
  const id = created.data.id;

  const readBack = await (await fetch(`${API}/books/${id}`, { headers: H })).json();

  const check = (label, got, want) =>
    console.log(`${got === want ? '✓' : '✗'} ${label}: 期望「${want}」 实得「${got}」`);

  check('title', readBack.data.title, title);
  check('author', readBack.data.author, author);
  check('description', readBack.data.description, desc);

  // 中文纲树节点
  const outlineRes = await (
    await fetch(`${API}/books/${id}/outlines`, {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ level: 'book_outline', title: '第一卷·风起云涌', content: '开篇布局' }),
    })
  ).json();
  const tree = await (await fetch(`${API}/books/${id}/outlines`, { headers: H })).json();
  check('outline.title', tree.data[0]?.title, '第一卷·风起云涌');
  check('outline.content', tree.data[0]?.content, '开篇布局');

  // 清理测试数据
  await fetch(`${API}/books/${id}`, { method: 'DELETE', headers: H });
  console.log('已清理测试书籍');
}

main().catch((e) => {
  console.error('校验失败:', e);
  process.exit(1);
});
