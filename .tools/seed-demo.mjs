// 创建「示例作品」演示纲树结构（用 fetch 发送，确保中文以 UTF-8 正确写入）
const API = 'http://localhost:3000/api/v1';

async function main() {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@novel.com', password: 'demo123456' }),
  })).json();
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.accessToken}` };
  const J = async (m, p, b) => {
    const r = await fetch(`${API}${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
    return (await r.json().catch(() => ({}))).data;
  };

  // 清掉上一次编码损坏的示例作品
  for (const b of await J('GET', '/books')) {
    if (b.title.includes('??') || b.title === '示例作品') {
      await fetch(`${API}/books/${b.id}`, { method: 'DELETE', headers: H });
      console.log('已清理旧示例作品');
    }
  }

  const book = await J('POST', '/books', {
    title: '示例作品', author: 'demo', description: '用于展示纲树结构的示例',
  });
  console.log('① 新建作品:', book.title);

  await J('PATCH', `/books/${book.id}/outlines/book-outline`, {
    content: '全书总纲：\n少年林逸自边城起势，历经门派倾轧与家国动荡，最终揭开自身身世之谜。',
  });
  console.log('② 写入大纲内容');

  const v1 = await J('POST', `/books/${book.id}/outlines`, { level: 'volume_outline', title: '第一卷 风起边城' });
  const v2 = await J('POST', `/books/${book.id}/outlines`, { level: 'volume_outline', title: '第二卷 云涌京华' });
  console.log('③ 新建两个卷纲（各自自动带出系统章纲）');

  let g = await J('GET', `/books/${book.id}/outlines`);
  const sys1 = g.chapters.find(c => c.parentId === v1.id && c.isSystem);
  await J('PATCH', `/books/${book.id}/outlines/${sys1.id}`, {
    content: '本卷讲述林逸在边城初露锋芒，卷入一桩灭门旧案，结识挚友与宿敌。',
  });
  console.log('④ 填写卷纲摘要:', sys1.title);

  for (const i of [1, 2]) {
    await J('POST', `/books/${book.id}/outlines`, {
      level: 'chapter_outline', title: `第${i}章 章纲${i}`,
      content: `第${i}章要点：核心场景与情节推进。`, parentId: v1.id,
    });
  }
  console.log('⑤ 新建两条章纲');

  g = await J('GET', `/books/${book.id}/outlines`);
  console.log('\n=== 纲树结构 ===');
  console.log('大纲:', g.bookOutline.content ? '已填写' : '空');
  for (const v of g.volumes) {
    console.log(`卷纲「${v.title}」`);
    for (const c of g.chapters.filter(x => x.parentId === v.id).sort((a, b) => a.sortOrder - b.sortOrder)) {
      console.log(`   - ${c.title}${c.isSystem ? '   [系统条目·不可删除]' : ''}`);
    }
  }
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
