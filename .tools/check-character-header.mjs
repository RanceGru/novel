// 验证「相关 → 角色」标题行的调整：
//   ① 标题行只有 箭头 + 「角色」+ 右侧「新建角色」按钮
//   ② 不再显示 👤 与计数（例如「👤 角色 (0)」）
//   ③ 展开后列表内不再有重复的角色标题行
//   ④ 点右侧按钮能打开「新建角色」对话框（这是本次唯一的功能要求）
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
}

async function main() {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);
  const book = await freshBook(J, '角色标题行验证书');
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

  // ① 标题行内容与结构
  console.log('\n【① 角色标题行】');
  const header = await cdp.eval(`
    (() => {
      const h=document.querySelector('[data-role="character-header"]');
      if(!h) return { found:false };
      const btn=h.querySelector('[data-role="new-character"]');
      const r=btn?btn.getBoundingClientRect():null;
      const hr=h.getBoundingClientRect();
      return {
        found:true,
        文本:(h.textContent||'').trim(),
        有新建按钮: !!btn,
        按钮在名称右侧: !!r && r.left > hr.left + hr.width * 0.5,
        按钮标题: btn ? btn.title : null,
      };
    })()
  `);
  console.log('   标题行:', JSON.stringify(header));
  check('存在角色标题行', header.found);
  check('标题行文本为「角色」', header.文本 === '角色', JSON.stringify(header.文本));
  check('右侧有「新建角色」按钮', header.有新建按钮);
  check('按钮位于名称右侧', header.按钮在名称右侧);

  // ② 不应再出现 👤 与「角色 (0)」这类文案
  const bodyText = await cdp.eval(`document.body.innerText || ''`);
  check('不含 👤 图标', !bodyText.includes('👤'));
  check('不含「角色 (数字)」计数文案', !/角色\s*\(\d+\)/.test(bodyText),
    (bodyText.match(/角色[^\n]*/g) || []).slice(0, 2).join(' | '));

  // ③ 展开后列表内无重复标题行
  console.log('\n【② 展开列表】');
  await cdp.eval(`(() => { const h=document.querySelector('[data-role="character-header"]'); h.click(); return 'ok'; })()`);
  await sleep(2000);
  const dup = await cdp.eval(`
    (() => {
      const headers=[...document.querySelectorAll('[data-role="character-header"]')].length;
      const listHeaders=[...document.querySelectorAll('span')].filter(s=>/^👤/.test((s.textContent||'').trim())).length;
      const rows=[...document.querySelectorAll('[data-char-row="character"]')].map(r=>(r.textContent||'').trim());
      return { headers, listHeaders, rows };
    })()
  `);
  console.log('   展开后:', JSON.stringify(dup));
  check('只有一行角色标题', dup.headers === 1, `count=${dup.headers}`);
  check('列表内无重复标题（无 👤 行）', dup.listHeaders === 0);
  check('角色行正常渲染', dup.rows.some((r) => r.includes('林逸')), JSON.stringify(dup.rows));

  // ④ 点右侧按钮打开新建角色对话框
  console.log('\n【③ 点「新建角色」】');
  // 先收起，验证「收起状态下点按钮也能打开」（会自动展开）
  await cdp.eval(`(() => { const h=document.querySelector('[data-role="character-header"]'); h.click(); return 'ok'; })()`);
  await sleep(1500);
  const collapsedClick = await cdp.eval(`
    (() => {
      const b=document.querySelector('[data-role="new-character"]');
      if(!b) return 'no-btn'; b.click(); return 'clicked';
    })()
  `);
  console.log('   收起状态下点击:', collapsedClick);
  await sleep(2000);
  const dlg = await cdp.eval(`
    (() => {
      const d=[...document.querySelectorAll('div.fixed.inset-0')].find(x=>/新建角色|编辑角色/.test(x.textContent||''));
      if(!d) return { open:false };
      return { open:true, 标题:(d.querySelector('h3')?.textContent||'').trim(),
               有提交按钮: [...d.querySelectorAll('button')].some(b=>/创建角色/.test(b.textContent||'')) };
    })()
  `);
  console.log('   对话框:', JSON.stringify(dlg));
  check('收起状态下点按钮也能打开对话框', dlg.open);
  check('对话框为「新建角色」', dlg.标题 === '新建角色', JSON.stringify(dlg.标题));
  check('对话框有「创建角色」按钮', dlg.有创建角色 ?? dlg.有提交按钮);

  // 关闭对话框
  await cdp.eval(`
    (() => {
      const d=[...document.querySelectorAll('div.fixed.inset-0')].find(x=>/新建角色/.test(x.textContent||''));
      if(!d) return 'no-dialog';
      const b=[...d.querySelectorAll('button')].find(x=>!x.textContent.trim());
      if(b) b.click(); return 'closed';
    })()
  `);

  // 截图仅作留档，失败不应影响断言结论
  try {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70, captureBeyondViewport: false });
    if (shot && shot.data) {
      const { writeFileSync } = await import('node:fs');
      writeFileSync('E:/project/novel/.tools/shots/character-header.jpg', Buffer.from(shot.data, 'base64'));
      console.log('\n   截图: .tools/shots/character-header.jpg');
    } else {
      console.log('\n   截图跳过（未返回数据）');
    }
  } catch (e) { console.log('\n   截图跳过:', e.message); }

  ws.close();
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
