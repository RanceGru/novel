// 回归验证（适配「确认才落库」的新行为）：
//  A. 分卷：默认号 / 重复拦截 / 改号后确认落库
//  B. 章节：默认号 / 重复拦截 / 右键重命名
//  C. 弹窗：分卷外创建 / 分卷内创建 的默认号
import { spawn } from 'node:child_process';
import path from 'node:path';
import { loginDemo, makeClient, freshBook, seedBook, selectBookInUi, openTocInUi } from './test-utils.mjs';

const ROOT = 'E:/project/novel';
const CLIENT = path.join(ROOT, 'client');
const PORT = 9229;
const API = 'http://localhost:3000/api/v1';
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
    if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  }
}

const EDITOR = `
  (() => {
    const num = document.querySelector('input[type="number"][title^="第几"]');
    const title = document.querySelector('input[placeholder$="标题"]');
    const err = [...document.querySelectorAll('div')].filter(d =>
      d.children.length === 0 && /已存在|有效的/.test(d.textContent || ''));
    return JSON.stringify({
      open: !!title,
      number: num ? num.value : null,
      title: title ? title.value : null,
      error: err.length ? err[0].textContent.trim() : null,
    });
  })()
`;

const setVal = (sel, v) => `
  (() => {
    const el = document.querySelector('${sel}');
    if (!el) return 'no-el';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, '${v}');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()
`;

const clickConfirm = `(() => { const b=document.querySelector('button[title^="确认"]'); if(b) b.click(); return b ? 'ok' : 'no-btn'; })()`;
const clickCancel = `(() => { const b=document.querySelector('button[title^="取消"]'); if(b) b.click(); return b ? 'ok' : 'no-btn'; })()`;
const expandBook = `(() => { const b=[...document.querySelectorAll('button')].filter(x=>x.querySelector('img')&&/字/.test(x.textContent||'')); if(b[0]) b[0].click(); return 'ok'; })()`;
const openToc = `(() => { const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='目录'); if(s[0]) (s[0].closest('div[class*="cursor-pointer"]')||s[0].parentElement).click(); return 'ok'; })()`;
const newVolume = `(() => { const b=document.querySelector('button[title="新建分卷"]'); if(b) b.click(); return b ? 'ok' : 'no-btn'; })()`;
const newChapterIn = (title) => `
  (() => {
    const rows=[...document.querySelectorAll('button')].filter(b=>/第\\d+卷/.test(b.textContent||''));
    const r=rows.find(b=>b.textContent.includes('${title}'));
    const btn=r && r.querySelector('button[title="新建章节"]');
    if(btn) btn.click(); return btn ? 'ok' : 'no-btn';
  })()`;

