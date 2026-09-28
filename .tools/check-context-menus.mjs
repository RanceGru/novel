// 验证两处「与章节一致」的交互：
//  A. 世界观条目：右侧 hover 出删除按键；右键菜单有重命名/删除
//  B. 角色子项：点「+」先给默认名「子项N」并可自定义；行内只有删除按键
//     （不再显示「空」，也没有行内重命名按键）；右键菜单有重命名/删除
import { loginDemo, makeClient, freshBook, selectBookInUi, openRelatedInUi } from './test-utils.mjs';

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
    if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || '').slice(0, 200) };
    return r.result.value;
  }
  /** 在指定元素中心按 CDP 真实鼠标右键；返回命中的元素标记 */
  async rightClick(selectorJs) {
    const box = await this.eval(`
      (() => {
        const el=${selectorJs};
        if(!el) return null;
        el.setAttribute('data-ctx-target','1');
        const r=el.getBoundingClientRect();
        return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) };
      })()
    `);
    if (!box || box.__err) return box;
    const base = { x: box.x, y: box.y, button: 'right', buttons: 2, clickCount: 1 };
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
    await sleep(900);
    return box;
  }
  /** 在元素上悬停（让 hover 才显示的按键出现） */
  async hover(selectorJs) {
    const box = await this.eval(`
      (() => {
        const el=${selectorJs};
        if(!el) return null;
        const r=el.getBoundingClientRect();
        return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) };
      })()
    `);
    if (!box || box.__err) return box;
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y, buttons: 0 });
    await sleep(600);
    return box;
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
const menuState = `
  (() => {
    const m=document.querySelector('[data-role="item-context-menu"]');
    if(!m) return { open:false };
    return { open:true, 文案:[...m.querySelectorAll('button')].map(b=>(b.textContent||'').trim()) };
  })()
`;

