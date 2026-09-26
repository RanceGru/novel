// Agent 调用面板
import { useState, useEffect } from 'react';
import { apiClient } from '../../services/api.service';
import { Loader2 } from 'lucide-react';

export default function AgentPanel() {
  const [agents, setAgents] = useState<any[]>([]);
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState('');
  const [input, setInput] = useState('');

  useEffect(() => {
    apiClient.get('/ai/agents').then(r => setAgents(r.data.data || [])).catch(() => {});
  }, []);

  const callAgent = async (name: string) => {
    setLoading(name); setResult(null);
    try {
      const r = await apiClient.post(`/ai/agents/${name}`, { chapterOutline: input || '需要生成章纲' });
      setResult(r.data.data);
    } catch (e: any) { setResult({ error: e.message }); }
    setLoading('');
  };

  return (
    <div className="text-xs h-full flex flex-col">
      <div className="px-3 py-1.5 border-b border-border-primary font-semibold text-text-tertiary">🤖 AI Agents</div>
      <div className="p-2">
        <textarea className="w-full p-1.5 border rounded text-xs h-16" placeholder="输入指令（如：需要生成武侠小说章纲）"
          value={input} onChange={e => setInput(e.target.value)} />
        <div className="grid grid-cols-2 gap-1 mt-1">
          {agents.filter((a: any) => a.available).map((a: any) => (
            <button key={a.name}
              onClick={() => callAgent(a.name)}
              disabled={loading === a.name}
              className="p-1.5 border border-border-primary rounded hover:bg-bg-hover text-left disabled:opacity-50">
              {loading === a.name ? <Loader2 size={12} className="animate-spin inline" /> : null}
              <div className="font-medium">{a.name}</div>
              <div className="text-text-tertiary text-[10px]">{a.description}</div>
            </button>
          ))}
        </div>
      </div>
      {result && (
        <div className="flex-1 overflow-y-auto p-2 border-t border-border-primary">
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      {agents.length === 0 && (
        <div className="p-3 text-text-tertiary">加载中...</div>
      )}
    </div>
  );
}
