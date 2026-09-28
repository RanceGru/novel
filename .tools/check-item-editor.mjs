// 验证「左栏点击条目 → 中间文本编辑器」这条通道：
//   · 大纲 / 卷纲 / 章纲 / 角色子项 / 世界观条目，点击后中间区域切到条目编辑器
//   · 在编辑器里改写内容 → 保存 → 真的落库（各自接口）
//   · 点击目录里的章节 → 中间区域切回正文编辑器（RichEditor）
import { loginDemo, makeClient, freshBook, seedBook, selectBookInUi, openRelatedInUi } from './test-utils.mjs';

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
    if (r.exceptionDetails) return { __err: (r.exceptionDetails.exception?.description || '').slice(0, 300) };
    return r.result.value;
  }
  async click(selectorJs) {
    return this.eval(`
      (() => {
        const el=${selectorJs};
        if(!el) return 'not-found';
        el.click();
        return 'clicked';
      })()
    `);
  }
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
    await sleep(500);
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

/** 中间区域当前是什么编辑器 */
const centerState = `
  (() => {
    const item = document.querySelector('[data-role="item-content"]');
    const titleEl = document.querySelector('[data-role="item-title"]');
    const tiptap = document.querySelector('.tiptap-editor');
    return {
      条目编辑器: !!item,
      条目标题: titleEl ? (titleEl.value !== undefined ? titleEl.value : titleEl.textContent) : null,
      内容框值: item ? item.value : null,
      正文编辑器: !!tiptap,
    };
  })()
`;