async function main() {
  const auth = await loginDemo();
  const { H, J } = makeClient(auth.accessToken);
  const book = await freshBook(J, '编号验证用书');
  await seedBook(J, book.id, { volumeCount: 2, chaptersOfFirst: 1 });
  const listVols = async () => (await J('GET', `/books/${book.id}/volumes`)).body.data;
  const listChs = async (vid) => (await J('GET', `/volumes/${vid}/chapters`)).body.data;

  let vols = await listVols();
  const normal = vols.filter(v => v.title !== '默认').sort((a, b) => a.volumeNumber - b.volumeNumber);
  const v1 = normal[0];
  console.log(`数据: 分卷 [${normal.map(v => v.volumeNumber)}]，「${v1.title}」章号 [${(await listChs(v1.id)).map(c => c.chapterNumber).sort((a, b) => a - b)}]`);

  const electronBin = path.join(CLIENT, 'node_modules/electron/dist/electron.exe');
  const child = spawn(electronBin, ['.', `--remote-debugging-port=${PORT}`], {
    cwd: CLIENT, env: { ...process.env, VITE_DEV_SERVER_URL: 'http://localhost:5173' },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  let target = null;
  for (let i = 0; i < 40; i++) {
    await sleep(500);
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      target = list.find((t) => t.type === 'page' && t.url.includes('5173'));
      if (target) break;
    } catch { /* 等待 */ }
  }
  if (!target) throw new Error('无法连接调试端口');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.addEventListener('open', res, { once: true }); ws.addEventListener('error', rej, { once: true }); });
  const cdp = new CDP(ws);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.eval(`
    localStorage.setItem('novel-auth', ${JSON.stringify(JSON.stringify({
      state: { isAuthenticated: true, accessToken: auth.accessToken, refreshToken: auth.refreshToken, user: auth.user },
      version: 0 }))});
    location.replace('http://localhost:5173/workspace'); 'ok'
  `);
  await sleep(6000);
  // 点作品行 = 切换当前作品并展开；再点「目录」展开页签
  // （不要再点一次作品行，那会把它收起来）
  console.log('选择作品:', await cdp.eval(selectBookInUi(book.title)));
  await sleep(2500);
  console.log('展开目录:', await cdp.eval(openTocInUi()));
  await sleep(2000);

  let pass = 0, fail = 0;
  const check = (label, cond) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); cond ? pass++ : fail++; };

  // ---------- A. 分卷 ----------
  console.log('\n【A. 分卷】');
  await cdp.eval(newVolume); await sleep(1500);
  let e = JSON.parse(await cdp.eval(EDITOR));
  const expVol = Math.max(...normal.map(v => v.volumeNumber)) + 1;
  check(`默认卷号 ${e.number}（期望 ${expVol}）`, Number(e.number) === expVol);

  await cdp.eval(setVal('input[type="number"][title^="第几"]', String(normal[0].volumeNumber)));
  await sleep(300);
  await cdp.eval(clickConfirm); await sleep(1200);
  e = JSON.parse(await cdp.eval(EDITOR));
  check(`重复卷号被拦截：「${e.error}」`, !!e.error && e.error.includes('已存在') && e.open);
  check('数据库未新增分卷', (await listVols()).filter(v => v.title !== '默认').length === normal.length);

  await cdp.eval(setVal('input[type="number"][title^="第几"]', String(expVol)));
  await sleep(300);
  await cdp.eval(clickConfirm); await sleep(2200);
  check('编辑器已关闭', !JSON.parse(await cdp.eval(EDITOR)).open);
  check(`卷号 ${expVol} 已落库`, (await listVols()).some(v => v.volumeNumber === expVol));

  // ---------- B. 章节 ----------
  console.log('\n【B. 章节】');
  const chs0 = await listChs(v1.id);
  const expCh = chs0.length ? Math.max(...chs0.map(c => c.chapterNumber)) + 1 : 1;
  await cdp.eval(newChapterIn(v1.title)); await sleep(1800);
  e = JSON.parse(await cdp.eval(EDITOR));
  check(`默认章号 ${e.number}（期望 ${expCh}）`, Number(e.number) === expCh);

  await cdp.eval(setVal('input[type="number"][title^="第几"]', String(chs0[0].chapterNumber)));
  await sleep(300);
  await cdp.eval(clickConfirm); await sleep(1200);
  e = JSON.parse(await cdp.eval(EDITOR));
  check(`重复章号被拦截：「${e.error}」`, !!e.error && e.error.includes('已存在') && e.open);
  check('数据库未新增章节', (await listChs(v1.id)).length === chs0.length);

  await cdp.eval(clickCancel); await sleep(900);
  check('取消后编辑器关闭且未落库', !JSON.parse(await cdp.eval(EDITOR)).open && (await listChs(v1.id)).length === chs0.length);

  // 右键重命名第1章
  await cdp.eval(`
    (() => {
      const t=[...document.querySelectorAll('button')].filter(b=>/^第\\d+章 /.test((b.textContent||'').trim()))
        .find(b=>b.textContent.trim().startsWith('第${chs0[0].chapterNumber}章'));
      if(!t) return 'no-chapter';
      t.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:200,clientY:300}));
      return 'ok';
    })()
  `);
  await sleep(900);
  await cdp.eval(`(() => { const m=[...document.querySelectorAll('button')].filter(b=>(b.textContent||'').includes('章节重命名')); if(m[0]) m[0].click(); return 'ok'; })()`);
  await sleep(1200);
  e = JSON.parse(await cdp.eval(EDITOR));
  check(`重命名编辑器带出当前章号 ${e.number}`, Number(e.number) === chs0[0].chapterNumber);
  await cdp.eval(setVal('input[placeholder$="标题"]', '重命名回归验证'));
  await sleep(300);
  await cdp.eval(clickConfirm); await sleep(2000);
  const renamed = (await listChs(v1.id)).find(c => c.title === '重命名回归验证');
  check('重命名已落库且号未变', !!renamed && renamed.chapterNumber === chs0[0].chapterNumber);

  // ---------- C. 弹窗 ----------
  console.log('\n【C. 新建章节弹窗】');
  await cdp.eval(`(() => { const b=document.querySelector('button[title="新建章节"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1200);
  await cdp.eval(`
    (() => {
      const sp=[...document.querySelectorAll('span')].find(s=>(s.textContent||'').trim()==='分卷外创建');
      if(sp) (sp.closest('button')||sp.parentElement).click(); return 'ok';
    })()
  `);
  await sleep(1800);
  e = JSON.parse(await cdp.eval(EDITOR));
  const defVol = (await listVols()).find(v => v.title === '默认');
  const defChs = defVol ? await listChs(defVol.id) : [];
  const expDef = defChs.length ? Math.max(...defChs.map(c => c.chapterNumber)) + 1 : 1;
  check(`分卷外创建默认号 ${e.number}（期望 ${expDef}）`, Number(e.number) === expDef);
  await cdp.eval(clickCancel); await sleep(900);

  await cdp.eval(`(() => { const b=document.querySelector('button[title="新建章节"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1200);
  await cdp.eval(`
    (() => {
      const sp=[...document.querySelectorAll('span')].find(s=>(s.textContent||'').trim()==='分卷内创建');
      const sm=sp && sp.closest('summary'); if(sm) sm.click(); return 'ok';
    })()
  `);
  await sleep(900);
  await cdp.eval(`
    (() => {
      const sp=[...document.querySelectorAll('span')].find(s=>(s.textContent||'').trim()==='分卷内创建');
      const box=sp && sp.closest('details'); if(!box) return 'no-details';
      const t=[...box.querySelectorAll('button')].find(b=>(b.textContent||'').includes('${v1.title}'));
      if(t) t.click(); return 'ok';
    })()
  `);
  await sleep(1800);
  e = JSON.parse(await cdp.eval(EDITOR));
  const chsNow = await listChs(v1.id);
  const expIn = chsNow.length ? Math.max(...chsNow.map(c => c.chapterNumber)) + 1 : 1;
  check(`分卷内创建默认号 ${e.number}（期望 ${expIn}）`, Number(e.number) === expIn);

  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  ws.close(); child.kill();
  await sleep(400);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
