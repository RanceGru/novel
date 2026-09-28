// 验证「世界观」区域（结构对齐「分卷 → 章节」）：
//   ① 默认自带 7 个固定条目：时代信息/社会背景/力量体系/政治体系/经济体系/文化体系/地理位置
//      它们没有展开箭头、点击不展开、不出现文本输入框
//   ② 标题行右侧「新增信息」按钮，点击后出现「名称输入框 + ✓/✗」草稿行（像新增章节）
//   ③ 草稿默认命名「其他补充1」，确认后落库；再新增得到「其他补充2」
//   ④ 新建的条目可自定义命名、可展开填写内容、可重命名、可删除
import { loginDemo, makeClient, freshBook, selectBookInUi, openRelatedInUi } from './test-utils.mjs';

const PORT = Number(process.env.PORT || 9260);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FIXED_TITLES = ['时代信息', '社会背景', '力量体系', '政治体系', '经济体系', '文化体系', '地理位置'];

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
    if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || '').slice(0, 200) };
    return r.result.value;
  }
}

const clickSpan = (text) => `
  (() => {
    const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()===${JSON.stringify(text)});
    if(!s.length) return 'not-found';
    (s[0].closest('div[class*="cursor-pointer"]')||s[0].closest('button')||s[0].parentElement).click();
    return 'clicked';
  })()
`;

