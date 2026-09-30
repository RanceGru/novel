// 验证「新建文本」：
//   ① 功能区「新建作品」下面有「新建文本」按钮
//   ② 点击后中间区域打开空白文本，面包屑显示「未保存文本」
//   ③ 输入内容后点保存 → 弹出「保存到」弹窗，提供 6 类落点
//   ④ 依次验证各类落点真的能建出来：分卷下新章节 / 分卷外章节 / 细纲卷纲 /
//      细纲章纲 / 角色子项 / 世界观条目，且内容随之一并写入
import { loginDemo, makeClient, freshBook, seedBook, selectBookInUi } from './test-utils.mjs';

const PORT = Number(process.env.PORT || 9260);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (l, c, extra = '') => { console.log(`   ${c ? '✓' : '✗'} ${l}${extra ? ' ' + extra : ''}`); c ? pass++ : fail++; };

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) { const { resolve } = this.pending.get(m.id); this.pending.delete(m.id); resolve(m.result); }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve) => {
      this.pending.set(id, { resolve });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); resolve({ __timeout: true }); } }, 15000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || '').slice(0, 300) };
    return r.result.value;
  }
}

const setValue = (selector, value) => `
  (() => {
    const el=document.querySelector(${JSON.stringify(selector)});
    if(!el) return 'no-el';
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const set=Object.getOwnPropertyDescriptor(proto,'value').set;
    set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true}));
    return 'ok';
  })()
`;
const crumb = `
  (() => {
    const nav=document.querySelector('[data-role="editor-breadcrumb"]');
    return nav ? nav.getAttribute('title') : null;
  })()
`;

/**
 * 走一遍新流程：新建文本 → 写内容 → 保存 → 按「位置」逐级下钻 → 选目标 → 改名 → 保存
 * @param drill 面包屑层级上的进入顺序，如 ['目录', '第1卷 …'] 表示先点「目录」再点该分卷
 * @param targetKey 目标行的 key（data-role="save-row-<key>"）
 */
async function newTextAndSave(cdp, { drill, targetKey, title, content }) {
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="new-text"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1200);
  await cdp.eval(setValue('[data-role="draft-content"]', content));
  await sleep(300);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="draft-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(2500);

  // 逐级下钻：每级按标签找到对应的「进入」行并点击
  for (const label of drill) {
    const hit = await cdp.eval(`
      (() => {
        const rows=[...document.querySelectorAll('[data-role^="save-row-"]')]
          .filter(r => r.getAttribute('data-row-kind') !== 'disabled');
        const t=rows.find(r => (r.textContent||'').trim().startsWith(${JSON.stringify(label)}));
        if(!t) return 'not-found:' + rows.map(r=>(r.textContent||'').trim().slice(0,14)).join('|');
        t.click(); return 'clicked';
      })()
    `);
    if (hit !== 'clicked') throw new Error(`下钻「${label}」失败: ${hit}`);
    await sleep(1500);
  }

  // 选目标（可保存的项）
  const picked = await cdp.eval(`
    (() => {
      const r=document.querySelector('[data-role="save-row-${targetKey}"]');
      if(!r) return 'no-target';
      r.click(); return 'clicked';
    })()
  `);
  if (picked !== 'clicked') throw new Error(`选择目标 ${targetKey} 失败: ${picked}`);
  await sleep(1200);
  await cdp.eval(setValue('[data-role="draft-title"]', title));
  await sleep(300);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="confirm-save-draft"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(3000);
}

