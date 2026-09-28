// 验证：细纲与「目录」同构（缩进/字号/箭头/按钮位置），且卷纲自带系统章纲
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loginDemo, makeClient, freshBook } from './test-utils.mjs';

const CLIENT = 'E:/project/novel/client';
const SHOTS = 'E:/project/novel/.tools/shots';
const PORT = 9253;
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

/** 读取一个元素的布局签名：左内边距、上下内边距、字号、子按钮/角色标记 */
const SIG = (sel) => `
  (() => {
    const el=${sel};
    if(!el) return null;
    const cs=getComputedStyle(el);
    return {
      paddingLeft: cs.paddingLeft,
      paddingTop: cs.paddingTop,
      fontSize: cs.fontSize,
      按钮: [...el.querySelectorAll('button')].map(b=>b.getAttribute('title')||b.getAttribute('data-role')||'(无)'),
      角色: [...el.querySelectorAll('[data-role]')].map(e=>e.getAttribute('data-role')),
      svg尺寸: [...el.querySelectorAll('svg')].map(s=>s.getAttribute('width')||s.getAttribute('height')||'?'),
    };
  })()
`;

let pass = 0, fail = 0;
const check = (l, c, extra = '') => { console.log(`   ${c ? '✓' : '✗'} ${l}${extra ? ' ' + extra : ''}`); c ? pass++ : fail++; };