async function main() {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);
  const book = await freshBook(J, '条目编辑器验证书');
  await seedBook(J, book.id, { volumeCount: 1, chaptersOfFirst: 1 });

  // 准备数据：卷纲 + 章纲 + 角色(含子项) + 世界观条目
  const volOutline = (await J('POST', `/books/${book.id}/outlines`, { level: 'volume_outline', title: '第一卷 试炼' })).body.data;
  await J('POST', `/books/${book.id}/outlines`, { level: 'chapter_outline', title: '第1章 章纲1', content: '原始章纲', parentId: volOutline.id });
  const ch = (await J('POST', `/books/${book.id}/characters`, { name: '林逸', category: 'protagonist' })).body.data;
  const secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  const bg = secs.find((s) => s.title === '背景');
  await J('PATCH', `/books/${book.id}/world-settings/placeholder`, {}).catch(() => {});
  await J('GET', `/books/${book.id}/world-settings`);   // 触发默认条目补齐
  const ws = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  const era = ws.find((s) => s.title === '时代信息');

  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const t = list.find((x) => x.type === 'page' && x.url.includes('5173'));
  if (!t) throw new Error(`未找到窗口（调试端口 ${PORT}）`);
  const sock = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { sock.addEventListener('open', r, { once: true }); sock.addEventListener('error', j, { once: true }); });
  const cdp = new CDP(sock);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable');
  await cdp.send('Page.reload');
  await sleep(8000);

  console.log('选择作品:', await cdp.eval(selectBookInUi(book.title)));
  await sleep(2500);
  console.log('展开相关:', await cdp.eval(openRelatedInUi()));
  await sleep(2000);
  console.log('展开纲树:', await cdp.eval(clickSpan('纲树')));
  await sleep(2500);

  /** 在条目编辑器里写入内容并保存 */
  const writeAndSave = async (text) => {
    await cdp.eval(`
      (() => {
        const el=document.querySelector('[data-role="item-content"]');
        if(!el) return 'no-editor';
        const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
        set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input',{bubbles:true}));
        return 'ok';
      })()
    `);
    await sleep(400);
    await cdp.eval(`(() => { const b=document.querySelector('[data-role="item-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
    await sleep(2500);
  };

  // ===== ① 大纲 =====
  console.log('\n【① 大纲 → 中间编辑器】');
  await cdp.click(`document.querySelector('[data-outline-row="book"]')`);
  await sleep(1500);
  let st = await cdp.eval(centerState);
  console.log('   中间区域:', JSON.stringify(st));
  check('点击大纲切到条目编辑器', st.条目编辑器);
  check('标题显示「大纲」', st.条目标题 === '大纲', JSON.stringify(st.条目标题));
  await writeAndSave('全书总纲：测试大纲内容 A');
  let outline = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('大纲内容已落库', (outline.bookOutline?.content || '').includes('测试大纲内容 A'),
    JSON.stringify(outline.bookOutline?.content));

  // ===== ② 卷纲 =====
  console.log('\n【② 卷纲 → 中间编辑器】');
  await cdp.hover(`document.querySelector('[data-outline-row="volume"]')`);
  console.log('   点行内编辑按钮:', await cdp.click(`document.querySelector('[data-outline-row="volume"] [data-role="open-doc"]')`));
  await sleep(1500);
  st = await cdp.eval(centerState);
  console.log('   中间区域:', JSON.stringify(st));
  check('点击卷纲切到条目编辑器', st.条目编辑器);
  check('标题显示卷纲名称', (st.条目标题 || '').includes('第一卷 试炼'), JSON.stringify(st.条目标题));
  await writeAndSave('本卷讲述初入宗门。');
  outline = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('卷纲内容已落库',
    outline.volumes.some((v) => (v.content || '').includes('本卷讲述初入宗门')),
    JSON.stringify(outline.volumes.map((v) => v.content)));

  // ===== ③ 章纲 =====
  console.log('\n【③ 章纲 → 中间编辑器】');
  // 注意：卷纲下的第一行是系统条目「第1卷卷纲」，要按标题选中真正的章纲
  await cdp.click(`[...document.querySelectorAll('[data-outline-row="chapter"]')].find(r=>(r.textContent||'').includes('章纲1'))`);
  await sleep(1500);
  st = await cdp.eval(centerState);
  console.log('   中间区域:', JSON.stringify(st));
  check('点击章纲切到条目编辑器', st.条目编辑器);
  check('标题显示章纲名称', (st.条目标题 || '').includes('章纲1'), JSON.stringify(st.条目标题));
  await writeAndSave('第1章要点：入门试炼。');
  outline = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('章纲内容已落库',
    outline.chapters.some((c) => (c.content || '').includes('第1章要点')),
    JSON.stringify(outline.chapters.map((c) => c.content)));

  // ===== ④ 角色子项 =====
  console.log('\n【④ 角色子项 → 中间编辑器】');
  await cdp.eval(clickSpan('角色'));
  await sleep(2000);
  await cdp.click(`document.querySelector('[data-char-row="character"]')`);
  await sleep(1200);
  await cdp.click(`document.querySelector('[data-char-row="section"][data-section-title="背景"]')`);
  await sleep(1500);
  st = await cdp.eval(centerState);
  console.log('   中间区域:', JSON.stringify(st));
  check('点击角色子项切到条目编辑器', st.条目编辑器);
  check('标题显示子项名称', st.条目标题 === '背景', JSON.stringify(st.条目标题));
  await writeAndSave('出身边城，父母双亡。');
  const secsAfter = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  check('子项内容已落库',
    (secsAfter.find((s) => s.id === bg.id)?.content || '').includes('出身边城'),
    JSON.stringify(secsAfter.find((s) => s.id === bg.id)?.content));

  // ===== ⑤ 世界观条目 =====
  console.log('\n【⑤ 世界观条目 → 中间编辑器】');
  await cdp.eval(clickSpan('世界观'));
  await sleep(2000);
  await cdp.click(`document.querySelector('[data-world-row="fixed"][data-world-title="时代信息"]')`);
  await sleep(1500);
  st = await cdp.eval(centerState);
  console.log('   中间区域:', JSON.stringify(st));
  check('点击世界观条目切到条目编辑器', st.条目编辑器);
  check('标题显示条目名称', st.条目标题 === '时代信息', JSON.stringify(st.条目标题));
  await writeAndSave('大梁王朝末年，天下将乱。');
  const wsAfter = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  check('世界观内容已落库',
    (wsAfter.find((s) => s.id === era.id)?.content || '').includes('大梁王朝末年'),
    JSON.stringify(wsAfter.find((s) => s.id === era.id)?.content));

  // ===== ⑥ 点击章节 → 切回正文编辑器 =====
  console.log('\n【⑥ 点击目录章节 → 正文编辑器】');
  await cdp.eval(clickSpan('目录'));
  await sleep(2000);
  // 目录里的章节要先把分卷展开才会渲染
  const expandedVol = await cdp.eval(`
    (() => {
      const spans=[...document.querySelectorAll('span')].filter(s=>/^第\\d+卷/.test((s.textContent||'').trim()));
      if(!spans.length) return 'no-volume';
      (spans[0].closest('button')||spans[0]).click();
      return 'clicked:'+(spans[0].textContent||'').trim().slice(0,20);
    })()
  `);
  console.log('   展开分卷:', expandedVol);
  await sleep(2500);

  // 章节标题是「第N章 测试」这种结构，点它所在的按钮即可
  const clickedChapter = await cdp.eval(`
    (() => {
      const spans=[...document.querySelectorAll('span')]
        .filter(s=>/^第\\d+章 /.test((s.textContent||'').trim()));
      if(!spans.length) return 'not-found';
      const btn=spans[0].closest('button') || spans[0];
      btn.click();
      return 'clicked:'+(spans[0].textContent||'').trim().slice(0,20);
    })()
  `);
  console.log('   点击章节:', clickedChapter);
  if (clickedChapter === 'not-found') {
    const dump = await cdp.eval(`
      (() => {
        const spans=[...document.querySelectorAll('span')].map(s=>(s.textContent||'').trim()).filter(t=>t && t.length<24);
        return {
          含章字样的文本: spans.filter(t=>t.includes('章')).slice(0,10),
          左侧文本: (document.querySelector('aside')?.innerText||'').replace(/\\s+/g,' ').slice(0,260),
        };
      })()
    `);
    console.log('   目录区 dump:', JSON.stringify(dump, null, 1));
  }
  await sleep(3000);
  st = await cdp.eval(centerState);
  console.log('   中间区域:', JSON.stringify(st));
  check('点击章节后回到正文编辑器', st.正文编辑器 && !st.条目编辑器, JSON.stringify(st));

  sock.close();
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