async function main() {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);
  const book = await freshBook(J, '新建文本验证书');
  const { volumes } = await seedBook(J, book.id, { volumeCount: 1, chaptersOfFirst: 1 });
  await J('POST', `/books/${book.id}/characters`, { name: '林逸', category: 'protagonist' });
  const vol = volumes.find((v) => v.volumeNumber === 1);

  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const t = list.find((x) => x.type === 'page' && x.url.includes('5173'));
  if (!t) throw new Error(`未找到窗口（调试端口 ${PORT}）`);
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.send('Page.reload');
  await sleep(8000);

  console.log('选择作品:', await cdp.eval(selectBookInUi(book.title)));
  await sleep(2500);

  // ===== ① 按钮存在，且位于「新建作品」下面 =====
  console.log('\n【① 功能区按钮】');
  const btns = await cdp.eval(`
    (() => {
      const all=[...document.querySelectorAll('button')].filter(b=>/新建作品|新建文本/.test(b.textContent||''));
      return all.map(b=>({ 文本:(b.textContent||'').trim(), top:Math.round(b.getBoundingClientRect().top) }));
    })()
  `);
  console.log('   按钮:', JSON.stringify(btns));
  check('存在「新建文本」按钮', btns.some((b) => b.文本.includes('新建文本')));
  const bNew = btns.find((b) => b.文本.includes('新建作品'));
  const bText = btns.find((b) => b.文本.includes('新建文本'));
  check('它排在「新建作品」下面', !!bNew && !!bText && bText.top > bNew.top, `作品top=${bNew?.top} 文本top=${bText?.top}`);

  // ===== ①b 「保存」按钮任何时候都可用，点了必须弹窗 =====
  // 之前没先选作品时该按钮是 disabled，用户点了没反应（看起来像坏了）
  console.log('\n【①b 保存按钮始终可点并弹窗】');
  await cdp.send('Page.reload');
  await sleep(8000);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="new-text"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1500);
  const btnState = await cdp.eval(`
    (() => {
      const b=document.querySelector('[data-role="draft-save"]');
      if(!b) return { found:false };
      return { found:true, 禁用:b.disabled, 透明度:getComputedStyle(b).opacity };
    })()
  `);
  console.log('   未选作品时的按钮:', JSON.stringify(btnState));
  check('保存按钮未被禁用', btnState.found && !btnState.禁用, JSON.stringify(btnState));
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="draft-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(3000);
  const dialogOnFresh = await cdp.eval(`
    (() => {
      const d=document.querySelector('[data-role="save-draft-dialog"]');
      if(!d) return { open:false };
      return {
        open:true,
        列表: [...d.querySelectorAll('[data-role^="save-row-"]')].map(b=>(b.textContent||'').trim().slice(0,10)),
        有位置面包屑: !!d.querySelector('[data-role="save-crumbs"]'),
      };
    })()
  `);
  console.log('   点保存后:', JSON.stringify(dialogOnFresh));
  check('点了就弹出选择保存位置的窗口', dialogOnFresh.open, JSON.stringify(dialogOnFresh));
  check('弹窗里有可进入的位置', (dialogOnFresh.列表 || []).length >= 2, JSON.stringify(dialogOnFresh.列表));
  check('弹窗按「位置」组织（面包屑）', dialogOnFresh.有位置面包屑);
  await cdp.eval(`(() => { const d=document.querySelector('[data-role="save-draft-dialog"]'); const b=[...d.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='取消'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1000);
  // 回到选中该作品的干净状态，继续后面的用例
  await cdp.send('Page.reload');
  await sleep(8000);
  console.log('   重新选作品:', await cdp.eval(selectBookInUi(book.title)));
  await sleep(2500);

  // ===== ② 打开空白文本 =====
  console.log('\n【② 打开空白文本】');
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="new-text"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1500);
  const opened = await cdp.eval(`
    (() => ({
      有草稿框: !!document.querySelector('[data-role="draft-content"]'),
      草稿内容: document.querySelector('[data-role="draft-content"]')?.value,
      面包屑: ${crumb},
      有正文编辑器: !!document.querySelector('[data-role="chapter-content"]'),
    }))()
  `);
  console.log('   状态:', JSON.stringify(opened));
  check('中间区域变成空白文本', opened.有草稿框 && opened.草稿内容 === '');
  check('面包屑显示「未保存文本」', opened.面包屑 === '未保存文本', JSON.stringify(opened.面包屑));
  check('不是正文编辑器', !opened.有正文编辑器);

  // ===== ③ 保存弹窗（Windows「另存为」式：位置面包屑 + 可下钻列表 + 文件名） =====
  console.log('\n【③ 保存弹窗布局】');
  await cdp.eval(setValue('[data-role="draft-content"]', '这是草稿里的内容。'));
  await sleep(300);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="draft-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(2500);
  const dlg = await cdp.eval(`
    (() => {
      const d=document.querySelector('[data-role="save-draft-dialog"]');
      if(!d) return { open:false };
      const rows=[...d.querySelectorAll('[data-role^="save-row-"]')];
      return {
        open:true,
        有位置面包屑: !!d.querySelector('[data-role="save-crumbs"]'),
        面包屑段: [...d.querySelectorAll('[data-role="save-crumbs"] button')].map(b=>(b.textContent||'').trim()),
        一级列表: rows.map(b=>(b.textContent||'').trim().slice(0,12)),
        有文件名输入: !!d.querySelector('[data-role="draft-title"]'),
        有保存按钮: !!d.querySelector('[data-role="confirm-save-draft"]'),
        有预览: (d.textContent||'').includes('内容预览'),
      };
    })()
  `);
  console.log('   弹窗:', JSON.stringify(dlg));
  check('弹出「保存到」窗口', dlg.open);
  check('有「位置」面包屑区', dlg.有位置面包屑);
  // 打开时还没选作品：面包屑为空并提示选择，一级列表是「作品」列表
  check('未选作品时面包屑为空（提示选择）', (dlg.面包屑段 || []).length === 0, JSON.stringify(dlg.面包屑段));
  check('一级列出作品供选择', (dlg.一级列表 || []).some((x) => x.startsWith(book.title.slice(0, 6))),
    JSON.stringify(dlg.一级列表));
  check('有「文件名」输入框', dlg.有文件名输入);
  check('有保存/取消按钮', dlg.有保存按钮);
  check('有内容预览', dlg.有预览);

  // 逐级下钻：作品 → 目录 → 分卷 → 新建章节
  // 注意：行的 data-role 是 save-row-<key>，按标签匹配时取元素文本更稳。
  const rowsNow = `
    (() => {
      const d=document.querySelector('[data-role="save-draft-dialog"]');
      if(!d) return { 面包屑:[], 列表:[] };
      return {
        面包屑: [...d.querySelectorAll('[data-role="save-crumbs"] button')].map(b=>(b.textContent||'').trim()),
        列表: [...d.querySelectorAll('[data-role^="save-row-"]')].map(b=>({
          文本:(b.textContent||'').trim(),
          角色:b.getAttribute('data-role'),
          类型:b.getAttribute('data-row-kind'),
        })),
      };
    })()
  `;
  const clickRowByText = (label) => `
    (() => {
      const rows=[...document.querySelectorAll('[data-role^="save-row-"]')]
        .filter(b=>b.getAttribute('data-row-kind')!=='disabled');
      const t=rows.find(b=>(b.textContent||'').trim().startsWith(${JSON.stringify(label)}));
      if(!t) return 'not-found';
      t.click(); return 'clicked';
    })()
  `;

  // 最上层应先列作品
  const lvl1 = await cdp.eval(rowsNow);
  console.log('   一级（作品列表）:', JSON.stringify((lvl1.列表 || []).map((x) => x.文本)));
  check('最上层列出所有作品供选择',
    (lvl1.列表 || []).some((x) => x.文本.startsWith(book.title)),
    JSON.stringify((lvl1.列表 || []).map((x) => x.文本)));
  check('未选作品时面包屑提示选择', (lvl1.面包屑 || []).length === 0, JSON.stringify(lvl1.面包屑));

  console.log('   下钻 作品 → 目录:');
  const drill0 = await cdp.eval(clickRowByText(book.title));
  await sleep(2000);
  const lvl1b = await cdp.eval(rowsNow);
  console.log('     ', drill0, JSON.stringify(lvl1b));
  check('选中作品后面包屑显示作品名', (lvl1b.面包屑 || []).includes(book.title), JSON.stringify(lvl1b.面包屑));
  check('作品下列出目录与相关',
    (lvl1b.列表 || []).some((x) => x.文本.startsWith('目录')) && (lvl1b.列表 || []).some((x) => x.文本.startsWith('相关')),
    JSON.stringify((lvl1b.列表 || []).map((x) => x.文本)));

  const drill1 = await cdp.eval(clickRowByText('目录'));
  await sleep(1500);
  const lvl2 = await cdp.eval(rowsNow);
  console.log('     ', drill1, JSON.stringify(lvl2));
  check('进入「目录」后面包屑增加一段', (lvl2.面包屑 || []).includes('目录'), JSON.stringify(lvl2.面包屑));
  check('列出分卷与分卷外章节',
    (lvl2.列表 || []).some((x) => x.文本.startsWith('第1卷')) && (lvl2.列表 || []).some((x) => x.文本.startsWith('分卷外章节')),
    JSON.stringify((lvl2.列表 || []).map((x) => x.文本)));

  // 「上一层」按键应可用，并能退回作品层
  const upDisabled = await cdp.eval(`(document.querySelector('[data-role="crumb-up"]')||{}).disabled`);
  check('「上一层」按键可用', upDisabled === false, String(upDisabled));
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="crumb-up"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1500);
  const afterUp = await cdp.eval(rowsNow);
  console.log('     上一层 →', JSON.stringify(afterUp.面包屑));
  check('点「上一层」回退到作品层',
    (afterUp.面包屑 || []).includes(book.title) && !(afterUp.面包屑 || []).includes('目录'),
    JSON.stringify(afterUp.面包屑));
  // 回到分卷继续后面的断言
  await cdp.eval(clickRowByText('目录'));
  await sleep(1500);
  await cdp.eval(clickRowByText('第1卷'));
  await sleep(1500);
  const lvl3 = await cdp.eval(rowsNow);
  console.log('     进入分卷:', JSON.stringify(lvl3.面包屑));
  check('进入分卷后出现「新建章节」',
    (lvl3.列表 || []).some((x) => x.文本.startsWith('新建章节')), JSON.stringify((lvl3.列表 || []).map((x) => x.文本)));
  check('并列展示已有章节（仅展示，不可选）',
    (lvl3.列表 || []).some((x) => x.文本.startsWith('第1章') && x.类型 === 'disabled'),
    JSON.stringify((lvl3.列表 || []).map((x) => ({ t: x.文本, k: x.类型 }))));

  // 点「新建章节」→ 文件名自动预填
  await cdp.eval(clickRowByText('新建章节'));
  await sleep(1200);
  const prefill = await cdp.eval(`(document.querySelector('[data-role="draft-title"]')||{}).value`);
  console.log('     默认文件名:', JSON.stringify(prefill));
  check('选中后文件名自动预填', !!prefill && prefill.includes('第'), JSON.stringify(prefill));
  // 点面包屑里的作品段（crumb-1）→ 回到作品层（列出目录/相关）
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="crumb-1"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1500);
  const backRoot = await cdp.eval(`
    [...document.querySelectorAll('[data-role^="save-row-"]')].map(b=>(b.textContent||'').trim())
  `);
  check('点面包屑里的作品可回到作品层（目录/相关）',
    (backRoot || []).some((x) => x.startsWith('目录')) && (backRoot || []).some((x) => x.startsWith('相关')),
    JSON.stringify(backRoot));
  // 取消
  await cdp.eval(`(() => { const d=document.querySelector('[data-role="save-draft-dialog"]'); const b=[...d.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='取消'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1200);
  check('取消后弹窗关闭', !(await cdp.eval(`!!document.querySelector('[data-role="save-draft-dialog"]')`)));

  // ===== ④ 各落点逐一验证（按下钻路径） =====
  console.log('\n【④ 存成：分卷下的新章节】');
  await newTextAndSave(cdp, {
    drill: [book.title, '目录', `第1卷`], targetKey: 'new-chapter',
    title: '第9章 草稿章节', content: '分卷内章节内容。',
  });
  let chs = (await J('GET', `/volumes/${vol.id}/chapters`)).body.data;
  const newCh = chs.find((c) => c.title === '第9章 草稿章节');
  check('分卷下新章节已创建', !!newCh, chs.map((c) => c.title).join(','));
  // 「落点决定内容归属」：存成章节，这段文字就成了该章节的正文
  const chDetail = newCh ? (await J('GET', `/volumes/${vol.id}/chapters/${newCh.id}`)).body.data : null;
  console.log('   库里章节内容:', JSON.stringify(chDetail?.content));
  console.log('   界面正文框值:', JSON.stringify(await cdp.eval(`(document.querySelector('[data-role="chapter-content"]')||{}).value`)));
  check('章节正文就是草稿内容', (chDetail?.content || '').includes('分卷内章节内容'),
    JSON.stringify(chDetail?.content));
  // 保存后会自动打开该章节；等一次自动保存（3 秒防抖）落库再继续
  await sleep(5000);
  const afterAutoSave = newCh ? (await J('GET', `/volumes/${vol.id}/chapters/${newCh.id}`)).body.data : null;
  check('自动保存后内容未被清空', (afterAutoSave?.content || '').includes('分卷内章节内容'),
    JSON.stringify(afterAutoSave?.content));
  check('保存后切到该章节（正文编辑器）', await cdp.eval(`!!document.querySelector('[data-role="chapter-content"]')`));
  check('路径更新为该章节', (await cdp.eval(crumb) || '').includes('第9章 草稿章节'), await cdp.eval(crumb));

  console.log('\n【④ 存成：分卷外章节】');
  await newTextAndSave(cdp, {
    drill: [book.title, '目录', '分卷外章节'], targetKey: 'new-default-chapter',
    title: '第1章 卷外章节', content: '分卷外内容。',
  });
  const vols2 = (await J('GET', `/books/${book.id}/volumes`)).body.data;
  const defVol = vols2.find((v) => v.title === '默认');
  check('自动创建了「默认」卷', !!defVol, vols2.map((v) => v.title).join(','));
  const defChs = defVol ? (await J('GET', `/volumes/${defVol.id}/chapters`)).body.data : [];
  check('分卷外章节已创建', defChs.some((c) => c.title === '第1章 卷外章节'), defChs.map((c) => c.title).join(','));

  console.log('\n【④ 存成：细纲 · 新卷纲】');
  await newTextAndSave(cdp, {
    drill: [book.title, '相关', '细纲'], targetKey: 'new-volume-outline',
    title: '草稿卷纲', content: '卷纲内容。',
  });
  let outlines = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('新卷纲已创建', outlines.volumes.some((v) => v.title === '草稿卷纲'), outlines.volumes.map((v) => v.title).join(','));

  console.log('\n【④ 存成：细纲 · 新章纲】');
  await newTextAndSave(cdp, {
    drill: [book.title, '相关', '细纲', '草稿卷纲'], targetKey: 'new-chapter-outline',
    title: '草稿章纲', content: '章纲内容。',
  });
  outlines = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  const newOutlineCh = outlines.chapters.find((c) => c.title === '草稿章纲');
  check('新章纲已创建', !!newOutlineCh, outlines.chapters.map((c) => c.title).join(','));
  check('章纲内容随草稿写入', (newOutlineCh?.content || '').includes('章纲内容'));

  console.log('\n【④ 存成：角色 · 子项】');
  const chars = (await J('GET', `/books/${book.id}/characters`)).body.data;
  await newTextAndSave(cdp, {
    drill: [book.title, '相关', '角色', chars[0].name], targetKey: 'new-section',
    title: '草稿子项', content: '子项内容。',
  });
  const secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  const newSec = secs.find((s) => s.title === '草稿子项');
  check('角色子项已创建', !!newSec, secs.map((s) => s.title).join(','));
  check('子项内容随草稿写入', (newSec?.content || '').includes('子项内容'));

  console.log('\n【④ 存成：世界观 · 其他补充】');
  await newTextAndSave(cdp, {
    drill: [book.title, '相关', '世界观'], targetKey: 'new-world',
    title: '草稿设定', content: '设定内容。',
  });
  const wsList = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  const newWs = wsList.find((s) => s.title === '草稿设定');
  check('世界观条目已创建', !!newWs, wsList.map((s) => s.title).join(','));
  check('设定内容随草稿写入', (newWs?.content || '').includes('设定内容'));

  console.log('\n【⑤ 草稿已清空】');
  check('保存后不再是草稿态', !(await cdp.eval(`!!document.querySelector('[data-role="draft-content"]')`)));

  ws.close();
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