async function main() {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);
  const book = await freshBook(J, '右键菜单验证书');
  await J('POST', `/books/${book.id}/characters`, { name: '林逸', category: 'protagonist' });

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

  // ============ A. 世界观条目 ============
  console.log('\n【A① 右侧删除按键】');
  await cdp.hover(`document.querySelector('[data-world-row="fixed"]')`);
  const btnInfo = await cdp.eval(`
    (() => {
      const row=document.querySelector('[data-world-row="fixed"]');
      const b=row && row.querySelector('[data-role="delete-world-item"]');
      if(!b) return { found:false };
      const cs=getComputedStyle(b);
      return { found:true, 位置在右侧: Math.round(b.getBoundingClientRect().left) > Math.round(row.getBoundingClientRect().left + row.getBoundingClientRect().width*0.5),
               hover后可见: cs.display !== 'none' };
    })()
  `);
  console.log('   删除按键:', JSON.stringify(btnInfo));
  check('世界观条目有删除按键', btnInfo.found);
  check('删除按键在行右侧', btnInfo.位置在右侧);
  check('悬停后删除按键可见', btnInfo.hover后可见);

  console.log('\n【A② 右键菜单】');
  await cdp.rightClick(`document.querySelector('[data-world-row="fixed"][data-world-title="时代信息"]')`);
  const menuA = await cdp.eval(menuState);
  console.log('   菜单:', JSON.stringify(menuA));
  check('右键弹出菜单', menuA.open);
  check('菜单含重命名与删除', menuA.open && menuA.文案.join(',').includes('重命名') && menuA.文案.join(',').includes('删除'),
    JSON.stringify(menuA.文案));

  // 用菜单重命名
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="menu-rename"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(900);
  const renameInput = await cdp.eval(`
    (() => {
      const i=document.querySelector('[data-world-row="fixed"][data-world-title="时代信息"] input');
      return i ? { 出现:true, 值:i.value } : { 出现:false };
    })()
  `);
  console.log('   重命名输入框:', JSON.stringify(renameInput));
  check('菜单重命名打开行内输入框', renameInput.出现);
  check('输入框带出原名称', renameInput.值 === '时代信息', JSON.stringify(renameInput.值));
  await cdp.eval(`
    (() => {
      const i=document.querySelector('[data-world-row="fixed"] input');
      if(!i) return 'no-input';
      const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      set.call(i,'时代背景（改名）'); i.dispatchEvent(new Event('input',{bubbles:true}));
      return 'ok';
    })()
  `);
  await sleep(300);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await sleep(2500);
  let api = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('世界观条目重命名已落库', api.some((s) => s.title === '时代背景（改名）'), api.map((s) => s.title).join(','));

  // 用菜单删除
  await cdp.rightClick(`document.querySelector('[data-world-row="fixed"][data-world-title="社会背景"]')`);
  const menuA2 = await cdp.eval(menuState);
  check('再次右键仍能弹出菜单', menuA2.open);
  await cdp.eval(`
    (() => {
      window.confirm = () => true;
      const b=document.querySelector('[data-role="menu-delete"]');
      if(!b) return 'no-btn'; b.click(); return 'clicked';
    })()
  `);
  await sleep(2500);
  api = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('世界观条目删除已落库', !api.some((s) => s.title === '社会背景'), api.map((s) => s.title).join(','));

  // ============ B. 角色子项 ============
  console.log('\n【B① 新建子项：默认名 子项N，可自定义】');
  console.log('展开角色:', await cdp.eval(clickSpan('角色')));
  await sleep(2000);
  // 展开角色行（点角色行）
  await cdp.eval(`(() => { const r=document.querySelector('[data-char-row="character"]'); if(!r) return 'no-row'; r.click(); return 'clicked'; })()`);
  await sleep(1500);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="add-section"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1200);
  const secDraft = await cdp.eval(`
    (() => {
      const i=document.querySelector('input[placeholder="子项标题"]');
      const ok=[...document.querySelectorAll('button')].find(b=>b.title==='确认');
      return { 有输入框:!!i, 默认值:i?i.value:null, 有确认:!!ok };
    })()
  `);
  console.log('   子项草稿:', JSON.stringify(secDraft));
  check('点「+」出现名称输入框', secDraft.有输入框);
  check('默认名为「子项1」', secDraft.默认值 === '子项1', JSON.stringify(secDraft.默认值));
  check('有确认按钮', secDraft.有确认);

  // 自定义命名后确认
  await cdp.eval(`
    (() => {
      const i=document.querySelector('input[placeholder="子项标题"]');
      if(!i) return 'no-input';
      const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      set.call(i,'身世线索'); i.dispatchEvent(new Event('input',{bubbles:true}));
      return 'ok';
    })()
  `);
  await sleep(300);
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.title==='确认'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(2500);
  let secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('自定义命名的子项已落库', secs.some((s) => s.title === '身世线索'), secs.map((s) => s.title).join(','));

  // 默认名按「子项N」这个系列递增：
  // 前一条自定义名叫「身世线索」，不属于该系列，所以此时默认名仍是「子项1」；
  // 真正落库一条「子项1」之后，下一个才应是「子项2」。
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="add-section"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1200);
  const secDraft2 = await cdp.eval(`(() => { const i=document.querySelector('input[placeholder="子项标题"]'); return i?i.value:null; })()`);
  console.log('   该系列为空时的默认值:', JSON.stringify(secDraft2));
  check('该系列为空时默认名仍为「子项1」', secDraft2 === '子项1', JSON.stringify(secDraft2));

  // 直接确认（即落库一条「子项1」）
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.title==='确认'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(2500);
  secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('「子项1」已落库', secs.some((s) => s.title === '子项1'), secs.map((s) => s.title).join(','));

  // 再点一次「+」，此时应递增为「子项2」
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="add-section"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1200);
  const secDraft3 = await cdp.eval(`(() => { const i=document.querySelector('input[placeholder="子项标题"]'); return i?i.value:null; })()`);
  console.log('   已有 子项1 后的默认值:', JSON.stringify(secDraft3));
  check('已有「子项1」后默认名递增为「子项2」', secDraft3 === '子项2', JSON.stringify(secDraft3));
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>x.title==='取消'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1000);

  console.log('\n【B② 子项行内只有删除按键】');
  await cdp.hover(`document.querySelector('[data-char-row="section"]')`);
  const secBtns = await cdp.eval(`
    (() => {
      const row=document.querySelector('[data-char-row="section"]');
      if(!row) return { found:false };
      return {
        found:true,
        有删除: !!row.querySelector('[data-role="delete-section"]'),
        有行内重命名: !!row.querySelector('[data-role="rename-section"]'),
        行文本: (row.textContent||'').trim(),
      };
    })()
  `);
  console.log('   子项行:', JSON.stringify(secBtns));
  check('子项行有删除按键', secBtns.有删除);
  check('子项行没有行内重命名按键', !secBtns.有行内重命名);
  check('子项行不显示「空」字', !secBtns.行文本.endsWith('空'), JSON.stringify(secBtns.行文本));

  console.log('\n【B③ 子项右键菜单】');
  await cdp.rightClick(`document.querySelector('[data-char-row="section"]')`);
  const menuB = await cdp.eval(menuState);
  console.log('   菜单:', JSON.stringify(menuB));
  check('子项右键弹出菜单', menuB.open);
  check('菜单含重命名与删除', menuB.open && menuB.文案.join(',').includes('重命名') && menuB.文案.join(',').includes('删除'),
    JSON.stringify(menuB.文案));

  await cdp.eval(`(() => { const b=document.querySelector('[data-role="menu-rename"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(900);
  await cdp.eval(`
    (() => {
      const i=document.querySelector('[data-char-row="section"] input');
      if(!i) return 'no-input';
      const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      set.call(i,'身世线索（改）'); i.dispatchEvent(new Event('input',{bubbles:true}));
      return 'ok';
    })()
  `);
  await sleep(300);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await sleep(2500);
  secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('子项重命名已落库', secs.some((s) => s.title === '身世线索（改）'), secs.map((s) => s.title).join(','));

  await cdp.rightClick(`document.querySelector('[data-char-row="section"]')`);
  await cdp.eval(`(() => { window.confirm=()=>true; const b=document.querySelector('[data-role="menu-delete"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(2500);
  secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('子项删除已落库', !secs.some((s) => s.title === '身世线索（改）'), secs.map((s) => s.title).join(','));

  ws.close();
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
