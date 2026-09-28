// 删除本会话中失败尝试遗留的测试作品（通过修好的级联接口，不用直接改库）
const API = 'http://localhost:3000/api/v1';
const TARGETS = ['级联删除验证用书', '纲树结构验证', '纲树界面统一验证', '细纲对齐验证', '角色子项验证'];

async function main() {
  const login = await (await fetch(`${API}/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@novel.com', password: 'demo123456' }),
  })).json();
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${login.data.accessToken}` };

  const books = (await (await fetch(`${API}/books`, { headers: H })).json()).data;
  let n = 0;
  for (const b of books) {
    if (!TARGETS.includes(b.title)) continue;
    const r = await fetch(`${API}/books/${b.id}`, { method: 'DELETE', headers: H });
    console.log(`${r.ok ? '已删除' : '删除失败(' + r.status + ')'}: ${b.title} ${b.id.slice(0, 8)}`);
    if (r.ok) n++;
  }
  const left = (await (await fetch(`${API}/books`, { headers: H })).json()).data;
  console.log(`\n共删除 ${n} 本；剩余作品:`, left.map(b => b.title).join(', ') || '（无）');
}

main().catch(e => { console.error('失败:', e.message); process.exit(1); });
