// 角色子项 界面验证：角色可展开、子项增删改（无序号）、样式对齐目录
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { loginDemo, makeClient, freshBook, selectBookInUi } from './test-utils.mjs';

const CLIENT = 'E:/project/novel/client';
const PORT = Number(process.env.PORT || 9260);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error('超时: ' + method)); } }, 20000);
    });
  }
  async eval(expr) {
    const r = await this.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) return { __error: (r.exceptionDetails.exception?.description || '').slice(0, 300) };
    return r.result.value;
  }
}

let pass = 0, fail = 0;
const check = (l, c, extra = '') => { console.log(`   ${c ? '✓' : '✗'} ${l}${extra ? ' ' + extra : ''}`); c ? pass++ : fail++; };

async function main() {
  const auth = await loginDemo();
  const { H, J } = makeClient(auth.accessToken);

  // 用本套件专属的作品，避免与其它套件互相污染（列表按 updatedAt 排序）
  // freshBook 会先删掉上次遗留，保证角色与子项从「默认 5 个子项」这个确定状态开始
  const book = await freshBook(J, '角色界面验证书');
  console.log('使用作品:', book.title);

  // 建立固定起点：一个主角「林逸」（会自动生成默认子项）
  let chars = (await J('GET', `/books/${book.id}/characters`)).body.data;
  if (!chars.length) {
    await J('POST', `/books/${book.id}/characters`, { name: '林逸', category: 'protagonist', background: '边城少年' });
    chars = (await J('GET', `/books/${book.id}/characters`)).body.data;
  }
  console.log('角色:', chars.map(c => c.name).join(', '));

  // 连接窗口：优先复用已登录的常驻窗口（PORT，默认 9260），
  // 没有就自己起一个带调试端口的实例并注入登录态——避免本套件依赖外部窗口存活。
  let cdp, ownChild = null;
  const findTarget = async (port) => {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      return list.find(x => x.type === 'page' && x.url.includes('5173')) || null;
    } catch { return null; }
  };

  let t = await findTarget(PORT);
  if (t) {
    console.log(`复用已登录窗口（调试端口 ${PORT}）`);
  } else {
    console.log(`调试端口 ${PORT} 无窗口，自行启动一个实例`);
    ownChild = spawn(path.join(CLIENT, 'node_modules/electron/dist/electron.exe'),
      ['.', `--remote-debugging-port=${PORT}`],
      { cwd: CLIENT, env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' }, stdio: ['ignore', 'ignore', 'ignore'] });
    for (let i = 0; i < 40 && !t; i++) { await sleep(500); t = await findTarget(PORT); }
    if (!t) { ownChild.kill(); throw new Error(`无法连接调试端口 ${PORT}`); }
  }

  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  cdp = new CDP(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');

  // 注入登录态（自启实例的 localStorage 是空的；复用窗口时这步是幂等的）
  await cdp.eval(`
    localStorage.setItem('novel-auth', ${JSON.stringify(JSON.stringify({
      state: { isAuthenticated: true, accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user },
      version: 0 }))});
    'ok'
  `);

  // 用真实鼠标事件把指针移到匹配元素上（hover 才显示的按钮必须先悬停）
  const hover = async (selectorJs) => {
    const box = await cdp.eval(`
      (() => {
        const t=${selectorJs};
        if(!t) return null;
        t.setAttribute('data-hover-target','1');
        const r=t.getBoundingClientRect();
        return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) };
      })()
    `);
    if (!box) return 'no-el';
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y, buttons: 0 });
    await sleep(600);
    return 'hovered';
  };
  // 按 data-section-title 定位子项行（不能用 textContent：
  // 进入重命名状态后标题变成 input 的 value，textContent 里就没有标题文本了）
  const rowContaining = (text) =>
    `[...document.querySelectorAll('[data-char-row="section"]')].find(r=>r.getAttribute('data-section-title')===${JSON.stringify(text)})`;

  // 刷新以拉取最新数据，回到写作台并切到本套件的作品
  await cdp.send('Page.reload');
  await sleep(7000);
  console.log('选择作品:', await cdp.eval(selectBookInUi(book.title)));
  await sleep(2500);

  const clickByText = (text) => `
    (() => {
      const el=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='${text}');
      if(!el.length) return 'no-span';
      (el[0].closest('div[class*="cursor-pointer"]')||el[0].closest('button')||el[0].parentElement).click();
      return 'clicked';
    })()
  `;
  // 点作品行已展开该作品，这里直接展开「相关」不再重复点作品行（会把它收起来）
  console.log('展开相关:', await cdp.eval(clickByText('相关')));
  await sleep(1400);
  console.log('展开角色:', await cdp.eval(clickByText('角色')));
  await sleep(2200);

  // ① 角色行存在且可展开
  console.log('\n【① 角色行】');
  const charRow = await cdp.eval(`
    (() => {
      const r=document.querySelector('[data-char-row="character"]');
      if(!r) return { found:false };
      return { found:true, 文本:(r.textContent||'').trim(),
               角色:[...r.querySelectorAll('[data-role]')].map(e=>e.getAttribute('data-role')) };
    })()
  `);
  console.log('   角色行:', JSON.stringify(charRow));
  check('角色行存在（可展开）', charRow.found);
  check('角色行有「新建子项」入口', charRow.found && charRow.角色.includes('add-section'));
  check('角色行有「编辑角色」入口', charRow.found && charRow.角色.includes('edit-character'));

  // 展开角色
  console.log('   点击展开角色:', await cdp.eval(`(() => { const r=document.querySelector('[data-char-row="character"]'); if(!r) return 'no-row'; r.click(); return 'clicked'; })()`));
  await sleep(1200);

  // ② 默认子项显示
  console.log('\n【② 默认子项】');
  const secTitles = await cdp.eval(`
    (() => [...document.querySelectorAll('[data-char-row="section"]')].map(s=>{
      const t=(s.textContent||'').trim();
      return t.replace(/\\d+字$|空$/,'').trim();
    }))()
  `);
  console.log('   子项:', JSON.stringify(secTitles));
  check('展开后显示默认子项', secTitles.length >= 5, `count=${secTitles.length}`);
  check('包含「背景」子项', secTitles.some(t => t.startsWith('背景')));
  check('子项标题不带序号（无「第N章」）', !secTitles.some(t => /^第\d/.test(t)), JSON.stringify(secTitles));

  // 截图仅作留档，失败不应中断断言流程
  const shot = async (name) => {
    try {
      const s = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
      writeFileSync(`E:/project/novel/.tools/shots/${name}.jpg`, Buffer.from(s.data, 'base64'));
      return `已保存 .tools/shots/${name}.jpg`;
    } catch (e) { return `截图跳过（${e.message}）`; }
  };
  console.log('   截图:', await shot('character-sections'));

  // ③ 行内 + 新建子项
  console.log('\n【③ 新建子项】');
  console.log('   点行内 +:', await cdp.eval(`
    (() => {
      const r=document.querySelector('[data-char-row="character"]');
      const b=r && r.querySelector('[data-role="add-section"]');
      if(!b) return 'no-btn'; b.click(); return 'clicked';
    })()
  `));
  await sleep(1000);
  const draft = await cdp.eval(`(() => { const i=document.querySelector('input[placeholder="子项标题"]'); return i ? { 出现:true } : { 出现:false }; })()`);
  check('出现子项标题输入框', draft.出现);
  await cdp.eval(`
    (() => {
      const el=document.querySelector('input[placeholder="子项标题"]');
      if(!el) return 'no-el';
      const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      s.call(el,'感情线'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'ok';
    })()
  `);
  await sleep(300);
  await cdp.eval(`
    (() => {
      const el=document.querySelector('input[placeholder="子项标题"]');
      el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
      return 'ok';
    })()
  `);
  await sleep(2200);
  let secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('新子项已落库', secs.some(s => s.title === '感情线'), `count=${secs.filter(s=>s.characterId===chars[0].id).length}`);

  // ④ 删除子项（按钮 hover 才显示，先真实悬停）
  console.log('\n【④ 删除子项】');
  const before = secs.filter(s => s.characterId === chars[0].id).length;
  console.log('   悬停「感情线」行:', await hover(rowContaining('感情线')));
  await cdp.eval(`
    (() => {
      const rows=[...document.querySelectorAll('[data-char-row="section"]')];
      const target=rows.find(r=>(r.textContent||'').includes('感情线'));
      const b=target && target.querySelector('[data-role="delete-section"]');
      if(!b) return 'no-btn';
      window.confirm = () => true;   // 自动确认
      b.click(); return 'clicked';
    })()
  `);
  await sleep(2200);
  secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('子项已删除', !secs.some(s => s.title === '感情线'),
    `before=${before} after=${secs.filter(s=>s.characterId===chars[0].id).length}`);

  // ⑤ 重命名子项（改写）
  // 注意：重命名入口已按需求改到右键菜单，行内只保留删除按键。
  console.log('\n【⑤ 重命名子项（右键菜单）】');
  const ctxBox = await cdp.eval(`
    (() => {
      const row=${rowContaining('外貌')};
      if(!row) return null;
      const r=row.getBoundingClientRect();
      return { x: Math.round(r.left+r.width/2), y: Math.round(r.top+r.height/2) };
    })()
  `);
  if (ctxBox) {
    const base = { x: ctxBox.x, y: ctxBox.y, button: 'right', buttons: 2, clickCount: 1 };
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  }
  await sleep(900);
  const menuOpen = await cdp.eval(`
    (() => {
      const m=document.querySelector('[data-role="item-context-menu"]');
      return m ? { open:true, 文案:[...m.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).join(',') } : { open:false };
    })()
  `);
  console.log('   右键菜单:', JSON.stringify(menuOpen));
  check('右键弹出菜单且含重命名', menuOpen.open && (menuOpen.文案 || '').includes('重命名'), JSON.stringify(menuOpen));
  const renameClick = await cdp.eval(`
    (() => {
      const b=document.querySelector('[data-role="menu-rename"]');
      if(!b) return 'no-btn'; b.click(); return 'clicked';
    })()
  `);
  console.log('   点菜单重命名:', renameClick);
  await sleep(900);
  const renameBox = await cdp.eval(`
    (() => {
      const t=${rowContaining('外貌')};
      const i=t && t.querySelector('input');
      if(!i) return 'missing';
      i.focus();
      return document.activeElement===i ? 'shown' : 'shown-no-focus';
    })()
  `);
  check('菜单重命名出现输入框', renameBox.startsWith('shown'), renameBox);
  await cdp.eval(`
    (() => {
      const t=${rowContaining('外貌')};
      const el=t && t.querySelector('input');
      if(!el) return 'no-el';
      const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      s.call(el,'外貌特征'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'ok';
    })()
  `);
  await sleep(400);
  // 重命名用 Enter 落库（与目录里重命名的习惯一致）
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
  await sleep(2200);
  secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('子项重命名已落库', secs.some(s => s.title === '外貌特征') && !secs.some(s => s.title === '外貌'));

  // ⑥ 编辑角色本体（此前 404 坏掉的路径）
  // 注意：必须按角色名定位到具体那一行，不能用 querySelector 取「第一个角色」——
  // 角色是按分类分组渲染的，第一行不一定是目标角色。
  console.log('\n【⑥ 编辑角色】');
  const charRowByName = (name) =>
    `[...document.querySelectorAll('[data-char-row="character"]')].find(r=>(r.textContent||'').includes(${JSON.stringify(name)}))`;
  const editClicked = await cdp.eval(`
    (() => {
      const r=${charRowByName(chars[0].name)};
      const b=r && r.querySelector('[data-role="edit-character"]');
      if(!b) return 'no-btn'; b.click(); return 'clicked';
    })()
  `);
  console.log('   点编辑角色:', editClicked);
  await sleep(1400);
  const editorShown = await cdp.eval(`
    (() => {
      const i=[...document.querySelectorAll('input')].find(x=>(x.value||'').includes(${JSON.stringify(chars[0].name)}));
      return i ? 'shown' : 'missing';
    })()
  `);
  check('角色编辑面板显示原名称', editorShown === 'shown', editorShown);
  await cdp.eval(`
    (() => {
      const i=[...document.querySelectorAll('input')].find(x=>(x.value||'').includes(${JSON.stringify(chars[0].name)}));
      if(!i) return 'no-input';
      const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      s.call(i,'林逸尘'); i.dispatchEvent(new Event('input',{bubbles:true})); return 'ok';
    })()
  `);
  await sleep(400);
  // 只在角色编辑对话框内找「保存修改」按钮：
  // 页面上其它元素（如左侧作品列表「草稿保存验证用书0字」）也含「保存」二字，
  // 用全局模糊匹配会点到别处。
  const clickedSave = await cdp.eval(`
    (() => {
      const dlg=[...document.querySelectorAll('div.fixed.inset-0')].find(d=>/编辑角色|新建角色/.test(d.textContent||''));
      if(!dlg) return 'no-dialog';
      const b=[...dlg.querySelectorAll('button')].find(x=>/保存修改|创建角色/.test(x.textContent||''));
      if(!b) return 'no-save'; b.click(); return 'clicked:' + (b.textContent||'').trim();
    })()
  `);
  console.log('   保存按钮:', clickedSave);
  await sleep(2500);
  chars = (await J('GET', `/books/${book.id}/characters`)).body.data;
  check('角色改名已落库（404 已修复）', chars.some(c => c.name === '林逸尘'), chars.map(c => c.name).join(','));

  // ⑦ 删除角色（此前 404 坏掉的路径）
  console.log('\n【⑦ 删除角色】');
  // 清掉上次运行可能残留的临时角色，保证断言只看本次新建的那一个
  for (const c of (await J('GET', `/books/${book.id}/characters`)).body.data) {
    if (/待删除|验证/.test(c.name)) await J('DELETE', `/books/${book.id}/characters/${c.id}`);
  }
  const temp = (await J('POST', `/books/${book.id}/characters`, { name: '待删除角色' })).body.data;
  await cdp.send('Page.reload');
  await sleep(7000);
  console.log('重新选择作品:', await cdp.eval(selectBookInUi(book.title)));
  await sleep(2500);
  await cdp.eval(clickByText('相关'));
  await sleep(1400);
  await cdp.eval(clickByText('角色'));
  await sleep(2200);
  const names = await cdp.eval(`(() => [...document.querySelectorAll('[data-char-row="character"]')].map(r=>(r.textContent||'').trim()))()`);
  console.log('   角色行:', JSON.stringify(names));
  check('新增角色出现在列表', names.some(n => n.includes('待删除角色')));
  const delRes = await cdp.eval(`
    (() => {
      const rows=[...document.querySelectorAll('[data-char-row="character"]')];
      const t=rows.find(r=>(r.textContent||'').includes('待删除角色'));
      if(!t) return 'no-row';
      t.click();                       // 展开
      return 'expanded';
    })()
  `);
  await sleep(1000);
  const delClicked = await cdp.eval(`
    (() => {
      const rows=[...document.querySelectorAll('[data-char-row="character"]')];
      const t=rows.find(r=>(r.textContent||'').includes('待删除角色'));
      const b=t && t.querySelector('[data-role="edit-character"]');
      if(!b) return 'no-btn'; b.click(); return 'clicked';
    })()
  `);
  await sleep(1400);
  const realDel = await cdp.eval(`
    (() => {
      const b=[...document.querySelectorAll('button')].find(x=>/删除/.test(x.textContent||''));
      if(!b) return 'no-del-btn';
      window.confirm=()=>true; b.click(); return 'clicked:'+(b.textContent||'').trim();
    })()
  `);
  console.log('   删除按钮:', realDel);
  await sleep(2500);
  chars = (await J('GET', `/books/${book.id}/characters`)).body.data;
  check('角色删除已落库（404 已修复）', !chars.some(c => c.name === '待删除角色'), chars.map(c => c.name).join(','));
  check('删除角色时级联删除其子项', !(await J('GET', `/books/${book.id}/characters/sections`)).body.data.some(s => s.characterId === temp.id));

  console.log('   截图:', await shot('character-sections-after'));

  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  ws.close();
  if (ownChild) ownChild.kill();   // 只关掉本套件自己启动的实例，不影响复用中的窗口
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
