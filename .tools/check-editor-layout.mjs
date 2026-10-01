// 验证「章节正文编辑器」与「条目编辑器」的布局完全一致
// 做法：分别打开两者，采集工具条/内容框/底栏的几何与样式，逐项比对。
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
}

const clickSpan = (text) => `
  (() => {
    const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()===${JSON.stringify(text)});
    if(!s.length) return 'not-found';
    (s[0].closest('div[class*="cursor-pointer"]')||s[0].closest('button')||s[0].parentElement).click();
    return 'clicked';
  })()
`;

/**
 * 采集编辑器的布局指标。
 * scopeSel 用来定位「包着编辑框的那块区域」，避免连左侧栏一起量。
 */
const layoutProbe = (boxSel) => `
  (() => {
    const box=document.querySelector(${JSON.stringify(boxSel)});
    if(!box) return { found:false };
    // 向上找到编辑器外壳（h-full flex flex-col 那一层）
    let shell=box.parentElement;
    while (shell && !(shell.className||'').includes('h-full')) shell=shell.parentElement;
    if (!shell) return { found:false, reason:'未找到编辑器外壳' };
    const cs=getComputedStyle(box);
    const bar=shell.firstElementChild;
    const barCs=bar?getComputedStyle(bar):null;
    const footer=shell.lastElementChild;
    const footerCs=footer?getComputedStyle(footer):null;
    const b=box.getBoundingClientRect();
    return {
      found:true,
      工具条: barCs ? {
        高: Math.round(bar.getBoundingClientRect().height),
        内边距: barCs.paddingLeft + '/' + barCs.paddingTop,
        背景: barCs.backgroundColor,
        下边框宽: barCs.borderBottomWidth,
      } : null,
      内容框: {
        高: Math.round(b.height),
        内边距: cs.padding,
        边框宽: cs.borderTopWidth,
        圆角: cs.borderTopLeftRadius,
        字号: cs.fontSize,
        行高: cs.lineHeight,
      },
      底栏: footerCs ? {
        高: Math.round(footer.getBoundingClientRect().height),
        字号: footerCs.fontSize,
        上边框宽: footerCs.borderTopWidth,
        文字: (footer.textContent||'').replace(/\\s+/g,' ').trim().slice(0,40),
      } : null,
      有保存按钮: !!shell.querySelector('button[title^="保存"]'),
      有关闭按钮: !!shell.querySelector('button[title^="关闭"]'),
      保存按钮文案: (() => {
        const btn=[...shell.querySelectorAll('button')].find(x=>(x.title||'').startsWith('保存'));
        return btn ? (btn.textContent||'').trim() : null;
      })(),
      // 保存按钮配色：应与右侧栏「生成正文」一致（实心主题色 + 反白文字）
      保存按钮配色: (() => {
        const btn=[...shell.querySelectorAll('button')].find(x=>(x.title||'').startsWith('保存'));
        if(!btn) return null;
        const cs=getComputedStyle(btn);
        const svg=btn.querySelector('svg');
        return {
          背景: cs.backgroundColor,
          文字色: cs.color,
          图标色: svg ? getComputedStyle(svg).color : null,
          圆角: cs.borderTopLeftRadius,
        };
      })(),
      // 用于对照的「生成正文」按钮配色
      生成正文配色: (() => {
        const btn=[...document.querySelectorAll('button')].find(x=>(x.textContent||'').includes('生成正文'));
        if(!btn) return null;
        const cs=getComputedStyle(btn);
        const svg=btn.querySelector('svg');
        return {
          背景: cs.backgroundColor,
          文字色: cs.color,
          图标色: svg ? getComputedStyle(svg).color : null,
          圆角: cs.borderTopLeftRadius,
        };
      })(),
      // 面包屑后面那个「·」分隔符是否存在（说明有标题区）
      有标题分隔符: !!shell.querySelector('.text-text-tertiary.shrink-0'),
    };
  })()
`;

