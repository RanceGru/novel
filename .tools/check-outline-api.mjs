// 纲树新结构后端验证
// 结构：大纲（单例·只有内容）/ 细纲（单例·容器）→ 卷纲（1:1 分卷）→ 章纲（1:1 章节）
//       每个卷纲自带系统条目「第N卷卷纲」，不可删除
import { loginDemo, makeClient, freshBook } from './test-utils.mjs';

const API = 'http://localhost:3000/api/v1';

let pass = 0, fail = 0;
const check = (label, cond, extra = '') => {
  console.log(`   ${cond ? '✓' : '✗'} ${label}${extra ? ' ' + extra : ''}`);
  cond ? pass++ : fail++;
};

async function main() {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);

  // 清掉上次遗留后新建，保证卷纲编号等断言起点确定
  const book = await freshBook(J, '纲树结构验证');
  console.log('作品:', book.title);

  // ① 分组读取：大纲 + 细纲 均为单例并自动创建
  console.log('\n【① 单例自动创建】');
  let g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('返回四个键', g && ['bookOutline', 'detailedOutline', 'volumes', 'chapters'].every(k => k in g),
    `keys=${Object.keys(g || {}).join(',')}`);
  check('大纲自动创建且标题「大纲」', g.bookOutline?.title === '大纲', `title=${g.bookOutline?.title}`);
  check('细纲自动创建且标题「细纲」', g.detailedOutline?.title === '细纲', `title=${g.detailedOutline?.title}`);
  check('初始卷纲/章纲为空', g.volumes.length === 0 && g.chapters.length === 0);

  const again = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('重复读取不会产生多条大纲/细纲', again.bookOutline.id === g.bookOutline.id && again.detailedOutline.id === g.detailedOutline.id);

  // ② 单例约束
  console.log('\n【② 单例约束】');
  check('新增大纲被拒', (await J('POST', `/books/${book.id}/outlines`, { level: 'book_outline', title: 'x' })).status === 400);
  check('新增细纲被拒', (await J('POST', `/books/${book.id}/outlines`, { level: 'detailed_outline', title: 'x' })).status === 400);
  check('大纲标题不可改', (await J('PATCH', `/books/${book.id}/outlines/${g.bookOutline.id}`, { title: '改名' })).body.data?.title === '大纲');
  check('大纲不可删除', (await J('DELETE', `/books/${book.id}/outlines/${g.bookOutline.id}`)).status === 400);
  check('细纲不可删除', (await J('DELETE', `/books/${book.id}/outlines/${g.detailedOutline.id}`)).status === 400);
  check('大纲内容可改写', (await J('PATCH', `/books/${book.id}/outlines/book-outline`, { content: '全书总纲' })).body.data?.content === '全书总纲');

  // ③ 新建卷纲 -> 自动生成系统条目「第1卷卷纲」
  console.log('\n【③ 卷纲自带系统章纲】');
  const v1 = (await J('POST', `/books/${book.id}/outlines`, { level: 'volume_outline', title: '第一卷·风起' })).body.data;
  check('创建卷纲', !!v1?.id && v1.level === 'volume_outline');
  check('卷纲挂在细纲下', v1.parentId === g.detailedOutline.id);

  g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  const sys = g.chapters.filter(c => c.parentId === v1.id);
  check('自动创建了 1 条章纲', sys.length === 1, `count=${sys.length}`);
  check('系统章纲标题为「第1卷卷纲」', sys[0]?.title === '第1卷卷纲', `title=${sys[0]?.title}`);
  check('系统章纲 isSystem=true', sys[0]?.isSystem === true);
  check('系统章纲不可删除', (await J('DELETE', `/books/${book.id}/outlines/${sys[0].id}`)).status === 400);
  const sysRenamed = await J('PATCH', `/books/${book.id}/outlines/${sys[0].id}`, { title: '改名试试' });
  check('系统章纲标题不可改', sysRenamed.body.data?.title === '第1卷卷纲', `title=${sysRenamed.body.data?.title}`);
  check('系统章纲内容可改写',
    (await J('PATCH', `/books/${book.id}/outlines/${sys[0].id}`, { content: '本卷讲述主角初入江湖' })).body.data?.content === '本卷讲述主角初入江湖');

  // 第二个卷纲的编号
  const v2 = (await J('POST', `/books/${book.id}/outlines`, { level: 'volume_outline', title: '第二卷·云涌' })).body.data;
  g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  const sys2 = g.chapters.find(c => c.parentId === v2.id);
  check('第二个卷纲的系统条目为「第2卷卷纲」', sys2?.title === '第2卷卷纲', `title=${sys2?.title}`);

  // ④ 普通章纲
  console.log('\n【④ 普通章纲】');
  const c1 = (await J('POST', `/books/${book.id}/outlines`, { level: 'chapter_outline', title: '第1章 起点', content: '主角登场', parentId: v1.id })).body.data;
  check('创建普通章纲', !!c1?.id && c1.isSystem === false);
  check('普通章纲可改名', (await J('PATCH', `/books/${book.id}/outlines/${c1.id}`, { title: '第1章 伊始' })).body.data?.title === '第1章 伊始');
  check('无 parentId 的章纲被拒', (await J('POST', `/books/${book.id}/outlines`, { level: 'chapter_outline', title: '无主' })).status === 400);
  g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  const kids = g.chapters.filter(c => c.parentId === v1.id).sort((a, b) => a.sortOrder - b.sortOrder);
  check('普通章纲排在系统条目之后', kids[0]?.isSystem === true && kids[1]?.title === '第1章 伊始',
    `order=${kids.map(k => k.title).join(' | ')}`);

  // ⑤ 生成下游产物
  console.log('\n【⑤ 生成分卷与章节】');
  const genVol = await J('POST', `/books/${book.id}/outlines/${v1.id}/generate-volume`);
  check('卷纲可生成分卷', genVol.ok && !!genVol.body.data?.id, `HTTP ${genVol.status}`);
  check('同一卷纲不能重复生成分卷', (await J('POST', `/books/${book.id}/outlines/${v1.id}/generate-volume`)).status === 400);

  const genCh = await J('POST', `/books/${book.id}/outlines/${c1.id}/generate-chapter`);
  check('章纲可生成章节（复用已生成的分卷）', genCh.ok && genCh.body.data?.volumeId === genVol.body.data.id,
    `volumeId=${genCh.body.data?.volumeId === genVol.body.data.id}`);
  check('章节快照写入章纲内容', genCh.body.data?.chapter?.chapterOutline === '主角登场');
  check('章节写入快照指纹', !!genCh.body.data?.chapter?.outlineHash);
  check('同一章纲不能重复生成章节', (await J('POST', `/books/${book.id}/outlines/${c1.id}/generate-chapter`)).status === 400);

  // ⑥ 改动检测
  console.log('\n【⑥ 章纲改动检测】');
  g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('刚生成后为 synced', g.chapters.find(c => c.id === c1.id).syncState === 'synced');
  await J('PATCH', `/books/${book.id}/outlines/${c1.id}`, { content: '主角登场（补充：捡到玉佩）' });
  g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('章纲改动后为 changed', g.chapters.find(c => c.id === c1.id).syncState === 'changed');
  const chId = genCh.body.data.chapter.id;
  const chNow = (await J('GET', `/volumes/${genVol.body.data.id}/chapters/${chId}`)).body.data;
  check('正文快照未被自动改写', chNow.chapterOutline === '主角登场', `snapshot=${chNow.chapterOutline}`);
  await J('PATCH', `/books/${book.id}/outlines/${c1.id}`, { content: '主角登场' });
  g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('改回原内容后恢复 synced', g.chapters.find(c => c.id === c1.id).syncState === 'synced');

  // ⑦ 删除章纲不删正文
  console.log('\n【⑦ 删除行为】');
  await J('DELETE', `/books/${book.id}/outlines/${c1.id}`);
  const chStill = (await J('GET', `/volumes/${genVol.body.data.id}/chapters/${chId}`)).body.data;
  check('删除章纲不影响已生成的正文', !!chStill?.id);
  g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('系统条目仍在', g.chapters.some(c => c.parentId === v1.id && c.isSystem === true));

  // ⑧ 删除卷纲级联章纲
  console.log('\n【⑧ 删除卷纲】');
  await J('DELETE', `/books/${book.id}/outlines/${v1.id}`);
  g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('卷纲已删', !g.volumes.some(v => v.id === v1.id));
  check('其下章纲（含系统条目）已级联删除', !g.chapters.some(c => c.parentId === v1.id));

  await J('DELETE', `/books/${book.id}`);
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
