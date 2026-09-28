// 验证「世界观」区域：
//   ① 标题行右侧有「新增信息」按钮，位置与角色行一致
//   ② 点按钮按 其他补充1、2、3… 递增命名，并真实落库（category=other）
//   ③ 「其他补充」不再作为一行分组标题出现
//   ④ 之前 404 的 store 路由（update/remove）已修好
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

  // 先放一条固定分类的条目，确认「有内容才显示分组」的行为
  await J('POST', `/books/${book.id}/world-settings`, { category: 'geography', title: '边城地图', content: '山川地形' });

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
  await sleep(2000);

  // ① 标题行
  console.log('\n【① 世界观标题行】');
  const header = await cdp.eval(`
    (() => {
      const h=document.querySelector('[data-role="world-header"]');
      if(!h) return { found:false };
      const btn=h.querySelector('[data-role="add-world-setting"]');
      const r=btn?btn.getBoundingClientRect():null;
      const hr=h.getBoundingClientRect();
      const charBtn=document.querySelector('[data-role="new-character"]');
      return {
        found:true, 文本:(h.textContent||'').trim(), 有按钮:!!btn,
        按钮在右侧: !!r && r.left > hr.left + hr.width*0.5,
        按钮标题: btn?btn.title:null,
        含计数: /\\d/.test((h.textContent||'').trim()),
        与角色按钮同尺寸: !!btn && !!charBtn
          ? JSON.stringify({w:Math.round(r.width),h:Math.round(r.height)}) ===
            JSON.stringify((({width,height})=>({w:Math.round(width),h:Math.round(height)}))(charBtn.getBoundingClientRect()))
          : null,
      };
    })()
  `);
  console.log('   标题行:', JSON.stringify(header));
  check('存在世界观标题行', header.found);
  check('标题行文本为「世界观」（无计数）', header.文本 === '世界观', JSON.stringify(header.文本));
  check('右侧有「新增信息」按钮', header.有按钮, header.按钮标题);
  check('按钮位于名称右侧', header.按钮在右侧);
  check('按钮尺寸与角色行的「新建角色」一致', header.与角色按钮同尺寸 !== false, String(header.与角色按钮同尺寸));

  // ② 连点三次 → 其他补充1/2/3
  console.log('\n【② 新增三条】');
  for (let i = 1; i <= 3; i++) {
    await cdp.eval(`(() => { const b=document.querySelector('[data-role="add-world-setting"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
    await sleep(2200);
    const api = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
    const others = api.filter((s) => s.category === 'other').map((s) => s.title);
    console.log(`   第 ${i} 次点击后 other 条目:`, JSON.stringify(others));
    check(`第 ${i} 次新增命名为「其他补充${i}」`, others.includes(`其他补充${i}`), JSON.stringify(others));
  }

  // ③ 界面上不再有「其他补充」分组标题，条目直接列出
  const ui = await cdp.eval(`
    (() => {
      const items=[...document.querySelectorAll('[data-role="world-other-item"]')].map(x=>(x.textContent||'').trim());
      const lines=(document.body.innerText||'').split('\\n').map(s=>s.trim());
      const catHeaderCount=lines.filter(l=>l==='其他补充').length;
      const geoHeader=lines.filter(l=>l==='地理位置').length;
      return { items, catHeaderCount, geoHeader };
    })()
  `);
  console.log('   界面:', JSON.stringify(ui));
  check('界面显示了三条其他补充', ui.items.length === 3, JSON.stringify(ui.items));
  check('没有「其他补充」分组标题', ui.catHeaderCount === 0, `count=${ui.catHeaderCount}`);
  check('有内容的固定分类（地理位置）仍显示分组', ui.geoHeader >= 1);

  // ④ store 路由（此前 404）
  console.log('\n【③ 修好的 store 路由】');
  const target = (await J('GET', `/books/${book.id}/world-settings`)).body.data.find((s) => s.category === 'other');
  const upd = await J('PATCH', `/books/${book.id}/world-settings/${target.id}`, { title: '其他补充1（改名验证）' });
  check('PATCH 走 /books/:bookId/world-settings/:id 成功', upd.status === 200, `status=${upd.status}`);
  const del = await J('DELETE', `/books/${book.id}/world-settings/${target.id}`);
  check('DELETE 走同一路径成功', del.status === 200, `status=${del.status}`);
  const after = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('删除后条目减少', after.length === 3, `count=${after.length}`);

  ws.close();
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
