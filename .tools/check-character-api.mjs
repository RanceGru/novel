// 角色子项 后端验证：自动带出默认子项 / 增删改 / 分组读取 / 级联清理
const API = 'http://localhost:3000/api/v1';

let pass = 0, fail = 0;
const check = (l, c, extra = '') => { console.log(`   ${c ? '✓' : '✗'} ${l}${extra ? ' ' + extra : ''}`); c ? pass++ : fail++; };

async function main() {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@novel.com', password: 'demo123456' }),
  })).json();
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.accessToken}` };
  const J = async (m, p, b) => {
    const r = await fetch(`${API}${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
    return { status: r.status, ok: r.ok, body: await r.json().catch(() => ({})) };
  };

  const book = (await J('POST', '/books', { title: '角色子项验证' })).body.data;
  console.log('作品:', book.title);

  // ① 新建角色自动带出 5 个默认子项
  console.log('\n【① 新建角色自动带出默认子项】');
  const ch = (await J('POST', `/books/${book.id}/characters`, {
    name: '林逸', category: 'protagonist', background: '边城少年，自幼父母双亡',
  })).body.data;
  check('角色已创建', !!ch?.id);

  let secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  const mine = secs.filter(s => s.characterId === ch.id);
  console.log('   自动子项:', mine.map(s => s.title).join(', '));
  check('自动带出 5 个默认子项', mine.length === 5, `count=${mine.length}`);
  check('标题为 背景/性格/能力/外貌/目标',
    ['背景', '性格', '能力', '外貌', '目标'].every(t => mine.some(s => s.title === t)));
  check('旧字段内容迁入「背景」子项',
    mine.find(s => s.title === '背景')?.content === '边城少年，自幼父母双亡');

  // ② 新建子项（无序号）
  console.log('\n【② 新建子项】');
  const s1 = (await J('POST', `/books/${book.id}/characters/${ch.id}/sections`, { title: '感情线' })).body.data;
  check('子项已创建', !!s1?.id && s1.title === '感情线');
  check('子项不带序号字段', !('number' in s1) && !('chapterNumber' in s1));
  const s2 = (await J('POST', `/books/${book.id}/characters/${ch.id}/sections`, { title: '成长节点', content: '初入江湖 → 拜师 → 悟道' })).body.data;
  check('第二条子项已创建', !!s2?.id);

  // ③ 改名与改内容
  console.log('\n【③ 修改子项】');
  const renamed = (await J('PATCH', `/books/${book.id}/characters/sections/${s1.id}`, { title: '感情线（改）' })).body.data;
  check('子项可改名', renamed?.title === '感情线（改）');
  const edited = (await J('PATCH', `/books/${book.id}/characters/sections/${s2.id}`, { content: '内容已更新' })).body.data;
  check('子项可改内容', edited?.content === '内容已更新');

  // ④ 分组读取
  console.log('\n【④ 分组读取】');
  secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('按 characterId 可筛出该角色的子项', secs.filter(s => s.characterId === ch.id).length === 7,
    `count=${secs.filter(s => s.characterId === ch.id).length}`);

  // ⑤ 越权与不存在
  console.log('\n【⑤ 边界】');
  check('不存在的角色不能建子项',
    (await J('POST', `/books/${book.id}/characters/00000000-0000-0000-0000-000000000000/sections`, { title: 'x' })).status === 404);
  check('不存在的子项不能改',
    (await J('PATCH', `/books/${book.id}/characters/sections/00000000-0000-0000-0000-000000000000`, { title: 'x' })).status === 404);

  // ⑥ 删除子项
  console.log('\n【⑥ 删除子项】');
  check('子项可删除', (await J('DELETE', `/books/${book.id}/characters/sections/${s1.id}`)).ok);
  secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('删除后不再返回', !secs.some(s => s.id === s1.id));

  // ⑦ 删除角色级联清理子项
  console.log('\n【⑦ 删除角色级联清理子项】');
  await J('DELETE', `/books/${book.id}/characters/${ch.id}`);
  secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('该角色的子项已全部清理', !secs.some(s => s.characterId === ch.id),
    `剩余=${secs.filter(s => s.characterId === ch.id).length}`);

  await J('DELETE', `/books/${book.id}`);
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
