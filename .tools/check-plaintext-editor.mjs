// 验证「正文改纯文本」：
//   ① 中间区域是纯文本 textarea（不再有 Tiptap 富文本与排版工具栏）
//   ② 输入内容 → 自动保存（防抖）后落库，且库里存的就是纯文本
//   ③ 字数按纯文本计（不含空白），并修正了「把 HTML 标签算成字」的老问题
//   ④ 导出 TXT 不含 HTML 标签；导出 Word 不出现 <p><p> 嵌套
import { loginDemo, makeClient, freshBook, seedBook, selectBookInUi, openTocInUi } from './test-utils.mjs';

const PORT = Number(process.env.PORT || 9260);
const API = 'http://localhost:3000/api/v1';
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

async function main() {
  const auth = await loginDemo();
  const { J } = await makeClientAndBook(auth);
  // 建作品 + 分卷 + 章节
  const book = await freshBook(J, '纯文本正文验证书');
  const { volumes } = await seedBook(J, book.id, { volumeCount: 1, chaptersOfFirst: 1 });
  const vol = volumes.find((v) => v.volumeNumber === 1);
  let chapters = (await J('GET', `/volumes/${vol.id}/chapters`)).body.data;
  const ch = chapters[0];

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
  console.log('展开目录:', await cdp.eval(openTocInUi()));
  await sleep(2000);
  // 展开分卷
  await cdp.eval(`
    (() => {
      const s=[...document.querySelectorAll('span')].filter(x=>/^第\\d+卷/.test((x.textContent||'').trim()));
      if(s.length) (s[0].closest('button')||s[0]).click();
      return 'ok';
    })()
  `);
  await sleep(2500);

  // ===== ① 是纯文本编辑器 =====
  console.log('\n【① 正文编辑器是纯文本】');
  const dom = await cdp.eval(`
    (() => {
      const ta=document.querySelector('[data-role="chapter-content"]');
      return {
        有纯文本框: !!ta,
        有富文本容器: !!document.querySelector('.tiptap-editor') || !!document.querySelector('.ProseMirror'),
        工具栏按钮数: [...document.querySelectorAll('button[title]')].filter(b=>['加粗','斜体','一级标题','二级标题','三级标题','无序列表','有序列表','引用','分割线'].includes(b.title)).length,
        有字数码: !!document.querySelector('[data-role="char-count"]'),
      };
    })()
  `);
  console.log('   编辑器:', JSON.stringify(dom));
  check('中间区域是纯文本 textarea', dom.有纯文本框);
  check('不再有 Tiptap 富文本容器', !dom.有富文本容器);
  check('排版按钮已移除', dom.工具栏按钮数 === 0, `count=${dom.工具栏按钮数}`);
  check('显示字数', dom.有字数码);

  // 先点章节让它加载进来
  await cdp.eval(`
    (() => {
      const spans=[...document.querySelectorAll('span')].filter(s=>/^第\\d+章 /.test((s.textContent||'').trim()));
      if(!spans.length) return 'not-found';
      (spans[0].closest('button')||spans[0]).click();
      return 'clicked';
    })()
  `);
  await sleep(2500);
  check('选中章节后出现正文编辑框', await cdp.eval(`!!document.querySelector('[data-role="chapter-content"]')`));

  // ===== ② 输入 → 自动保存 =====
  console.log('\n【② 输入并自动保存】');
  const text = '第一段内容。\n\n第二段内容，共两段。';
  await cdp.eval(`
    (() => {
      const ta=document.querySelector('[data-role="chapter-content"]');
      if(!ta) return 'no-ta';
      const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
      set.call(ta, ${JSON.stringify(text)}); ta.dispatchEvent(new Event('input',{bubbles:true}));
      return 'ok';
    })()
  `);
  await sleep(4500);   // 等 3 秒防抖 + 请求
  let saved = (await J('GET', `/volumes/${vol.id}/chapters/${ch.id}`)).body.data;
  console.log('   库中内容:', JSON.stringify(saved.content));
  check('内容已自动保存且为纯文本', saved.content === text, JSON.stringify(saved.content));
  check('库中不含 HTML 标签', !/<[a-z][\s\S]*>/i.test(saved.content || ''));

  // ===== ③ 字数按纯文本计 =====
  console.log('\n【③ 字数统计】');
  const expectCount = text.replace(/\s/g, '').length;
  console.log(`   期望字数（去空白）: ${expectCount}，库里 wordCount=${saved.wordCount}`);
  check('后端 wordCount 按纯文本计', saved.wordCount === expectCount, `${saved.wordCount} vs ${expectCount}`);
  const uiCount = await cdp.eval(`(document.querySelector('[data-role="char-count"]')||{}).textContent`);
  console.log('   界面字数:', JSON.stringify(uiCount));
  check('界面显示字数', !!uiCount && uiCount.includes(String(expectCount)), String(uiCount));

  // 塞一段带 HTML 的内容，验证服务端不再把标签算成字
  await J('PATCH', `/volumes/${vol.id}/chapters/${ch.id}`, { content: '<p>标签测试</p><p>第二段</p>' });
  const withHtml = (await J('GET', `/volumes/${vol.id}/chapters/${ch.id}`)).body.data;
  console.log(`   含 HTML 时 wordCount=${withHtml.wordCount}（纯文本应为 ${'标签测试第二段'.length}）`);
  check('含 HTML 时字数按纯文本计', withHtml.wordCount === '标签测试第二段'.length,
    `${withHtml.wordCount} vs ${'标签测试第二段'.length}`);

  // ===== ④ 导出 =====
  console.log('\n【④ 导出】');
  const login = await loginDemo();
  const H = { Authorization: `Bearer ${login.accessToken}` };
  // 导出接口是 POST（控制器为 @Post('txt/:bookId') / @Post('word/:bookId')）
  const txtRes = await fetch(`${API}/export/txt/${book.id}`, { method: 'POST', headers: H });
  const txt = await txtRes.text();
  console.log('   TXT 片段:', JSON.stringify(txt.split('\n').filter((l) => l.trim()).slice(-6).join(' | ').slice(0, 160)));
  check('导出 TXT 成功', txtRes.ok, `status=${txtRes.status}`);
  check('TXT 不含 HTML 标签', !/<[a-z][\s\S]*>/i.test(txt));
  check('TXT 含纯文本内容', txt.includes('标签测试'));

  const docRes = await fetch(`${API}/export/word/${book.id}`, { method: 'POST', headers: H });
  const doc = await docRes.text();
  check('导出 Word 成功', docRes.ok, `status=${docRes.status}`);
  check('Word 无 <p><p> 嵌套', !/<p>\s*<p>/i.test(doc));
  check('Word 内容来自纯文本（无残留标签）', !/&lt;p&gt;|<p[^>]*><p/i.test(doc) && doc.includes('标签测试'));
  console.log('   Word 段落数:', (doc.match(/<p>/g) || []).length);

  ws.close();
  console.log(`\n=== 结论: ${pass} 通过 / ${fail} 失败 ===`);
  process.exitCode = fail === 0 ? 0 : 1;
}

async function makeClientAndBook(auth) {
  const { makeClient } = await import('./test-utils.mjs');
  return makeClient(auth.accessToken);
}

main().catch((e) => { console.error('失败:', e.message); process.exit(1); });