async function main() {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);
  const book = await freshBook(J, '编辑器布局验证书');
  const { volumes } = await seedBook(J, book.id, { volumeCount: 1, chaptersOfFirst: 1 });
  const vol = volumes.find((v) => v.volumeNumber === 1);
  await J('POST', `/books/${book.id}/world-settings`, { category: 'other', title: '布局用条目', content: '内容' });

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

  // ===== 打开章节 → 采集正文编辑器布局 =====
  console.log('\n【① 章节正文编辑器】');
  await cdp.eval(`
    (() => {
      const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='目录');
      if(s.length) (s[0].closest('div[class*="cursor-pointer"]')||s[0].parentElement).click();
      return 'ok';
    })()
  `);
  await sleep(2000);
  await cdp.eval(`
    (() => {
      const s=[...document.querySelectorAll('span')].filter(x=>/^第\\d+卷/.test((x.textContent||'').trim()));
      if(s.length) (s[0].closest('button')||s[0]).click();
      return 'ok';
    })()
  `);
  await sleep(2500);
  await cdp.eval(`
    (() => {
      const s=[...document.querySelectorAll('span')].filter(x=>/^第\\d+章 /.test((x.textContent||'').trim()));
      if(!s.length) return 'not-found';
      (s[0].closest('button')||s[0]).click();
      return 'ok';
    })()
  `);
  await sleep(3000);
  const chapterLayout = await cdp.eval(layoutProbe('[data-role="chapter-content"]'));
  console.log('   布局:', JSON.stringify(chapterLayout, null, 1).replace(/\n\s*/g, ' '));
  check('章节编辑器已打开', chapterLayout.found, JSON.stringify(chapterLayout).slice(0, 120));

  // ===== 打开条目 → 采集条目编辑器布局 =====
  console.log('\n【② 条目编辑器（相关 → 世界观条目）】');
  console.log('   展开相关:', await cdp.eval(openRelatedInUi()));
  await sleep(2000);
  console.log('   展开世界观:', await cdp.eval(clickSpan('世界观')));
  await sleep(2000);
  await cdp.eval(`
    (() => {
      const r=document.querySelector('[data-world-row="item"][data-world-title="布局用条目"]')
        || document.querySelector('[data-world-row="fixed"]');
      if(!r) return 'not-found'; r.click(); return 'clicked';
    })()
  `);
  await sleep(2000);
  const itemLayout = await cdp.eval(layoutProbe('[data-role="item-content"]'));
  console.log('   布局:', JSON.stringify(itemLayout, null, 1).replace(/\n\s*/g, ' '));
  check('条目编辑器已打开', itemLayout.found, JSON.stringify(itemLayout).slice(0, 120));

  // ===== 逐项比对 =====
  console.log('\n【③ 逐项比对】');
  if (chapterLayout.found && itemLayout.found) {
    const cmp = (label, a, b) => check(label, JSON.stringify(a) === JSON.stringify(b), `章节=${JSON.stringify(a)} 条目=${JSON.stringify(b)}`);
    cmp('工具条高度一致', chapterLayout.工具条?.高, itemLayout.工具条?.高);
    cmp('工具条内边距/背景/下边框一致',
      [chapterLayout.工具条?.内边距, chapterLayout.工具条?.背景, chapterLayout.工具条?.下边框宽],
      [itemLayout.工具条?.内边距, itemLayout.工具条?.背景, itemLayout.工具条?.下边框宽]);
    cmp('内容框内边距一致', chapterLayout.内容框?.内边距, itemLayout.内容框?.内边距);
    cmp('内容框边框宽一致', chapterLayout.内容框?.边框宽, itemLayout.内容框?.边框宽);
    cmp('内容框圆角一致', chapterLayout.内容框?.圆角, itemLayout.内容框?.圆角);
    cmp('内容框字号/行高一致',
      [chapterLayout.内容框?.字号, chapterLayout.内容框?.行高],
      [itemLayout.内容框?.字号, itemLayout.内容框?.行高]);
    cmp('底栏高度/字号/上边框一致',
      [chapterLayout.底栏?.高, chapterLayout.底栏?.字号, chapterLayout.底栏?.上边框宽],
      [itemLayout.底栏?.高, itemLayout.底栏?.字号, itemLayout.底栏?.上边框宽]);
    cmp('都有保存按钮', chapterLayout.有保存按钮, itemLayout.有保存按钮);
    cmp('都有关闭按钮', chapterLayout.有关闭按钮, itemLayout.有关闭按钮);
    cmp('保存按钮文案一致（都用图标，无 emoji）', chapterLayout.保存按钮文案, itemLayout.保存按钮文案);

    // 标题区：条目编辑器有（可改名），正文没有——正文标题就在面包屑最后一段，
    // 重复显示只是噪音，故此处允许不同
    check('条目编辑器有可编辑标题区', itemLayout.有标题分隔符 === true, String(itemLayout.有标题分隔符));
    check('正文编辑器不重复显示标题', chapterLayout.有标题分隔符 === false, String(chapterLayout.有标题分隔符));

    check('章节编辑器不再用 emoji 保存按钮', !/💾/.test(chapterLayout.保存按钮文案 || ''), JSON.stringify(chapterLayout.保存按钮文案));
    check('内容框有边框（不再是贴边无边框）', chapterLayout.内容框?.边框宽 !== '0px', String(chapterLayout.内容框?.边框宽));
    check('章节编辑器有底栏', !!chapterLayout.底栏, JSON.stringify(chapterLayout.底栏));
    check('底栏字数与「Ctrl+S」提示都在', /字/.test(chapterLayout.底栏?.文字 || '') && /Ctrl\+S/.test(chapterLayout.底栏?.文字 || ''),
      JSON.stringify(chapterLayout.底栏?.文字));

    // 保存按钮配色应与右侧栏「生成正文」一致（实心主题色 + 反白文字/图标）
    console.log('\n【④ 保存按钮配色】');
    const ref = chapterLayout.生成正文配色;
    console.log('   生成正文按钮:', JSON.stringify(ref));
    console.log('   保存按钮:', JSON.stringify(chapterLayout.保存按钮配色));
    check('取到了「生成正文」按钮做基准', !!ref, JSON.stringify(ref));
    check('保存按钮背景与「生成正文」一致', chapterLayout.保存按钮配色?.背景 === ref?.背景,
      `保存=${chapterLayout.保存按钮配色?.背景} 生成正文=${ref?.背景}`);
    check('保存按钮文字色与「生成正文」一致', chapterLayout.保存按钮配色?.文字色 === ref?.文字色,
      `保存=${chapterLayout.保存按钮配色?.文字色} 生成正文=${ref?.文字色}`);
    check('保存按钮图标色与「生成正文」一致', chapterLayout.保存按钮配色?.图标色 === ref?.图标色,
      `保存=${chapterLayout.保存按钮配色?.图标色} 生成正文=${ref?.图标色}`);
    check('保存按钮是实心主题色（非透明）',
      !!chapterLayout.保存按钮配色?.背景 && chapterLayout.保存按钮配色.背景 !== 'rgba(0, 0, 0, 0)',
      String(chapterLayout.保存按钮配色?.背景));
    check('保存按钮文字为反白（白色）', chapterLayout.保存按钮配色?.文字色 === 'rgb(255, 255, 255)',
      String(chapterLayout.保存按钮配色?.文字色));
    check('两个编辑器的保存按钮配色一致',
      JSON.stringify(chapterLayout.保存按钮配色) === JSON.stringify(itemLayout.保存按钮配色),
      `章节=${JSON.stringify(chapterLayout.保存按钮配色)} 条目=${JSON.stringify(itemLayout.保存按钮配色)}`);
  }

  ws.close();
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
