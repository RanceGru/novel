// 纲树界面统一验证（当前结构）
//
// 结构：大纲（普通章节行，不可展开） / 细纲（与目录同构：卷纲↔分卷、章纲↔章节）
//       每个卷纲自带系统章纲「第N卷卷纲」，isSystem 不可删除、标题不可改
//
// 定位一律使用组件上的 data-outline-row / data-role，避免依赖 DOM 结构推断。
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loginDemo, makeClient, freshBook } from './test-utils.mjs';

const CLIENT = 'E:/project/novel/client';
const SHOTS = 'E:/project/novel/.tools/shots';
const PORT = 9254;
const API = 'http://localhost:3000/api/v1';
mkdirSync(SHOTS, { recursive: true });
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
  const { J } = makeClient(auth.accessToken);

  // 数据：卷纲（自带系统章纲）+ 普通章纲；另建一个真实分卷用于目录对照
  // 先清掉上次遗留，保证卷纲编号从 1 开始
  const book = await freshBook(J, '纲树界面统一验证');
  await J('PATCH', `/books/${book.id}/outlines/book-outline`, { content: '全书总纲内容QWE' });
  const v1 = (await J('POST', `/books/${book.id}/outlines`, { level: 'volume_outline', title: '第一卷·界面' })).body.data;
  await J('POST', `/books/${book.id}/outlines`, { level: 'chapter_outline', title: '第1章 界面章纲', content: '原始章纲内容', parentId: v1.id });
  const vol = (await J('POST', `/books/${book.id}/volumes`, { title: '第一卷·界面', volumeNumber: 1 })).body.data;
  await J('POST', `/volumes/${vol.id}/chapters`, { title: '第1章 界面章纲', chapterNumber: 1 });
  console.log('准备数据:', book.title);

  const child = spawn(path.join(CLIENT, 'node_modules/electron/dist/electron.exe'),
    ['.', `--remote-debugging-port=${PORT}`],
    { cwd: CLIENT, env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' }, stdio: ['ignore', 'ignore', 'ignore'] });
  let t = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      t = list.find((x) => x.type === 'page' && x.url.includes('5173'));
      if (t) break;
    } catch { /* 等待 */ }
  }
  if (!t) throw new Error('无法连接调试端口');
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.eval(
    `localStorage.setItem('novel-auth', ${JSON.stringify(JSON.stringify({
      state: { isAuthenticated: true, accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user },
      version: 0,
    }))});` + `location.replace('http://localhost:5173/workspace'); 'ok'`
  );
  await sleep(6500);

  const clickByText = (text) => `
    (() => {
      const el=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='${text}');
      if(!el.length) return 'no-span';
      (el[0].closest('div[class*="cursor-pointer"]')||el[0].closest('button')||el[0].parentElement).click();
      return 'clicked';
    })()
  `;
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].filter(x=>x.querySelector('img')&&/字/.test(x.textContent||'')); const r=b.find(x=>x.textContent.includes('纲树界面统一验证')); if(r) r.click(); return 'ok'; })()`);
  await sleep(1600);
  await cdp.eval(clickByText('相关')); await sleep(1300);
  await cdp.eval(clickByText('纲树')); await sleep(2400);

  // ===== ① 结构：大纲行 + 细纲容器 =====
  console.log('\n【① 结构】');
  const treeText = await cdp.eval(`document.body.innerText || ''`);
  check('显示「大纲」', treeText.includes('大纲'));
  check('显示「细纲」', treeText.includes('细纲'));
  check('细纲下显示卷纲「第一卷·界面」', treeText.includes('第一卷·界面'));
  check('卷纲自带「第1卷卷纲」', treeText.includes('第1卷卷纲'));
  check('普通章纲「第1章 界面章纲」可见', treeText.includes('第1章 界面章纲'));

  // ===== ② 大纲是普通行：不可展开、点击就地编辑 =====
  console.log('\n【② 大纲为普通章节行】');
  const bookRow = await cdp.eval(`
    (() => {
      const row=document.querySelector('[data-outline-row="book"]');
      if(!row) return { found:false };
      return { found:true, 文本:(row.textContent||'').trim(),
               角色:[...row.querySelectorAll('[data-role]')].map(e=>e.getAttribute('data-role')) };
    })()
  `);
  console.log('   大纲行:', JSON.stringify(bookRow));
  check('大纲行存在', bookRow.found);
  check('无展开/收起（无 toggle 控件）', bookRow.found && !bookRow.角色.some(r => r.includes('toggle')));
  check('无新增/删除按钮', bookRow.found && !bookRow.角色.some(r => ['add-volume', 'add-chapter', 'delete'].includes(r)));

  await cdp.eval(`(() => { const r=document.querySelector('[data-outline-row="book"]'); if(r) r.click(); return 'ok'; })()`);
  await sleep(1000);
  const ta = await cdp.eval(`(() => { const t=document.querySelector('textarea[placeholder^="在此撰写全书大纲"]'); return t ? { 存在:true, 值:t.value } : { 存在:false }; })()`);
  check('点击后就地出现编辑框并预填内容', ta.存在 && ta.值 === '全书总纲内容QWE', JSON.stringify(ta));
  await cdp.eval(`
    (() => {
      const t=document.querySelector('textarea[placeholder^="在此撰写全书大纲"]');
      if(!t) return 'no-ta';
      const s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      s.call(t,'全书总纲内容QWE-已改'); t.dispatchEvent(new Event('input',{bubbles:true})); return 'ok';
    })()
  `);
  await sleep(300);
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='保存'); if(b) b.click(); return 'ok'; })()`);
  await sleep(2000);
  const savedOutline = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('大纲内容已保存', savedOutline.bookOutline.content === '全书总纲内容QWE-已改');
  check('保存后编辑框收起',
    !(await cdp.eval(`(() => !!document.querySelector('textarea[placeholder^="在此撰写全书大纲"]'))()`)));

  // ===== ③ 右键菜单（与目录的分卷/章节菜单一致）=====
  console.log('\n【③ 右键菜单】');
  const openCtx = (rowSel) => `
    (() => {
      const r=document.querySelector('${rowSel}');
      if(!r) return 'no-row';
      r.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:200,clientY:300}));
      return 'fired';
    })()
  `;
  const menuItems = `
    (() => {
      const all=[...document.querySelectorAll('div')].filter(d =>
        (d.className||'').toString().includes('z-50') && d.querySelector('button'));
      const m=all.length ? all[all.length-1] : null;
      if(!m) return null;
      return {
        按钮: [...m.querySelectorAll('button')].map(b=>(b.textContent||'').trim()),
        文本: (m.textContent||'').trim(),
      };
    })()
  `;

  // 系统章纲行：右键只应出现「生成章节」，不含重命名/删除
  const sysRowSel = `[data-outline-row="chapter"]`;
  console.log('   右键系统章纲行:', await cdp.eval(`
    (() => {
      const rows=[...document.querySelectorAll('[data-outline-row="chapter"]')];
      const r=rows.find(x=>(x.textContent||'').includes('第1卷卷纲'));
      if(!r) return 'no-row';
      r.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:200,clientY:300}));
      return 'fired';
    })()
  `));
  await sleep(800);
  let items = await cdp.eval(menuItems);
  console.log('   系统章纲菜单:', JSON.stringify(items));
  check('系统章纲菜单含「生成章节」', items && items.按钮.some(i => i.includes('生成章节')));
  check('系统章纲菜单不含「删除章纲」', items && !items.按钮.some(i => i.includes('删除')));
  check('系统章纲菜单不含「章纲重命名」', items && !items.按钮.some(i => i.includes('重命名')));
  check('系统章纲菜单标注不可删除', items && items.文本.includes('不可删除'), 'text=' + (items ? items.文本 : ''));
  await cdp.eval(`document.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`); await sleep(500);

  // 普通章纲行：应含生成章节 / 重命名 / 删除
  console.log('   右键普通章纲行:', await cdp.eval(`
    (() => {
      const rows=[...document.querySelectorAll('[data-outline-row="chapter"]')];
      const r=rows.find(x=>(x.textContent||'').includes('第1章 界面章纲'));
      if(!r) return 'no-row';
      r.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:200,clientY:300}));
      return 'fired';
    })()
  `));
  await sleep(800);
  items = await cdp.eval(menuItems);
  console.log('   普通章纲菜单:', JSON.stringify(items));
  check('普通章纲菜单含「生成章节」', items && items.按钮.some(i => i.includes('生成章节')));
  check('普通章纲菜单含「章纲重命名」', items && items.按钮.some(i => i.includes('重命名')));
  check('普通章纲菜单含「删除章纲」', items && items.按钮.some(i => i.includes('删除')));
  await cdp.eval(`document.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`); await sleep(500);

  // 卷纲行：应含新建章纲 / 生成分卷 / 重命名 / 删除
  console.log('   右键卷纲行:', await cdp.eval(openCtx('[data-outline-row="volume"]')));
  await sleep(800);
  items = await cdp.eval(menuItems);
  console.log('   卷纲菜单:', JSON.stringify(items));
  check('卷纲菜单含「新建章纲」', items && items.按钮.some(i => i.includes('新建章纲')));
  check('卷纲菜单含「生成分卷」', items && items.按钮.some(i => i.includes('生成分卷')));
  check('卷纲菜单含「卷纲重命名」', items && items.按钮.some(i => i.includes('重命名')));
  check('卷纲菜单含「删除卷纲」', items && items.按钮.some(i => i.includes('删除卷纲')));

  // 行内按钮：卷纲保留「新建章纲」，章纲保留「删除」（系统条目除外）
  const inlineRoles = await cdp.eval(`
    (() => {
      const volRows=[...document.querySelectorAll('[data-outline-row="volume"]')];
      const chRows=[...document.querySelectorAll('[data-outline-row="chapter"]')];
      const roles=(el)=>el ? [...el.querySelectorAll('[data-role]')].map(e=>e.getAttribute('data-role')) : null;
      const sys=chRows.find(r=>(r.textContent||'').includes('第1卷卷纲'));
      const nor=chRows.find(r=>(r.textContent||'').includes('第1章 界面章纲'));
      return {
        卷纲行: roles(volRows[0]),
        普通章纲行: roles(nor),
        系统章纲行: roles(sys),
      };
    })()
  `);
  console.log('   行内按钮:', JSON.stringify(inlineRoles));
  check('卷纲行保留「新建章纲」按钮', inlineRoles.卷纲行 && inlineRoles.卷纲行.includes('add-chapter'));
  check('卷纲行无删除按钮（删除在右键菜单）', inlineRoles.卷纲行 && !inlineRoles.卷纲行.includes('delete'));
  check('普通章纲行保留「删除」按钮', inlineRoles.普通章纲行 && inlineRoles.普通章纲行.includes('delete'));
  check('系统章纲行无删除按钮', inlineRoles.系统章纲行 && !inlineRoles.系统章纲行.includes('delete'));

  // 行内「新建章纲」确实可用：点击后出现编号+标题草稿
  console.log('   点行内「新建章纲」:', await cdp.eval(`
    (() => {
      const r=document.querySelector('[data-outline-row="volume"]');
      const b=r && r.querySelector('[data-role="add-chapter"]');
      if(!b) return 'no-btn'; b.click(); return 'clicked';
    })()
  `));
  await sleep(1200);
  const inlineDraft = await cdp.eval(`
    (() => {
      const num=document.querySelector('input[type="number"][title^="第几"]');
      const title=document.querySelector('input[placeholder$="标题"]');
      return { 有编号: !!num, 编号: num?Number(num.value):null, 标题: title?title.value:null };
    })()
  `);
  console.log('   草稿:', JSON.stringify(inlineDraft));
  check('行内按钮可打开「编号 + 标题」草稿',
    inlineDraft.有编号 && /^第\d+章 章纲\d+$/.test(inlineDraft.标题 || ''),
    JSON.stringify(inlineDraft));
  // 期望序号 = 该卷下已有普通章纲数 + 1（系统条目「第N卷卷纲」不计入）
  const expectNum = (await J('GET', `/books/${book.id}/outlines`)).body.data
    .chapters.filter(c => c.parentId === v1.id && !c.isSystem).length + 1;
  check(`序号按普通章纲计数（期望 ${expectNum}，系统条目不计入）`,
    inlineDraft.编号 === expectNum, `number=${inlineDraft.编号}`);
  check('标题格式与章节一致「第N章 章纲N」',
    inlineDraft.标题 === `第${expectNum}章 章纲${expectNum}`, `title=${inlineDraft.标题}`);
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('title')||'').includes('取消')); if(b) b.click(); return 'ok'; })()`);
  await sleep(800);
  await cdp.eval(`document.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`); await sleep(400);

  // ===== ④ 生成流程（经右键菜单）=====
  console.log('\n【④ 生成分卷 / 章节（右键菜单）】');
  const clickMenuItem = (text) => `
    (() => {
      const all=[...document.querySelectorAll('div')].filter(d =>
        (d.className||'').toString().includes('z-50') && d.querySelector('button'));
      const m=all.length ? all[all.length-1] : null;
      if(!m) return 'no-menu';
      const b=[...m.querySelectorAll('button')].find(x=>(x.textContent||'').includes('${text}'));
      if(!b) return 'no-item';
      b.click(); return 'clicked';
    })()
  `;

  // 卷纲 -> 生成分卷
  await cdp.eval(openCtx('[data-outline-row="volume"]'));
  await sleep(700);
  console.log('   菜单点「生成分卷」:', await cdp.eval(clickMenuItem('生成分卷')));
  await sleep(2400);
  let g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('卷纲状态变为 synced', g.volumes.find(v => v.id === v1.id)?.syncState === 'synced');

  // 普通章纲 -> 生成章节
  await cdp.eval(`
    (() => {
      const rows=[...document.querySelectorAll('[data-outline-row="chapter"]')];
      const r=rows.find(x=>(x.textContent||'').includes('第1章 界面章纲'));
      if(!r) return 'no-row';
      r.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:200,clientY:300}));
      return 'fired';
    })()
  `);
  await sleep(700);
  console.log('   菜单点「生成章节」:', await cdp.eval(clickMenuItem('生成章节')));
  await sleep(2400);
  g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  const normal = g.chapters.find(c => !c.isSystem);
  const sysCh = g.chapters.find(c => c.isSystem);
  check('普通章纲变为 synced', normal?.syncState === 'synced', `state=${normal?.syncState}`);
  check('系统条目未受影响（仍 pending）', sysCh?.syncState === 'pending', `state=${sysCh?.syncState}`);

  // 截图仅作留档，失败不应中断断言（Electron 偶发截图超时）
  try {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 60 });
    writeFileSync(path.join(SHOTS, 'outline-unified.jpg'), Buffer.from(shot.data, 'base64'));
  } catch (e) { console.log('   截图跳过:', e.message); }

  // ===== ⑤ 改动提示 =====
  console.log('\n【⑤ 章纲改动提示】');
  await J('PATCH', `/books/${book.id}/outlines/${normal.id}`, { content: '原始章纲内容-改了' });
  await cdp.eval(clickByText('纲树')); await sleep(1500);   // 收起
  await cdp.eval(clickByText('纲树')); await sleep(2400);   // 再展开 -> 重新拉取
  const treeText2 = await cdp.eval(`document.body.innerText || ''`);
  check('提示「章纲有改动」', treeText2.includes('章纲有改动'));

  await J('DELETE', `/books/${book.id}`);
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  ws.close(); child.kill();
  await sleep(400);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
