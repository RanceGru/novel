// 验证右栏（RightPanel）：
//   ① Tab 只有 4 个：指令 / 审查 / 记忆 / 设定，「章纲」已移除
//   ② 默认停在「指令」（书里不再出现「章节纲（快照）」文本域）
//   ③ Tab 之间可以正常切换
//   ④ 底部「生成正文」按钮仍在，且为蓝底白字（与用户要求一致）
import { loginDemo, makeClient, freshBook, selectBookInUi } from './test-utils.mjs';

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

/** 读出右栏的 Tab 文案 / 当前选中项 / 底部按钮样式 */
const READ_PANEL = `
  (() => {
    const panel = document.querySelector('[data-role="right-panel"]');
    if (!panel) return { __err: 'right-panel not found' };
    const tabs = [...panel.querySelectorAll('[data-role="right-panel-tab"]')].map((b) => ({
      文案: (b.textContent || '').trim(),
      键: b.getAttribute('data-tab'),
      选中: /text-brand-primary/.test(b.className),
      有下边框: /border-b-2/.test(b.className),
    }));
    const gen = panel.querySelector('[data-role="generate-content"]');
    const cs = gen ? getComputedStyle(gen) : null;
    // 主题色基准：临时挂一个 bg-brand-primary 元素读出当前主题的实际色值
    const probe = document.createElement('div');
    probe.className = 'bg-brand-primary text-brand-text';
    probe.style.position = 'fixed'; probe.style.opacity = '0';
    document.body.appendChild(probe);
    const pcs = getComputedStyle(probe);
    const 主题色 = pcs.backgroundColor, 反白色 = pcs.color;
    probe.remove();
    const panelText = panel.innerText || '';
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { 顶: Math.round(r.top), 底: Math.round(r.bottom), 高: Math.round(r.height), 左: Math.round(r.left), 右: Math.round(r.right) };
    };
    const ink = panel.querySelector('[data-role="instruction-input"]');
    const inkLabel = panel.querySelector('[data-role="instruction-label"]');
    const twBlock = panel.querySelector('[data-role="target-word-count"]');
    const twInput = panel.querySelector('[data-role="target-word-input"]');
    return {
      tabs,
      面板文本: panelText,
      含写作指令: panelText.includes('写作指令'),
      含章纲快照: panelText.includes('章节纲（快照）'),
      主题色,
      反白色,
      指令框: rect(ink),
      指令标签: rect(inkLabel),
      首个页签: rect(panel.querySelector('[data-role="right-panel-tab"]')),
      目标字数块: rect(twBlock),
      目标字数输入框: rect(twInput),
      生成正文块: rect(gen),
      面板块: rect(panel),
      生成正文: gen ? {
        文案: (gen.textContent || '').trim(),
        背景色: cs.backgroundColor,
        文字色: cs.color,
      } : null,
      全页含章纲快照: (document.body.innerText || '').includes('章节纲（快照）'),
    };
  })()
`;

