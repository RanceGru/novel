// 测试公用工具：登录、按标题取书、原生命令行提示
//
// 为什么需要「按标题取书」：`GET /books` 按 updatedAt DESC 排序，
// 多个测试套件若都用 books[0]，前一个套件改过的书会跑到列表最前，
// 导致后一个套件作用在错误的书上（曾出现 3 个套件随机失败）。
export const API = 'http://localhost:3000/api/v1';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function makeClient(token) {
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const J = async (m, p, b) => {
    const r = await fetch(`${API}${p}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
    return { status: r.status, ok: r.ok, body: await r.json().catch(() => ({})) };
  };
  return { H, J };
}

export async function loginDemo() {
  const r = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@novel.com', password: 'demo123456' }),
  });
  const body = await r.json();
  if (!body.success) throw new Error('登录失败: ' + JSON.stringify(body).slice(0, 200));
  return body.data;
}

/** 按标题精确取书；不存在则创建。返回 { book, created } */
export async function pickBook(J, title, extra = {}) {
  const books = (await J('GET', '/books')).body.data || [];
  const found = books.find((b) => b.title === title);
  if (found) return { book: found, created: false };
  const r = await J('POST', '/books', { title, author: '测试', ...extra });
  if (!r.body?.data) throw new Error(`创建作品「${title}」失败: ${r.status}`);
  return { book: r.body.data, created: true };
}

/** 删除指定标题的作品（不存在则忽略）。用于套件开始前清掉上次运行的遗留 */
export async function deleteBooksByTitle(J, titles) {
  const books = (await J('GET', '/books')).body.data || [];
  let n = 0;
  for (const b of books) {
    if (!titles.includes(b.title)) continue;
    const r = await J('DELETE', `/books/${b.id}`);
    if (r.ok) n++;
  }
  return n;
}

/**
 * 每个套件开始时调用：删掉本套件的作品再新建，保证起点确定。
 * 否则上次运行留下的分卷/章节会让「默认编号」等断言漂移。
 */
export async function freshBook(J, title) {
  const removed = await deleteBooksByTitle(J, [title]);
  if (removed) console.log(`已清理上次遗留的「${title}」: ${removed} 本`);
  return (await pickBook(J, title)).book;
}

/** 通过 CDP 在界面里选中某本书（点作品行本身 = 切换当前作品并展开其目录/相关） */
export function selectBookInUi(title) {
  return `
    (() => {
      const btns=[...document.querySelectorAll('button')].filter(b=>b.querySelector('img') && /字/.test(b.textContent||''));
      const t=btns.find(b=>(b.textContent||'').includes(${JSON.stringify(title)}));
      if(!t) return 'not-found';
      t.click();
      return 'clicked';
    })()
  `;
}

/** 展开左侧「目录」页签（需先选中作品） */
export function openTocInUi() {
  return `
    (() => {
      const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='目录');
      if(!s.length) return 'not-found';
      (s[0].closest('div[class*="cursor-pointer"]')||s[0].parentElement).click();
      return 'clicked';
    })()
  `;
}

/** 展开左侧「相关」页签（需先选中作品） */
export function openRelatedInUi() {
  return `
    (() => {
      const s=[...document.querySelectorAll('span')].filter(x=>(x.textContent||'').trim()==='相关');
      if(!s.length) return 'not-found';
      (s[0].closest('div[class*="cursor-pointer"]')||s[0].parentElement).click();
      return 'clicked';
    })()
  `;
}

/**
 * 保证某本书具备测试所需的基础数据（分卷 + 章节），只在缺失时补齐，
 * 因此可重复运行。返回 { volumes, chapters } 便于断言期望值。
 */
export async function seedBook(J, bookId, { volumeCount = 2, chaptersOfFirst = 1 } = {}) {
  let vols = (await J('GET', `/books/${bookId}/volumes`)).body.data || [];
  for (let n = 1; n <= volumeCount; n++) {
    if (!vols.some((v) => v.volumeNumber === n)) {
      const r = await J('POST', `/books/${bookId}/volumes`, { title: `第${n}卷`, volumeNumber: n });
      if (!r.body?.data) throw new Error(`创建第${n}卷失败: ${r.status}`);
      vols = (await J('GET', `/books/${bookId}/volumes`)).body.data;
    }
  }
  const first = vols.find((v) => v.volumeNumber === 1);
  let chs = (await J('GET', `/volumes/${first.id}/chapters`)).body.data || [];
  for (let n = 1; n <= chaptersOfFirst; n++) {
    if (!chs.some((c) => c.chapterNumber === n)) {
      const r = await J('POST', `/volumes/${first.id}/chapters`, { title: `第${n}章 测试`, chapterNumber: n });
      if (!r.body?.data) throw new Error(`创建第${n}章失败: ${r.status}`);
      chs = (await J('GET', `/volumes/${first.id}/chapters`)).body.data;
    }
  }
  return { volumes: vols, chapters: chs };
}
