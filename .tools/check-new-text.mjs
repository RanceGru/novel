// 验证「新建文本」：
//   ① 功能区「新建作品」下面有「新建文本」按钮
//   ② 点击后中间区域打开空白文本，面包屑显示「未保存文本」
//   ③ 输入内容后点保存 → 弹出「保存到」弹窗，提供 6 类落点
//   ④ 依次验证各类落点真的能建出来：分卷下新章节 / 分卷外章节 / 细纲卷纲 /
//      细纲章纲 / 角色子项 / 世界观条目，且内容随之一并写入
import { loginDemo, makeClient, freshBook, seedBook, selectBookInUi } from './test-utils.mjs';

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

const setValue = (selector, value) => `
  (() => {
    const el=document.querySelector(${JSON.stringify(selector)});
    if(!el) return 'no-el';
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const set=Object.getOwnPropertyDescriptor(proto,'value').set;
    set.call(el, ${JSON.stringify(value)}); el.dispatchEvent(new Event('input',{bubbles:true}));
    return 'ok';
  })()
`;
const crumb = `
  (() => {
    const nav=document.querySelector('[data-role="editor-breadcrumb"]');
    return nav ? nav.getAttribute('title') : null;
  })()
`;

/** 走一遍：新建文本 → 写内容 → 选落点 → 保存 */
async function newTextAndSave(cdp, { kind, title, content, picker }) {
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="new-text"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1200);
  await cdp.eval(setValue('[data-role="draft-content"]', content));
  await sleep(300);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="draft-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(2000);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="target-${kind}"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(900);
  if (picker) {
    await cdp.eval(`
      (() => {
        const el=document.querySelector(${JSON.stringify(picker.selector)});
        if(!el) return 'no-el';
        const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;
        set.call(el, ${JSON.stringify(picker.value)}); el.dispatchEvent(new Event('change',{bubbles:true}));
        return 'ok';
      })()
    `);
    await sleep(600);
  }
  await cdp.eval(setValue('[data-role="draft-title"]', title));
  await sleep(300);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="confirm-save-draft"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(3000);
}

