// 验证「世界观」区域（条目即内容，无下级）：
//   ① 默认自带 8 个条目，顺序固定：时代信息/社会背景/力量体系/政治体系/经济体系/文化体系/地理位置/其他补充
//   ② 标题行右侧有「新增信息」按钮（样式/尺寸与角色行一致）
//   ③ 点新增 → 默认命名「其他补充」，排在最后
//   ④ 条目可点开填写内容并保存（这是「可填写的项」，不是分组标题）
//   ⑤ 不存在分组标题这一层（原先的「力量体系 > 武道境界」两层结构已取消）
import { loginDemo, makeClient, freshBook, selectBookInUi, openRelatedInUi } from './test-utils.mjs';

const PORT = Number(process.env.PORT || 9260);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DEFAULT_TITLES = ['时代信息', '社会背景', '力量体系', '政治体系', '经济体系', '文化体系', '地理位置', '其他补充'];

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

const rows = `[...document.querySelectorAll('[data-world-row="item"]')].map(x=>x.getAttribute('data-world-title'))`;

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

  // ① 默认条目
  console.log('\n【① 默认自带的条目】');
  const uiRows = await cdp.eval(rows);
  console.log('   界面条目:', JSON.stringify(uiRows));
  check('界面显示 8 个默认条目', Array.isArray(uiRows) && uiRows.length === 8, `count=${Array.isArray(uiRows) ? uiRows.length : 'n/a'}`);
  check('条目顺序与默认一致', Array.isArray(uiRows) && uiRows.join(',') === DEFAULT_TITLES.join(','),
    Array.isArray(uiRows) ? uiRows.join(',') : '');

  const apiRows = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('后端也补齐了 8 条', apiRows.length === 8, `count=${apiRows.length}`);
  check('后端按 sortOrder 升序返回',
    apiRows.every((s, i) => i === 0 || s.sortOrder >= apiRows[i - 1].sortOrder),
    apiRows.map((s) => s.sortOrder).join(','));

  // ② 标题行按钮
  console.log('\n【② 新增信息按钮】');
  const header = await cdp.eval(`
    (() => {
      const h=document.querySelector('[data-role="world-header"]');
      const btn=h && h.querySelector('[data-role="add-world-setting"]');
      const charBtn=document.querySelector('[data-role="new-character"]');
      if(!h||!btn) return { found:false };
      const r=btn.getBoundingClientRect(), hr=h.getBoundingClientRect();
      const round=(x)=>({w:Math.round(x.width),h:Math.round(x.height)});
      return { found:true, 标题:(h.textContent||'').trim(), 按钮标题:btn.title,
               按钮在右侧:r.left > hr.left + hr.width*0.5,
               尺寸与角色按钮一致: charBtn ? JSON.stringify(round(r))===JSON.stringify(round(charBtn.getBoundingClientRect())) : null };
    })()
  `);
  console.log('   标题行:', JSON.stringify(header));
  check('标题行文本为「世界观」（无计数）', header.标题 === '世界观', JSON.stringify(header.标题));
  check('右侧按钮标题为「新增信息」', header.按钮标题 === '新增信息', header.按钮标题);
  check('按钮位于名称右侧', header.按钮在右侧);
  check('按钮尺寸与角色行一致', header.尺寸与角色按钮一致 !== false);

  // ③ 新增 → 默认名「其他补充」，排在最后
  console.log('\n【③ 点新增】');
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="add-world-setting"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(2500);
  const afterAdd = await cdp.eval(rows);
  console.log('   新增后界面条目:', JSON.stringify(afterAdd));
  check('新增了第 9 条', Array.isArray(afterAdd) && afterAdd.length === 9, `count=${Array.isArray(afterAdd) ? afterAdd.length : 'n/a'}`);
  check('新增条目默认名为「其他补充」', Array.isArray(afterAdd) && afterAdd[8] === '其他补充', String(afterAdd && afterAdd[8]));
  const apiAfter = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  const last = apiAfter[apiAfter.length - 1];
  check('新增条目已落库且 sortOrder 最大', last.title === '其他补充' && last.sortOrder === Math.max(...apiAfter.map((s) => s.sortOrder)),
    `title=${last.title} sortOrder=${last.sortOrder}`);

  // ④ 点开条目填写内容并保存
  console.log('\n【④ 条目可填写内容】');
  await cdp.eval(`
    (() => {
      const r=[...document.querySelectorAll('[data-world-row="item"]')].find(x=>x.getAttribute('data-world-title')==='力量体系');
      if(!r) return 'not-found'; r.click(); return 'clicked';
    })()
  `);
  await sleep(1200);
  const editorOpen = await cdp.eval(`
    (() => {
      const ta=document.querySelector('textarea[placeholder*="力量体系"]');
      return ta ? { open:true } : { open:false, 有textarea: !!document.querySelector('textarea') };
    })()
  `);
  console.log('   编辑器:', JSON.stringify(editorOpen));
  check('点条目展开出可填写区域', editorOpen.open);

  await cdp.eval(`
    (() => {
      const ta=document.querySelector('textarea[placeholder*="力量体系"]');
      if(!ta) return 'no-ta';
      const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      set.call(ta,'共九境：炼体、开脉、凝气…');
      ta.dispatchEvent(new Event('input',{bubbles:true}));
      return 'ok';
    })()
  `);
  await sleep(400);
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/^保存$/.test((x.textContent||'').trim())); if(!b) return 'no-save'; b.click(); return 'clicked'; })()`);
  await sleep(2500);
  const saved = (await J('GET', `/books/${book.id}/world-settings`)).body.data.find((s) => s.title === '力量体系');
  check('内容已落库', !!saved && (saved.content || '').includes('共九境'), JSON.stringify((saved || {}).content));

  // ⑤ 不存在分组标题层
  // 判据：只比较 8 个默认条目的「出现次数」会被步骤③新增的同名第 9 条干扰，
  // 所以改为直接断言 —— 这些名字各自只对应一个条目行（data-world-row="item"），
  // 界面上不存在「属于条目行之外的同名文本」（那才是分组标题）。
  console.log('\n【⑤ 无分组层】');
  const grouping = await cdp.eval(`
    (() => {
      const titles=${JSON.stringify(DEFAULT_TITLES)};
      const rowTitles=[...document.querySelectorAll('[data-world-row="item"]')].map(x=>x.getAttribute('data-world-title'));
      const out={};
      for (const t of titles) {
        const rowCount=rowTitles.filter(x=>x===t).length;
        // 界面上等于该标题的整行数量（含非条目行）
        const lineCount=(document.body.innerText||'').split('\\n').map(s=>s.trim()).filter(l=>l===t).length;
        out[t]={ 条目行:rowCount, 整行:lineCount };
      }
      return { out, 条目行总数: rowTitles.length };
    })()
  `);
  console.log('   各默认条目:', JSON.stringify(grouping.out));
  console.log('   条目行总数:', grouping.条目行总数);
  const noGroupHeader = Object.entries(grouping.out).every(([, v]) => v.条目行 >= 1 && v.整行 <= v.条目行);
  check('默认条目都渲染成条目行', DEFAULT_TITLES.every((t) => grouping.out[t].条目行 >= 1));
  check('没有条目行之外的同名标题（即无分组标题层）', noGroupHeader,
    JSON.stringify(grouping.out));

  ws.close();
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