async function main() {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);

  // 数据：一个真实分卷（用于目录对照）+ 一个卷纲（细纲内）
  // 先清掉上次遗留，保证编号断言起点确定
  const book = await freshBook(J, '细纲对齐验证');
  const vol = (await J('POST', `/books/${book.id}/volumes`, { title: '风起', volumeNumber: 1 })).body.data;
  await J('POST', `/volumes/${vol.id}/chapters`, { title: '起点', chapterNumber: 1 });
  await J('POST', `/books/${book.id}/outlines`, { level: 'volume_outline', title: '风起' });
  await J('PATCH', `/books/${book.id}/outlines/book-outline`, { content: '总纲内容' });
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
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].filter(x=>x.querySelector('img')&&/字/.test(x.textContent||'')); const r=b.find(x=>x.textContent.includes('细纲对齐验证')); if(r) r.click(); return 'ok'; })()`);
  await sleep(1600);

  // 目录 header 用精确选择器：同时含「目录」文本与「新建分卷」按钮的**最内层** div
  const TOC_HDR = `(() => {
    const all=[...document.querySelectorAll('div')].filter(d =>
      (d.textContent||'').includes('目录') && d.querySelector('button[title="新建分卷"]'));
    return all.length ? all[all.length-1] : null;
  })()`;
  const TOC_VOL_ROW = `[...document.querySelectorAll('button')].find(b=>/^第\\d+卷 /.test((b.textContent||'').trim()))`;
  // 章节行：目录里用 pl-16 固定缩进，比文本匹配更可靠（避免匹配到祖先容器）
  const TOC_CH_ROW = `document.querySelector('div.pl-16.py-1')`;

  // ===== 阶段 A：先量「目录」 =====
  console.log('\n【阶段 A：目录基准】');
  await cdp.eval(clickByText('目录')); await sleep(2200);
  // 目录的分卷默认折叠，需先展开才能渲染出章节行
  console.log('   展开分卷以渲染章节行:', await cdp.eval(`
    (() => {
      const b=${TOC_VOL_ROW};
      if(!b) return 'no-vol-row';
      b.click(); return 'clicked';
    })()
  `));
  await sleep(1800);
  const tocHdr = await cdp.eval(SIG(TOC_HDR));
  const tocVolRow = await cdp.eval(SIG(TOC_VOL_ROW));
  const tocChRow = await cdp.eval(SIG(TOC_CH_ROW));
  console.log('   目录 header:', JSON.stringify(tocHdr));
  console.log('   分卷行     :', JSON.stringify(tocVolRow));
  console.log('   章节行     :', JSON.stringify(tocChRow));
  check('取到目录基准数据', !!tocHdr && !!tocVolRow);
  check('取到目录章节行', !!tocChRow);

  // ===== 阶段 B：切到相关 → 纲树，量细纲 =====
  console.log('\n【阶段 B：细纲对齐】');
  await cdp.eval(clickByText('目录')); await sleep(900);   // 收起目录
  await cdp.eval(clickByText('相关')); await sleep(1300);
  await cdp.eval(clickByText('纲树')); await sleep(2300);

  const detailedHdr = await cdp.eval(SIG(`document.querySelector('[data-outline-row="detailed"]')`));
  const volOutlineRow = await cdp.eval(SIG(`document.querySelector('[data-outline-row="volume"]')`));
  const chOutlineRow = await cdp.eval(SIG(`document.querySelector('[data-outline-row="chapter"]')`));
  console.log('   细纲 header:', JSON.stringify(detailedHdr));
  console.log('   卷纲行     :', JSON.stringify(volOutlineRow));
  console.log('   章纲行     :', JSON.stringify(chOutlineRow));

  console.log('\n【① 细纲 header vs 目录 header】');
  check('细纲 header 存在', !!detailedHdr);
  check('paddingLeft 一致', detailedHdr && tocHdr && detailedHdr.paddingLeft === tocHdr.paddingLeft,
    `${detailedHdr?.paddingLeft} vs ${tocHdr?.paddingLeft}`);
  check('paddingTop 一致', detailedHdr && tocHdr && detailedHdr.paddingTop === tocHdr.paddingTop,
    `${detailedHdr?.paddingTop} vs ${tocHdr?.paddingTop}`);
  check('fontSize 一致', detailedHdr && tocHdr && detailedHdr.fontSize === tocHdr.fontSize,
    `${detailedHdr?.fontSize} vs ${tocHdr?.fontSize}`);
  check('细纲有两个入口按钮（新建卷纲/新建章纲）',
    detailedHdr && detailedHdr.按钮.includes('新建卷纲') && detailedHdr.按钮.includes('新建章纲'),
    `buttons=${JSON.stringify(detailedHdr?.按钮)}`);
  // 图例：箭头之后不应再有装饰性图标（仅保留箭头 + 文本 + 两个入口按钮）
  check('细纲左侧无多余图例（svg 数 = 箭头1 + 两个按钮图标2 = 3）',
    detailedHdr && detailedHdr.svg尺寸.length === 3, `svg=${JSON.stringify(detailedHdr?.svg尺寸)}`);

  console.log('\n【② 卷纲行 vs 分卷行】');
  check('卷纲行存在', !!volOutlineRow);
  check('paddingLeft 一致', volOutlineRow && tocVolRow && volOutlineRow.paddingLeft === tocVolRow.paddingLeft,
    `${volOutlineRow?.paddingLeft} vs ${tocVolRow?.paddingLeft}`);
  check('fontSize 一致', volOutlineRow && tocVolRow && volOutlineRow.fontSize === tocVolRow.fontSize,
    `${volOutlineRow?.fontSize} vs ${tocVolRow?.fontSize}`);
  check('卷纲行保留「新建章纲」按钮（同分卷行的 +）',
    volOutlineRow && volOutlineRow.角色.includes('add-chapter'),
    `roles=${JSON.stringify(volOutlineRow?.角色)}`);

  console.log('\n【③ 章纲行 vs 章节行】');
  check('章纲行存在', !!chOutlineRow);
  check('paddingLeft 一致', chOutlineRow && tocChRow && chOutlineRow.paddingLeft === tocChRow.paddingLeft,
    `${chOutlineRow?.paddingLeft} vs ${tocChRow?.paddingLeft}`);
  check('fontSize 一致', chOutlineRow && tocChRow && chOutlineRow.fontSize === tocChRow.fontSize,
    `${chOutlineRow?.fontSize} vs ${tocChRow?.fontSize}`);

  const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, 'outline-aligned.png'), Buffer.from(shot1.data, 'base64'));

  // ④ 新建卷纲：左编号 + 右标题，默认 卷纲2
  console.log('\n【④ 新建卷纲：编号 + 标题两块】');
  console.log('   点「新建卷纲」:', await cdp.eval(`(() => { const b=document.querySelector('[data-outline-row="detailed"] [data-role="add-volume"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`));
  await sleep(1200);
  const draft = await cdp.eval(`
    (() => {
      const num=document.querySelector('input[type="number"][title^="第几"]');
      const title=document.querySelector('input[placeholder$="标题"]');
      return { 有编号框: !!num, 编号: num?num.value:null, 标题: title?title.value:null };
    })()
  `);
  console.log('   草稿:', JSON.stringify(draft));
  check('出现编号选择框（左侧）', draft.有编号框);
  check('出现标题输入框（右侧）', draft.标题 !== null);
  check('编号默认为 2（已有 1 个卷纲）', Number(draft.编号) === 2, `number=${draft.编号}`);
  check('标题默认「卷纲2」', draft.标题 === '卷纲2', `title=${draft.标题}`);

  // 点 ✗ 取消不应落库
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('title')||'').includes('取消')); if(b) b.click(); return 'ok'; })()`);
  await sleep(1200);
  let g0 = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('取消后未落库（仍 1 个卷纲）', g0.volumes.length === 1, `count=${g0.volumes.length}`);

  // 重新打开并点 ✓ 落库
  await cdp.eval(`(() => { const b=document.querySelector('[data-outline-row="detailed"] [data-role="add-volume"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1000);
  await cdp.eval(`
    (() => {
      const el=document.querySelector('input[placeholder$="标题"]');
      if(!el) return 'no-el';
      const setter=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      setter.call(el,'第二卷·云涌'); el.dispatchEvent(new Event('input',{bubbles:true})); return 'ok';
    })()
  `);
  await sleep(300);
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('title')||'').includes('确认')); if(b) b.click(); return 'ok'; })()`);
  await sleep(2200);

  const g = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  const v2 = g.volumes.find(v => v.title === '第二卷·云涌');
  const sys2 = g.chapters.find(c => c.parentId === v2?.id);
  check('卷纲已创建', !!v2);
  check('自动带出系统章纲「第2卷卷纲」', sys2?.title === '第2卷卷纲', `title=${sys2?.title}`);
  check('该条为 isSystem（不可删除）', sys2?.isSystem === true);

  // ⑤ 新建章纲：左编号 + 右标题，默认 章纲N（入口在卷纲的右键菜单）
  console.log('\n【⑤ 新建章纲：编号 + 标题两块】');
  console.log('   右键卷纲行:', await cdp.eval(`
    (() => {
      const r=document.querySelector('[data-outline-row="volume"]');
      if(!r) return 'no-row';
      r.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:200,clientY:300}));
      return 'fired';
    })()
  `));
  await sleep(800);
  console.log('   菜单点「新建章纲」:', await cdp.eval(`
    (() => {
      const all=[...document.querySelectorAll('div')].filter(d =>
        (d.className||'').toString().includes('z-50') && d.querySelector('button'));
      const m=all.length ? all[all.length-1] : null;
      if(!m) return 'no-menu';
      const b=[...m.querySelectorAll('button')].find(x=>(x.textContent||'').includes('新建章纲'));
      if(!b) return 'no-item'; b.click(); return 'clicked';
    })()
  `));
  await sleep(1200);
  const chDraft = await cdp.eval(`
    (() => {
      const num=document.querySelector('input[type="number"][title^="第几"]');
      const title=document.querySelector('input[placeholder$="标题"]');
      return { 有编号框: !!num, 编号: num?num.value:null, 标题: title?title.value:null };
    })()
  `);
  console.log('   草稿:', JSON.stringify(chDraft));
  check('出现编号选择框', chDraft.有编号框);
  check('标题默认格式「第N章 章纲N」（同章节命名）',
    /^第\d+章 章纲\d+$/.test(chDraft.标题 || ''), `title=${chDraft.标题}`);
  check('默认序号从 1 开始（系统条目「第1卷卷纲」不计入）',
    Number(chDraft.编号) === 1, `number=${chDraft.编号}`);
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>(x.getAttribute('title')||'').includes('取消')); if(b) b.click(); return 'ok'; })()`);
  await sleep(900);

  const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, 'outline-aligned-created.png'), Buffer.from(shot2.data, 'base64'));

  await J('DELETE', `/books/${book.id}`);
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  ws.close(); child.kill();
  await sleep(400);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
