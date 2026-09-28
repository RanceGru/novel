// 新建草稿行为验证：
//  ① 点新建 -> 出现编辑器，但数据库里还没有新记录（未落库）
//  ② 点 ✗ 取消 -> 编辑器消失，数据库仍无新记录
//  ③ 点 ✓ 确认 -> 新记录落库，标题与编号正确
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { loginDemo, makeClient, freshBook, seedBook, selectBookInUi, openTocInUi } from './test-utils.mjs';

const ROOT = 'E:/project/novel';
const CLIENT = path.join(ROOT, 'client');
const SHOTS = path.join(ROOT, '.tools/shots');
const PORT = 9228;
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
    if (r.exceptionDetails) throw new Error('页面异常: ' + JSON.stringify(r.exceptionDetails.exception));
    return r.result.value;
  }
}

const EDITOR = `
  (() => {
    const num = document.querySelector('input[type="number"][title^="第几"]');
    const title = document.querySelector('input[placeholder$="标题"]');
    const err = [...document.querySelectorAll('div')].filter(d =>
      d.children.length === 0 && /已存在/.test(d.textContent || ''));
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

async function main() {
  const auth = await loginDemo();
  const { H, J } = makeClient(auth.accessToken);
  // 用本套件专属的作品，并清掉上次遗留（否则已有第9卷会让默认编号断言漂移）
  const book = await freshBook(J, '草稿保存验证用书');
  await seedBook(J, book.id, { volumeCount: 2, chaptersOfFirst: 1 });
  const listVols = async () => (await J('GET', `/books/${book.id}/volumes`)).body.data;
  const listChs = async (vid) => (await J('GET', `/volumes/${vid}/chapters`)).body.data;

  const vols0 = await listVols();
  const normal0 = vols0.filter(v => v.title !== '默认').sort((a, b) => a.volumeNumber - b.volumeNumber);
  console.log('初始分卷:', normal0.map(v => `${v.volumeNumber}:${v.title}`).join(', '));

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
  console.log('选择作品:', await cdp.eval(selectBookInUi(book.title)));
  await sleep(2500);
  console.log('展开目录:', await cdp.eval(openTocInUi()));
  await sleep(2000);

  let pass = 0, fail = 0;
  const check = (label, cond) => { console.log(`   ${cond ? '✓' : '✗'} ${label}`); cond ? pass++ : fail++; };

  // ============ 分卷 ============
  console.log('\n【分卷】① 点新建分卷（应只开草稿，不落库）');
  await cdp.eval(`(() => { const b=document.querySelector('button[title="新建分卷"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1500);
  const draft = JSON.parse(await cdp.eval(EDITOR));
  console.log('   编辑器:', JSON.stringify(draft));
  const volsAfterOpen = await listVols();
  check('编辑器已打开', draft.open);
  check(`默认卷号 ${draft.number}（期望 ${Math.max(...normal0.map(v => v.volumeNumber)) + 1}）`,
        Number(draft.number) === Math.max(...normal0.map(v => v.volumeNumber)) + 1);
  check(`数据库未新增分卷（仍 ${normal0.length} 个）`, volsAfterOpen.filter(v => v.title !== '默认').length === normal0.length);

  const shot1 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, 'draft-volume.png'), Buffer.from(shot1.data, 'base64'));

  console.log('\n【分卷】② 点 ✗ 取消（应丢弃，不落库）');
  await cdp.eval(`(() => { const b=document.querySelector('button[title^="取消"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1200);
  const afterCancel = JSON.parse(await cdp.eval(EDITOR));
  const volsAfterCancel = await listVols();
  check('编辑器已关闭', !afterCancel.open);
  check(`数据库仍无新分卷（${volsAfterCancel.filter(v => v.title !== '默认').length} 个）`,
        volsAfterCancel.filter(v => v.title !== '默认').length === normal0.length);

  console.log('\n【分卷】③ 重新新建并改标题/卷号后点 ✓ 确认');
  await cdp.eval(`(() => { const b=document.querySelector('button[title="新建分卷"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1500);
  await cdp.eval(setVal('input[placeholder$="标题"]', '第四卷 落库验证'));
  await sleep(300);
  await cdp.eval(setVal('input[type="number"][title^="第几"]', '9'));
  await sleep(300);
  await cdp.eval(`(() => { const b=document.querySelector('button[title^="确认"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(2200);
  const afterConfirm = JSON.parse(await cdp.eval(EDITOR));
  const volsAfterConfirm = await listVols();
  const created = volsAfterConfirm.find(v => v.volumeNumber === 9);
  check('编辑器已关闭', !afterConfirm.open);
  check(`已落库第9卷（标题「${created?.title}」）`, !!created && created.title === '第四卷 落库验证');

  // ============ 章节 ============
  const targetVol = volsAfterConfirm.filter(v => v.title !== '默认').sort((a, b) => a.volumeNumber - b.volumeNumber)[0];
  console.log(`\n【章节】目标分卷「${targetVol.title}」`);
  console.log('   展开分卷:', await cdp.eval(`(() => { const rows=[...document.querySelectorAll('button')].filter(b=>/第\\d+卷/.test(b.textContent||'')); const r=rows.find(b=>b.textContent.includes('${targetVol.title}')); if(!r) return 'not-found'; r.click(); return 'ok'; })()`));
  await sleep(1800);
  const chs0 = await listChs(targetVol.id);
  console.log('   初始章号:', chs0.map(c => c.chapterNumber).join(',') || '(空)');

  console.log('   ① 点新建章节（应只开草稿）');
  await cdp.eval(`
    (() => {
      const rows=[...document.querySelectorAll('button')].filter(b=>/第\\d+卷/.test(b.textContent||''));
      const r=rows.find(b=>b.textContent.includes('${targetVol.title}'));
      const btn=r && r.querySelector('button[title="新建章节"]');
      if(btn) btn.click(); return 'ok';
    })()
  `);
  await sleep(1800);
  const chDraft = JSON.parse(await cdp.eval(EDITOR));
  console.log('   编辑器:', JSON.stringify(chDraft));
  const chsAfterOpen = await listChs(targetVol.id);
  const expCh = chs0.length ? Math.max(...chs0.map(c => c.chapterNumber)) + 1 : 1;
  check('编辑器已打开', chDraft.open);
  check(`默认章号 ${chDraft.number}（期望 ${expCh}）`, Number(chDraft.number) === expCh);
  check(`数据库未新增章节（仍 ${chs0.length} 章）`, chsAfterOpen.length === chs0.length);

  console.log('   ② 点 ✗ 取消');
  await cdp.eval(`(() => { const b=document.querySelector('button[title^="取消"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1200);
  const chsAfterCancel = await listChs(targetVol.id);
  check('编辑器已关闭', !JSON.parse(await cdp.eval(EDITOR)).open);
  check(`数据库仍 ${chs0.length} 章`, chsAfterCancel.length === chs0.length);

  console.log('   ③ 新建并点 ✓ 确认');
  await cdp.eval(`
    (() => {
      const rows=[...document.querySelectorAll('button')].filter(b=>/第\\d+卷/.test(b.textContent||''));
      const r=rows.find(b=>b.textContent.includes('${targetVol.title}'));
      const btn=r && r.querySelector('button[title="新建章节"]');
      if(btn) btn.click(); return 'ok';
    })()
  `);
  await sleep(1800);
  await cdp.eval(setVal('input[placeholder$="标题"]', '落库验证章'));
  await sleep(300);
  await cdp.eval(`(() => { const b=document.querySelector('button[title^="确认"]'); if(b) b.click(); return 'ok'; })()`);
  await sleep(2200);
  const chsFinal = await listChs(targetVol.id);
  const newCh = chsFinal.find(c => c.title === '落库验证章');
  check(`编辑器已关闭`, !JSON.parse(await cdp.eval(EDITOR)).open);
  check(`已落库「落库验证章」(第${newCh?.chapterNumber}章)`, !!newCh);

  const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(SHOTS, 'draft-confirmed.png'), Buffer.from(shot2.data, 'base64'));

  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  ws.close(); child.kill();
  await sleep(400);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