async function main() {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);
  const book = await freshBook(J, '世界观验证书');

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
  console.log('展开相关:', await cdp.eval(openRelatedInUi()));
  await sleep(2000);
  console.log('展开世界观:', await cdp.eval(clickSpan('世界观')));
  await sleep(2500);

  // ① 固定条目
  console.log('\n【① 固定条目（7 个，无箭头不可点）】');
  const fixed = await cdp.eval(`
    (() => {
      const rows=[...document.querySelectorAll('[data-world-row="fixed"]')];
      return rows.map(r=>({
        标题: r.getAttribute('data-world-title'),
        含箭头: !!r.querySelector('svg'),
        可点击类: /cursor-pointer/.test(r.className),
      }));
    })()
  `);
  console.log('   固定条目:', JSON.stringify(fixed));
  check('固定条目为 7 个', fixed.length === 7, `count=${fixed.length}`);
  check('标题与默认一致', fixed.map((x) => x.标题).join(',') === FIXED_TITLES.join(','), fixed.map((x) => x.标题).join(','));
  check('固定条目没有展开箭头', fixed.every((x) => !x.含箭头));
  check('固定条目不可点击', fixed.every((x) => !x.可点击类));

  // 点一下固定条目，仍不应出现输入框
  await cdp.eval(`
    (() => {
      const r=document.querySelector('[data-world-row="fixed"][data-world-title="力量体系"]');
      if(!r) return 'not-found';
      r.click(); r.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      return 'clicked';
    })()
  `);
  await sleep(1200);
  // 注意作用域：右侧「章纲（快照）」面板本来就有文本域，不能统计全页
  const afterClick = await cdp.eval(`
    (() => {
      const header=document.querySelector('[data-role="world-header"]');
      const scope=header ? header.parentElement : document.body;
      return {
        相关区内文本域: scope.querySelectorAll('textarea').length,
        有力量体系输入提示: !!scope.querySelector('textarea[placeholder*="力量体系"]'),
      };
    })()
  `);
  console.log('   点击固定条目后:', JSON.stringify(afterClick));
  check('点击固定条目不出现文本输入框',
    afterClick.相关区内文本域 === 0 && !afterClick.有力量体系输入提示);

  // ② 新增草稿行
  console.log('\n【② 点新增信息】');
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="add-world-setting"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1500);
  const draft = await cdp.eval(`
    (() => {
      const i=document.querySelector('input[placeholder="条目名称"]');
      const ok=document.querySelector('[data-role="confirm-new-world-item"]');
      return { 有输入框: !!i, 默认值: i?i.value:null, 有确认按钮: !!ok };
    })()
  `);
  console.log('   草稿行:', JSON.stringify(draft));
  check('出现名称输入框（像新增章节）', draft.有输入框);
  check('默认命名为「其他补充1」', draft.默认值 === '其他补充1', JSON.stringify(draft.默认值));
  check('有 ✓ 确认按钮', draft.有确认按钮);

  // 后端此时不应已有该条目（确认后才落库）
  const beforeConfirm = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('确认前未落库', beforeConfirm.length === 7, `count=${beforeConfirm.length}`);

  // ③ 确认落库
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="confirm-new-world-item"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(2500);
  let api = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('确认后落库', api.length === 8, `count=${api.length}`);
  check('落库名称「其他补充1」', api.some((s) => s.title === '其他补充1'), api.map((s) => s.title).join(','));
  const uiAfterFirst = await cdp.eval(`[...document.querySelectorAll('[data-world-row="item"]')].map(x=>x.getAttribute('data-world-title'))`);
  check('界面出现该条目', Array.isArray(uiAfterFirst) && uiAfterFirst.includes('其他补充1'), JSON.stringify(uiAfterFirst));

  // 再次新增 → 其他补充2
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="add-world-setting"]'); b.click(); return 'clicked'; })()`);
  await sleep(1500);
  const draft2 = await cdp.eval(`(() => { const i=document.querySelector('input[placeholder="条目名称"]'); return i?i.value:null; })()`);
  console.log('   第二次草稿默认值:', JSON.stringify(draft2));
  check('第二次默认命名为「其他补充2」', draft2 === '其他补充2', JSON.stringify(draft2));

  // 自定义命名后确认
  await cdp.eval(`
    (() => {
      const i=document.querySelector('input[placeholder="条目名称"]');
      if(!i) return 'no-input';
      const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      set.call(i,'王朝更替'); i.dispatchEvent(new Event('input',{bubbles:true}));
      return 'ok';
    })()
  `);
  await sleep(400);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="confirm-new-world-item"]'); b.click(); return 'clicked'; })()`);
  await sleep(2500);
  api = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('支持自定义命名后落库', api.some((s) => s.title === '王朝更替'), api.map((s) => s.title).join(','));

  // ④ 自建条目可展开写内容 + 可重命名 + 可删除
  console.log('\n【③ 自建条目的编辑能力】');
  await cdp.eval(`
    (() => {
      const r=[...document.querySelectorAll('[data-world-row="item"]')].find(x=>x.getAttribute('data-world-title')==='其他补充1');
      if(!r) return 'not-found'; r.click(); return 'clicked';
    })()
  `);
  await sleep(1200);
  const hasTextarea = await cdp.eval(`!!document.querySelector('textarea[placeholder*="其他补充1"]')`);
  check('自建条目可展开填写内容', hasTextarea);

  await cdp.eval(`
    (() => {
      const ta=document.querySelector('textarea');
      if(!ta) return 'no-ta';
      const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      set.call(ta,'补充设定内容ABC'); ta.dispatchEvent(new Event('input',{bubbles:true}));
      return 'ok';
    })()
  `);
  await sleep(400);
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/^保存$/.test((x.textContent||'').trim())); if(!b) return 'no-save'; b.click(); return 'clicked'; })()`);
  await sleep(2500);
  api = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('内容已落库', (api.find((s) => s.title === '其他补充1')?.content || '').includes('补充设定内容ABC'));

  // 重命名（hover 出按钮）
  const target = api.find((s) => s.title === '其他补充1');
  await cdp.eval(`
    (() => {
      const r=[...document.querySelectorAll('[data-world-row="item"]')].find(x=>x.getAttribute('data-world-title')==='其他补充1');
      if(!r) return 'no-row';
      r.querySelector('[data-role="rename-world-item"]').click(); return 'clicked';
    })()
  `);
  await sleep(1000);
  const renameBox = await cdp.eval(`
    (() => {
      const i=document.querySelector('input[placeholder="条目名称"]');
      if(!i) return { 出现:false };
      const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      set.call(i,'其他补充1（改名）'); i.dispatchEvent(new Event('input',{bubbles:true}));
      return { 出现:true, 原值:i.value };
    })()
  `);
  check('点重命名出现输入框', renameBox.出现);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await sleep(2500);
  api = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('重命名已落库', api.some((s) => s.title === '其他补充1（改名）'), api.map((s) => s.title).join(','));

  // 删除
  await cdp.eval(`
    (() => {
      window.confirm = () => true;
      const r=[...document.querySelectorAll('[data-world-row="item"]')].find(x=>x.getAttribute('data-world-title')==='其他补充1（改名）');
      if(!r) return 'no-row';
      r.querySelector('[data-role="delete-world-item"]').click(); return 'clicked';
    })()
  `);
  await sleep(2500);
  api = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('删除已落库', !api.some((s) => s.id === target.id), api.map((s) => s.title).join(','));

  ws.close();
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