async function main() {
  const auth = await loginDemo();
  const { J } = makeClient(auth.accessToken);
  const book = await freshBook(J, '新建文本验证书');
  const { volumes } = await seedBook(J, book.id, { volumeCount: 1, chaptersOfFirst: 1 });
  await J('POST', `/books/${book.id}/characters`, { name: '林逸', category: 'protagonist' });
  const vol = volumes.find((v) => v.volumeNumber === 1);

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

  // ===== ① 按钮存在，且位于「新建作品」下面 =====
  console.log('\n【① 功能区按钮】');
  const btns = await cdp.eval(`
    (() => {
      const all=[...document.querySelectorAll('button')].filter(b=>/新建作品|新建文本/.test(b.textContent||''));
      return all.map(b=>({ 文本:(b.textContent||'').trim(), top:Math.round(b.getBoundingClientRect().top) }));
    })()
  `);
  console.log('   按钮:', JSON.stringify(btns));
  check('存在「新建文本」按钮', btns.some((b) => b.文本.includes('新建文本')));
  const bNew = btns.find((b) => b.文本.includes('新建作品'));
  const bText = btns.find((b) => b.文本.includes('新建文本'));
  check('它排在「新建作品」下面', !!bNew && !!bText && bText.top > bNew.top, `作品top=${bNew?.top} 文本top=${bText?.top}`);

  // ===== ①b 「保存」按钮任何时候都可用，点了必须弹窗 =====
  // 之前没先选作品时该按钮是 disabled，用户点了没反应（看起来像坏了）
  console.log('\n【①b 保存按钮始终可点并弹窗】');
  await cdp.send('Page.reload');
  await sleep(8000);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="new-text"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1500);
  const btnState = await cdp.eval(`
    (() => {
      const b=document.querySelector('[data-role="draft-save"]');
      if(!b) return { found:false };
      return { found:true, 禁用:b.disabled, 透明度:getComputedStyle(b).opacity };
    })()
  `);
  console.log('   未选作品时的按钮:', JSON.stringify(btnState));
  check('保存按钮未被禁用', btnState.found && !btnState.禁用, JSON.stringify(btnState));
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="draft-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(3000);
  const dialogOnFresh = await cdp.eval(`
    (() => {
      const d=document.querySelector('[data-role="save-draft-dialog"]');
      return d ? { open:true, 落点数:d.querySelectorAll('[data-role^="target-"]').length } : { open:false };
    })()
  `);
  console.log('   点保存后:', JSON.stringify(dialogOnFresh));
  check('点了就弹出选择保存位置的窗口', dialogOnFresh.open, JSON.stringify(dialogOnFresh));
  check('弹窗里有可选的落点', (dialogOnFresh.落点数 || 0) === 6, `count=${dialogOnFresh.落点数}`);
  await cdp.eval(`(() => { const d=document.querySelector('[data-role="save-draft-dialog"]'); const b=[...d.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='取消'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1000);
  // 回到选中该作品的干净状态，继续后面的用例
  await cdp.send('Page.reload');
  await sleep(8000);
  console.log('   重新选作品:', await cdp.eval(selectBookInUi(book.title)));
  await sleep(2500);

  // ===== ② 打开空白文本 =====
  console.log('\n【② 打开空白文本】');
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="new-text"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(1500);
  const opened = await cdp.eval(`
    (() => ({
      有草稿框: !!document.querySelector('[data-role="draft-content"]'),
      草稿内容: document.querySelector('[data-role="draft-content"]')?.value,
      面包屑: ${crumb},
      有正文编辑器: !!document.querySelector('[data-role="chapter-content"]'),
    }))()
  `);
  console.log('   状态:', JSON.stringify(opened));
  check('中间区域变成空白文本', opened.有草稿框 && opened.草稿内容 === '');
  check('面包屑显示「未保存文本」', opened.面包屑 === '未保存文本', JSON.stringify(opened.面包屑));
  check('不是正文编辑器', !opened.有正文编辑器);

  // ===== ③ 点保存弹窗 =====
  console.log('\n【③ 保存弹窗】');
  await cdp.eval(setValue('[data-role="draft-content"]', '这是草稿里的内容。'));
  await sleep(300);
  await cdp.eval(`(() => { const b=document.querySelector('[data-role="draft-save"]'); if(!b) return 'no-btn'; b.click(); return 'clicked'; })()`);
  await sleep(2500);
  const dlg = await cdp.eval(`
    (() => {
      const d=document.querySelector('[data-role="save-draft-dialog"]');
      if(!d) return { open:false };
      return {
        open:true,
        落点类型: [...d.querySelectorAll('[data-role^="target-"]')].map(b=>(b.textContent||'').trim()),
        有名称输入: !!d.querySelector('[data-role="draft-title"]'),
      };
    })()
  `);
  console.log('   弹窗:', JSON.stringify(dlg));
  check('弹出「保存到」弹窗', dlg.open);
  check('提供 6 类落点', (dlg.落点类型 || []).length === 6, JSON.stringify(dlg.落点类型));
  check('含「某分卷下的新章节」', (dlg.落点类型 || []).some((x) => x.includes('分卷下的新章节')));
  check('含「分卷外章节」', (dlg.落点类型 || []).some((x) => x.includes('分卷外章节')));
  check('含细纲（卷纲/章纲）', (dlg.落点类型 || []).filter((x) => x.includes('细纲')).length === 2);
  check('含角色子项', (dlg.落点类型 || []).some((x) => x.includes('角色')));
  check('含世界观', (dlg.落点类型 || []).some((x) => x.includes('世界观')));
  check('有名称输入框', dlg.有名称输入);
  await cdp.eval(`(() => { const d=document.querySelector('[data-role="save-draft-dialog"]'); const b=[...d.querySelectorAll('button')].find(x=>(x.textContent||'').trim()==='取消'); if(b) b.click(); return 'ok'; })()`);
  await sleep(1200);
  check('取消后弹窗关闭', !(await cdp.eval(`!!document.querySelector('[data-role="save-draft-dialog"]')`)));

  // ===== ④ 各落点逐一验证 =====
  console.log('\n【④ 存成：分卷下的新章节】');
  await newTextAndSave(cdp, {
    kind: 'chapter_in_volume', title: '第9章 草稿章节', content: '分卷内章节内容。',
    picker: { selector: '[data-role="pick-volume"]', value: vol.id },
  });
  let chs = (await J('GET', `/volumes/${vol.id}/chapters`)).body.data;
  const newCh = chs.find((c) => c.title === '第9章 草稿章节');
  check('分卷下新章节已创建', !!newCh, chs.map((c) => c.title).join(','));
  // 「落点决定内容归属」：存成章节，这段文字就成了该章节的正文
  const chDetail = newCh ? (await J('GET', `/volumes/${vol.id}/chapters/${newCh.id}`)).body.data : null;
  console.log('   库里章节内容:', JSON.stringify(chDetail?.content));
  console.log('   界面正文框值:', JSON.stringify(await cdp.eval(`(document.querySelector('[data-role="chapter-content"]')||{}).value`)));
  check('章节正文就是草稿内容', (chDetail?.content || '').includes('分卷内章节内容'),
    JSON.stringify(chDetail?.content));
  // 保存后会自动打开该章节；等一次自动保存（3 秒防抖）落库再继续
  await sleep(5000);
  const afterAutoSave = newCh ? (await J('GET', `/volumes/${vol.id}/chapters/${newCh.id}`)).body.data : null;
  check('自动保存后内容未被清空', (afterAutoSave?.content || '').includes('分卷内章节内容'),
    JSON.stringify(afterAutoSave?.content));
  check('保存后切到该章节（正文编辑器）', await cdp.eval(`!!document.querySelector('[data-role="chapter-content"]')`));
  check('路径更新为该章节', (await cdp.eval(crumb) || '').includes('第9章 草稿章节'), await cdp.eval(crumb));

  console.log('\n【④ 存成：分卷外章节】');
  await newTextAndSave(cdp, { kind: 'chapter_default', title: '第1章 卷外章节', content: '分卷外内容。' });
  const vols2 = (await J('GET', `/books/${book.id}/volumes`)).body.data;
  const defVol = vols2.find((v) => v.title === '默认');
  check('自动创建了「默认」卷', !!defVol, vols2.map((v) => v.title).join(','));
  const defChs = defVol ? (await J('GET', `/volumes/${defVol.id}/chapters`)).body.data : [];
  check('分卷外章节已创建', defChs.some((c) => c.title === '第1章 卷外章节'), defChs.map((c) => c.title).join(','));

  console.log('\n【④ 存成：细纲 · 新卷纲】');
  await newTextAndSave(cdp, { kind: 'outline_volume', title: '草稿卷纲', content: '卷纲内容。' });
  let outlines = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  check('新卷纲已创建', outlines.volumes.some((v) => v.title === '草稿卷纲'), outlines.volumes.map((v) => v.title).join(','));

  console.log('\n【④ 存成：细纲 · 新章纲】');
  const parentId = outlines.volumes.find((v) => v.title === '草稿卷纲')?.id;
  await newTextAndSave(cdp, {
    kind: 'outline_chapter', title: '草稿章纲', content: '章纲内容。',
    picker: { selector: '[data-role="pick-parent-outline"]', value: parentId },
  });
  outlines = (await J('GET', `/books/${book.id}/outlines`)).body.data;
  const newOutlineCh = outlines.chapters.find((c) => c.title === '草稿章纲');
  check('新章纲已创建', !!newOutlineCh, outlines.chapters.map((c) => c.title).join(','));
  check('章纲内容随草稿写入', (newOutlineCh?.content || '').includes('章纲内容'));

  console.log('\n【④ 存成：角色 · 子项】');
  const chars = (await J('GET', `/books/${book.id}/characters`)).body.data;
  await newTextAndSave(cdp, {
    kind: 'character_section', title: '草稿子项', content: '子项内容。',
    picker: { selector: '[data-role="pick-character"]', value: chars[0].id },
  });
  const secs = (await J('GET', `/books/${book.id}/characters/sections`)).body.data;
  const newSec = secs.find((s) => s.title === '草稿子项');
  check('角色子项已创建', !!newSec, secs.map((s) => s.title).join(','));
  check('子项内容随草稿写入', (newSec?.content || '').includes('子项内容'));

  console.log('\n【④ 存成：世界观 · 其他补充】');
  await newTextAndSave(cdp, { kind: 'world_setting', title: '草稿设定', content: '设定内容。' });
  const wsList = (await J('GET', `/books/${book.id}/world-settings`)).body.data;
  const newWs = wsList.find((s) => s.title === '草稿设定');
  check('世界观条目已创建', !!newWs, wsList.map((s) => s.title).join(','));
  check('设定内容随草稿写入', (newWs?.content || '').includes('设定内容'));

  console.log('\n【⑤ 草稿已清空】');
  check('保存后不再是草稿态', !(await cdp.eval(`!!document.querySelector('[data-role="draft-content"]')`)));

  ws.close();
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