async function main() {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);
  const book = await freshBook(J, '右栏验证书');

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

  // ① Tab 列表
  console.log('\n【① Tab 列表】');
  let st = await cdp.eval(READ_PANEL);
  if (st.__err) throw new Error(st.__err);
  console.log('   Tab:', JSON.stringify(st.tabs.map((x) => x.文案)));
  check('Tab 共 4 个', st.tabs.length === 4, `count=${st.tabs.length}`);
  check('Tab 顺序为 指令/审查/记忆/设定',
    st.tabs.map((x) => x.文案).join(',') === '📋 指令,🔍 审查,🧠 记忆,⚙ 设定',
    st.tabs.map((x) => x.文案).join(','));
  check('已无「章纲」Tab', !st.tabs.some((x) => x.文案.includes('章纲')));
  check('页面里也不再出现「章节纲（快照）」文本域', !st.全页含章纲快照);

  // ② 默认停在「指令」
  console.log('\n【② 默认 Tab】');
  const selected = st.tabs.filter((x) => x.选中).map((x) => x.文案);
  check('只有一个 Tab 处于选中态', selected.length === 1, JSON.stringify(selected));
  check('默认选中「📋 指令」', selected[0] === '📋 指令', JSON.stringify(selected));
  check('选中的 Tab 带下划线', st.tabs.find((x) => x.选中)?.有下边框 === true);
  check('默认显示「写作指令」文本域', st.含写作指令);
  check('默认不显示章纲快照文本域', !st.含章纲快照);

  // ③ 切换 Tab
  console.log('\n【③ Tab 切换】');
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="right-panel-tab"][data-tab="settings"]'); if(b) b.click(); return !!b; })()`);
  await sleep(800);
  st = await cdp.eval(READ_PANEL);
  check('切到「设定」后选中态跟随',
    st.tabs.find((x) => x.选中)?.键 === 'settings', JSON.stringify(st.tabs.filter((x) => x.选中).map((x) => x.键)));
  check('「设定」面板显示生成参数', st.面板文本.includes('生成参数'));

  await cdp.eval(`(() => { const b=document.querySelector('[data-role="right-panel-tab"][data-tab="review"]'); if(b) b.click(); return !!b; })()`);
  await sleep(1200);
  st = await cdp.eval(READ_PANEL);
  check('切到「审查」后选中态跟随',
    st.tabs.find((x) => x.选中)?.键 === 'review', JSON.stringify(st.tabs.filter((x) => x.选中).map((x) => x.键)));
  check('切到「审查」后「目标字数」仍固定在面板内',
    !!st.目标字数块 && st.目标字数块.底 <= st.面板块.底 && st.目标字数块.底 > 0,
    JSON.stringify(st.目标字数块));

  await cdp.eval(`(() => { const b=document.querySelector('[data-role="right-panel-tab"][data-tab="instruction"]'); if(b) b.click(); return !!b; })()`);
  await sleep(800);
  st = await cdp.eval(READ_PANEL);
  check('能切回「指令」', st.tabs.find((x) => x.选中)?.键 === 'instruction');

  // ④ 生成正文按钮
  console.log('\n【④ 生成正文按钮】');
  console.log('   按钮:', JSON.stringify(st.生成正文), '主题色:', st.主题色, '反白色:', st.反白色);
  check('按钮文案为「生成正文」', st.生成正文?.文案 === '生成正文', JSON.stringify(st.生成正文?.文案));
  check('按钮为实心主题色', st.生成正文?.背景色 === st.主题色, `${st.生成正文?.背景色} vs ${st.主题色}`);
  check('按钮为反白文字', st.生成正文?.文字色 === st.反白色 && st.反白色 === 'rgb(255, 255, 255)',
    `${st.生成正文?.文字色} vs ${st.反白色}`);

  // ⑤ 指令文本框拉伸到底（到「目标字数」上方），且不挤压「目标字数」
  console.log('\n【⑤ 指令框拉伸】');
  console.log('   指令框:', JSON.stringify(st.指令框), '目标字数块:', JSON.stringify(st.目标字数块));
  console.log('   目标字数输入框:', JSON.stringify(st.目标字数输入框), '生成正文块:', JSON.stringify(st.生成正文块));
  const GAP = st.目标字数块.顶 - st.指令框.底;          // 指令框底 → 目标字数块顶
  const 标签间距 = st.指令框.顶 - st.指令标签.底;        // 「写作指令」标签底 → 指令框顶
  const 标签上留白 = st.指令标签.顶 - st.首个页签.底;   // 页签栏底 → 标签顶（应保持 p-3 = 12px）
  const 面板内底部距 = st.面板块.底 - st.目标字数块.底;  // 目标字数块底 → 面板底（应只剩生成正文区）
  console.log(`   指令框↔目标字数间距=${GAP}px；标签↔指令框=${标签间距}px；页签栏↔标签=${标签上留白}px；目标字数块底↔面板底=${面板内底部距}px`);
  check('指令框已拉伸（明显高于原来的 160px）', st.指令框.高 > 220, `高=${st.指令框.高}`);
  check('指令框一直伸到「目标字数」上方（保留了 12px 间距）',
    GAP >= 8 && GAP <= 20, `间距=${GAP}px`);
  check('「写作指令」标签位置未变（页签栏下方仍留 12px）', 标签上留白 === 12, `留白=${标签上留白}px`);
  check('指令框紧跟标签下方（间距 8px，起始位置未变）', 标签间距 === 8, `间距=${标签间距}px`);
  check('「目标字数」输入框未被挤压（高度与原样一致）',
    st.目标字数输入框.高 >= 26 && st.目标字数输入框.高 <= 44, `高=${st.目标字数输入框.高}`);
  check('「目标字数」仍在生成正文按钮上方（位置未被顶下去）',
    st.目标字数块.底 <= st.生成正文块.顶, `${st.目标字数块.底} vs ${st.生成正文块.顶}`);
  check('指令框与「目标字数」都在面板可视区内',
    st.指令框.底 <= st.面板块.底 && st.目标字数块.底 <= st.面板块.底,
    `面板底=${st.面板块.底}`);

  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  ws.close();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('运行出错:', e.message); process.exit(1); });
